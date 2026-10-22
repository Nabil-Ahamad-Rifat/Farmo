import { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft, ChevronRight, Milk, ShoppingBag, Wallet, History, AlertCircle, Wheat, TrendingUp, ArrowRight, HandCoins } from 'lucide-react-native';
import { farmMonth, shiftMonth, type FinanceSummary, type MonthLine, type MonthStatement } from '@farm/business-logic';
import { Text } from '@/src/components/ui/Text';
import { mobileApiClient } from '@/src/lib/apiClient';
import { monthLabel, tk } from '@/src/lib/format';
import { Button, Card, EmptyState, FormError, PageHeader, StatCard, StatGrid } from '@/src/components/ui';
import { BalanceText, TypeBadge } from '@/src/components/StatusPill';
import { PaymentModal } from '@/src/components/PaymentModal';
import { signed, moneyError } from '@/src/components/money/MoneyRow';
import { cardShadow, colors } from '@/src/theme';
import { useOwnerOnly } from '@/src/hooks/useOwnerOnly';

/** GET /api/reports/monthly */
interface MonthlyReport {
  month: string;
  totals: MonthStatement['totals'];
  lines: (MonthLine & { customer: { id: string; name: string; type: string; phone: string | null } | null })[];
  /** Feed bought this month. */
  feed: { kg: number; spent: number; paid: number; owed: number; count: number };
  /** Profit and cash flow for the month. */
  money: FinanceSummary;
}

/** "1,250.5 L" */
const litres = (n: number) => `${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })} L`;

/** Monthly Report, like the web's MonthlyReport: milk sold, money received and what is still due. */
export default function MonthlyReportScreen() {
  const allowed = useOwnerOnly();
  return allowed ? <MonthlyReportScreenContent /> : null;
}

