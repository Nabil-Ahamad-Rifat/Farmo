import { dayRate } from '@farm/business-logic';
import type { Employee } from '@farm/shared-types';
import { tk } from '@/src/lib/format';

// Same wording as the web app's components/workers/shared.tsx.

/** "Monthly ৳18,000 · ৳600/day" or "Daily · ৳500/day". */
export function payLabel(w: Pick<Employee, 'payType' | 'salary' | 'dailyRate'>) {
  return w.payType === 'daily'
    ? `Daily · ${tk(w.dailyRate ?? 0)}/day`
    : `Monthly ${tk(w.salary)} · ${tk(dayRate(w.salary))}/day`;
}

/** Who owes whom, in words, with the text colour and badge tone to show it in. */
export function balanceInfo(balance: number) {
  if (balance > 0.004) return { label: `You owe ${tk(balance)}`, text: 'text-red-600', tone: 'danger' as const };
  if (balance < -0.004) return { label: `Advance ${tk(-balance)}`, text: 'text-amber-700', tone: 'warning' as const };
  return { label: 'Settled', text: 'text-brand-700', tone: 'brand' as const };
}
