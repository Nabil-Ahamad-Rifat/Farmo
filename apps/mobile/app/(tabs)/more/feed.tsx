import { useCallback, useEffect, useRef, useState } from 'react';
import { View, FlatList, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Plus, Edit3, Trash2, AlertTriangle, Wheat, Store, ChevronLeft, ChevronRight, ShoppingBag, Wallet, CalendarClock, BarChart2 } from 'lucide-react-native';
import type { FeedBatch, SupplierSummary } from '@farm/shared-types';
import { farmMonth, feedCostBetween, feedMonthSummary, isLowStock, shiftMonth, stockPercentage, totalStockValue } from '@farm/business-logic';
import { PendingEntries } from '@/src/components/PendingEntries';
import { Text } from '@/src/components/ui/Text';
import { mobileApiClient } from '@/src/lib/apiClient';
import { generateIdempotencyKey } from '@/src/lib/idempotency';
import { useCrudList } from '@/src/hooks/useCrudList';
import { tk, fmtDate, monthLabel } from '@/src/lib/format';
import {
  Button, Card, Chips, EmptyState, FormError, FormFooter, FormModal, IconButton, PageHeader, SearchInput, StatCard, StatGrid, TextField, useConfirm, useToast,
} from '@/src/components/ui';
import { StatusPill } from '@/src/components/StatusPill';
import { FeedPurchaseModal, PRESET_FEED_NAMES } from '@/src/components/FeedPurchaseModal';
import { cardShadow, colors } from '@/src/theme';

/** Paid/partial/due for a batch: derived for supplier purchases; older and supplier-less ones are paid. */
const payStatus = (b: FeedBatch) => (b.supplierId ? b.payStatus ?? 'pending' : 'paid');

/** Feed cost so far today, the same way the web's Feed page works it out (UTC day start to now). */
function costToday(feed: FeedBatch[]) {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  return feedCostBetween(
    feed.map((b) => ({ quantity: b.quantity, unitPrice: b.unitPrice, coverDays: b.coverDays ?? null, purchasedAt: b.purchasedAt ?? null, createdAt: b.createdAt })),
    start,
    new Date(),
  );
}

