import { useCallback, useRef, useState } from 'react';
import { View, FlatList, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Plus, HandCoins, PiggyBank, Wallet, Users, Phone } from 'lucide-react-native';
import type { WorkerListItem } from '@farm/shared-types';
import { Text } from '@/src/components/ui/Text';
import { useCrudList } from '@/src/hooks/useCrudList';
import { tk } from '@/src/lib/format';
import { Button, Chips, EmptyState, FormError, PageHeader, SearchInput, StatCard, StatGrid, useToast } from '@/src/components/ui';
import { WorkerFormModal, WorkerPaymentModal } from '@/src/components/workers/WorkerModals';
import { BalancePill, WorkerStatusBadge } from '@/src/components/workers/BalancePill';
import { payLabel } from '@/src/components/workers/shared';
import { cardShadow, colors } from '@/src/theme';

const FILTERS = [
  { value: 'active', label: 'Working' },
  { value: 'owed', label: 'You owe' },
  { value: 'advance', label: 'Advance' },
  { value: 'left', label: 'Left' },
  { value: 'all', label: 'All' },
] as const;
type Filter = (typeof FILTERS)[number]['value'];

const MATCHES: Record<Filter, (w: WorkerListItem) => boolean> = {
  active: (w) => w.status !== 'left',
  owed: (w) => w.account.balance > 0.004,
  advance: (w) => w.account.balance < -0.004,
  left: (w) => w.status === 'left',
  all: () => true,
};

/** Workers, like the web's EmployeeManager: pay accounts, advances and a Pay button on every row. */
export default function WorkersScreen() {
  const { items: workers, loading, refreshing, error, refresh, reload } = useCrudList<WorkerListItem>('/api/employees');
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('active');
  const [adding, setAdding] = useState(false);
  const [paying, setPaying] = useState<WorkerListItem | null>(null);

  // Coming back from a worker's page: pick up pay or absences added there.
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) firstFocus.current = false;
      else reload();
    }, [reload]),
  );

  // Farm-wide totals: never affected by the search box or filter.
  const owed = workers.reduce((s, w) => s + Math.max(0, w.account.balance), 0);
  const advances = workers.reduce((s, w) => s + Math.max(0, -w.account.balance), 0);
  const monthEarned = workers.reduce((s, w) => s + w.thisMonth.earned, 0);
  const monthPaid = workers.reduce((s, w) => s + w.thisMonth.paid, 0);
  const working = workers.filter((w) => w.status !== 'left').length;

  const q = search.trim().toLowerCase();
  const shown = workers.filter(
    (w) => MATCHES[filter](w) && (!q || w.name.toLowerCase().includes(q) || w.role.toLowerCase().includes(q) || (w.phone ?? '').includes(q)),
  );

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
        data={shown}
        keyExtractor={(item) => item.id}
        contentContainerClassName="p-4 pb-10"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListHeaderComponent={
          <View className="mb-4 gap-4">
            <PageHeader
              title="Workers"
              subtitle="Pay, advances and absences of every worker. Monthly pay is salary ÷ 30 per day."
              actions={<Button label="Add worker" icon={Plus} variant="brand" onPress={() => setAdding(true)} />}
            />
            <FormError message={error} />
            <StatGrid>
              <StatCard label="You owe workers" value={tk(owed)} icon={HandCoins} tone={owed > 0 ? 'danger' : 'neutral'} hint="Earned but not paid yet" />
              <StatCard label="Advances given" value={tk(advances)} icon={PiggyBank} hint="Paid more than earned" />
              <StatCard label="Labour this month" value={tk(monthEarned)} icon={Wallet} hint={`Paid ${tk(monthPaid)} this month`} />
              <StatCard label="Working now" value={String(working)} icon={Users} tone="brand" hint={`${workers.length} in total`} />
            </StatGrid>
            <SearchInput value={search} onChangeText={setSearch} placeholder="Search by name, work or phone..." />
            <Chips options={FILTERS.map((f) => ({ value: f.value, label: f.label, count: workers.filter(MATCHES[f.value]).length }))} value={filter} onChange={setFilter} />
          </View>
        }
        ListEmptyComponent={
          <EmptyState icon={Users} message={workers.length === 0 ? 'No workers yet. Add your first worker.' : 'No workers match this search or filter.'} />
        }
        renderItem={({ item: w, index }) => (
          <View
            style={index === 0 ? cardShadow : undefined}
            className={`flex-row items-center gap-3 border-x border-line bg-white px-4 py-3.5 ${index === 0 ? 'rounded-t-card border-t' : 'border-t border-t-slate-100'} ${index === shown.length - 1 ? 'rounded-b-card border-b' : ''}`}
          >
            <Pressable onPress={() => router.push(`/worker/${w.id}`)} className="min-w-0 flex-1 flex-row items-center gap-3" accessibilityRole="link">
              <View className="h-11 w-11 items-center justify-center rounded-card bg-ink">
                <Text className="text-base font-bold text-white">{w.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View className="min-w-0 flex-1">
                <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
                  <Text className="text-sm font-bold text-ink" numberOfLines={1}>
                    {w.name}
                  </Text>
                  {w.status === 'left' ? <WorkerStatusBadge status="left" /> : null}
                </View>
                <Text className="text-xs text-slate-500" numberOfLines={1}>
                  {w.role} · {payLabel(w)}
                </Text>
                <View className="mt-0.5 flex-row items-center gap-1">
                  {w.phone ? <Phone size={11} color={colors.slate500} /> : null}
                  <Text className="text-xs text-slate-500" numberOfLines={1}>
                    {w.phone ? `${w.phone} · ` : ''}This month {tk(w.thisMonth.earned)}
                    {w.thisMonth.daysAbsent > 0 ? ` · ${w.thisMonth.daysAbsent} absent` : ''}
                  </Text>
                </View>
              </View>
            </Pressable>
            <View className="items-end gap-1.5">
              <BalancePill balance={w.account.balance} />
              <Pressable
                onPress={() => setPaying(w)}
                accessibilityRole="button"
                accessibilityLabel={`Pay ${w.name}`}
                className="h-10 flex-row items-center gap-1.5 rounded-control border border-brand-200 bg-brand-50 px-3.5"
              >
                <Wallet size={16} color={colors.brand700} />
                <Text className="text-sm font-semibold text-brand-700">Pay</Text>
              </Pressable>
            </View>
          </View>
        )}
      />

      {adding ? (
        <WorkerFormModal
          onClose={() => setAdding(false)}
          onSaved={(saved) => {
            setAdding(false);
            toast(`${saved.name} added`);
            reload();
            router.push(`/worker/${saved.id}`);
          }}
        />
      ) : null}
      {paying ? (
        <WorkerPaymentModal
          worker={paying}
          onClose={() => setPaying(null)}
          onSaved={() => {
            toast(`Paid ${paying.name}`);
            setPaying(null);
            reload();
          }}
        />
      ) : null}
    </View>
  );
}
