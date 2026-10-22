import { useCallback, useEffect, useState } from 'react';
import { View, FlatList, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Plus, Users, Edit3, Trash2, Wallet, Milk, HandCoins, AlertCircle, ShoppingCart } from 'lucide-react-native';
import type { Sale } from '@farm/shared-types';
import { LIST_PERIODS, inListPeriod, type ListPeriod } from '@farm/business-logic';
import { PendingEntries } from '@/src/components/PendingEntries';
import { Text } from '@/src/components/ui/Text';
import { mobileApiClient } from '@/src/lib/apiClient';
import { useCrudList } from '@/src/hooks/useCrudList';
import { useSaleOptions } from '@/src/hooks/useSaleOptions';
import { tk, fmtDate } from '@/src/lib/format';
import { Button, Chips, EmptyState, FormError, PageHeader, SearchInput, StatCard, StatGrid, useConfirm, useToast } from '@/src/components/ui';
import { StatusPill } from '@/src/components/StatusPill';
import { SaleFormModal } from '@/src/components/SaleFormModal';
import { colors } from '@/src/theme';

const PRODUCTS: Record<string, { label: string; unit: string }> = {
  milk: { label: 'Milk', unit: 'L' },
  cow_sale: { label: 'Cow', unit: 'head' },
  other: { label: 'Other', unit: '' },
  general: { label: 'General', unit: '' },
  products: { label: 'Products', unit: '' },
};

const PERIODS = LIST_PERIODS.map((p) => ({ value: p.value, label: p.label }));
const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'paid', label: 'Paid' },
  { value: 'partial', label: 'Partial' },
  { value: 'pending', label: 'Due' },
];
const TYPE_FILTERS = [
  { value: 'all', label: 'All customers' },
  { value: 'regular', label: 'Regular' },
  { value: 'new', label: 'New' },
];

/** Paid amount for any sale: derived for customer sales, hand-set status for older ones. */
const salePaid = (s: Sale) => (s.customerId ? s.paidAmount ?? 0 : s.status === 'paid' ? s.amount : 0);
const saleStatus = (s: Sale) => (s.customerId ? s.status : s.status === 'paid' ? 'paid' : 'pending');

/** "1,250.5 L" */
const litres = (n: number) => `${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })} L`;

