import { absenceSchema } from '@farm/shared-validation';
import { addDaysIso } from '@farm/business-logic';
import { db } from '@/lib/db';
import { withAuth, getIdFromParams } from '@/lib/middleware/withAuth';
import { findWorker, getWorkerDetail, payDay } from '@/lib/payroll';

// Mark a monthly worker absent for one day or a range (unpaid days).
// Days already marked are left as they are.
export const POST = withAuth(async (req, { tenantId, userId }, routeContext) => {
  try {
    const worker = await findWorker(tenantId, await getIdFromParams(routeContext, req));
    if (!worker) return Response.json({ error: 'Employee not found' }, { status: 404 });
    if (worker.payType === 'daily') {
      return Response.json({ error: 'Daily workers are paid only for the work you add, so absences are not needed' }, { status: 400 });
    }

    const parsed = absenceSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? 'Invalid absence' }, { status: 400 });
    }
    const a = parsed.data;
    const days: string[] = [];
    for (let d = a.from; d <= (a.to ?? a.from); d = addDaysIso(d + 'T12:00:00Z', 1)) days.push(d);

    const taken = new Set(
      (await db.employeeAbsence.findMany({ where: { employeeId: worker.id, date: { in: days.map((d) => payDay(d)) } }, select: { date: true } })).map(
        (x) => x.date.toISOString().slice(0, 10),
      ),
    );
    const fresh = days.filter((d) => !taken.has(d));
    if (fresh.length) {
      await db.employeeAbsence.createMany({
        data: fresh.map((d) => ({ createdById: userId, tenantId, employeeId: worker.id, date: payDay(d), note: a.note ?? null })),
      });
    }
    return Response.json({ added: fresh.length, worker: await getWorkerDetail(tenantId, worker.id) }, { status: 201 });
  } catch (err: unknown) {
    console.error('Error marking absence:', err);
    return Response.json({ error: 'Failed to mark absence' }, { status: 500 });
  }
});
