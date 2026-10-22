import { paymentSchema } from '@farm/shared-validation';
import { db } from '@/lib/db';
import { withAuth, getIdFromParams } from '@/lib/middleware/withAuth';
import { withIdempotency } from '@/lib/idempotency';
import { recomputeCustomer, dayToDate } from '@/lib/receivables';

// Record money received from a customer. It is applied to their oldest unpaid
// sales first; anything left over becomes advance credit.
export const POST = withAuth(async (req, { tenantId, userId }, routeContext) => withIdempotency(req, tenantId, 'customers:payment', async () => {
  try {
    const customerId = await getIdFromParams(routeContext, req);
    if (!customerId) return Response.json({ error: 'Missing id' }, { status: 400 });

    const parsed = paymentSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? 'Invalid payment' }, { status: 400 });
    }

    const customer = await db.customer.findFirst({ where: { id: customerId, tenantId } });
    if (!customer) return Response.json({ error: 'Customer not found' }, { status: 404 });

    const { amount, method, note, paidAt } = parsed.data;
    const { payment, balance } = await db.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: { createdById: userId, tenantId, customerId, amount, method, note: note ?? null, paidAt: dayToDate(paidAt) },
      });
      const balance = await recomputeCustomer(tx, tenantId, customerId);
      return { payment, balance };
    });

    return Response.json({ payment, totalDue: balance.totalDue, advance: balance.advance }, { status: 201 });
  } catch (err: unknown) {
    console.error('Error recording payment:', err);
    return Response.json({ error: 'Failed to record payment' }, { status: 500 });
  }
}));
