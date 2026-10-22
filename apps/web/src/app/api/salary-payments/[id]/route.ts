import { workerPaymentSchema } from '@farm/shared-validation';
import { farmToday } from '@farm/business-logic';
import { db } from '@/lib/db';
import { withAuth, getIdFromParams } from '@/lib/middleware/withAuth';
import { isObjectId } from '@/lib/receivables';
import { payDay } from '@/lib/payroll';

async function findPayment(tenantId: string, id: string | null) {
  if (!id || !isObjectId(id)) return null;
  return db.salaryPayment.findFirst({ where: { id, employee: { tenantId } } });
}

// Fix a payment or write-off (amount, day, note).
export const PUT = withAuth(async (req, { tenantId }, routeContext) => {
  try {
    const existing = await findPayment(tenantId, await getIdFromParams(routeContext, req));
    if (!existing) return Response.json({ error: 'Payment not found' }, { status: 404 });

    const parsed = workerPaymentSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? 'Invalid payment' }, { status: 400 });
    }
    const p = parsed.data;
    if (p.paidAt && p.paidAt > farmToday()) return Response.json({ error: 'The payment date cannot be in the future' }, { status: 400 });

    const payment = await db.salaryPayment.update({
      where: { id: existing.id },
      data: { amount: p.amount, paidAt: p.paidAt ? payDay(p.paidAt) : existing.paidAt, note: p.note ?? null, tenantId },
    });
    return Response.json(payment);
  } catch (err: unknown) {
    console.error('Error updating worker payment:', err);
    return Response.json({ error: 'Failed to save payment' }, { status: 500 });
  }
});

export const DELETE = withAuth(async (req, { tenantId }, routeContext) => {
  try {
    const existing = await findPayment(tenantId, await getIdFromParams(routeContext, req));
    if (!existing) return Response.json({ error: 'Payment not found' }, { status: 404 });
    await db.salaryPayment.delete({ where: { id: existing.id } });
    return Response.json({ success: true });
  } catch (err: unknown) {
    console.error('Error deleting worker payment:', err);
    return Response.json({ error: 'Failed to delete payment' }, { status: 500 });
  }
});
