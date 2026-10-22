import { Text } from '@/src/components/ui/Text';
import { Badge } from '@/src/components/ui';
import { tk } from '@/src/lib/format';

const STATUS = {
  paid: { label: 'Paid', tone: 'brand' },
  partial: { label: 'Partial', tone: 'warning' },
  pending: { label: 'Due', tone: 'danger' },
} as const;

/** Paid / Partial / Due pill for a sale or feed purchase, like the web's PaymentStatusPill. */
export function StatusPill({ status }: { status: string }) {
  const s = STATUS[status as keyof typeof STATUS] ?? STATUS.pending;
  return <Badge label={s.label} tone={s.tone} />;
}

/** Regular / New customer badge, like the web's CustomerTypeBadge. */
export function TypeBadge({ type }: { type: string }) {
  return type === 'regular' ? <Badge label="Regular" tone="brand" /> : <Badge label="New" tone="violet" />;
}

/** A balance: due in red, advance in green, otherwise "Clear". */
export function BalanceText({ value, size = 'text-sm' }: { value: number; size?: string }) {
  if (value > 0) return <Text className={`${size} font-bold text-red-600`}>{tk(value)}</Text>;
  if (value < 0) return <Text className={`${size} font-semibold text-brand-700`}>Advance {tk(-value)}</Text>;
  return <Text className={`${size} font-semibold text-slate-400`}>Clear</Text>;
}