/** Feed Inventory, like the web's FeedManager: the month's feed account, stock and what is owed. */
export default function FeedScreen() {
  const { items: feed, loading, refreshing, refresh, reload, error: loadError } = useCrudList<FeedBatch>('/api/feed');
  const confirm = useConfirm();
  const toast = useToast();

  const [suppliers, setSuppliers] = useState<SupplierSummary[]>([]);
  const loadSuppliers = useCallback(
    () =>
      mobileApiClient
        .get<SupplierSummary[]>('/api/suppliers')
        .then(setSuppliers)
        .catch(() => {
          // Non-fatal: the supplier picker just shows no existing suppliers.
        }),
    [],
  );
  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  // A supplier page may have added purchases or payments.
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) firstFocus.current = false;
      else Promise.all([reload(), loadSuppliers()]);
    }, [reload, loadSuppliers]),
  );

  const [search, setSearch] = useState('');
  const currentMonth = farmMonth();
  // The Monthly Report links here as /more/feed?month=YYYY-MM.
  const params = useLocalSearchParams<{ month?: string }>();
  const asked = typeof params.month === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(params.month) && params.month <= currentMonth ? params.month : null;
  const [month, setMonth] = useState(asked ?? currentMonth);
  // A new link while the screen is already open moves the picker too.
  const [lastAsked, setLastAsked] = useState(asked);
  if (asked !== lastAsked) {
    setLastAsked(asked);
    if (asked) setMonth(asked);
  }
  const [view, setView] = useState<'month' | 'stock'>('month');
  const [purchase, setPurchase] = useState<{ batch: FeedBatch | null } | null>(null);

  const [usageFeed, setUsageFeed] = useState<FeedBatch | null>(null);
  const [usageForm, setUsageForm] = useState({ quantity: '', note: '' });
  const [usageError, setUsageError] = useState('');
  const [saving, setSaving] = useState(false);
  const [usageKey, setUsageKey] = useState(generateIdempotencyKey);

  async function afterChange() {
    await Promise.all([reload(), loadSuppliers()]);
  }

  function openUsage(item: FeedBatch) {
    setUsageFeed(item);
    setUsageForm({ quantity: '', note: '' });
    setUsageError('');
    setUsageKey(generateIdempotencyKey());
  }

  async function handleUsageSubmit() {
    if (!usageFeed) return;
    setSaving(true);
    setUsageError('');
    try {
      await mobileApiClient.post('/api/feed/usage', { feedBatchId: usageFeed.id, ...usageForm }, 'Failed to record usage', {
        idempotencyKey: usageKey,
      });
      setUsageFeed(null);
      toast('Feed use recorded');
      await reload();
    } catch (err) {
      setUsageError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: FeedBatch) {
    if (!(await confirm({ title: `Delete the ${item.name} purchase of ${item.quantity.toLocaleString()} kg?`, message: 'Its cost and any amount owed for it are removed too.', tone: 'danger', confirmLabel: 'Delete' }))) return;
    try {
      await mobileApiClient.delete(`/api/feed/${item.id}`, 'Failed to delete purchase');
      toast('Purchase deleted');
      await afterChange();
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  }

  const summary = feedMonthSummary(feed, month);
  const q = search.trim().toLowerCase();
  // "Bought in month" lists that month's purchases; "All in stock now" lists everything with stock left.
  const shown = view === 'stock' ? feed.filter((b) => b.remainingQuantity > 0) : summary.purchases;
  const filtered = shown.filter((item) => !q || item.name.toLowerCase().includes(q) || (item.supplier?.name ?? '').toLowerCase().includes(q));
  const owed = suppliers.reduce((s, x) => s + x.totalDue, 0);
  const runningLow = feed.filter((b) => b.schedule && b.schedule.remaining > 0 && b.schedule.daysLeft <= 1);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface">
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerClassName="gap-3 p-4 pb-10"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListHeaderComponent={
          <View className="mb-2 gap-4">
            <PageHeader
              title="Feed Inventory"
              subtitle="What you bought each month, from whom, what it cost and what is still owed."
              actions={<Button label="Buy feed" icon={Plus} onPress={() => setPurchase({ batch: null })} />}
            />
            <View className="flex-row items-center justify-between">
              <Pressable onPress={() => setMonth(shiftMonth(month, -1))} className="h-10 w-10 items-center justify-center rounded-control border border-line bg-white" accessibilityLabel="Previous month">
                <ChevronLeft size={16} color={colors.slate600} />
              </Pressable>
              <Text className="text-base font-bold text-ink">{monthLabel(month)}</Text>
              <Pressable
                onPress={() => month < currentMonth && setMonth(shiftMonth(month, 1))}
                disabled={month >= currentMonth}
                className={`h-10 w-10 items-center justify-center rounded-control border border-line bg-white ${month < currentMonth ? '' : 'opacity-40'}`}
                accessibilityLabel="Next month"
              >
                <ChevronRight size={16} color={colors.slate600} />
              </Pressable>
            </View>
            <FormError message={loadError} />
            <StatGrid>
              <StatCard
                label="Feed bought"
                value={`${summary.totals.kg.toLocaleString('en-IN')} kg`}
                icon={Wheat}
                hint={`${summary.totals.count} purchase${summary.totals.count === 1 ? '' : 's'} in ${monthLabel(month)}`}
              />
              <StatCard label="Total spent" value={tk(summary.totals.spent)} icon={ShoppingBag} hint="All feed bought this month" />
              <StatCard label="Paid" value={tk(summary.totals.paid)} icon={Wallet} tone="brand" />
              <StatCard label="Still owed" value={tk(summary.totals.owed)} icon={Store} tone="danger" hint="For this month's feed" />
            </StatGrid>

            {summary.byFeed.length ? (
              <Card padded={false}>
                <View className="flex-row bg-slate-50 px-4 py-2.5">
                  <Text className="flex-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Feed</Text>
                  <Text className="w-24 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">Quantity</Text>
                  <Text className="w-24 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">Spent</Text>
                </View>
                {summary.byFeed.map((f) => (
                  <View key={f.name} className="flex-row items-center border-t border-slate-100 px-4 py-2.5">
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-ink">{f.name}</Text>
                      <Text className="text-xs text-slate-500">
                        {f.count} purchase{f.count === 1 ? '' : 's'} · avg {tk(Math.round((f.spent / f.kg) * 100) / 100)}/kg
                      </Text>
                    </View>
                    <Text className="w-24 text-right text-sm text-slate-600">{f.kg.toLocaleString('en-IN')} kg</Text>
                    <Text className="w-24 text-right text-sm font-bold text-ink">{tk(f.spent)}</Text>
                  </View>
                ))}
                <View className="flex-row border-t border-line bg-slate-50 px-4 py-2.5">
                  <Text className="flex-1 text-sm font-bold text-ink">Total ({summary.totals.count})</Text>
                  <Text className="w-24 text-right text-sm font-bold text-ink">{summary.totals.kg.toLocaleString('en-IN')} kg</Text>
                  <Text className="w-24 text-right text-sm font-bold text-ink">{tk(summary.totals.spent)}</Text>
                </View>
              </Card>
            ) : null}

            <View className="gap-1.5">
              <View className="flex-row items-center gap-1.5">
                <CalendarClock size={13} color={colors.slate500} />
                <Text className="text-xs text-slate-500">
                  Feed cost today: <Text className="font-bold text-slate-700">{tk(costToday(feed))}</Text>
                </Text>
              </View>
              <View className="flex-row items-center gap-1.5">
                <BarChart2 size={13} color={colors.slate500} />
                <Text className="text-xs text-slate-500">
                  Stock value now: <Text className="font-bold text-slate-700">{tk(Math.round(totalStockValue(feed)))}</Text>
                </Text>
              </View>
              <Pressable onPress={() => router.navigate('/more/suppliers')} className="flex-row items-center gap-1.5" accessibilityRole="link">
                <Store size={13} color={colors.slate500} />
                <Text className="text-xs text-slate-500">
                  You owe suppliers in total: <Text className="font-bold text-red-600">{tk(owed)}</Text> →
                </Text>
              </Pressable>
            </View>

            {runningLow.length ? (
              <View className="flex-row items-start gap-3 rounded-card border border-amber-200 bg-amber-50 p-4" accessibilityRole="alert">
                <AlertTriangle size={16} color={colors.amber600} />
                <Text className="flex-1 text-sm text-amber-900">
                  <Text className="font-semibold">Running out soon:</Text>{' '}
                  {runningLow.map((b) => `${b.name} (${b.schedule!.remaining.toLocaleString()} kg left)`).join(', ')}. Time to buy more.
                </Text>
              </View>
            ) : null}

            <View className="flex-row flex-wrap items-center gap-1.5">
              <Text className="text-xs font-medium text-slate-500">Quick filter:</Text>
              {PRESET_FEED_NAMES.map((name) => (
                <Pressable
                  key={name}
                  onPress={() => setSearch(search === name ? '' : name)}
                  className={`rounded-full border px-3 py-1.5 ${search === name ? 'border-amber-600 bg-amber-600' : 'border-amber-200 bg-amber-50'}`}
                >
                  <Text className={`text-xs font-semibold ${search === name ? 'text-white' : 'text-amber-800'}`}>{name}</Text>
                </Pressable>
              ))}
            </View>
            <Chips
              options={[
                { value: 'month', label: `Bought in ${monthLabel(month).split(' ')[0]}` },
                { value: 'stock', label: 'All in stock now' },
              ]}
              value={view}
              onChange={setView}
            />
            <SearchInput value={search} onChangeText={setSearch} placeholder="Search feed or supplier..." />
            <PendingEntries match={/^\/api\/feed(\/usage)?$/} />
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon={Wheat}
            title={view === 'month' ? `No feed bought in ${monthLabel(month)}` : 'No feed in stock'}
            message={q ? 'Try another search.' : 'Buy feed to see it here.'}
          />
        }
        renderItem={({ item }) => {
          const s = item.schedule;
          const total = item.quantity * item.unitPrice;
          const due = item.supplierId ? Math.max(0, total - (item.paidAmount ?? 0)) : 0;
          const low = s ? s.remaining > 0 && s.daysLeft <= 1 : isLowStock(item);
          const finished = s ? s.remaining <= 0 : item.remainingQuantity <= 0;
          const pct = s ? Math.round((s.daysLeft / s.coverDays) * 100) : stockPercentage(item);
          return (
            <View style={cardShadow} className={`gap-2 rounded-card border border-line bg-white p-4 ${finished ? 'opacity-60' : ''}`}>
              <View className="flex-row items-start justify-between gap-3">
                <View className="min-w-0 flex-1">
                  <Text className="text-[15px] font-semibold text-ink">{item.name}</Text>
                  <Text className="text-xs text-slate-500">
                    {fmtDate(item.purchasedAt ?? item.createdAt)}
                    {item.supplier ? ' · ' : ''}
                    {item.supplier ? (
                      <Text className="font-semibold text-brand-700" onPress={() => router.push(`/supplier/${item.supplier!.id}`)}>
                        {item.supplier.name}
                      </Text>
                    ) : null}
                  </Text>
                </View>
                <View className="items-end gap-1">
                  <Text className="text-sm font-bold text-ink">{tk(total)}</Text>
                  <StatusPill status={payStatus(item)} />
                </View>
              </View>
              <Text className="text-xs text-slate-600">
                {item.quantity.toLocaleString()} kg at {tk(item.unitPrice)}/kg
                {due > 0 ? <Text className="font-semibold text-red-600"> · {tk(due)} due</Text> : null}
              </Text>
              <Text className="text-xs text-slate-600">
                {s ? `${tk(s.perDayCost)}/day · ${s.perDayQty.toLocaleString()} kg/day` : 'Days not set'}
              </Text>
              <View className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <View className={`h-full rounded-full ${low ? 'bg-red-500' : 'bg-brand-500'}`} style={{ width: `${Math.max(0, Math.min(pct, 100))}%` }} />
              </View>
              <View className="flex-row items-center justify-between gap-2">
                <Text className={`flex-1 text-xs ${low ? 'font-semibold text-red-600' : 'text-slate-500'}`}>
                  {s
                    ? finished
                      ? 'Finished'
                      : s.daysLeft <= 1
                        ? `Last day today · ${item.remainingQuantity.toLocaleString()} kg left`
                        : `${s.daysLeft} days left · to ${fmtDate(s.endsOn)} · ${item.remainingQuantity.toLocaleString()} kg left`
                    : `${item.remainingQuantity.toLocaleString()} of ${item.quantity.toLocaleString()} kg left${low && !finished ? ' · Low Stock' : ''}`}
                </Text>
              </View>
              <View className="flex-row gap-2">
                <Button label="Use" variant="amber" size="sm" disabled={finished} onPress={() => openUsage(item)} />
                <View className="flex-1" />
                <IconButton icon={Edit3} label="Edit purchase" onPress={() => setPurchase({ batch: item })} />
                <IconButton icon={Trash2} variant="danger" label="Delete purchase" onPress={() => handleDelete(item)} />
              </View>
            </View>
          );
        }}
      />

      <FeedPurchaseModal
        open={!!purchase}
        batch={purchase?.batch}
        suppliers={suppliers}
        onClose={() => setPurchase(null)}
        onSaved={async () => {
          const editing = !!purchase?.batch;
          setPurchase(null);
          toast(editing ? 'Purchase saved' : 'Feed purchase added');
          await afterChange();
        }}
      />

      <FormModal
        visible={!!usageFeed}
        title={usageFeed?.schedule ? 'Record extra use' : 'Record feed use'}
        subtitle={usageFeed?.name}
        onClose={() => setUsageFeed(null)}
        footer={<FormFooter onCancel={() => setUsageFeed(null)} onSubmit={handleUsageSubmit} loading={saving} label="Record use" />}
      >
        {usageFeed ? (
          <View className="rounded-control border border-amber-200 bg-amber-50 p-3">
            <Text className="text-sm text-amber-900">
              In stock: <Text className="font-bold">{usageFeed.remainingQuantity.toLocaleString()} kg</Text>
            </Text>
            {usageFeed.schedule ? (
              <Text className="mt-1 text-xs text-amber-800">
                {usageFeed.schedule.perDayQty} kg/day is taken off automatically. Record only extra use here — it lowers stock, not cost.
              </Text>
            ) : null}
          </View>
        ) : null}
        <FormError message={usageError} />
        <TextField label="Quantity used (kg) *" placeholder="e.g. 50" keyboardType="decimal-pad" value={usageForm.quantity} onChangeText={(v) => setUsageForm({ ...usageForm, quantity: v })} />
        <TextField label="Note" placeholder="e.g. Morning feeding" value={usageForm.note} onChangeText={(v) => setUsageForm({ ...usageForm, note: v })} />
      </FormModal>
    </View>
  );
}
