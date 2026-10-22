// Worker pay accounts: what each worker earned (salary / 30 per day, minus
// absent days; or days x rate for daily workers), what they were given, and
// the balance. The maths lives in @farm/business-logic; this loads the records.
import type { Employee, Prisma } from '@prisma/client';
import { farmToday, workerAccount, workerMonths, type WorkerLike } from '@farm/business-logic';
import { db } from '@/lib/db';
import { isObjectId } from '@/lib/receivables';

/** "YYYY-MM-DD" -> noon UTC that day; blank means today on the farm's clock. */
export const payDay = (day?: string | null) => new Date((day || farmToday()) + 'T12:00:00Z');

/** Older documents: no payType means monthly; "terminated" means left; "on_leave" is still working. */
export const workerStatus = (e: Pick<Employee, 'status' | 'leftDate'>) =>
  e.status === 'left' || e.status === 'terminated' || e.leftDate ? 'left' : 'active';

type WorkerRecords = {
  rates: { from: Date; monthlySalary: number | null; dailyRate: number | null }[];
  absences: { date: Date }[];
  work: { date: Date; days: number; rate: number }[];
  payments: { amount: number; paidAt: Date; kind: string | null }[];
};

function toWorker(e: Employee, r: WorkerRecords): WorkerLike {
  return {
    payType: e.payType ?? 'monthly',
    joinDate: e.joinDate,
    createdAt: e.createdAt,
    leftDate: e.leftDate,
    salary: e.salary,
    rates: r.rates,
    absences: r.absences.map((a) => a.date),
    work: r.work,
    payments: r.payments.map((p) => ({ amount: p.amount, date: p.paidAt, kind: p.kind })),
  };
}

/** Every record of the given workers (or the whole farm), grouped by worker. */
async function loadRecords(tenantId: string, employeeIds?: string[]) {
  const where = { tenantId, ...(employeeIds ? { employeeId: { in: employeeIds } } : {}) };
  // Payments made before pay accounts may lack tenantId; they are found through their worker.
  const payWhere: Prisma.SalaryPaymentWhereInput = employeeIds ? { employeeId: { in: employeeIds } } : { employee: { tenantId } };
  const [rates, absences, work, payments] = await Promise.all([
    db.payRate.findMany({ where, orderBy: { from: 'asc' } }),
    db.employeeAbsence.findMany({ where, orderBy: { date: 'desc' } }),
    db.workEntry.findMany({ where, orderBy: [{ date: 'desc' }, { createdAt: 'desc' }] }),
    db.salaryPayment.findMany({ where: payWhere, orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }] }),
  ]);
  const group = <T extends { employeeId: string }>(rows: T[]) => {
    const m = new Map<string, T[]>();
    for (const row of rows) m.set(row.employeeId, [...(m.get(row.employeeId) ?? []), row]);
    return m;
  };
  return { rates: group(rates), absences: group(absences), work: group(work), payments: group(payments) };
}

type Loaded = Awaited<ReturnType<typeof loadRecords>>;
const recordsOf = (l: Loaded, id: string) => ({
  rates: l.rates.get(id) ?? [],
  absences: l.absences.get(id) ?? [],
  work: l.work.get(id) ?? [],
  payments: l.payments.get(id) ?? [],
});

/** Every worker with their account, working ones first, then by name. */
export async function listWorkers(tenantId: string, now = new Date()) {
  const [employees, loaded] = await Promise.all([db.employee.findMany({ where: { tenantId } }), loadRecords(tenantId)]);
  const month = farmToday(now).slice(0, 7);
  return employees
    .map((e) => {
      const worker = toWorker(e, recordsOf(loaded, e.id));
      const thisMonth = workerMonths(worker, now).find((m) => m.month === month);
      return {
        ...e,
        payType: e.payType ?? 'monthly',
        status: workerStatus(e),
        account: workerAccount(worker, now),
        thisMonth: { earned: thisMonth?.earned ?? 0, paid: thisMonth?.paid ?? 0, daysAbsent: thisMonth?.daysAbsent ?? 0 },
      };
    })
    .sort((a, b) => Number(a.status === 'left') - Number(b.status === 'left') || a.name.localeCompare(b.name));
}

/** One worker with account, months and full history. Null if not in this farm. */
export async function getWorkerDetail(tenantId: string, id: string, now = new Date()) {
  if (!isObjectId(id)) return null;
  const e = await db.employee.findFirst({ where: { id, tenantId } });
  if (!e) return null;
  const records = recordsOf(await loadRecords(tenantId, [id]), id);
  const worker = toWorker(e, records);
  return {
    ...e,
    payType: e.payType ?? 'monthly',
    status: workerStatus(e),
    account: workerAccount(worker, now),
    months: workerMonths(worker, now),
    payments: records.payments,
    absences: records.absences,
    work: records.work,
    rates: [...records.rates].reverse(),
  };
}

/** Every worker of the farm in the shape the pay maths uses (for the money reports). */
export async function farmWorkers(tenantId: string): Promise<WorkerLike[]> {
  const [employees, loaded] = await Promise.all([db.employee.findMany({ where: { tenantId } }), loadRecords(tenantId)]);
  return employees.map((e) => toWorker(e, recordsOf(loaded, e.id)));
}

/** The worker of this farm, or null. */
export async function findWorker(tenantId: string, id: string | null) {
  if (!id || !isObjectId(id)) return null;
  return db.employee.findFirst({ where: { id, tenantId } });
}
