import { dayRate } from '@farm/business-logic';
import type { Employee, WorkerAccountInfo } from '@farm/shared-types';
import { tk } from '@/components/sales/shared';

/** "Monthly ৳18,000 · ৳600/day" or "Daily ৳500/day". */
export function payLabel(w: Pick<Employee, 'payType' | 'salary' | 'dailyRate'>) {
  return w.payType === 'daily'
    ? `Daily · ${tk(w.dailyRate ?? 0)}/day`
    : `Monthly ${tk(w.salary)} · ${tk(dayRate(w.salary))}/day`;
}

/** Who owes whom, in words: "You owe ৳X", "Advance ৳X" or "Settled". */
export function balanceInfo(balance: number) {
  if (balance > 0.004) return { label: `You owe ${tk(balance)}`, text: 'text-red-600', cls: 'border-red-200 bg-red-50 text-red-700' };
  if (balance < -0.004) return { label: `Advance ${tk(-balance)}`, text: 'text-amber-700', cls: 'border-amber-200 bg-amber-50 text-amber-800' };
  return { label: 'Settled', text: 'text-brand-700', cls: 'border-brand-200 bg-brand-50 text-brand-700' };
}

export function BalancePill({ account }: { account: Pick<WorkerAccountInfo, 'balance'> }) {
  const b = balanceInfo(account.balance);
  return <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-bold ${b.cls}`}>{b.label}</span>;
}

export function WorkerStatusBadge({ status }: { status: string }) {
  return status === 'left' ? (
    <span className="inline-flex rounded-full border border-line bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">Left</span>
  ) : (
    <span className="inline-flex rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">Working</span>
  );
}
