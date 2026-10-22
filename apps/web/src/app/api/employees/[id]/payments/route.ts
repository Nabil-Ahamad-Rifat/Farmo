import { workerPaymentSchema } from '@farm/shared-validation';
import { farmToday } from '@farm/business-logic';
import { db } from '@/lib/db';
import { withAuth, getIdFromParams } from '@/lib/middleware/withAuth';
import { withIdempotency } from '@/lib/idempotency';
import { findWorker, getWorkerDetail, payDay } from '@/lib/payroll';

// Give money to a worker: any amount on any day (an advance or wages).
export const POST = withAuth(async (req, { tenantId, userId }, routeContext) => withIdempotency(req, tenantId, 'employees:payment', async () => {
  try {
    const worker = await findWorker(tenantId, await getIdFromParams(routeContext, req));
    if (!worker) return Response.json({ error: 'Employee not found' }, { status: 404 });

    const parsed = workerPaymentSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? 'Invalid payment' }, { status: 400 });
    }
    const p = parsed.data;
    if (p.paidAt && p.paidAt > farmToday()) return Response.json({ error: 'The payment date cannot be in the future' }, { status: 400 });

    const payment = await db.salaryPayment.create({
      data: { createdById: userId, tenantId, employeeId: worker.id, kind: 'payment', amount: p.amount, paidAt: payDay(p.paidAt), note: p.note ?? null },
    });
    return Response.json({ payment, worker: await getWorkerDetail(tenantId, worker.id) }, { status: 201 });
  } catch (err: unknown) {
    console.error('Error recording worker payment:', err);
    return Response.json({ error: 'Failed to record payment' }, { status: 500 });
  }
}));
