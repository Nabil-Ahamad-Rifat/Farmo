import { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { TrendingUp, TrendingDown, Wallet, Scale, ChevronLeft, ChevronRight, ListChecks } from 'lucide-react-native';
import { farmMonth, shiftMonth, type FinanceSummary } from '@farm/business-logic';
import { Text } from '@/src/components/ui/Text';
import { mobileApiClient } from '@/src/lib/apiClient';
import { fmtDate, monthLabel, tk, todayStr } from '@/src/lib/format';
import { Button, Card, Chips, DateField, FormError, PageHeader } from '@/src/components/ui';
import { MoneyRow, signed, minus, moneyError } from '@/src/components/money/MoneyRow';
import { IncomeCostChart } from '@/src/components/money/IncomeCostChart';
import { colors } from '@/src/theme';
import { useOwnerOnly } from '@/src/hooks/useOwnerOnly';

/** GET /api/revenue (range=…, month=… or from=…&to=…) */
interface RevenueReport {
  range: { preset: string; from: string; to: string; month: string | null; days: number };
  summary: FinanceSummary;
  chart: { key: string; income: number; costs: number; profit: number }[];
  months: { month: string; income: number; costs: number; profit: number; moneyIn: number; moneyOut: number }[];
  dues: { customersOwe: number; youOweSuppliers: number; youOweWorkers: number; workerAdvances: number };
}

type Preset = 'today' | '7d' | '30d' | 'month' | 'lastmonth' | 'pick' | 'custom';

const PRESETS: { value: string; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'month', label: 'This month' },
  { value: 'lastmonth', label: 'Last month' },
  { value: 'choose', label: 'Choose dates' },
];

/** Revenue Portal, like the web's RevenuePortal: profit, cash flow, dues and months for any period. */
export default function RevenueScreen() {
  const allowed = useOwnerOnly();
  return allowed ? <RevenueScreenContent /> : null;
}

