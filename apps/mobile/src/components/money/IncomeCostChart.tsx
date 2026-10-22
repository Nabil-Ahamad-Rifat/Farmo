import { useState, type ReactNode } from 'react';
import { View, Pressable } from 'react-native';
import { barHeightPx } from '@farm/business-logic';
import { Text } from '@/src/components/ui/Text';
import { Card, CardHeader } from '@/src/components/ui';
import { fmtDate, monthLabel, tk } from '@/src/lib/format';
import { signed } from './MoneyRow';

export interface ChartPoint {
  key: string;
  income: number;
  costs: number;
  profit: number;
}

// Same colours as the web's IncomeCostChart.
const INCOME = '#2a78d6';
const COSTS = '#eb6834';
const HEIGHT = 96;

/** Income and cost bars per day (or per month); tap a bar to see its numbers. */
export function IncomeCostChart({ chart, title = 'Income and costs', action }: { chart: ChartPoint[]; title?: string; action?: ReactNode }) {
  const [picked, setPicked] = useState<number | null>(null);
  if (!chart.length) return null;
  const maxVal = Math.max(...chart.map((d) => Math.max(d.income, d.costs)), 1);
  const perMonth = chart[0].key.length === 7;
  const every = Math.max(1, Math.ceil(chart.length / 6));
  const sel = picked != null ? chart[picked] : null;

  return (
    <Card padded={false}>
      <CardHeader title={title} subtitle={`${perMonth ? 'Per month' : 'Per day'}, on the profit basis · tap a bar`} actions={action} />
      <View className="px-4 pb-4 pt-3">
        <View className="min-h-[38px] justify-center">
          {sel ? (
            <Text className="text-xs text-slate-600">
              <Text className="font-semibold text-ink">{perMonth ? monthLabel(sel.key) : fmtDate(sel.key)}</Text>
              {'  '}Income {tk(sel.income)} · Costs {tk(sel.costs)} · Profit {signed(sel.profit)}
            </Text>
          ) : (
            <View className="flex-row items-center gap-4">
              <Legend color={INCOME} label="Income" />
              <Legend color={COSTS} label="Costs" />
            </View>
          )}
        </View>
        <View className="mt-1 flex-row items-end gap-0.5">
          {chart.map((d, i) => (
            <Pressable key={d.key} onPress={() => setPicked(picked === i ? null : i)} className={`flex-1 items-center gap-1 rounded ${picked === i ? 'bg-slate-100' : ''}`} accessibilityLabel={`${d.key}: income ${d.income}, costs ${d.costs}`}>
              <View className="w-full flex-row items-end justify-center gap-px" style={{ height: HEIGHT }}>
                <View className="flex-1 rounded-t-sm" style={{ backgroundColor: INCOME, height: barHeightPx(d.income, maxVal, HEIGHT) }} />
                <View className="flex-1 rounded-t-sm" style={{ backgroundColor: COSTS, height: barHeightPx(d.costs, maxVal, HEIGHT) }} />
              </View>
              <Text className="text-[9px] text-slate-400">{i % every === 0 ? (perMonth ? d.key.slice(5) : d.key.slice(8)) : ' '}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Card>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
      <Text className="text-xs text-slate-500">{label}</Text>
    </View>
  );
}