/** Sales, like the web's SalesManager on a phone. */
export default function SalesScreen() {
  const { items: sales, loading, refreshing, refresh, reload, error: loadError } = useCrudList<Sale>('/api/sales');
  const options = useSaleOptions();
  const confirm = useConfirm();
  const toast = useToast();
  const params = useLocalSearchParams<{ new?: string }>();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [period, setPeriod] = useState<ListPeriod>('month');
  const [modal, setModal] = useState<{ sale: Sale | null } | null>(null);

  // "Record sale" on Home opens this screen with ?new=1.
  useEffect(() => {
    if (params.new !== '1') return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setModal({ sale: null });
    router.setParams({ new: undefined });
  }, [params.new]);

  // A sale or payment made elsewhere (Home, a customer's page) shows when coming back.
  const { reload: reloadOptions } = options;
  const refreshAll = useCallback(async () => {
    await Promise.all([reload(), reloadOptions()]);
  }, [reload, reloadOptions]);
  useFocusEffect(
    useCallback(() => {
      refreshAll();
    }, [refreshAll])
  );

  async function handleDelete(sale: Sale) {
    const paid = salePaid(sale);
    const msg =
      paid > 0 && sale.customerId
        ? `Delete this sale of ${tk(sale.amount)}? The ${tk(paid)} paid on it stays with ${sale.customerName} and will cover their other dues (or become advance).`
        : `Delete this sale of ${tk(sale.amount)}?`;
    if (!(await confirm({ title: msg, confirmLabel: 'Delete', tone: 'danger' }))) return;
    try {
      await mobileApiClient.delete(`/api/sales/${sale.id}`, 'Failed to delete sale.');
      toast('Sale deleted');
      await refreshAll();
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  }

  const q = search.trim().toLowerCase();
  const filtered = sales.filter((sale) => {
    const matchesSearch =
      !q ||
      sale.customerName.toLowerCase().includes(q) ||
      (!!sale.cow && (sale.cow.name.toLowerCase().includes(q) || sale.cow.tagNumber.toLowerCase().includes(q)));
    const matchesStatus = statusFilter === 'all' || saleStatus(sale) === statusFilter;
    const matchesType = typeFilter === 'all' || sale.customer?.type === typeFilter;
    // Days counted on the farm's clock (Bangladesh), same as the web Sales page.
    return matchesSearch && matchesStatus && matchesType && inListPeriod(sale.createdAt, period);
  });

  const sold = filtered.reduce((s, x) => s + x.amount, 0);
  const paid = filtered.reduce((s, x) => s + salePaid(x), 0);
  // Milk litres and taka in the same filtered sales (the rule milkLitres uses in business-logic).
  const milk = filtered.filter((x) => x.saleType === 'milk');
  const milkLitres = milk.reduce((s, x) => s + (x.quantity ?? 0), 0);
  const milkAmount = milk.reduce((s, x) => s + x.amount, 0);
  const totalDue = options.customers.reduce((s, c) => s + Math.max(0, c.totalDue), 0);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator />
      </View>
    );
  }

  const header = (
    <View className="gap-4 pb-4">
      <PageHeader
        title="Sales"
        subtitle="Every sale with who bought, what, how much, and what is still due."
        actions={
          <>
            <Button label="Customers & dues" icon={Users} variant="secondary" onPress={() => router.navigate('/dues')} />
            <Button label="Record sale" icon={Plus} onPress={() => setModal({ sale: null })} />
          </>
        }
      />
      <FormError message={loadError} />
      <StatGrid>
        <StatCard label="Sold (filtered)" value={tk(sold)} icon={Wallet} hint={`${filtered.length} sale${filtered.length === 1 ? '' : 's'}`} />
        <StatCard
          label="Milk sold"
          value={litres(milkLitres)}
          icon={Milk}
          hint={milkLitres > 0 ? `${tk(milkAmount)} · avg ${tk(Math.round((milkAmount / milkLitres) * 100) / 100)}/L` : 'No milk sales in this view'}
        />
        <StatCard label="Received on these sales" value={tk(paid)} icon={HandCoins} tone="brand" />
        <StatCard label="Total due — all customers" value={tk(totalDue)} icon={AlertCircle} tone="danger" hint="View who owes →" href="/dues" />
      </StatGrid>
      <View className="gap-2">
        <Chips options={PERIODS} value={period} onChange={setPeriod} />
        <Chips options={STATUS_FILTERS} value={statusFilter} onChange={setStatusFilter} />
        <Chips options={TYPE_FILTERS} value={typeFilter} onChange={setTypeFilter} />
      </View>
      <SearchInput value={search} onChangeText={setSearch} placeholder="Search by customer name or cow tag..." />
      <PendingEntries match="/api/sales" />
    </View>
  );

  return (
    <View className="flex-1 bg-surface">
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerClassName="p-4 pb-10"
        ListHeaderComponent={header}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListEmptyComponent={
          <View className="rounded-card border border-line bg-white">
            <EmptyState icon={ShoppingCart} message="No sales match these filters." />
          </View>
        }
        renderItem={({ item: sale, index }) => {
          const info = PRODUCTS[sale.saleType] ?? { label: sale.saleType, unit: '' };
          const due = Math.max(0, sale.amount - salePaid(sale));
          const first = index === 0;
          const last = index === filtered.length - 1;
          return (
            <View
              className={`flex-row items-start gap-3 border-x border-line bg-white px-4 py-3.5 ${first ? 'rounded-t-card border-t' : 'border-t border-t-slate-100'} ${last ? 'rounded-b-card border-b' : ''}`}
            >
              <View className="min-w-0 flex-1">
                <View className="flex-row flex-wrap items-center gap-2">
                  {sale.customerId ? (
                    <Pressable onPress={() => router.push(`/customer/${sale.customerId}`)} accessibilityRole="link" className="shrink">
                      <Text className="text-sm font-semibold text-ink" numberOfLines={1}>
                        {sale.customerName}
                      </Text>
                    </Pressable>
                  ) : (
                    <Text className="shrink text-sm font-semibold text-ink" numberOfLines={1}>
                      {sale.customerName}
                    </Text>
                  )}
                  <StatusPill status={saleStatus(sale)} />
                </View>
                <Text className="mt-0.5 text-xs text-slate-500" numberOfLines={2}>
                  {info.label}
                  {sale.quantity != null && sale.unitPrice != null ? ` · ${sale.quantity}${info.unit ? ` ${info.unit}` : ''} × ${tk(sale.unitPrice)}` : ''} · {fmtDate(sale.createdAt)}
                  {sale.cow ? ` · ${sale.cow.name} (${sale.cow.tagNumber})` : ''}
                </Text>
                {sale.notes ? (
                  <Text className="mt-0.5 text-xs text-slate-400" numberOfLines={1}>
                    {sale.notes}
                  </Text>
                ) : null}
              </View>
              <View className="items-end">
                <Text className="text-sm font-bold text-ink">{tk(sale.amount)}</Text>
                {due > 0 ? <Text className="text-xs font-semibold text-red-600">Due {tk(due)}</Text> : null}
                <View className="mt-1 flex-row gap-1">
                  <Pressable onPress={() => setModal({ sale })} className="rounded-lg p-2" accessibilityLabel={`Edit sale to ${sale.customerName}`}>
                    <Edit3 size={16} color={colors.slate400} />
                  </Pressable>
                  <Pressable onPress={() => handleDelete(sale)} className="rounded-lg p-2" accessibilityLabel={`Delete sale to ${sale.customerName}`}>
                    <Trash2 size={16} color={colors.slate400} />
                  </Pressable>
                </View>
              </View>
            </View>
          );
        }}
      />

      <SaleFormModal
        open={!!modal}
        sale={modal?.sale}
        customers={options.customers}
        activeCows={options.activeCows}
        defaultMilkPrice={options.defaultMilkPrice}
        onClose={() => setModal(null)}
        onSaved={async () => {
          setModal(null);
          await refreshAll();
        }}
      />
    </View>
  );
}
