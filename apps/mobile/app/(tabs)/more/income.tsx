import { useEffect, useState } from 'react';
import { View, FlatList, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { Plus, Edit3, Coins, Hash } from 'lucide-react-native';
import type { OtherIncome } from '@farm/shared-types';
import { LIST_PERIODS, inListPeriod, farmToday, sumAmounts, type ListPeriod } from '@farm/business-logic';
import { PendingEntries } from '@/src/components/PendingEntries';
import { Text } from '@/src/components/ui/Text';
import { mobileApiClient } from '@/src/lib/apiClient';
import { generateIdempotencyKey } from '@/src/lib/idempotency';
import { useCrudList } from '@/src/hooks/useCrudList';
import { fmtDate, tk, toDay } from '@/src/lib/format';
import {
  Button, Chips, DateField, EmptyState, FormError, FormFooter, FormModal, PageHeader, SearchInput, SelectField, StatCard, StatGrid, TextField,
  useConfirm, useToast,
} from '@/src/components/ui';
import { colors } from '@/src/theme';

const CATEGORIES = [
  { value: 'subsidy', label: 'Government subsidy' },
  { value: 'grant', label: 'Grant / aid' },
  { value: 'insurance', label: 'Insurance payout' },
  { value: 'donation', label: 'Donation' },
  { value: 'rental', label: 'Land / equipment rental' },
  { value: 'refund', label: 'Refund' },
  { value: 'other', label: 'Other' },
];

const categoryLabel = (val: string) => CATEGORIES.find((c) => c.value === val)?.label ?? val;
const PERIODS = LIST_PERIODS.map((p) => ({ value: p.value, label: p.label }));

/** Other income, like the web's OtherIncomeManager on a phone. */
export default function IncomeScreen() {
  const { items: incomes, loading, refreshing, refresh, reload, error } = useCrudList<OtherIncome>('/api/income');
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [period, setPeriod] = useState<ListPeriod>('month');
  // undefined = closed, null = adding, a record = editing.
  const [editing, setEditing] = useState<OtherIncome | null | undefined>(undefined);

  const q = search.trim().toLowerCase();
  const filtered = incomes.filter(
    (inc) =>
      (!q || inc.description.toLowerCase().includes(q)) &&
      (categoryFilter === 'all' || inc.category === categoryFilter) &&
      // Days counted on the farm's clock (Bangladesh), same as the web.
      inListPeriod(inc.incomeDate, period),
  );
  const total = sumAmounts(filtered);
  const periodLabel = LIST_PERIODS.find((p) => p.value === period)?.label ?? '';

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
        title="Other income"
        subtitle="Subsidies, grants, insurance payouts, rent and any money that is not from sales."
        actions={<Button label="Add income" icon={Plus} variant="brand" onPress={() => setEditing(null)} />}
      />
      <FormError message={error} />
      <StatGrid>
        <StatCard label="Other income" value={tk(total)} icon={Coins} tone="brand" hint={periodLabel} />
        <StatCard label="Records" value={String(filtered.length)} icon={Hash} hint={categoryFilter === 'all' ? 'All categories' : categoryLabel(categoryFilter)} />
      </StatGrid>
      <SearchInput value={search} onChangeText={setSearch} placeholder="Search income..." />
      <View className="gap-2">
        <Chips options={PERIODS} value={period} onChange={setPeriod} />
        <Chips options={[{ value: 'all', label: 'All categories' }, ...CATEGORIES]} value={categoryFilter} onChange={setCategoryFilter} />
      </View>
      <PendingEntries match="/api/income" />
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
            <EmptyState icon={Coins} title="No income in this view" message="Change the period or category, or add an income record." />
          </View>
        }
        renderItem={({ item: income, index }) => {
          const first = index === 0;
          const last = index === filtered.length - 1;
          return (
            <View
              className={`flex-row items-center gap-3 border-x border-line bg-white px-4 py-3 ${first ? 'rounded-t-card border-t' : 'border-t border-t-slate-100'} ${last ? 'rounded-b-card border-b' : ''}`}
            >
              <View className="min-w-0 flex-1">
                <Text className="text-sm font-semibold text-ink" numberOfLines={1}>
                  {income.description}
                </Text>
                <Text className="text-xs text-slate-500" numberOfLines={1}>
                  {categoryLabel(income.category)} · {fmtDate(income.incomeDate)}
                </Text>
              </View>
              <Text className="text-sm font-semibold text-brand-700">{tk(income.amount)}</Text>
              <Pressable onPress={() => setEditing(income)} className="rounded-lg p-2" accessibilityLabel={`Edit ${income.description}`}>
                <Edit3 size={16} color={colors.slate400} />
              </Pressable>
            </View>
          );
        }}
      />

      <IncomeFormModal
        visible={editing !== undefined}
        income={editing ?? null}
        onClose={() => setEditing(undefined)}
        onSaved={(message) => {
          setEditing(undefined);
          toast(message);
          reload();
        }}
      />
    </View>
  );
}

