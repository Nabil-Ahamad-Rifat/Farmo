import { feedPurchaseSchema } from '@farm/shared-validation';
import { storedFeedRemaining } from '@farm/business-logic';
import { db } from '@/lib/db';
import { withAuth, getIdFromParams } from '@/lib/middleware/withAuth';
import { dayToDate } from '@/lib/receivables';
import {
  feedInclude, findOrCreateSupplierByName, presentFeed, purchaseDate, purchaseTotal, recomputeSupplier,
} from '@/lib/payables';

export const GET = withAuth(async (req, { tenantId }, routeContext) => {
  const id = await getIdFromParams(routeContext, req);
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });

  const feed = await db.feedBatch.findFirst({ where: { id, tenantId }, include: feedInclude });
  if (!feed) return Response.json({ error: 'Feed batch not found' }, { status: 404 });

  return Response.json(presentFeed(feed));
});

export const PUT = withAuth(async (req, { tenantId, userId }, routeContext) => {
  try {
    const id = await getIdFromParams(routeContext, req);
    if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const parsed = feedPurchaseSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? 'Invalid feed batch' }, { status: 400 });
    }
    const f = parsed.data;

    const existing = await db.feedBatch.findFirst({ where: { id, tenantId } });
    if (!existing) return Response.json({ error: 'Feed batch not found' }, { status: 404 });

    if (f.supplierId && f.supplierId !== existing.supplierId) {
      const exists = await db.supplier.findFirst({ where: { id: f.supplierId, tenantId } });
      if (!exists) return Response.json({ error: 'Supplier not found' }, { status: 404 });
    }

    // Fields older mobile builds don't send keep their saved values. Sending
    // coverDays as null or blank means "don't know" (clears the days).
    const coverDays = body && 'coverDays' in body ? f.coverDays ?? null : existing.coverDays;
    const purchasedAt = f.purchasedAt ? dayToDate(f.purchasedAt) : existing.purchasedAt;
    const next = { quantity: f.quantity, unitPrice: f.unitPrice, coverDays, purchasedAt, createdAt: existing.createdAt };
    // Clients send the stock left now (what GET returned); store it with the daily use so far added back.
    const remainingQuantity = f.remainingQuantity === undefined
      ? Math.min(existing.remainingQuantity, f.quantity)
      : storedFeedRemaining(next, f.remainingQuantity);

    const updated = await db.$transaction(async (tx) => {
      let supplierId = existing.supplierId;
      if (f.supplierId) supplierId = f.supplierId;
      else if (f.supplierName) supplierId = (await findOrCreateSupplierByName(tx, tenantId, f.supplierName)).id;

      // A batch from before supplier tracking was paid in full: keep it that way when linking it.
      if (!existing.supplierId && supplierId) {
        await tx.supplierPayment.create({
          data: { createdById: userId,
            tenantId,
            supplierId,
            amount: purchaseTotal(existing),
            note: 'Paid before supplier tracking',
            paidAt: purchaseDate(existing),
          },
        });
      }

      await tx.feedBatch.update({
        where: { id },
        data: {
          name: f.name,
          quantity: f.quantity,
          unitPrice: f.unitPrice,
          remainingQuantity,
          coverDays,
          purchasedAt,
          supplierId,
          ...(supplierId ? {} : { paidAmount: purchaseTotal(f), payStatus: 'paid' }),
        },
      });

      if (supplierId) await recomputeSupplier(tx, tenantId, supplierId);
      if (existing.supplierId && existing.supplierId !== supplierId) {
        await recomputeSupplier(tx, tenantId, existing.supplierId);
      }
      return tx.feedBatch.findUniqueOrThrow({ where: { id }, include: feedInclude });
    });

    return Response.json(presentFeed(updated));
  } catch (err: unknown) {
    console.error('Error updating feed batch:', err);
    return Response.json({ error: 'Failed to save feed batch' }, { status: 500 });
  }
});

export const DELETE = withAuth(async (req, { tenantId }, routeContext) => {
  try {
    const id = await getIdFromParams(routeContext, req);
    if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });

    const batch = await db.feedBatch.findFirst({ where: { id, tenantId } });
    if (!batch) return Response.json({ success: true });

    await db.$transaction(async (tx) => {
      await tx.feedBatch.delete({ where: { id } });
      // Payments stay with the supplier; what they covered rolls onto other purchases (or becomes advance).
      if (batch.supplierId) await recomputeSupplier(tx, tenantId, batch.supplierId);
    });

    return Response.json({ success: true });
  } catch (err: unknown) {
    console.error('Error deleting feed batch:', err);
    return Response.json({ error: 'Failed to delete feed batch' }, { status: 500 });
  }
});
