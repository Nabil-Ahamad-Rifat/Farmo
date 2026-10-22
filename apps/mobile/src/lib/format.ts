import { farmToday } from '@farm/business-logic';
// Display helpers for the dues/payables screens (same rules as the web app's
// components/sales/shared.tsx).

/** ৳1,250 — whole taka when there are no paisa, otherwise two decimals. */
export function tk(amount: number) {
  const hasPaisa = Math.round(amount * 100) % 100 !== 0;
  return '৳' + amount.toLocaleString('en-IN', { minimumFractionDigits: hasPaisa ? 2 : 0, maximumFractionDigits: 2 });
}

/** Today on the farm's clock (Bangladesh), not UTC. */
export const todayStr = () => farmToday();
export const toDay = (d: Date | string) => new Date(d).toISOString().slice(0, 10);
export const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** "October 2026" for a "YYYY-MM" month (UTC, like the month math). */
export const monthLabel = (month: string) =>
  new Date(month + '-01T00:00:00Z').toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bkash', label: 'bKash' },
  { value: 'nagad', label: 'Nagad' },
  { value: 'bank', label: 'Bank' },
  { value: 'other', label: 'Other' },
];

export const paymentMethodLabel = (m: string) => PAYMENT_METHODS.find((p) => p.value === m)?.label ?? m;
