import { paymentSchema } from '@farm/shared-validation';
import { db } from '@/lib/db';
import { withAuth, getIdFromParams } from '@/lib/middleware/withAuth';
import { withIdempotency } from '@/lib/idempotency';
import { dayToDate } from '@/lib/receivables';
import { recomputeSupplier } from '@/lib/payables';

// Record money paid to a supplier. It is applied to the oldest unpaid
// purchases first; anything left over becomes advance with that supplier.
export const POST = withAuth(async (req, { tenantId, userId }, routeContext) => withIdempotency(req, tenantId, 'suppliers:payment', async () => {
  try {
    const supplierId = await getIdFromParams(routeContext, req);
    if (!supplierId) return Response.json({ error: 'Missing id' }, { status: 400 });

    const parsed = paymentSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? 'Invalid payment' }, { status: 400 });
    }

    const supplier = await db.supplier.findFirst({ where: { id: supplierId, tenantId } });
    if (!supplier) return Response.json({ error: 'Supplier not found' }, { status: 404 });

    const { amount, method, note, paidAt } = parsed.data;
    const { payment, balance } = await db.$transaction(async (tx) => {
      const payment = await tx.supplierPayment.create({
        data: { createdById: userId, tenantId, supplierId, amount, method, note: note ?? null, paidAt: dayToDate(paidAt) },
      });
      const balance = await recomputeSupplier(tx, tenantId, supplierId);
      return { payment, balance };
    });

    return Response.json({ payment, totalDue: balance.totalDue, advance: balance.advance }, { status: 201 });
  } catch (err: unknown) {
    console.error('Error recording supplier payment:', err);
    return Response.json({ error: 'Failed to record payment' }, { status: 500 });
  }
}));
