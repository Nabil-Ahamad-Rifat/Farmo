import { useCallback, useRef, useState } from 'react';
import { View, FlatList, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { AlertCircle, Store, PiggyBank, Wallet, Plus } from 'lucide-react-native';
import type { SupplierSummary } from '@farm/shared-types';
import { Text } from '@/src/components/ui/Text';
import { useCrudList } from '@/src/hooks/useCrudList';
import { tk } from '@/src/lib/format';
import { Button, EmptyState, FormError, IconButton, PageHeader, SearchInput, StatCard, StatGrid, ToggleChip, useToast } from '@/src/components/ui';
import { PaymentModal } from '@/src/components/PaymentModal';
import { SupplierFormModal } from '@/src/components/SupplierFormModal';
import { cardShadow } from '@/src/theme';

/** Suppliers & Payables, like the web's SupplierManager. */
export default function SuppliersScreen() {
  const { items: suppliers, loading, refreshing, refresh, reload, error } = useCrudList<SupplierSummary>('/api/suppliers');
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [owedOnly, setOwedOnly] = useState(false);
  const [paying, setPaying] = useState<SupplierSummary | null>(null);
  const [adding, setAdding] = useState(false);

  // A supplier page may have changed balances.
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) firstFocus.current = false;
      else reload();
    }, [reload])
  );

  const q = search.trim().toLowerCase();
  const filtered = suppliers.filter(
    (s) => (!q || s.name.toLowerCase().includes(q) || (s.phone ?? '').includes(q)) && (!owedOnly || s.totalDue > 0),
  );
  const totalDue = suppliers.reduce((sum, s) => sum + s.totalDue, 0);
  const totalAdvance = suppliers.reduce((sum, s) => sum + s.advance, 0);
  const owed = suppliers.filter((s) => s.totalDue > 0).length;

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
        keyExtractor={(s) => s.id}
        contentContainerClassName="gap-3 p-4 pb-10"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListHeaderComponent={
          <View className="mb-2 gap-4">
            <PageHeader
              title="Suppliers & Payables"
              subtitle="Where you buy feed, what you owe each one, and what you have paid."
              actions={<Button label="Add supplier" icon={Plus} onPress={() => setAdding(true)} />}
            />
            <FormError message={error} />
            <StatGrid>
              <StatCard label="Total you owe" value={tk(totalDue)} icon={AlertCircle} tone={totalDue > 0 ? 'danger' : 'neutral'} />
              <StatCard label="Suppliers owed" value={`${owed} of ${suppliers.length}`} icon={Store} />
              <StatCard label="Advance paid" value={tk(totalAdvance)} icon={PiggyBank} tone="brand" />
            </StatGrid>
            <SearchInput value={search} onChangeText={setSearch} placeholder="Search by name or phone..." />
            <ToggleChip label="I owe money" on={owedOnly} onChange={setOwedOnly} />
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon={Store}
            title={suppliers.length ? 'No suppliers match' : 'No suppliers yet'}
            message={suppliers.length ? 'Try another search.' : 'Add a supplier, or buy feed on credit and the supplier is added for you.'}
          />
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/supplier/${item.id}`)}
            style={cardShadow}
            className="flex-row items-center gap-3 rounded-card border border-line bg-white p-4"
            accessibilityRole="link"
          >
            <View className="h-10 w-10 items-center justify-center rounded-card bg-amber-600">
              <Text className="text-base font-bold text-white">{item.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-sm font-semibold text-ink" numberOfLines={1}>
                {item.name}
              </Text>
              <Text className="text-xs text-slate-500" numberOfLines={1}>
                Bought {tk(item.totalBought)} · paid {tk(item.totalPaid)}
              </Text>
            </View>
            {item.totalDue > 0 ? (
              <Text className="text-sm font-bold text-red-600">{tk(item.totalDue)}</Text>
            ) : item.advance > 0 ? (
              <Text className="text-xs font-semibold text-brand-700">Advance {tk(item.advance)}</Text>
            ) : (
              <Text className="text-xs font-semibold text-slate-400">Clear</Text>
            )}
            {item.totalDue > 0 ? <IconButton icon={Wallet} variant="amber" label={`Pay ${item.name}`} onPress={() => setPaying(item)} /> : null}
          </Pressable>
        )}
      />

      <PaymentModal
        party={paying}
        mode="pay"
        onClose={() => setPaying(null)}
        onSaved={async () => {
          setPaying(null);
          toast('Payment saved');
          await reload();
        }}
      />
      <SupplierFormModal
        visible={adding}
        onClose={() => setAdding(false)}
        onSaved={(s) => {
          setAdding(false);
          toast(`${s.name} added`);
          reload();
          router.push(`/supplier/${s.id}`);
        }}
      />
    </View>
  );
}
