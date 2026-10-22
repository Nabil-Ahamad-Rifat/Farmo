import { farmToday } from '@farm/business-logic';
import { StatCard } from '@/components/ui/StatCard';
import { CheckCircle, Clock, CircleDashed, Milk, Beef, Package, type LucideIcon } from 'lucide-react';

/** Product types offered in the sale form. general/products are legacy values that still display. */
export const PRODUCT_TYPES = [
  { value: 'milk', label: 'Milk', unit: 'L', icon: Milk, color: 'bg-sky-50 text-sky-700 border-sky-200' },
  { value: 'cow_sale', label: 'Cow', unit: 'head', icon: Beef, color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'other', label: 'Other', unit: '', icon: Package, color: 'bg-slate-50 text-slate-700 border-line' },
] as const;

const LEGACY_TYPES: Record<string, { label: string; color: string }> = {
  general: { label: 'General', color: 'bg-slate-50 text-slate-700 border-line' },
  products: { label: 'Farm Products', color: 'bg-violet-50 text-violet-700 border-violet-200' },
};

export function productTypeInfo(type: string) {
  const known = PRODUCT_TYPES.find((t) => t.value === type);
  if (known) return { label: known.label, color: known.color, unit: known.unit };
  return { ...(LEGACY_TYPES[type] ?? { label: type, color: LEGACY_TYPES.general.color }), unit: '' };
}

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bkash', label: 'bKash' },
  { value: 'nagad', label: 'Nagad' },
  { value: 'bank', label: 'Bank' },
  { value: 'other', label: 'Other' },
] as const;

export const paymentMethodLabel = (m: string) => PAYMENT_METHODS.find((p) => p.value === m)?.label ?? m;

/** ৳1,250 — whole taka when there are no paisa, otherwise two decimals. */
export function tk(amount: number) {
  const hasPaisa = Math.round(amount * 100) % 100 !== 0;
  return '৳' + amount.toLocaleString('en-IN', { minimumFractionDigits: hasPaisa ? 2 : 0, maximumFractionDigits: 2 });
}

/** Today on the farm's clock (Bangladesh), not UTC: right after midnight it is already the new day. */
export const todayStr = () => farmToday();
/** "1,250.5 L" */
export const litres = (n: number) => `${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })} L`;
export const toDay = (d: Date | string) => new Date(d).toISOString().slice(0, 10);
/** "October 2026" for a "YYYY-MM" month (UTC, like the month math). */
export const monthLabel = (month: string) =>
  new Date(month + '-01T00:00:00Z').toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
export const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** Paid amount for any sale: derived for customer sales, hand-set status for legacy ones. */
export function salePaid(sale: { amount: number; status: string; paidAmount?: number | null; customerId?: string | null }) {
  if (sale.customerId) return sale.paidAmount ?? 0;
  return sale.status === 'paid' ? sale.amount : 0;
}

export function PaymentStatusPill({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string; Icon: typeof CheckCircle }> = {
    paid: { cls: 'bg-brand-50 text-brand-700 border-brand-200', label: 'Paid', Icon: CheckCircle },
    partial: { cls: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Partial', Icon: CircleDashed },
    pending: { cls: 'bg-red-50 text-red-700 border-red-200', label: 'Due', Icon: Clock },
  };
  const { cls, label, Icon } = map[status] ?? map.pending;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${cls}`}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {label}
    </span>
  );
}

export function CustomerTypeBadge({ type }: { type: string }) {
  return type === 'regular' ? (
    <span className="inline-flex items-center rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
      Regular
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
      New
    </span>
  );
}

export const inputCls =
  'w-full rounded-control border border-line bg-white px-3.5 py-2.5 text-base text-ink shadow-sm placeholder:text-slate-400 transition-colors focus:border-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-600/10 sm:py-2 sm:text-sm';
export const labelCls = 'mb-1.5 block text-[13px] font-medium text-slate-700';

/** Older name for StatCard (components/ui): slate, emerald and red map to its tones. */
export function SummaryCard({
  label,
  value,
  Icon,
  tone,
  hint,
}: {
  label: string;
  value: string;
  Icon: LucideIcon;
  tone: 'slate' | 'emerald' | 'red';
  hint?: string;
}) {
  return <StatCard label={label} value={value} Icon={Icon} hint={hint} tone={tone === 'emerald' ? 'brand' : tone === 'red' ? 'danger' : 'neutral'} />;
}
