import { paymentSchema } from '@farm/shared-validation';
import { db } from '@/lib/db';
import { withAuth, getIdFromParams } from '@/lib/middleware/withAuth';
import { dayToDate } from '@/lib/receivables';
import { recomputeSupplier } from '@/lib/payables';

export const PUT = withAuth(async (req, { tenantId }, routeContext) => {
  try {
    const id = await getIdFromParams(routeContext, req);
    if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });

    const parsed = paymentSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? 'Invalid payment' }, { status: 400 });
    }

    const existing = await db.supplierPayment.findFirst({ where: { id, tenantId } });
    if (!existing) return Response.json({ error: 'Payment not found' }, { status: 404 });

    const { amount, method, note, paidAt } = parsed.data;
    const payment = await db.$transaction(async (tx) => {
      const payment = await tx.supplierPayment.update({
        where: { id },
        data: { amount, method, note: note ?? null, paidAt: dayToDate(paidAt, existing.paidAt) },
      });
      await recomputeSupplier(tx, tenantId, existing.supplierId);
      return payment;
    });

    return Response.json(payment);
  } catch (err: unknown) {
    console.error('Error updating supplier payment:', err);
    return Response.json({ error: 'Failed to update payment' }, { status: 500 });
  }
});

export const DELETE = withAuth(async (req, { tenantId }, routeContext) => {
  try {
    const id = await getIdFromParams(routeContext, req);
    if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });

    const existing = await db.supplierPayment.findFirst({ where: { id, tenantId } });
    if (!existing) return Response.json({ error: 'Payment not found' }, { status: 404 });

    await db.$transaction(async (tx) => {
      await tx.supplierPayment.delete({ where: { id } });
      await recomputeSupplier(tx, tenantId, existing.supplierId);
    });

    return Response.json({ success: true });
  } catch (err: unknown) {
    console.error('Error deleting supplier payment:', err);
    return Response.json({ error: 'Failed to delete payment' }, { status: 500 });
  }
});
