import { feedUsageSchema } from '@farm/shared-validation';
import { db } from '@/lib/db';
import { withAuth } from '@/lib/middleware/withAuth';
import { withIdempotency } from '@/lib/idempotency';
import { presentFeed } from '@/lib/payables';

// GET /api/feed/usage - list all feed usages
export const GET = withAuth(async (_req, { tenantId }) => {
  try {
    const usages = await db.feedUsage.findMany({
      where: { feedBatch: { tenantId } },
      include: { feedBatch: { select: { name: true, unitPrice: true } } },
      orderBy: { usedAt: 'desc' },
    });
    return Response.json(usages);
  } catch (err: unknown) {
    console.error('Error loading feed usage:', err);
    return Response.json({ error: 'Failed to load feed usage' }, { status: 500 });
  }
});

// POST /api/feed/usage - record feed usage
export const POST = withAuth(async (req, { tenantId }) => withIdempotency(req, tenantId, 'feed-usage:create', async () => {
  try {
    const parsed = feedUsageSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      const field = parsed.error.issues[0]?.path[0];
      if (field === 'feedBatchId') return Response.json({ error: 'Feed batch not found' }, { status: 404 });
      if (field === 'quantity') return Response.json({ error: 'A valid usage quantity greater than zero is required' }, { status: 400 });
      return Response.json({ error: 'feedBatchId and quantity are required' }, { status: 400 });
    }
    const { feedBatchId, quantity: qtyNum, note, usedAt } = parsed.data;

    // Verify feedBatch belongs to tenant
    const batch = await db.feedBatch.findFirst({ where: { id: feedBatchId, tenantId } });
    if (!batch) return Response.json({ error: 'Feed batch not found' }, { status: 404 });

    // For a scheduled batch the stock left now is below the saved value (the daily use is
    // worked out from the date). Extra use on it moves stock only; its cost is spread by day.
    const available = presentFeed(batch).remainingQuantity;
    if (qtyNum > available) {
      return Response.json({ error: `Insufficient stock. Only ${available} kg remaining.` }, { status: 400 });
    }

    const [usage] = await db.$transaction([
      db.feedUsage.create({
        data: {
          feedBatchId,
          quantity: qtyNum,
          note: note || null,
          usedAt: usedAt ? new Date(usedAt) : new Date(),
        },
      }),
      db.feedBatch.update({
        where: { id: feedBatchId },
        data: { remainingQuantity: batch.remainingQuantity - qtyNum },
      }),
    ]);

    return Response.json(usage, { status: 201 });
  } catch (err: unknown) {
    console.error('Error recording feed usage:', err);
    return Response.json({ error: 'Failed to record feed usage' }, { status: 500 });
  }
}));
