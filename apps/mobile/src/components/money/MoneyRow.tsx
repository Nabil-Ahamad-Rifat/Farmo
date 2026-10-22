import { View, Pressable } from 'react-native';
import { router, type Href } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { Text } from '@/src/components/ui/Text';
import { ApiError } from '@farm/api-client';
import { tk } from '@/src/lib/format';

/** ৳1,200 or − ৳1,200 for a loss. */
export const signed = (n: number) => (n < 0 ? '− ' + tk(-n) : tk(n));

/** A cost shown as a deduction: − ৳1,200. */
export const minus = (n: number) => '− ' + tk(n);

/**
 * One label/amount line in a money card (same wording as the web Revenue
 * Portal). With href it opens the entries behind the number.
 */
export function MoneyRow({
  label,
  value,
  hint,
  strong,
  first,
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  strong?: boolean;
  first?: boolean;
  href?: Href;
}) {
  const body = (
    <>
      <View className="min-w-0 flex-1">
        <Text className={`text-sm ${strong ? 'font-bold text-ink' : 'text-slate-600'}`}>{label}</Text>
        {hint ? <Text className="text-[11px] text-slate-400">{hint}</Text> : null}
      </View>
      <View className="flex-row items-center gap-1">
        <Text className={`text-sm text-ink ${strong ? 'font-extrabold' : 'font-semibold'}`}>{value}</Text>
        {href ? <ArrowRight size={14} color="#cbd5e1" /> : null}
      </View>
    </>
  );
  const cls = `flex-row items-center justify-between gap-3 py-2.5 ${first ? '' : 'border-t border-slate-100'}`;
  return href ? (
    <Pressable onPress={() => router.push(href)} className={cls} accessibilityRole="link">
      {body}
    </Pressable>
  ) : (
    <View className={cls}>{body}</View>
  );
}

/** Money reports are owner-only on the server; say so plainly instead of the raw error. */
export function moneyError(err: unknown) {
  if (err instanceof ApiError && err.status === 403) return 'Only the farm owner can see money reports.';
  return (err as Error).message;
}
