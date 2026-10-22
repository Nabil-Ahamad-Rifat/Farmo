import { employeeSchema } from '@farm/shared-validation';
import { db } from '@/lib/db';
import { withAuth } from '@/lib/middleware/withAuth';
import { withIdempotency } from '@/lib/idempotency';
import { getWorkerDetail, listWorkers, payDay } from '@/lib/payroll';

export const GET = withAuth(async (_req, { tenantId }) => {
  try {
    return Response.json(await listWorkers(tenantId));
  } catch (err: unknown) {
    console.error('Error listing employees:', err);
    return Response.json({ error: 'Failed to load employees' }, { status: 500 });
  }
});

// Add a worker. Their pay rate is recorded from the day they started.
export const POST = withAuth(async (req, { tenantId }) => withIdempotency(req, tenantId, 'employees:create', async () => {
  try {
    const parsed = employeeSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? 'Invalid worker' }, { status: 400 });
    }
    const e = parsed.data;
    const daily = e.payType === 'daily';
    const start = payDay(e.joinDate);

    const id = await db.$transaction(async (tx) => {
      const created = await tx.employee.create({
        data: {
          tenantId,
          name: e.name,
          role: e.role,
          phone: e.phone ?? null,
          email: e.email ?? null,
          payType: e.payType,
          salary: daily ? 0 : e.salary!,
          dailyRate: daily ? e.dailyRate! : null,
          joinDate: start,
          status: 'active',
        },
      });
      await tx.payRate.create({
        data: { tenantId, employeeId: created.id, from: start, monthlySalary: daily ? null : e.salary!, dailyRate: daily ? e.dailyRate! : null },
      });
      return created.id;
    });

    return Response.json(await getWorkerDetail(tenantId, id), { status: 201 });
  } catch (err: unknown) {
    console.error('Error creating employee:', err);
    return Response.json({ error: 'Failed to create employee' }, { status: 500 });
  }
}));
