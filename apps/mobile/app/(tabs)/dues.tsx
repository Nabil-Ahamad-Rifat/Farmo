import { useCallback, useState } from 'react';
import { View, FlatList, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Plus, AlertCircle, Users, PiggyBank, HandCoins } from 'lucide-react-native';
import type { CustomerSummary } from '@farm/shared-types';
import { Text } from '@/src/components/ui/Text';
import { useCrudList } from '@/src/hooks/useCrudList';
import { tk } from '@/src/lib/format';
import { Button, EmptyState, FormError, PageHeader, SearchInput, StatCard, StatGrid, ToggleChip } from '@/src/components/ui';
import { TypeBadge } from '@/src/components/StatusPill';
import { PaymentModal } from '@/src/components/PaymentModal';
import { CustomerFormModal } from '@/src/components/CustomerFormModal';
import { colors } from '@/src/theme';

const TYPE_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'regular', label: 'Regular' },
  { value: 'new', label: 'New' },
];

/** Customers & Dues, like the web's CustomerManager on a phone. */
export default function DuesScreen() {
  const { items: customers, loading, refreshing, refresh, reload, error } = useCrudList<CustomerSummary>('/api/customers');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [owingOnly, setOwingOnly] = useState(false);
  const [adding, setAdding] = useState(false);
  const [paying, setPaying] = useState<CustomerSummary | null>(null);

  // Sales and payments made on other screens show when coming back.
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const q = search.trim().toLowerCase();
  const filtered = customers.filter(
    (c) =>
      (!q || c.name.toLowerCase().includes(q) || (c.phone ?? '').includes(q)) &&
      (typeFilter === 'all' || c.type === typeFilter) &&
      (!owingOnly || c.totalDue > 0),
  );
  const totalDue = customers.reduce((s, c) => s + c.totalDue, 0);
  const owing = customers.filter((c) => c.totalDue > 0).length;
  const advance = customers.reduce((s, c) => s + c.advance, 0);

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
        title="Customers & Dues"
        subtitle="Who buys from you, who owes you, and how much."
        actions={<Button label="Add customer" icon={Plus} onPress={() => setAdding(true)} />}
      />
      <FormError message={error} />
      <StatGrid>
        <StatCard label="Total due to you" value={tk(totalDue)} icon={AlertCircle} tone="danger" />
        <StatCard label="Customers who owe" value={`${owing} of ${customers.length}`} icon={Users} />
        <StatCard label="Advance held" value={tk(advance)} icon={PiggyBank} tone="brand" />
      </StatGrid>
      <SearchInput value={search} onChangeText={setSearch} placeholder="Search by name or phone..." />
      <View className="flex-row flex-wrap items-center gap-2">
        <ToggleChip label="Owes money" on={owingOnly} onChange={setOwingOnly} />
        <View className="mx-1 h-8 w-px bg-slate-200" />
        {TYPE_FILTERS.map((t) => {
          const active = typeFilter === t.value;
          return (
            <Pressable
              key={t.value}
              onPress={() => setTypeFilter(t.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              className={`rounded-full px-4 py-2.5 ${active ? 'bg-ink' : 'border border-line bg-white'}`}
            >
              <Text className={`text-sm font-semibold ${active ? 'text-white' : 'text-slate-600'}`}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
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
            <EmptyState icon={Users} message={customers.length ? 'Nothing matches this search.' : 'No customers yet. They are added when you record a sale, or with Add customer.'} />
          </View>
        }
        renderItem={({ item: c, index }) => {
          const first = index === 0;
          const last = index === filtered.length - 1;
          return (
            <View
              className={`flex-row items-center gap-3 border-x border-line bg-white px-4 py-3 ${first ? 'rounded-t-card border-t' : 'border-t border-t-slate-100'} ${last ? 'rounded-b-card border-b' : ''}`}
            >
              <Pressable onPress={() => router.push(`/customer/${c.id}`)} className="min-w-0 flex-1" accessibilityRole="link">
                <View className="flex-row items-center gap-2">
                  <Text className="shrink text-sm font-semibold text-ink" numberOfLines={1}>
                    {c.name}
                  </Text>
                  <TypeBadge type={c.type} />
                </View>
                <Text className="text-xs text-slate-500" numberOfLines={1}>
                  Bought {tk(c.totalSold)} · paid {tk(c.totalPaid)}
                </Text>
              </Pressable>
              {c.totalDue > 0 ? (
                <Text className="text-sm font-bold text-red-600">{tk(c.totalDue)}</Text>
              ) : c.advance > 0 ? (
                <Text className="text-xs font-semibold text-brand-700">Advance {tk(c.advance)}</Text>
              ) : (
                <Text className="text-sm font-bold text-slate-400">Clear</Text>
              )}
              {c.totalDue > 0 ? (
                <Pressable
                  onPress={() => setPaying(c)}
                  accessibilityLabel={`Collect from ${c.name}`}
                  className="h-9 w-9 items-center justify-center rounded-control border border-brand-200 bg-brand-50"
                >
                  <HandCoins size={16} color={colors.brand600} />
                </Pressable>
              ) : null}
            </View>
          );
        }}
      />

      <CustomerFormModal
        visible={adding}
        onClose={() => setAdding(false)}
        onSaved={(saved) => {
          setAdding(false);
          router.push(`/customer/${saved.id}`);
        }}
      />
      <PaymentModal
        party={paying}
        mode="collect"
        onClose={() => setPaying(null)}
        onSaved={() => {
          setPaying(null);
          reload();
        }}
      />
    </View>
  );
}
