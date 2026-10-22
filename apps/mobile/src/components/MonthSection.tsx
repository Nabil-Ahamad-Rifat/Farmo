import { View } from 'react-native';
import { Text } from '@/src/components/ui/Text';
import { monthKey, type MonthSummary } from '@farm/business-logic';
import { monthLabel, tk } from '@/src/lib/format';

/** Split a newest-first history into newest-first month groups. */
export function groupByMonth<T extends { date: Date | string }>(history: T[]) {
  const groups: { month: string; entries: T[] }[] = [];
  for (const entry of history) {
    const month = monthKey(entry.date);
    const last = groups[groups.length - 1];
    if (last?.month === month) last.entries.push(entry);
    else groups.push({ month, entries: [entry] });
  }
  return groups;
}

/** Month heading: name, litres, sold, paid and the balance at month end. */
export function MonthHeading({ month, summary }: { month: string; summary?: Pick<MonthSummary, 'milkLitres' | 'sold' | 'paid' | 'closing'> }) {
  return (
    <View className="gap-1 border-y border-slate-100 bg-slate-50 px-4 py-2.5">
      <Text className="text-sm font-bold text-ink">{monthLabel(month)}</Text>
      {summary ? (
        <View className="flex-row flex-wrap gap-x-3">
          {summary.milkLitres > 0 ? <Text className="text-[11px] text-slate-600">{summary.milkLitres} L milk</Text> : null}
          <Text className="text-[11px] text-slate-600">Sold {tk(summary.sold)}</Text>
          <Text className="text-[11px] text-brand-700">Paid {tk(summary.paid)}</Text>
          <Text className={`text-[11px] font-semibold ${summary.closing > 0 ? 'text-red-600' : summary.closing < 0 ? 'text-brand-700' : 'text-slate-400'}`}>
            {summary.closing > 0 ? `Due at month end ${tk(summary.closing)}` : summary.closing < 0 ? `Advance ${tk(-summary.closing)}` : 'Clear at month end'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
