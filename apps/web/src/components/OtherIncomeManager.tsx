"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Edit3, Coins, Hash } from 'lucide-react';
import type { OtherIncome } from '@farm/shared-types';
import { webApiClient } from '@farm/api-client';
import { LIST_PERIODS, inListPeriod, farmToday, type ListPeriod, sumAmounts } from '@farm/business-logic';
import Modal, { FormError, FormFooter } from '@/components/sales/Modal';
import { fmtDate, inputCls, labelCls, tk, toDay } from '@/components/sales/shared';
import { PageHeader, Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import { Badge, Chips, FilterBar, SearchInput } from '@/components/ui/Controls';
import { Table, THead, TBody, Th, Td, TRow } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/Empty';
import { useConfirm, useToast } from '@/components/ui/Feedback';

const CATEGORIES = [
  { value: 'subsidy', label: 'Government subsidy' },
  { value: 'grant', label: 'Grant / aid' },
  { value: 'insurance', label: 'Insurance payout' },
  { value: 'donation', label: 'Donation' },
  { value: 'rental', label: 'Land / equipment rental' },
  { value: 'refund', label: 'Refund' },
  { value: 'other', label: 'Other' },
] as const;

const categoryLabel = (val: string) => CATEGORIES.find((c) => c.value === val)?.label ?? val;

export default function OtherIncomeManager({ initialIncomes }: { initialIncomes: OtherIncome[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [period, setPeriod] = useState<ListPeriod>('month');
  const [editing, setEditing] = useState<OtherIncome | null | undefined>(undefined);

  async function handleDelete(income: OtherIncome) {
    const ok = await confirm({ title: 'Delete this income?', body: `${income.description} · ${tk(income.amount)} on ${fmtDate(income.incomeDate)}`, tone: 'danger' });
    if (!ok) return;
    try {
      await webApiClient.delete(`/api/income/${income.id}`, 'Failed to delete income');
      toast('Income deleted');
      router.refresh();
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  }

  const q = search.trim().toLowerCase();
  const filtered = initialIncomes.filter(
    (inc) =>
      (!q || inc.description.toLowerCase().includes(q)) &&
      (categoryFilter === 'all' || inc.category === categoryFilter) &&
      inListPeriod(inc.incomeDate, period),
  );
  const total = sumAmounts(filtered);
  const periodLabel = LIST_PERIODS.find((p) => p.value === period)?.label ?? '';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Other income"
        subtitle="Subsidies, grants, insurance payouts, rent and any money that is not from sales."
        actions={
          <Button variant="brand" onClick={() => setEditing(null)}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Add income
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard label="Other income" value={tk(total)} Icon={Coins} tone="brand" hint={periodLabel} />
        <StatCard label="Records" value={String(filtered.length)} Icon={Hash} hint={categoryFilter === 'all' ? 'All categories' : categoryLabel(categoryFilter)} />
      </div>

      <Card>
        <div className="space-y-3 border-b border-line p-4 sm:px-6">
          <FilterBar>
            <SearchInput value={search} onChange={setSearch} placeholder="Search income..." label="Search income" className="lg:max-w-sm lg:flex-1" />
            <Chips options={LIST_PERIODS} value={period} onChange={setPeriod} label="Period" />
          </FilterBar>
          <Chips options={[{ value: 'all', label: 'All categories' }, ...CATEGORIES]} value={categoryFilter} onChange={setCategoryFilter} label="Category" />
        </div>

        {filtered.length === 0 ? (
          <EmptyState Icon={Coins} title="No income in this view" body="Change the period or category, or add an income record." />
        ) : (
          <>
          {/* Phones: one row per record with the amount always visible. */}
          <ul className="divide-y divide-slate-100 sm:hidden">
            {filtered.map((income) => (
              <li key={income.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{income.description}</p>
                  <p className="truncate text-xs text-slate-500">{categoryLabel(income.category)} · {fmtDate(income.incomeDate)}</p>
                </div>
                <p className="shrink-0 text-sm font-semibold tabular-nums text-brand-700">{tk(income.amount)}</p>
                <Button variant="ghost" size="icon" onClick={() => setEditing(income)} aria-label={`Edit ${income.description}`}>
                  <Edit3 className="h-4 w-4" />
                </Button>
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
              {filtered.map((income) => (
                <TRow key={income.id}>
                  <Td className="font-semibold text-ink">{income.description}</Td>
                  <Td><Badge>{categoryLabel(income.category)}</Badge></Td>
                  <Td className="whitespace-nowrap text-slate-500">{fmtDate(income.incomeDate)}</Td>
                  <Td align="right" className="whitespace-nowrap font-semibold text-brand-700">{tk(income.amount)}</Td>
                  <Td align="right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setEditing(income)} aria-label={`Edit ${income.description}`}>
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(income)} aria-label={`Delete ${income.description}`} className="hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </Td>
                </TRow>
              ))}
            </TBody>
          </Table>
          </>
        )}
      </Card>

      {editing !== undefined && (
        <IncomeFormModal
          income={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            toast(editing ? 'Income updated' : 'Income added');
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function IncomeFormModal({ income, onClose, onSaved }: { income: OtherIncome | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    description: income?.description ?? '',
    amount: income ? String(income.amount) : '',
    category: income?.category ?? 'other',
    incomeDate: income ? toDay(income.incomeDate) : farmToday(),
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (income) await webApiClient.put(`/api/income/${income.id}`, form, 'Failed to save income');
      else await webApiClient.post('/api/income', form, 'Failed to save income');
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title={income ? 'Edit income' : 'Add other income'} onClose={onClose}>
      <FormError message={error} />
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label htmlFor="inc-desc" className={labelCls}>Description</label>
          <input id="inc-desc" required autoFocus maxLength={200} placeholder="e.g. Government livestock subsidy" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="inc-amount" className={labelCls}>Amount (৳)</label>
            <input id="inc-amount" type="number" step="any" min="0.01" required inputMode="decimal" placeholder="e.g. 5000" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label htmlFor="inc-date" className={labelCls}>Date</label>
            <input id="inc-date" type="date" required max={farmToday()} value={form.incomeDate} onChange={(e) => setForm({ ...form, incomeDate: e.target.value })} className={inputCls} />
          </div>
        </div>
        <div>
          <label htmlFor="inc-cat" className={labelCls}>Category</label>
          <select id="inc-cat" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputCls}>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <FormFooter onCancel={onClose} loading={loading} label={income ? 'Save changes' : 'Add income'} />
      </form>
    </Modal>
  );
}
