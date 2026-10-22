import { leaveSchema } from '@farm/shared-validation';
import { farmToday } from '@farm/business-logic';
import { db } from '@/lib/db';
import { withAuth, getIdFromParams } from '@/lib/middleware/withAuth';
import { findWorker, getWorkerDetail, payDay } from '@/lib/payroll';

// Mark the day a worker left (pay stops after it), or clear it when they come back.
// The response's account shows the final settlement.
export const POST = withAuth(async (req, { tenantId }, routeContext) => {
  try {
    const worker = await findWorker(tenantId, await getIdFromParams(routeContext, req));
    if (!worker) return Response.json({ error: 'Employee not found' }, { status: 404 });

    const parsed = leaveSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? 'Invalid date' }, { status: 400 });
    }
    const { leftDate } = parsed.data;
    if (leftDate) {
      if (leftDate > farmToday()) return Response.json({ error: 'The leaving date cannot be in the future' }, { status: 400 });
      const start = (worker.joinDate ?? worker.createdAt).toISOString().slice(0, 10);
      if (leftDate < start) return Response.json({ error: 'The leaving date cannot be before the start date' }, { status: 400 });
    }

    await db.employee.update({
      where: { id: worker.id },
      data: leftDate ? { status: 'left', leftDate: payDay(leftDate) } : { status: 'active', leftDate: null },
    });
    return Response.json(await getWorkerDetail(tenantId, worker.id));
  } catch (err: unknown) {
    console.error('Error marking worker as left:', err);
    return Response.json({ error: 'Failed to save' }, { status: 500 });
  }
});
