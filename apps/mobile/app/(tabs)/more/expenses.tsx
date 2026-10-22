import { useCallback, useEffect, useState } from 'react';
import { View, FlatList, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Plus, PackageOpen, PawPrint, Hash, Trash2 } from 'lucide-react-native';
import type { OtherExpense } from '@farm/shared-types';
import { LIST_PERIODS, inListPeriod, farmToday, sumAmounts, type ListPeriod } from '@farm/business-logic';
import { PendingEntries } from '@/src/components/PendingEntries';
import { Text } from '@/src/components/ui/Text';
import { mobileApiClient } from '@/src/lib/apiClient';
import { generateIdempotencyKey } from '@/src/lib/idempotency';
import { useCrudList } from '@/src/hooks/useCrudList';
import { fmtDate, tk, toDay } from '@/src/lib/format';
import {
  Button, ChipGroup, Chips, DateField, EmptyState, FormError, FormFooter, FormModal, PageHeader, SearchInput, StatCard, StatGrid, TextField, useConfirm, useToast,
} from '@/src/components/ui';
import { cardShadow, colors } from '@/src/theme';

const CATEGORIES = [
  { value: 'vet', label: 'Veterinary' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'medicine', label: 'Medicine' },
  { value: 'transport', label: 'Transport' },
  { value: 'electricity', label: 'Electricity / utilities' },
  { value: 'repair', label: 'Repair & maintenance' },
  { value: 'other', label: 'Other' },
];

/** A cost written on an animal record (GET /api/expenses/animal-care). Edited on the animal's page. */
interface AnimalCost {
  id: string;
  cowId: string;
  tagNumber: string;
  animalName: string;
  type: string;
  title: string | null;
  amount: number;
  date: string;
}

const RECORD_LABELS: Record<string, string> = {
  vaccine: 'Vaccine',
  insemination: 'Semen / AI',
  pregnancy_check: 'Pregnancy check',
  calving: 'Calving',
  treatment: 'Treatment',
  deworming: 'Deworming',
  weight: 'Weight',
  other: 'Animal care',
};

/** One line: an expense entered here, or an animal record's cost. */
type Row = { key: string; description: string; detail?: string; category: string; amount: number; date: string | Date; expense?: OtherExpense; cowId?: string };

const categoryLabel = (val: string) => (val === 'animal' ? 'Animal care' : CATEGORIES.find((c) => c.value === val)?.label ?? val);

/** Other expenses, like the web's ExpenseManager (animal-care costs included). */
export default function ExpensesScreen() {
  const { items: expenses, loading, refreshing, refresh, reload, error: loadError } = useCrudList<OtherExpense>('/api/expenses');
  const toast = useToast();
  const [animalCosts, setAnimalCosts] = useState<AnimalCost[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [period, setPeriod] = useState<ListPeriod>('month');
  const [editing, setEditing] = useState<OtherExpense | null | undefined>(undefined);

  const loadAnimalCosts = useCallback(
    () =>
      mobileApiClient
        .get<AnimalCost[]>('/api/expenses/animal-care')
        .then(setAnimalCosts)
        .catch(() => {
          // An older server has no animal-care list; the expenses still show.
        }),
    [],
  );
  useEffect(() => {
    loadAnimalCosts();
  }, [loadAnimalCosts]);

  const rows: Row[] = [
    ...expenses.map((exp): Row => ({ key: 'e' + exp.id, description: exp.description, category: exp.category, amount: exp.amount, date: exp.expenseDate, expense: exp })),
    ...animalCosts.map((a): Row => ({
      key: 'a' + a.id,
      description: `${RECORD_LABELS[a.type] ?? 'Animal care'}${a.title ? `: ${a.title}` : ''}`,
      detail: `${a.tagNumber}${a.animalName && a.animalName !== a.tagNumber ? ` · ${a.animalName}` : ''}`,
      category: 'animal',
      amount: a.amount,
      date: a.date,
      cowId: a.cowId,
    })),
  ].sort((x, y) => new Date(y.date).getTime() - new Date(x.date).getTime());

  const q = search.trim().toLowerCase();
  const filtered = rows.filter(
    (row) =>
      (!q || row.description.toLowerCase().includes(q) || (row.detail ?? '').toLowerCase().includes(q)) &&
      (categoryFilter === 'all' || row.category === categoryFilter) &&
      inListPeriod(row.date, period),
  );
  const total = sumAmounts(filtered);
  const animalTotal = sumAmounts(filtered.filter((r) => r.category === 'animal'));
  const periodLabel = LIST_PERIODS.find((p) => p.value === period)?.label ?? '';

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
        keyExtractor={(r) => r.key}
        contentContainerClassName="p-4 pb-10"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              await Promise.all([refresh(), loadAnimalCosts()]);
            }}
          />
        }
        ListHeaderComponent={
          <View className="mb-4 gap-4">
            <PageHeader
              title="Other expenses"
              subtitle="Vet, medicine, equipment, transport, electricity and other costs. Costs written on animal records show here as Animal care."
              actions={<Button label="Add expense" icon={Plus} onPress={() => setEditing(null)} />}
            />
            <FormError message={loadError} />
            <StatGrid>
              <StatCard label="Total costs" value={tk(total)} icon={PackageOpen} tone="danger" hint={periodLabel} />
              <StatCard label="Animal care" value={tk(animalTotal)} icon={PawPrint} hint="From animal records" />
              <StatCard label="Records" value={String(filtered.length)} icon={Hash} hint={categoryFilter === 'all' ? 'All categories' : categoryLabel(categoryFilter)} />
            </StatGrid>
            <SearchInput value={search} onChangeText={setSearch} placeholder="Search expenses or animals..." />
            <Chips options={LIST_PERIODS.map((p) => ({ value: p.value, label: p.label }))} value={period} onChange={(v) => setPeriod(v as ListPeriod)} />
            <Chips options={[{ value: 'all', label: 'All categories' }, ...CATEGORIES, { value: 'animal', label: 'Animal care' }]} value={categoryFilter} onChange={setCategoryFilter} />
            <PendingEntries match="/api/expenses" />
          </View>
        }
        ListEmptyComponent={<EmptyState icon={PackageOpen} title="No expenses in this view" message="Change the period or category, or add an expense." />}
        renderItem={({ item: row, index }) => (
          <Pressable
            onPress={() => (row.expense ? setEditing(row.expense) : router.push(`/animal/${row.cowId}`))}
            style={index === 0 ? cardShadow : undefined}
            className={`flex-row items-center gap-3 border-x border-line bg-white px-4 py-3 ${index === 0 ? 'rounded-t-card border-t' : 'border-t border-t-slate-100'} ${index === filtered.length - 1 ? 'rounded-b-card border-b' : ''}`}
            accessibilityRole={row.expense ? 'button' : 'link'}
          >
            <View className="min-w-0 flex-1">
              <Text className="text-sm font-semibold text-ink" numberOfLines={1}>
                {row.description}
              </Text>
              <Text className="text-xs text-slate-500" numberOfLines={1}>
                {row.expense ? `${categoryLabel(row.category)} · ${fmtDate(row.date)}` : `Animal care · ${row.detail} · ${fmtDate(row.date)}`}
              </Text>
            </View>
            {row.cowId ? <PawPrint size={14} color={colors.brand600} /> : null}
            <Text className="text-sm font-semibold text-ink">{tk(row.amount)}</Text>
          </Pressable>
        )}
      />

      {editing !== undefined ? (
        <ExpenseFormModal
          expense={editing}
          onClose={() => setEditing(undefined)}
          onSaved={(msg) => {
            setEditing(undefined);
            toast(msg);
            reload();
          }}
        />
      ) : null}
    </View>
  );
}

