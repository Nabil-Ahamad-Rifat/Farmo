import { db } from '@/lib/db';
import { withAuth, getIdFromParams } from '@/lib/middleware/withAuth';
import { withIdempotency } from '@/lib/idempotency';
import { findWorker, getWorkerDetail, payDay } from '@/lib/payroll';

// Give up an advance the worker will not pay back (e.g. left without notice).
// The amount becomes a loss in the reports and the balance returns to zero.
export const POST = withAuth(async (req, { tenantId, userId }, routeContext) => withIdempotency(req, tenantId, 'employees:writeoff', async () => {
  try {
    const worker = await findWorker(tenantId, await getIdFromParams(routeContext, req));
    if (!worker) return Response.json({ error: 'Employee not found' }, { status: 404 });

    const detail = await getWorkerDetail(tenantId, worker.id);
    const owed = -(detail?.account.balance ?? 0);
    if (owed <= 0) return Response.json({ error: 'This worker does not owe the farm anything' }, { status: 400 });

    const body = ((await req.json().catch(() => null)) ?? {}) as { note?: unknown };
    await db.salaryPayment.create({
      data: { createdById: userId,
        tenantId,
        employeeId: worker.id,
        kind: 'writeoff',
        amount: owed,
        paidAt: payDay(),
        note: typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 300) : 'Advance written off',
      },
    });
    return Response.json(await getWorkerDetail(tenantId, worker.id), { status: 201 });
  } catch (err: unknown) {
    console.error('Error writing off advance:', err);
    return Response.json({ error: 'Failed to write off' }, { status: 500 });
  }
}));