function MonthlyReportScreenContent() {
  // The farm's month (Bangladesh time), not the phone's UTC clock.
  const current = farmMonth();
  const [month, setMonth] = useState(current);
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [collect, setCollect] = useState<{ id: string; name: string; totalDue: number } | null>(null);
  // The month whose request has settled (success or failure), so an error never leaves the spinner up.
  const [loaded, setLoaded] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setReport(await mobileApiClient.get<MonthlyReport>(`/api/reports/monthly?month=${month}`, 'Failed to load report'));
      setError('');
    } catch (err) {
      setError(moneyError(err));
    } finally {
      setLoaded(month);
    }
  }, [month]);

  useEffect(() => {
    // load() only sets state after its request settles, not synchronously here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const r = report?.month === month ? report : null;
  const t = r?.totals;
  const owing = r?.lines.filter((l) => l.closing > 0).length ?? 0;
  const p = r?.money.profit;

  return (
    <>
      <ScrollView
        className="flex-1 bg-surface"
        contentContainerClassName="gap-5 p-4 pb-10"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
      >
        <PageHeader title="Monthly Report" subtitle="Milk sold, money received and what is still due, month by month." />

        {/* Month */}
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => setMonth(shiftMonth(month, -1))}
            className="h-10 w-10 items-center justify-center rounded-control border border-line bg-white"
            accessibilityLabel="Previous month"
          >
            <ChevronLeft size={16} color={colors.slate600} />
          </Pressable>
          <Text className="flex-1 text-center text-lg font-bold text-ink">{monthLabel(month)}</Text>
          <Pressable
            onPress={() => month < current && setMonth(shiftMonth(month, 1))}
            disabled={month >= current}
            className={`h-10 w-10 items-center justify-center rounded-control border border-line bg-white ${month < current ? '' : 'opacity-40'}`}
            accessibilityLabel="Next month"
          >
            <ChevronRight size={16} color={colors.slate600} />
          </Pressable>
          {month !== current ? (
            <Pressable onPress={() => setMonth(current)} className="rounded-control px-3 py-2" accessibilityRole="button">
              <Text className="text-xs font-semibold text-slate-600">This month</Text>
            </Pressable>
          ) : null}
        </View>

        <FormError message={error} />

        {!r ? (
          loaded === month ? null : (
            <View className="items-center py-16">
              <ActivityIndicator />
            </View>
          )
        ) : (
          <>
            <StatGrid>
              <StatCard label="Milk sold" value={litres(t!.milkLitres)} icon={Milk} />
              <StatCard label="Total sales" value={tk(t!.sold)} icon={ShoppingBag} hint="All products" />
              <StatCard label="Money received" value={tk(t!.collected)} icon={Wallet} tone="brand" />
              <StatCard label="Due from before" value={tk(t!.carriedIn)} icon={History} hint="Carried into this month" />
              <StatCard
                label="Due at month end"
                value={tk(t!.dueAtEnd)}
                icon={AlertCircle}
                tone="danger"
                hint={owing ? `${owing} customer${owing === 1 ? '' : 's'} still owe` : 'Nothing owed'}
              />
            </StatGrid>

            {/* Feed bought */}
            <Pressable
              onPress={() => router.navigate(`/more/feed?month=${month}`)}
              style={cardShadow}
              className="flex-row items-center gap-3 rounded-card border border-amber-100 bg-white p-4"
              accessibilityRole="link"
            >
              <View className="h-9 w-9 items-center justify-center rounded-control bg-amber-100">
                <Wheat size={16} color={colors.amber700} />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-ink">Feed bought: {tk(r.feed.spent)}</Text>
                <Text className="text-xs text-slate-500">
                  {r.feed.kg.toLocaleString('en-IN')} kg in {r.feed.count} purchase{r.feed.count === 1 ? '' : 's'} · paid {tk(r.feed.paid)}
                  {r.feed.owed > 0 ? ` · still owed ${tk(r.feed.owed)}` : ''}
                </Text>
              </View>
              <ArrowRight size={14} color={colors.amber700} />
            </Pressable>

            {/* Costs and profit */}
            {p ? (
              <Card>
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                      <TrendingUp size={16} color={colors.slate400} />
                      <Text className="text-base font-bold text-ink">Costs and profit</Text>
                    </View>
                    <Text className="text-xs text-slate-500">Earned and spent this month, whether paid yet or not.</Text>
                  </View>
                  <Text className={`text-2xl font-extrabold ${p.profit < 0 ? 'text-red-600' : 'text-brand-700'}`}>{signed(p.profit)}</Text>
                </View>
                <View className="mt-3">
                  {[
                    ['Sales made', tk(p.salesMade)],
                    ['Other income', tk(p.otherIncome)],
                    ['Feed bought', '− ' + tk(p.feed)],
                    ["Workers' pay earned", '− ' + tk(p.labour + p.writtenOff)],
                    ['Animal care', '− ' + tk(p.animalCare)],
                    ['Other expenses', '− ' + tk(p.otherExpenses)],
                    ['Cash in / out', `${tk(r.money.cash.moneyIn)} / ${tk(r.money.cash.moneyOut)}`],
                  ].map(([k, v]) => (
                    <View key={k} className="flex-row justify-between gap-3 border-b border-slate-50 py-1.5">
                      <Text className="text-sm text-slate-600">{k}</Text>
                      <Text className="text-sm font-semibold text-ink">{v}</Text>
                    </View>
                  ))}
                </View>
                <Pressable onPress={() => router.navigate(`/more/revenue?month=${month}`)} className="mt-3 flex-row items-center gap-1" accessibilityRole="link">
                  <Text className="text-xs font-semibold text-sky-700">Full breakdown in the Revenue Portal</Text>
                  <ArrowRight size={13} color={colors.sky700} />
                </Pressable>
              </Card>
            ) : null}

            {/* Customers */}
            <Card padded={false}>
              {r.lines.length === 0 ? (
                <EmptyState message={`No sales, payments or dues in ${monthLabel(month)}.`} />
              ) : (
                <>
                  {r.lines.map((l, i) => (
                    <View key={l.partyId ?? 'none'} className={`gap-2 px-4 py-3.5 ${i > 0 ? 'border-t border-slate-100' : ''} ${l.closing > 0 ? 'bg-red-50/40' : ''}`}>
                      <View className="flex-row items-start justify-between gap-3">
                        <Pressable
                          disabled={!l.customer}
                          onPress={() => l.customer && router.push(`/customer/${l.customer.id}`)}
                          className="min-w-0 flex-1"
                          accessibilityRole="link"
                        >
                          {l.customer ? (
                            <View className="flex-row items-center gap-2">
                              <Text className="shrink text-sm font-semibold text-ink" numberOfLines={1}>
                                {l.customer.name}
                              </Text>
                              <TypeBadge type={l.customer.type} />
                            </View>
                          ) : (
                            <Text className="text-sm font-semibold text-slate-500">No customer (older sales)</Text>
                          )}
                          <Text className="text-[11px] text-slate-400">
                            {l.salesCount} sale{l.salesCount === 1 ? '' : 's'} · {l.paymentsCount} payment{l.paymentsCount === 1 ? '' : 's'}
                            {l.milkLitres ? ` · ${litres(l.milkLitres)}` : ''}
                          </Text>
                        </Pressable>
                        <View className="items-end">
                          <BalanceText value={l.closing} />
                          <Text className="text-[11px] text-slate-400">at month end</Text>
                        </View>
                      </View>
                      <View className="flex-row flex-wrap items-center justify-between gap-2">
                        <Text className="text-xs text-slate-600">
                          Sold {tk(l.sold)} · <Text className="font-semibold text-brand-700">Paid {tk(l.paid)}</Text>
                          {l.carriedIn !== 0 ? ` · From before ${l.carriedIn > 0 ? tk(l.carriedIn) : `advance ${tk(-l.carriedIn)}`}` : ''}
                        </Text>
                        {l.customer && l.closing > 0 && month === current ? (
                          <Button
                            label="Collect"
                            icon={HandCoins}
                            variant="brand"
                            size="sm"
                            onPress={() => setCollect({ id: l.customer!.id, name: l.customer!.name, totalDue: l.closing })}
                          />
                        ) : null}
                      </View>
                    </View>
                  ))}
                  <View className="flex-row justify-between gap-3 border-t border-line bg-slate-50 px-4 py-3">
                    <Text className="text-sm font-bold text-ink">Total</Text>
                    <Text className="text-sm font-bold text-ink">
                      {litres(t!.milkLitres)} · {tk(t!.sold)} · <Text className="text-brand-700">{tk(t!.collected)}</Text> ·{' '}
                      <Text className="text-red-600">{tk(t!.dueAtEnd)}</Text>
                    </Text>
                  </View>
                </>
              )}
            </Card>

            <Text className="text-xs text-slate-500">
              Due at month end = due from before + sold − paid. &ldquo;Paid&rdquo; is money received during the month, whichever sale it was for.
            </Text>
          </>
        )}
      </ScrollView>

      <PaymentModal
        party={collect}
        mode="collect"
        onClose={() => setCollect(null)}
        onSaved={() => {
          setCollect(null);
          load();
        }}
      />
    </>
  );
}
