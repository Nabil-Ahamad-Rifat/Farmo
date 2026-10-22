"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Edit3, PackageOpen, PawPrint, Hash } from 'lucide-react';
import type { OtherExpense } from '@farm/shared-types';
import { webApiClient } from '@farm/api-client';
import { LIST_PERIODS, inListPeriod, farmToday, type ListPeriod, sumAmounts } from '@farm/business-logic';
import Modal, { FormError, FormFooter } from '@/components/sales/Modal';
import { fmtDate, inputCls, labelCls, tk, toDay } from '@/components/sales/shared';
import { PageHeader, Card } from '@/components/ui/Card';
import { Button, buttonCls } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import { Badge, Chips, FilterBar, SearchInput } from '@/components/ui/Controls';
import { Table, THead, TBody, Th, Td, TRow } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/Empty';
import { useConfirm, useToast } from '@/components/ui/Feedback';

const CATEGORIES = [
  { value: 'vet', label: 'Veterinary' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'medicine', label: 'Medicine' },
  { value: 'transport', label: 'Transport' },
  { value: 'electricity', label: 'Electricity / utilities' },
  { value: 'repair', label: 'Repair & maintenance' },
  { value: 'other', label: 'Other' },
] as const;

/** A cost written on an animal record (treatment, vaccine, AI...). Edited on the animal's page. */
export interface AnimalCost {
  id: string;
  cowId: string;
  tagNumber: string;
  animalName: string;
  type: string;
  title: string | null;
  amount: number;
  date: string | Date;
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

/** One line in the list: an expense entered here, or an animal record's cost. */
type Row = { key: string; description: string; detail?: string; category: string; amount: number; date: string | Date; expense?: OtherExpense; cowId?: string };

const categoryLabel = (val: string) => (val === 'animal' ? 'Animal care' : CATEGORIES.find((c) => c.value === val)?.label ?? val);

export default function ExpenseManager({ initialExpenses, animalCosts = [] }: { initialExpenses: OtherExpense[]; animalCosts?: AnimalCost[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [period, setPeriod] = useState<ListPeriod>('month');
  const [editing, setEditing] = useState<OtherExpense | null | undefined>(undefined);

  async function handleDelete(exp: OtherExpense) {
    const ok = await confirm({ title: 'Delete this expense?', body: `${exp.description} · ${tk(exp.amount)} on ${fmtDate(exp.expenseDate)}`, tone: 'danger' });
    if (!ok) return;
    try {
      await webApiClient.delete(`/api/expenses/${exp.id}`, 'Failed to delete expense');
      toast('Expense deleted');
      router.refresh();
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  }

  const rows: Row[] = [
    ...initialExpenses.map((exp): Row => ({ key: 'e' + exp.id, description: exp.description, category: exp.category, amount: exp.amount, date: exp.expenseDate, expense: exp })),
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Other expenses"
        subtitle="Vet, medicine, equipment, transport, electricity and other costs. Costs written on animal records show here as Animal care."
        actions={
          <Button onClick={() => setEditing(null)}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Add expense
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard label="Total costs" value={tk(total)} Icon={PackageOpen} tone="danger" hint={periodLabel} />
        <StatCard label="Animal care" value={tk(animalTotal)} Icon={PawPrint} hint="From animal records" />
        <StatCard label="Records" value={String(filtered.length)} Icon={Hash} hint={categoryFilter === 'all' ? 'All categories' : categoryLabel(categoryFilter)} />
      </div>

      <Card>
        <div className="space-y-3 border-b border-line p-4 sm:px-6">
          <FilterBar>
            <SearchInput value={search} onChange={setSearch} placeholder="Search expenses or animals..." label="Search expenses" className="lg:max-w-sm lg:flex-1" />
            <Chips options={LIST_PERIODS} value={period} onChange={setPeriod} label="Period" />
          </FilterBar>
          <Chips
            options={[{ value: 'all', label: 'All categories' }, ...CATEGORIES, { value: 'animal', label: 'Animal care' }]}
            value={categoryFilter}
            onChange={setCategoryFilter}
            label="Category"
          />
        </div>

        {filtered.length === 0 ? (
          <EmptyState Icon={PackageOpen} title="No expenses in this view" body="Change the period or category, or add an expense." />
        ) : (
          <>
          {/* Phones: one row per record with the amount always visible. */}
          <ul className="divide-y divide-slate-100 sm:hidden">
            {filtered.map((row) => (
              <li key={row.key}>
                {row.expense ? (
                  <button type="button" onClick={() => setEditing(row.expense!)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">{row.description}</span>
                      <span className="block truncate text-xs text-slate-500">{categoryLabel(row.category)} · {fmtDate(row.date)}</span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">{tk(row.amount)}</span>
                  </button>
                ) : (
                  <Link href={`/dashboard/cows/${row.cowId}`} className="flex items-center gap-3 px-4 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">{row.description}</span>
                      <span className="block truncate text-xs text-slate-500">Animal care · {row.detail} · {fmtDate(row.date)}</span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">{tk(row.amount)}</span>
                  </Link>
                )}
              </li>
            ))}
          </ul>
          <Table className="hidden sm:block">
            <THead>
              <tr>
                <Th>Description</Th>
                <Th>Category</Th>
                <Th>Date</Th>
                <Th align="right">Amount</Th>
                <Th align="right"><span className="sr-only">Actions</span></Th>
              </tr>
            </THead>
            <TBody>
              {filtered.map((row) => (
                <TRow key={row.key}>
                  <Td>
                    <p className="font-semibold text-ink">{row.description}</p>
                    {row.detail && <p className="text-xs text-slate-500">{row.detail}</p>}
                  </Td>
                  <Td><Badge tone={row.category === 'animal' ? 'brand' : 'neutral'}>{categoryLabel(row.category)}</Badge></Td>
                  <Td className="whitespace-nowrap text-slate-500">{fmtDate(row.date)}</Td>
                  <Td align="right" className="whitespace-nowrap font-semibold text-ink">{tk(row.amount)}</Td>
                  <Td align="right">
                    {row.expense ? (
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setEditing(row.expense!)} aria-label={`Edit ${row.description}`}>
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(row.expense!)} aria-label={`Delete ${row.description}`} className="hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Link href={`/dashboard/cows/${row.cowId}`} className={buttonCls('secondary', 'sm')} title="Edit this cost on the animal's record">
                        <PawPrint className="h-3.5 w-3.5" aria-hidden="true" /> Open animal
                      </Link>
                    )}
                  </Td>
                </TRow>
              ))}
            </TBody>
          </Table>
          </>
        )}
      </Card>

      {editing !== undefined && (
        <ExpenseFormModal
          expense={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            toast(editing ? 'Expense updated' : 'Expense added');
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function ExpenseFormModal({ expense, onClose, onSaved }: { expense: OtherExpense | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    description: expense?.description ?? '',
    amount: expense ? String(expense.amount) : '',
    category: expense?.category ?? 'other',
    expenseDate: expense ? toDay(expense.expenseDate) : farmToday(),
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (expense) await webApiClient.put(`/api/expenses/${expense.id}`, form, 'Failed to save expense');
      else await webApiClient.post('/api/expenses', form, 'Failed to save expense');
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title={expense ? 'Edit expense' : 'Add expense'} onClose={onClose}>
      <FormError message={error} />
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label htmlFor="exp-desc" className={labelCls}>Description</label>
          <input id="exp-desc" required autoFocus maxLength={200} placeholder="e.g. Electricity bill" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="exp-amount" className={labelCls}>Amount (৳)</label>
            <input id="exp-amount" type="number" step="any" min="0.01" required inputMode="decimal" placeholder="e.g. 1200" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label htmlFor="exp-date" className={labelCls}>Date</label>
            <input id="exp-date" type="date" required max={farmToday()} value={form.expenseDate} onChange={(e) => setForm({ ...form, expenseDate: e.target.value })} className={inputCls} />
          </div>
        </div>
        <div>
          <label htmlFor="exp-cat" className={labelCls}>Category</label>
          <select id="exp-cat" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputCls}>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <p className="text-xs text-slate-500">Vet visits and medicine for one animal are better added on that animal&apos;s record, so they show in its history too.</p>
        <FormFooter onCancel={onClose} loading={loading} label={expense ? 'Save changes' : 'Add expense'} />
      </form>
    </Modal>
  );
}
