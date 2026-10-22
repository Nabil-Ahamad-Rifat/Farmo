import { db } from '@/lib/db';
import { withAuth, getIdFromParams } from '@/lib/middleware/withAuth';
import { withIdempotency } from '@/lib/idempotency';
import { findWorker, payDay } from '@/lib/payroll';

// Kept for older mobile builds; new clients use /api/employees/[id] (history)
// and /api/employees/[id]/payments.
export const GET = withAuth(async (req, { tenantId }, routeContext) => {
  try {
    const worker = await findWorker(tenantId, await getIdFromParams(routeContext, req));
    if (!worker) return Response.json({ error: 'Employee not found' }, { status: 404 });
    const payments = await db.salaryPayment.findMany({ where: { employeeId: worker.id }, orderBy: { paidAt: 'desc' } });
    return Response.json(payments);
  } catch (err: unknown) {
    console.error('Error listing salary payments:', err);
    return Response.json({ error: 'Failed to load salary payments' }, { status: 500 });
  }
});

// Older builds send a month/year with each payment; it is kept as a note only.
export const POST = withAuth(async (req, { tenantId, userId }, routeContext) => withIdempotency(req, tenantId, 'salary:create', async () => {
  try {
    const worker = await findWorker(tenantId, await getIdFromParams(routeContext, req));
    if (!worker) return Response.json({ error: 'Employee not found' }, { status: 404 });

    const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    const amount = parseFloat(String(body.amount));
    if (!Number.isFinite(amount) || amount <= 0) {
      return Response.json({ error: 'Valid payment amount is required' }, { status: 400 });
    }
    const month = parseInt(String(body.periodMonth));
    const year = parseInt(String(body.periodYear));
    const validPeriod = month >= 1 && month <= 12 && year >= 2000 && year <= 2100;
    const day = typeof body.paidAt === 'string' && /^\d{4}-\d{2}-\d{2}/.test(body.paidAt) ? body.paidAt.slice(0, 10) : undefined;

    const payment = await db.salaryPayment.create({
      data: { createdById: userId,
        tenantId,
        employeeId: worker.id,
        kind: 'payment',
        amount,
        periodMonth: validPeriod ? month : null,
        periodYear: validPeriod ? year : null,
        note: typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 300) : null,
        paidAt: payDay(day),
      },
    });
    return Response.json(payment, { status: 201 });
  } catch (err: unknown) {
    console.error('Error processing salary:', err);
    return Response.json({ error: 'Failed to record salary payment' }, { status: 500 });
  }
}));
