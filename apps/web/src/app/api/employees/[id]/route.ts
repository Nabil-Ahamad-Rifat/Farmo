import { employeeSchema } from '@farm/shared-validation';
import { farmToday } from '@farm/business-logic';
import { db } from '@/lib/db';
import { withAuth, getIdFromParams } from '@/lib/middleware/withAuth';
import { findWorker, getWorkerDetail, payDay } from '@/lib/payroll';

export const GET = withAuth(async (req, { tenantId }, routeContext) => {
  try {
    const id = await getIdFromParams(routeContext, req);
    const detail = id ? await getWorkerDetail(tenantId, id) : null;
    if (!detail) return Response.json({ error: 'Employee not found' }, { status: 404 });
    return Response.json(detail);
  } catch (err: unknown) {
    console.error('Error fetching employee:', err);
    return Response.json({ error: 'Failed to load employee' }, { status: 500 });
  }
});

// Edit a worker. Fields not sent keep their value (older mobile builds send
// only some). A new salary or day rate applies from `rateFrom` (default today);
// days before it keep the old rate.
export const PUT = withAuth(async (req, { tenantId }, routeContext) => {
  try {
    const existing = await findWorker(tenantId, await getIdFromParams(routeContext, req));
    if (!existing) return Response.json({ error: 'Employee not found' }, { status: 404 });

    const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    const current = {
      name: existing.name,
      role: existing.role,
      phone: existing.phone ?? '',
      email: existing.email ?? '',
      payType: existing.payType ?? 'monthly',
      salary: existing.salary,
      dailyRate: existing.dailyRate ?? undefined,
      joinDate: (existing.joinDate ?? existing.createdAt).toISOString().slice(0, 10),
    };
    const sent = Object.fromEntries(Object.entries(body).filter(([k, v]) => k in current || (k === 'rateFrom' && v)));
    // Older mobile builds send an empty joinDate when none was set.
    if (sent.joinDate === '' || sent.joinDate === null) delete sent.joinDate;
    const parsed = employeeSchema.safeParse({ ...current, ...sent });
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? 'Invalid worker' }, { status: 400 });
    }
    const e = parsed.data;
    const daily = e.payType === 'daily';
    const rateChanged =
      e.payType !== current.payType || (daily ? e.dailyRate !== existing.dailyRate : e.salary !== existing.salary);
    const rateFrom = payDay(e.rateFrom ?? farmToday());

    await db.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id: existing.id },
        data: {
          name: e.name,
          role: e.role,
          phone: e.phone ?? null,
          email: e.email ?? null,
          payType: e.payType,
          salary: daily ? 0 : e.salary!,
          dailyRate: daily ? e.dailyRate! : null,
          joinDate: payDay(e.joinDate),
          // Older mobile builds mark a worker who left with status "terminated".
          ...(body.status === 'terminated' && !existing.leftDate ? { status: 'left', leftDate: payDay(farmToday()) } : {}),
        },
      });
      if (rateChanged) {
        // One rate per day: a second change on the same day replaces the first.
        await tx.payRate.deleteMany({ where: { employeeId: existing.id, from: rateFrom } });
        await tx.payRate.create({
          data: {
            tenantId,
            employeeId: existing.id,
            from: rateFrom,
            monthlySalary: daily ? null : e.salary!,
            dailyRate: daily ? e.dailyRate! : null,
          },
        });
      }
    });

    return Response.json(await getWorkerDetail(tenantId, existing.id));
  } catch (err: unknown) {
    console.error('Error updating employee:', err);
    return Response.json({ error: 'Failed to update employee' }, { status: 500 });
  }
});

// A worker who was paid keeps their history: mark them as left instead.
export const DELETE = withAuth(async (req, { tenantId }, routeContext) => {
  try {
    const existing = await findWorker(tenantId, await getIdFromParams(routeContext, req));
    if (!existing) return Response.json({ success: true });

    const [payments, work] = await Promise.all([
      db.salaryPayment.count({ where: { employeeId: existing.id } }),
      db.workEntry.count({ where: { employeeId: existing.id } }),
    ]);
    if (payments + work > 0) {
      return Response.json(
        { error: `${existing.name} has pay records. Mark them as left instead of deleting, so the money history stays correct.` },
        { status: 409 },
      );
    }

    await db.$transaction([
      db.payRate.deleteMany({ where: { employeeId: existing.id } }),
      db.employeeAbsence.deleteMany({ where: { employeeId: existing.id } }),
      db.employee.delete({ where: { id: existing.id } }),
    ]);
    return Response.json({ success: true });
  } catch (err: unknown) {
    console.error('Error deleting employee:', err);
    return Response.json({ error: 'Failed to delete employee' }, { status: 500 });
  }
});