const fromIncome = (income: OtherIncome | null) => ({
  description: income?.description ?? '',
  amount: income ? String(income.amount) : '',
  category: income?.category ?? 'other',
  incomeDate: income ? toDay(income.incomeDate) : farmToday(),
});

function IncomeFormModal({
  visible,
  income,
  onClose,
  onSaved,
}: {
  visible: boolean;
  income: OtherIncome | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const confirm = useConfirm();
  const [form, setForm] = useState(() => fromIncome(income));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [key, setKey] = useState(generateIdempotencyKey);

  useEffect(() => {
    if (!visible) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(fromIncome(income));
    setError('');
    setKey(generateIdempotencyKey());
  }, [visible, income]);

  async function submit() {
    setError('');
    if (!form.description.trim()) return setError('Please enter a description.');
    if (!(parseFloat(form.amount) > 0)) return setError('Enter an amount more than 0.');
    setLoading(true);
    try {
      if (income) await mobileApiClient.put(`/api/income/${income.id}`, form, 'Failed to save income');
      else await mobileApiClient.post('/api/income', form, 'Failed to save income', { idempotencyKey: key });
      onSaved(income ? 'Income updated' : 'Income added');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function remove() {
    if (!income) return;
    const ok = await confirm({ title: 'Delete this income?', message: `${income.description} · ${tk(income.amount)} on ${fmtDate(income.incomeDate)}`, confirmLabel: 'Delete', tone: 'danger' });
    if (!ok) return;
    try {
      await mobileApiClient.delete(`/api/income/${income.id}`, 'Failed to delete income');
      onSaved('Income deleted');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <FormModal
      visible={visible}
      title={income ? 'Edit income' : 'Add other income'}
      onClose={onClose}
      footer={<FormFooter onCancel={onClose} onSubmit={submit} loading={loading} label={income ? 'Save changes' : 'Add income'} />}
    >
      <FormError message={error} />
      <TextField label="Description" maxLength={200} placeholder="e.g. Government livestock subsidy" value={form.description} onChangeText={(v) => setForm({ ...form, description: v })} />
      <TextField label="Amount (৳)" keyboardType="decimal-pad" placeholder="e.g. 5000" value={form.amount} onChangeText={(v) => setForm({ ...form, amount: v })} />
      <DateField label="Date" value={form.incomeDate} onChange={(v) => setForm({ ...form, incomeDate: v })} maxDate={new Date()} />
      <SelectField label="Category" placeholder="Choose a category" value={form.category} options={CATEGORIES} onChange={(v) => setForm({ ...form, category: v })} />
      {income ? (
        <Pressable onPress={remove} className="self-start py-1" accessibilityRole="button">
          <Text className="text-sm font-semibold text-red-600">Delete this income</Text>
        </Pressable>
      ) : null}
    </FormModal>
  );
}
