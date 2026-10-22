import { feedPurchaseSchema } from '@farm/shared-validation';
import { storedFeedRemaining } from '@farm/business-logic';
import { db } from '@/lib/db';
import { withAuth } from '@/lib/middleware/withAuth';
import { withIdempotency } from '@/lib/idempotency';
import { dayToDate } from '@/lib/receivables';
import {
  feedInclude, findOrCreateSupplierByName, listFeed, presentFeed, purchaseTotal, recomputeSupplier,
} from '@/lib/payables';

export const GET = withAuth(async (_req, { tenantId }) => {
  try {
    return Response.json(await listFeed(tenantId));
  } catch (err: unknown) {
    console.error('Error listing feed:', err);
    return Response.json({ error: 'Failed to load feed' }, { status: 500 });
  }
});

export const POST = withAuth(async (req, { tenantId, userId }) => withIdempotency(req, tenantId, 'feed:create', async () => {
  try {
    const parsed = feedPurchaseSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? 'Invalid feed purchase' }, { status: 400 });
    }
    const f = parsed.data;

    if (f.supplierId) {
      const exists = await db.supplier.findFirst({ where: { id: f.supplierId, tenantId } });
      if (!exists) return Response.json({ error: 'Supplier not found' }, { status: 404 });
    }

    const total = purchaseTotal(f);
    // Older mobile builds send no paidNow: that has always meant a fully paid batch.
    const paidNow = f.paidNow ?? total;
    const purchasedAt = dayToDate(f.purchasedAt);
    const coverDays = f.coverDays ?? null;
    // The form's "remaining" is the stock left now; store it with the daily use so far added back.
    const remainingQuantity = f.remainingQuantity === undefined
      ? f.quantity
      : storedFeedRemaining({ ...f, coverDays, purchasedAt }, f.remainingQuantity);

    const batch = await db.$transaction(async (tx) => {
      const supplier = f.supplierId
        ? await tx.supplier.findFirstOrThrow({ where: { id: f.supplierId, tenantId } })
        : f.supplierName
          ? await findOrCreateSupplierByName(tx, tenantId, f.supplierName)
          : null;

      const created = await tx.feedBatch.create({
        data: { createdById: userId,
          tenantId,
          name: f.name,
          quantity: f.quantity,
          unitPrice: f.unitPrice,
          remainingQuantity,
          coverDays,
          purchasedAt,
          supplierId: supplier?.id ?? null,
          // Without a supplier there is nobody to owe, so it can only be fully paid.
          paidAmount: supplier ? 0 : total,
          payStatus: supplier ? 'pending' : 'paid',
        },
      });

      if (supplier) {
        if (paidNow > 0) {
          await tx.supplierPayment.create({
            data: { createdById: userId,
              tenantId,
              supplierId: supplier.id,
              amount: paidNow,
              method: f.paymentMethod ?? 'cash',
              note: 'Paid at time of purchase',
              paidAt: purchasedAt,
            },
          });
        }
        await recomputeSupplier(tx, tenantId, supplier.id);
      }
      return tx.feedBatch.findUniqueOrThrow({ where: { id: created.id }, include: feedInclude });
    });

    return Response.json(presentFeed(batch), { status: 201 });
  } catch (err: unknown) {
    console.error('Error creating feed batch:', err);
    return Response.json({ error: 'Failed to save feed batch' }, { status: 500 });
  }
}));