function ExpenseFormModal({ expense, onClose, onSaved }: { expense: OtherExpense | null; onClose: () => void; onSaved: (message: string) => void }) {
  const confirm = useConfirm();
  const [form, setForm] = useState({
    description: expense?.description ?? '',
    amount: expense ? String(expense.amount) : '',
    category: expense?.category ?? 'other',
    expenseDate: expense ? toDay(expense.expenseDate) : farmToday(),
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [createKey] = useState(generateIdempotencyKey);

  async function submit() {
    setError('');
    if (!form.description.trim() || !(parseFloat(form.amount) > 0)) {
      setError('Enter a description and an amount.');
      return;
    }
    setLoading(true);
    try {
      if (expense) await mobileApiClient.put(`/api/expenses/${expense.id}`, form, 'Failed to save expense');
      else await mobileApiClient.post('/api/expenses', form, 'Failed to save expense', { idempotencyKey: createKey });
      onSaved(expense ? 'Expense updated' : 'Expense added');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function remove() {
    if (!expense) return;
    const ok = await confirm({ title: 'Delete this expense?', message: `${expense.description} · ${tk(expense.amount)} on ${fmtDate(expense.expenseDate)}`, tone: 'danger', confirmLabel: 'Delete' });
    if (!ok) return;
    try {
      await mobileApiClient.delete(`/api/expenses/${expense.id}`, 'Failed to delete expense');
      onSaved('Expense deleted');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <FormModal
      visible
      title={expense ? 'Edit expense' : 'Add expense'}
      onClose={onClose}
      footer={<FormFooter onCancel={onClose} onSubmit={submit} loading={loading} label={expense ? 'Save changes' : 'Add expense'} />}
    >
      <FormError message={error} />
      <TextField label="Description *" maxLength={200} placeholder="e.g. Electricity bill" value={form.description} onChangeText={(v) => setForm({ ...form, description: v })} />
      <TextField label="Amount (৳) *" keyboardType="decimal-pad" placeholder="e.g. 1200" value={form.amount} onChangeText={(v) => setForm({ ...form, amount: v })} />
      <DateField label="Date" value={form.expenseDate} maxDate={new Date()} onChange={(v) => setForm({ ...form, expenseDate: v })} />
      <ChipGroup label="Category" options={CATEGORIES} value={form.category} onChange={(v) => setForm({ ...form, category: v })} />
      <Text className="text-xs text-slate-500">Vet visits and medicine for one animal are better added on that animal&apos;s record, so they show in its history too.</Text>
      {expense ? (
        <Pressable onPress={remove} className="flex-row items-center justify-center gap-1.5 py-2" accessibilityRole="button">
          <Trash2 size={14} color={colors.red600} />
          <Text className="text-sm font-semibold text-red-600">Delete expense</Text>
        </Pressable>
      ) : null}
    </FormModal>
  );
}
