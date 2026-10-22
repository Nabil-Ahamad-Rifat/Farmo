import { workEntrySchema } from '@farm/shared-validation';
import { farmToday } from '@farm/business-logic';
import { db } from '@/lib/db';
import { withAuth, getIdFromParams } from '@/lib/middleware/withAuth';
import { withIdempotency } from '@/lib/idempotency';
import { findWorker, getWorkerDetail, payDay } from '@/lib/payroll';

// Add work done by a daily worker (e.g. 3 days). The rate defaults to theirs.
export const POST = withAuth(async (req, { tenantId, userId }, routeContext) => withIdempotency(req, tenantId, 'employees:work', async () => {
  try {
    const worker = await findWorker(tenantId, await getIdFromParams(routeContext, req));
    if (!worker) return Response.json({ error: 'Employee not found' }, { status: 404 });
    if (worker.payType !== 'daily') {
      return Response.json({ error: 'Monthly workers are paid for every day; mark absences instead' }, { status: 400 });
    }

    const parsed = workEntrySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? 'Invalid work entry' }, { status: 400 });
    }
    const w = parsed.data;
    if (w.date > farmToday()) return Response.json({ error: 'The work date cannot be in the future' }, { status: 400 });
    const rate = w.rate ?? worker.dailyRate ?? 0;
    if (rate <= 0) return Response.json({ error: 'Set a day rate for this worker first' }, { status: 400 });

    const entry = await db.workEntry.create({
      data: { createdById: userId, tenantId, employeeId: worker.id, date: payDay(w.date), days: w.days, rate, note: w.note ?? null },
    });
    return Response.json({ entry, worker: await getWorkerDetail(tenantId, worker.id) }, { status: 201 });
  } catch (err: unknown) {
    console.error('Error adding work:', err);
    return Response.json({ error: 'Failed to add work' }, { status: 500 });
  }
}));