function RevenueScreenContent() {
  const params = useLocalSearchParams<{ month?: string }>();
  const thisMonth = farmMonth();
  const startMonth = params.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : null;
  const [preset, setPreset] = useState<Preset>(startMonth && startMonth !== thisMonth ? 'pick' : 'month');
  const [pickedMonth, setPickedMonth] = useState(startMonth ?? shiftMonth(thisMonth, -1));
  const [custom, setCustom] = useState({ from: thisMonth + '-01', to: todayStr() });
  const [applied, setApplied] = useState(custom);
  const [showCustom, setShowCustom] = useState(false);
  const [data, setData] = useState<RevenueReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const query =
    preset === 'pick' ? `month=${pickedMonth}` : preset === 'custom' ? `from=${applied.from}&to=${applied.to}` : `range=${preset}`;

  const fetchData = useCallback(async () => {
    try {
      setData(await mobileApiClient.get<RevenueReport>(`/api/revenue?${query}`, 'Failed to load the money report'));
      setError('');
    } catch (err) {
      setError(moneyError(err));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    // A new period must show the spinner again before its request settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetchData();
  }, [fetchData]);

  function showMonth(month: string) {
    if (month === thisMonth) setPreset('month');
    else {
      setPickedMonth(month);
      setPreset('pick');
    }
  }

  function choosePreset(v: string) {
    if (v === 'choose') {
      setShowCustom(!showCustom);
      return;
    }
    setShowCustom(false);
    setPreset(v as Preset);
  }

  function showDates() {
    if (!custom.from || !custom.to) return;
    const ordered = custom.from <= custom.to ? custom : { from: custom.to, to: custom.from };
    setCustom(ordered);
    setApplied(ordered);
    setPreset('custom');
  }

  const r = data?.range;
  const periodText = !r
    ? ''
    : r.month && (r.preset === 'month' || r.preset === 'lastmonth' || r.preset === 'pick')
      ? monthLabel(r.month) + (r.preset === 'month' ? ' (so far)' : '')
      : r.from === r.to
        ? fmtDate(r.from)
        : `${fmtDate(r.from)} – ${fmtDate(r.to)}`;
  const p = data?.summary.profit;
  const c = data?.summary.cash;
  // Rows open History filtered to the same period, like the web.
  const historyHref = (type: string): Href | undefined => (r ? `/more/history?type=${type}&from=${r.from}&to=${r.to}` : undefined);
  const choosing = showCustom || preset === 'pick' || preset === 'custom';
  const shownMonth = preset === 'pick' ? pickedMonth : thisMonth;

  return (
    <ScrollView
      className="flex-1 bg-surface"
      contentContainerClassName="gap-5 p-4 pb-10"
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await fetchData();
            setRefreshing(false);
          }}
        />
      }
    >
      <PageHeader title="Revenue Portal" subtitle="Profit, cash and dues for any period. Every number links to the entries behind it." />

      {/* Period */}
      <Card className="gap-3">
        <Chips options={PRESETS} value={choosing ? 'choose' : preset} onChange={choosePreset} />
        {choosing ? (
          <View className="gap-3 border-t border-slate-100 pt-3">
            <Text className="text-[13px] font-medium text-slate-700">A month</Text>
            <View className="flex-row items-center justify-between rounded-control border border-line p-1">
              <Pressable onPress={() => showMonth(shiftMonth(shownMonth, -1))} className="rounded-lg p-2" accessibilityLabel="Previous month">
                <ChevronLeft size={18} color={colors.slate600} />
              </Pressable>
              <Text className="text-sm font-bold text-ink">{monthLabel(shownMonth)}</Text>
              <Pressable
                onPress={() => shownMonth < thisMonth && showMonth(shiftMonth(shownMonth, 1))}
                className={`rounded-lg p-2 ${shownMonth < thisMonth ? '' : 'opacity-30'}`}
                accessibilityLabel="Next month"
              >
                <ChevronRight size={18} color={colors.slate600} />
              </Pressable>
            </View>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <DateField label="From" value={custom.from} maxDate={new Date()} onChange={(v) => setCustom({ ...custom, from: v })} />
              </View>
              <View className="flex-1">
                <DateField label="To" value={custom.to} maxDate={new Date()} onChange={(v) => setCustom({ ...custom, to: v })} />
              </View>
            </View>
            <Button label="Show" size="lg" onPress={showDates} />
          </View>
        ) : null}
        {r ? (
          <Text className="text-sm font-semibold text-slate-700">
            {periodText} <Text className="font-normal text-slate-500">· {r.days} day{r.days === 1 ? '' : 's'}</Text>
          </Text>
        ) : null}
      </Card>

      <FormError message={error} />

      {loading && !data ? (
        <View className="items-center justify-center py-16">
          <ActivityIndicator />
        </View>
      ) : data && p && c ? (
        <>
          {/* Profit */}
          <Card>
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <Text className="text-xs font-bold uppercase tracking-wider text-slate-500">Profit</Text>
                <Text className={`mt-1 text-3xl font-extrabold ${p.profit < 0 ? 'text-red-600' : 'text-brand-700'}`}>{signed(p.profit)}</Text>
                <Text className="mt-1 text-xs text-slate-500">What the farm earned minus what it cost, whether paid yet or not.</Text>
              </View>
              <View className={`h-10 w-10 items-center justify-center rounded-card ${p.profit < 0 ? 'bg-red-600' : 'bg-brand-600'}`}>
                {p.profit < 0 ? <TrendingDown size={20} color={colors.white} /> : <TrendingUp size={20} color={colors.white} />}
              </View>
            </View>
            <View className="mt-4 border-t border-slate-100">
              <MoneyRow first label={`Sales made (${p.salesCount})`} value={tk(p.salesMade)} href={historyHref('sale')} />
              <MoneyRow label="Other income" value={tk(p.otherIncome)} href={historyHref('income')} />
              <MoneyRow label="Feed bought" value={minus(p.feed)} hint="Feed with days set is spread over those days" href={historyHref('feed')} />
              <MoneyRow label="Workers' pay earned" value={minus(p.labour)} hint="Salary ÷ 30 per day worked, plus daily labour" href="/more/employees" />
              {p.writtenOff > 0 ? <MoneyRow label="Advances written off" value={minus(p.writtenOff)} href={historyHref('writeoff')} /> : null}
              <MoneyRow label="Animal care" value={minus(p.animalCare)} hint="Costs on animal records: vet, medicine, vaccine, AI" href={historyHref('animal')} />
              <MoneyRow label="Other expenses" value={minus(p.otherExpenses)} href={historyHref('expense')} />
              <MoneyRow label="Profit" value={signed(p.profit)} strong />
            </View>
          </Card>

          {/* Cash flow */}
          <Card>
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <Text className="text-xs font-bold uppercase tracking-wider text-slate-500">Cash flow</Text>
                <Text className={`mt-1 text-3xl font-extrabold ${c.net < 0 ? 'text-red-600' : 'text-ink'}`}>{signed(c.net)}</Text>
                <Text className="mt-1 text-xs text-slate-500">Money that actually came in minus money that went out.</Text>
              </View>
              <View className="h-10 w-10 items-center justify-center rounded-card bg-ink">
                <Wallet size={20} color={colors.white} />
              </View>
            </View>
            <View className="mt-4 border-t border-slate-100">
              <MoneyRow first label="Received from customers" value={tk(c.fromCustomers)} href={historyHref('payment')} />
              <MoneyRow label="Other income" value={tk(c.otherIncome)} href={historyHref('income')} />
              <MoneyRow label="Money in" value={tk(c.moneyIn)} strong />
              <MoneyRow label="Paid to suppliers" value={minus(c.toSuppliers)} href={historyHref('supplier')} />
              {c.feedPaidOnSpot > 0 ? <MoneyRow label="Feed paid on the spot" value={minus(c.feedPaidOnSpot)} href={historyHref('feed')} /> : null}
              <MoneyRow label="Paid to workers" value={minus(c.toWorkers)} href={historyHref('salary')} />
              {c.animalCare > 0 ? <MoneyRow label="Animal care" value={minus(c.animalCare)} href={historyHref('animal')} /> : null}
              <MoneyRow label="Other expenses" value={minus(c.otherExpenses)} href={historyHref('expense')} />
              <MoneyRow label="Money out" value={minus(c.moneyOut)} strong />
            </View>
          </Card>

          {/* Dues */}
          <Card>
            <View className="flex-row items-center gap-2">
              <Scale size={16} color={colors.slate400} />
              <Text className="text-base font-bold text-ink">Dues right now</Text>
            </View>
            <Text className="text-xs text-slate-500">Why profit and cash differ: sales not yet paid for, and bills not yet paid.</Text>
            <View className="mt-4 flex-row flex-wrap gap-3">
              <Due label="Customers owe you" value={data.dues.customersOwe} href="/dues" />
              <Due label="You owe suppliers" value={data.dues.youOweSuppliers} href="/more/suppliers" />
              <Due label="You owe workers" value={data.dues.youOweWorkers} href="/more/employees" />
              <Due label="Advances to workers" value={data.dues.workerAdvances} href="/more/employees" />
            </View>
          </Card>

          <IncomeCostChart chart={data.chart} />

          {/* Month by month */}
          <Card padded={false}>
            <View className="flex-row items-center justify-between gap-3 p-4">
              <View className="flex-1">
                <Text className="text-base font-bold text-ink">Month by month</Text>
                <Text className="text-xs text-slate-500">Tap a month to see it in full.</Text>
              </View>
              <Button label="All entries" icon={ListChecks} variant="secondary" size="sm" onPress={() => router.push('/more/history')} />
            </View>
            {data.months.map((m) => (
              <Pressable
                key={m.month}
                onPress={() => showMonth(m.month)}
                className={`gap-1 border-t border-slate-100 px-4 py-3 ${r?.month === m.month ? 'bg-sky-50' : ''}`}
                accessibilityRole="button"
              >
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm font-semibold text-ink">{monthLabel(m.month)}</Text>
                  <Text className={`text-sm font-bold ${m.profit < 0 ? 'text-red-600' : 'text-brand-700'}`}>{signed(m.profit)}</Text>
                </View>
                <Text className="text-xs text-slate-500">
                  Income {tk(m.income)} · Costs {tk(m.costs)} · In {tk(m.moneyIn)} · Out {tk(m.moneyOut)}
                </Text>
              </Pressable>
            ))}
          </Card>
        </>
      ) : null}
    </ScrollView>
  );
}

function Due({ label, value, href }: { label: string; value: number; href: Href }) {
  return (
    <Pressable onPress={() => router.navigate(href)} className="min-w-[45%] flex-1 rounded-control border border-slate-100 bg-slate-50 p-3" accessibilityRole="link">
      <Text className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</Text>
      <Text className="mt-1 text-lg font-extrabold text-ink">{tk(value)}</Text>
    </Pressable>
  );
}
