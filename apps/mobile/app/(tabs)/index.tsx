import { useCallback, useState } from 'react';
import { View, ScrollView, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { router, useFocusEffect, type Href } from 'expo-router';
import {
  TrendingUp, Banknote, HandCoins, Store, PawPrint, Users, Wheat, AlertTriangle, ShoppingCart, ArrowRight, Phone, Wallet,
} from 'lucide-react-native';
import type { AnimalDueItem, CowListItem, CustomerSummary, FeedBatch, Sale, SupplierSummary, WorkerListItem } from '@farm/shared-types';
import type { FinanceSummary } from '@farm/business-logic';
import { Text } from '@/src/components/ui/Text';
import { mobileApiClient } from '@/src/lib/apiClient';
import { useAutoRefresh } from '@/src/hooks/useAutoRefresh';
import { useSession } from '@/src/context/AuthContext';
import { fmtDate, tk } from '@/src/lib/format';
import { Button, Card, CardHeader, EmptyState, FormError, PageHeader, StatCard, StatGrid } from '@/src/components/ui';
import { StatusPill, TypeBadge } from '@/src/components/StatusPill';
import { PaymentModal } from '@/src/components/PaymentModal';
import { DueSoonCard } from '@/src/components/animals/DueSoonCard';
import { StatusBadge } from '@/src/components/animals/shared';
import { IncomeCostChart, type ChartPoint } from '@/src/components/money/IncomeCostChart';
import { signed } from '@/src/components/money/MoneyRow';
import { cardShadow, colors } from '@/src/theme';

interface RevenueSlice {
  summary: FinanceSummary;
  chart: ChartPoint[];
}

interface HomeData {
  cows: CowListItem[];
  workers: WorkerListItem[];
  feed: FeedBatch[];
  sales: Sale[];
  customers: CustomerSummary[];
  suppliers: SupplierSummary[];
  due: AnimalDueItem[];
  month: RevenueSlice | null;
  last30: RevenueSlice | null;
}

type PayState = { mode: 'collect' | 'pay'; party: { id: string; name: string; totalDue: number } } | null;

/** Greeting on the farm's clock (Bangladesh), like the web dashboard. */
function greeting() {
  const h = (new Date().getUTCHours() + 6) % 24;
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

const saleStatus = (s: Sale) => (s.customerId ? s.status : s.status === 'paid' ? 'paid' : 'pending');

/** Home: the web's Farm overview (apps/web/src/app/dashboard/page.tsx) built from the same API data. */
export default function HomeScreen() {
  const { isOwner } = useSession();
  const [data, setData] = useState<HomeData | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [pay, setPay] = useState<PayState>(null);

  const load = useCallback(async () => {
    try {
      const get = <T,>(path: string) => mobileApiClient.get<T>(path, 'Failed to load the overview');
      const [cows, workers, feed, sales, customers, suppliers, due, month, last30] = await Promise.all([
        get<CowListItem[]>('/api/cows'),
        get<WorkerListItem[]>('/api/employees'),
        get<FeedBatch[]>('/api/feed'),
        get<Sale[]>('/api/sales'),
        get<CustomerSummary[]>('/api/customers'),
        get<SupplierSummary[]>('/api/suppliers'),
        get<AnimalDueItem[]>('/api/animals/due-soon').catch(() => [] as AnimalDueItem[]),
        // Money numbers are owner-only (managers get a 403).
        isOwner ? get<RevenueSlice>('/api/revenue?range=month') : Promise.resolve(null),
        isOwner ? get<RevenueSlice>('/api/revenue?range=30d') : Promise.resolve(null),
      ]);
      setData({ cows, workers, feed, sales, customers, suppliers, due, month, last30 });
      setError('');
    } catch (err) {
      setError((err as Error).message);
    }
  }, [isOwner]);

  // Reload whenever Home comes back into view (a sale or payment may have changed it).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );
  // And every 30 s / on return to the app / after offline entries upload.
  useAutoRefresh(load, useFocusEffect);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (!data) {
    return (
      <View className="flex-1 items-center justify-center bg-surface p-6">
        {error ? <FormError message={error} /> : <ActivityIndicator />}
      </View>
    );
  }

  const m = data.month?.summary;
  const owing = data.customers.filter((c) => c.totalDue > 0);
  const totalDue = owing.reduce((s, c) => s + c.totalDue, 0);
  const owedSuppliers = data.suppliers.filter((s) => s.totalDue > 0);
  const totalPayable = owedSuppliers.reduce((s, x) => s + x.totalDue, 0);
  const activeCows = data.cows.filter((c) => c.status === 'active').length;
  const activeWorkers = data.workers.filter((w) => w.status !== 'left').length;
  const feedKg = data.feed.reduce((s, f) => s + f.remainingQuantity, 0);
  const feedValue = data.feed.reduce((s, f) => s + f.remainingQuantity * f.unitPrice, 0);
  const runningOut = data.feed.filter((b) => b.schedule && b.schedule.remaining > 0 && b.schedule.daysLeft <= 1);
  const costRows = m
    ? [
        { label: 'Feed bought', value: m.profit.feed, href: '/more/feed' as Href },
        { label: "Workers' pay earned", value: m.profit.labour + m.profit.writtenOff, href: '/more/employees' as Href },
        { label: 'Animal care', value: m.profit.animalCare, href: '/more/expenses' as Href },
        { label: 'Other expenses', value: m.profit.otherExpenses, href: '/more/expenses' as Href },
      ]
    : [];
  const maxCost = Math.max(1, ...costRows.map((r) => r.value));

  return (
    <>
      <ScrollView
        className="flex-1 bg-surface"
        contentContainerClassName="gap-5 p-4 pb-10"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <PageHeader
          eyebrow={greeting()}
          title="Farm overview"
          subtitle={isOwner ? 'What needs attention today and how this month is going.' : 'What needs attention today.'}
          actions={
            <>
              {isOwner ? <Button label="Revenue Portal" icon={TrendingUp} variant="secondary" onPress={() => router.navigate('/more/revenue')} /> : null}
              <Button label="Record sale" icon={ShoppingCart} onPress={() => router.navigate('/sales?new=1')} />
            </>
          }
        />
        <FormError message={error} />

        <StatGrid>
          {m ? (
            <>
              <StatCard
                label="Profit this month"
                value={signed(m.profit.profit)}
                icon={TrendingUp}
                tone={m.profit.profit < 0 ? 'danger' : 'brand'}
                hint={`Sales ${tk(m.profit.salesMade)} · costs ${tk(m.profit.costs)}`}
                href="/more/revenue"
              />
              <StatCard label="Received this month" value={tk(m.cash.moneyIn)} icon={Banknote} tone="brand" hint={`Paid out ${tk(m.cash.moneyOut)}`} href="/more/revenue" />
            </>
          ) : null}
          <StatCard
            label="Customers owe you"
            value={tk(totalDue)}
            icon={HandCoins}
            tone={totalDue > 0 ? 'danger' : 'neutral'}
            hint={`${owing.length} customer${owing.length === 1 ? '' : 's'}`}
            href="/dues"
          />
          <StatCard
            label="You owe suppliers"
            value={tk(totalPayable)}
            icon={Store}
            tone={totalPayable > 0 ? 'warning' : 'neutral'}
            hint={`${owedSuppliers.length} supplier${owedSuppliers.length === 1 ? '' : 's'}`}
            href="/more/suppliers"
          />
        </StatGrid>

        {/* Farm at a glance */}
        <View style={cardShadow} className="flex-row rounded-card border border-line bg-white">
          {[
            { label: 'Animals', value: String(data.cows.length), hint: `${activeCows} in herd`, href: '/cows' as Href, Icon: PawPrint },
            { label: 'Workers', value: String(activeWorkers), hint: `${data.workers.length} in total`, href: '/more/employees' as Href, Icon: Users },
            { label: 'Feed stock', value: `${feedKg.toLocaleString('en-IN', { maximumFractionDigits: 1 })} kg`, hint: `${tk(Math.round(feedValue))} value`, href: '/more/feed' as Href, Icon: Wheat },
          ].map((f, i) => (
            <Pressable key={f.label} onPress={() => router.navigate(f.href)} accessibilityRole="link" className={`flex-1 px-3 py-4 ${i > 0 ? 'border-l border-line' : ''}`}>
              <Text className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{f.label}</Text>
              <Text className="text-lg font-bold text-ink" numberOfLines={1} adjustsFontSizeToFit>
                {f.value}
              </Text>
              <Text className="text-xs text-slate-500" numberOfLines={1}>
                {f.hint}
              </Text>
            </Pressable>
          ))}
        </View>

        {runningOut.length > 0 ? (
          <Pressable onPress={() => router.navigate('/more/feed')} className="flex-row items-start gap-3 rounded-card border border-amber-200 bg-amber-50 px-4 py-3.5">
            <AlertTriangle size={16} color={colors.amber600} />
            <Text className="flex-1 text-sm text-amber-900">
              <Text className="font-semibold">Feed running out:</Text>{' '}
              {runningOut.map((b) => `${b.name} (${b.schedule!.remaining.toLocaleString()} kg left)`).join(', ')}. Buy more soon →
            </Text>
          </Pressable>
        ) : null}

        <DueSoonCard items={data.due} />

        {/* Who owes me */}
        <Card padded={false}>
          <CardHeader
            icon={HandCoins}
            title="Who owes me"
            subtitle={owing.length === 0 ? 'Nobody owes you right now.' : `${owing.length} customer${owing.length === 1 ? '' : 's'} with unpaid sales · ${tk(totalDue)}`}
          />
          {owing.slice(0, 6).map((c) => (
            <View key={c.id} className="flex-row items-center gap-3 border-b border-slate-100 px-4 py-3">
              <Pressable onPress={() => router.push(`/customer/${c.id}`)} className="min-w-0 flex-1" accessibilityRole="link">
                <View className="flex-row items-center gap-2">
                  <Text className="shrink text-sm font-semibold text-ink" numberOfLines={1}>
                    {c.name}
                  </Text>
                  <TypeBadge type={c.type} />
                </View>
                <View className="flex-row items-center gap-1">
                  {c.phone ? <Phone size={11} color={colors.slate500} /> : null}
                  <Text className="text-xs text-slate-500" numberOfLines={1}>
                    {c.phone ? `${c.phone} · ` : ''}Bought {tk(c.totalSold)} · paid {tk(c.totalPaid)}
                  </Text>
                </View>
              </Pressable>
              <Text className="text-sm font-bold text-red-600">{tk(c.totalDue)}</Text>
              <Button label="Collect" icon={HandCoins} variant="brand" size="sm" onPress={() => setPay({ mode: 'collect', party: c })} />
            </View>
          ))}
          <SeeAll label={owing.length > 6 ? `+ ${owing.length - 6} more · All customers` : 'All customers'} onPress={() => router.navigate('/dues')} />
        </Card>

        {/* Who I owe */}
        <Card padded={false}>
          <CardHeader
            icon={Store}
            title="Who I owe"
            subtitle={owedSuppliers.length === 0 ? 'You owe no suppliers right now.' : `${owedSuppliers.length} supplier${owedSuppliers.length === 1 ? '' : 's'} with unpaid feed · ${tk(totalPayable)}`}
          />
          {owedSuppliers.slice(0, 6).map((s) => (
            <View key={s.id} className="flex-row items-center gap-3 border-b border-slate-100 px-4 py-3">
              <Pressable onPress={() => router.push(`/supplier/${s.id}`)} className="min-w-0 flex-1" accessibilityRole="link">
                <Text className="text-sm font-semibold text-ink" numberOfLines={1}>
                  {s.name}
                </Text>
                <Text className="text-xs text-slate-500" numberOfLines={1}>
                  {s.phone ? `${s.phone} · ` : ''}Bought {tk(s.totalBought)} · paid {tk(s.totalPaid)}
                </Text>
              </Pressable>
              <Text className="text-sm font-bold text-red-600">{tk(s.totalDue)}</Text>
              <Button label="Pay" icon={Wallet} variant="amber" size="sm" onPress={() => setPay({ mode: 'pay', party: s })} />
            </View>
          ))}
          <SeeAll label={owedSuppliers.length > 6 ? `+ ${owedSuppliers.length - 6} more · All suppliers` : 'All suppliers'} onPress={() => router.navigate('/more/suppliers')} />
        </Card>

        {m && data.last30 ? (
          <>
            <IncomeCostChart
              chart={data.last30.chart}
              title="Last 30 days"
              action={<Button label="Details" icon={ArrowRight} variant="secondary" size="sm" onPress={() => router.navigate('/more/revenue')} />}
            />
            <Card padded={false}>
              <CardHeader title="This month's costs" subtitle={`${tk(m.profit.costs)} so far`} />
              <View className="gap-4 p-4">
                {costRows.map((r) => (
                  <Pressable key={r.label} onPress={() => router.navigate(r.href)} accessibilityRole="link">
                    <View className="flex-row items-baseline justify-between gap-3">
                      <Text className="text-sm text-slate-600">{r.label}</Text>
                      <Text className="text-sm font-semibold text-ink">{tk(r.value)}</Text>
                    </View>
                    <View className="mt-1.5 h-1.5 rounded-full bg-slate-100">
                      <View className="h-1.5 rounded-full bg-slate-400" style={{ width: `${(r.value / maxCost) * 100}%` }} />
                    </View>
                  </Pressable>
                ))}
              </View>
            </Card>
          </>
        ) : null}

        {/* Recent */}
        <Card padded={false}>
          <CardHeader title="Recent sales" subtitle="The last five sales recorded" actions={<LinkText label="View all" onPress={() => router.navigate('/sales')} />} />
          {data.sales.length === 0 ? (
            <EmptyState icon={ShoppingCart} title="No sales yet" message="Record your first sale to see it here." />
          ) : (
            data.sales.slice(0, 5).map((sale, i) => (
              <View key={sale.id} className={`flex-row items-center justify-between gap-3 px-4 py-3 ${i > 0 ? 'border-t border-slate-100' : ''}`}>
                <View className="min-w-0 flex-1">
                  <Text className="text-sm font-semibold text-ink" numberOfLines={1}>
                    {sale.customerName}
                  </Text>
                  <Text className="text-xs text-slate-500">{fmtDate(sale.createdAt)}</Text>
                </View>
                <Text className="text-sm font-semibold text-ink">{tk(sale.amount)}</Text>
                <StatusPill status={saleStatus(sale)} />
              </View>
            ))
          )}
        </Card>

        <Card padded={false}>
          <CardHeader title="Recently added animals" subtitle="The last five animals registered" actions={<LinkText label="View all" onPress={() => router.navigate('/cows')} />} />
          {data.cows.length === 0 ? (
            <EmptyState icon={PawPrint} title="No animals yet" message="Add your animals with a photo and Cow ID." />
          ) : (
            data.cows.slice(0, 5).map((cow, i) => (
              <Pressable
                key={cow.id}
                onPress={() => router.push(`/animal/${cow.id}`)}
                className={`flex-row items-center justify-between gap-3 px-4 py-3 ${i > 0 ? 'border-t border-slate-100' : ''}`}
              >
                <View className="min-w-0 flex-1">
                  <Text className="text-sm font-semibold text-ink" numberOfLines={1}>
                    {cow.name} <Text className="text-xs font-normal text-slate-500">({cow.tagNumber})</Text>
                  </Text>
                  <Text className="text-xs text-slate-500">{cow.breed || 'Breed not set'}</Text>
                </View>
                <StatusBadge status={cow.status} />
              </Pressable>
            ))
          )}
        </Card>
      </ScrollView>

      <PaymentModal party={pay?.party ?? null} mode={pay?.mode ?? 'collect'} onClose={() => setPay(null)} onSaved={() => {
        setPay(null);
        load();
      }} />
    </>
  );
}

function SeeAll({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="items-center py-3" accessibilityRole="link">
      <Text className="text-xs font-semibold text-slate-500">{label} →</Text>
    </Pressable>
  );
}

function LinkText({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="link" className="py-1">
      <Text className="text-xs font-semibold text-brand-700">{label}</Text>
    </Pressable>
  );
}
