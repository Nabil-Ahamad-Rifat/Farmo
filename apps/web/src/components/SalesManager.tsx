"use client";

import { useConfirm, useToast } from '@/components/ui/Feedback';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Search, Trash2, Edit3, Wallet, HandCoins, AlertCircle, FileText, Users, Milk } from 'lucide-react';
import type { Cow, Sale } from '@farm/shared-types';
import { webApiClient } from '@farm/api-client';
import { LIST_PERIODS, inListPeriod, type ListPeriod } from '@farm/business-logic';
import SaleFormModal from '@/components/sales/SaleFormModal';
import type { PickerCustomer } from '@/components/sales/CustomerPicker';
import {
  SummaryCard,
  PaymentStatusPill,
  CustomerTypeBadge,
  productTypeInfo,
  salePaid,
  tk,
  fmtDate,
  litres,
} from '@/components/sales/shared';

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'paid', label: 'Paid' },
  { value: 'partial', label: 'Partial' },
  { value: 'pending', label: 'Due' },
];

const chip = (active: boolean) =>
  `rounded-control px-3.5 py-2 text-xs font-semibold transition ${
    active ? 'bg-ink text-white shadow-card' : 'border border-line bg-white text-slate-600 hover:bg-slate-50'
  }`;

export default function SalesManager({
  initialSales,
  activeCows,
  customers,
  totalDue,
  defaultMilkPrice,
}: {
  initialSales: Sale[];
  activeCows: Cow[];
  customers: PickerCustomer[];
  /** What all customers owe right now. */
  totalDue: number;
  defaultMilkPrice: number;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [period, setPeriod] = useState<ListPeriod>('month');
  const [modal, setModal] = useState<{ sale: Sale | null } | null>(null);

  async function handleDelete(sale: Sale) {
    const paid = salePaid(sale);
    const msg = paid > 0 && sale.customerId
      ? `Delete this sale of ${tk(sale.amount)}? The ${tk(paid)} paid on it stays with ${sale.customerName} and will cover their other dues (or become advance).`
      : `Delete this sale of ${tk(sale.amount)}?`;
    if (!(await confirm({ title: msg, tone: 'danger' }))) return;
    try {
      await webApiClient.delete(`/api/sales/${sale.id}`);
      router.refresh();
    } catch {
      toast('Failed to delete sale.', 'error');
    }
  }

  const q = search.trim().toLowerCase();
  const filtered = initialSales.filter((sale) => {
    const matchesSearch =
      !q ||
      sale.customerName.toLowerCase().includes(q) ||
      (sale.cow && (sale.cow.name.toLowerCase().includes(q) || sale.cow.tagNumber.toLowerCase().includes(q)));
    const status = sale.customerId ? sale.status : sale.status === 'paid' ? 'paid' : 'pending';
    const matchesStatus = statusFilter === 'all' || status === statusFilter;
    const matchesType = typeFilter === 'all' || sale.customer?.type === typeFilter;
    const matchesPeriod = inListPeriod(sale.createdAt, period);
    return matchesSearch && matchesStatus && matchesType && matchesPeriod;
  });

  const sold = filtered.reduce((s, x) => s + x.amount, 0);
  const paid = filtered.reduce((s, x) => s + salePaid(x), 0);
  // Milk litres and taka in the same filtered sales (the rule milkLitres uses in business-logic).
  const milk = filtered.filter((x) => x.saleType === 'milk');
  const milkLitres = milk.reduce((s, x) => s + (x.quantity ?? 0), 0);
  const milkAmount = milk.reduce((s, x) => s + x.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[28px]">Sales</h1>
          <p className="mt-1 text-slate-500">Every sale with who bought, what, how much, and what is still due.</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard/customers"
            className="inline-flex items-center gap-2 rounded-control border border-line bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <Users className="h-4 w-4" />
            Customers & dues
          </Link>
          <button
            onClick={() => setModal({ sale: null })}
            className="inline-flex items-center gap-2 rounded-control bg-ink px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-700"
          >
            <Plus className="h-4 w-4" />
            Record sale
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <SummaryCard label="Sold (filtered)" value={tk(sold)} Icon={Wallet} tone="slate" hint={`${filtered.length} sale${filtered.length === 1 ? '' : 's'}`} />
        <SummaryCard
          label="Milk sold"
          value={litres(milkLitres)}
          Icon={Milk}
          tone="slate"
          hint={milkLitres > 0 ? `${tk(milkAmount)} · avg ${tk(Math.round((milkAmount / milkLitres) * 100) / 100)}/L` : 'No milk sales in this view'}
        />
        <SummaryCard label="Received on these sales" value={tk(paid)} Icon={HandCoins} tone="emerald" />
        <Link href="/dashboard/customers" className="block">
          <SummaryCard label="Total due — all customers" value={tk(totalDue)} Icon={AlertCircle} tone="red" hint="View who owes →" />
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {LIST_PERIODS.map(({ value, label }) => (
          <button key={value} onClick={() => setPeriod(value)} aria-pressed={period === value} className={chip(period === value)}>
            {label}
          </button>
        ))}
        <span className="mx-1 h-6 w-px bg-slate-200" aria-hidden="true" />
        {STATUS_FILTERS.map((s) => (
          <button key={s.value} onClick={() => setStatusFilter(s.value)} className={chip(statusFilter === s.value)}>
            {s.label}
          </button>
        ))}
        <span className="mx-1 h-6 w-px bg-slate-200" aria-hidden="true" />
        {['all', 'regular', 'new'].map((t) => (
          <button key={t} onClick={() => setTypeFilter(t)} className={`${chip(typeFilter === t)} capitalize`}>
            {t === 'all' ? 'All customers' : t}
          </button>
        ))}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          aria-label="Search sales"
          placeholder="Search by customer name or cow tag..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-control border border-line bg-white py-2.5 pl-10 pr-4 text-sm text-ink placeholder-slate-400 shadow-sm focus:border-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-600/10"
        />
      </div>

      {/* Phones: one card per sale, so amount, due and status are always visible. */}
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-card border border-line bg-white shadow-card sm:hidden">
        {filtered.length === 0 ? (
          <li className="py-12 text-center text-sm text-slate-500">No sales match these filters.</li>
        ) : (
          filtered.map((sale) => {
            const info = productTypeInfo(sale.saleType);
            const due = Math.max(0, sale.amount - salePaid(sale));
            const status = sale.customerId ? sale.status : sale.status === 'paid' ? 'paid' : 'pending';
            return (
              <li key={sale.id} className="flex items-start gap-3 px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {sale.customerId ? (
                      <Link href={`/dashboard/customers/${sale.customerId}`} className="truncate text-sm font-semibold text-ink">{sale.customerName}</Link>
                    ) : (
                      <span className="truncate text-sm font-semibold text-ink">{sale.customerName}</span>
                    )}
                    <PaymentStatusPill status={status} />
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {info.label}
                    {sale.quantity != null && sale.unitPrice != null ? ` · ${sale.quantity}${info.unit ? ` ${info.unit}` : ''} × ${tk(sale.unitPrice)}` : ''} · {fmtDate(sale.createdAt)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold tabular-nums text-ink">{tk(sale.amount)}</p>
                  {due > 0 && <p className="text-xs font-semibold tabular-nums text-red-600">Due {tk(due)}</p>}
                  <div className="mt-1 flex justify-end gap-1">
                    <button onClick={() => setModal({ sale })} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-ink" aria-label={`Edit sale to ${sale.customerName}`}>
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDelete(sale)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Delete sale to ${sale.customerName}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })
        )}
      </ul>

      <div className="hidden overflow-x-auto rounded-card border border-line bg-white shadow-card sm:block">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              {['Customer', 'Product', 'Qty × Price', 'Amount', 'Paid', 'Due', 'Status', 'Date'].map((h) => (
                <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">{h}</th>
              ))}
              <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-sm text-slate-500">
                  No sales match these filters.
                </td>
              </tr>
            ) : (
              filtered.map((sale) => {
                const info = productTypeInfo(sale.saleType);
                const salePaidAmt = salePaid(sale);
                const due = Math.max(0, sale.amount - salePaidAmt);
                const status = sale.customerId ? sale.status : sale.status === 'paid' ? 'paid' : 'pending';
                return (
                  <tr key={sale.id} className="transition hover:bg-slate-50/50">
                    <td className="whitespace-nowrap px-5 py-4">
                      <div className="flex items-center gap-2">
                        {sale.customerId ? (
                          <Link href={`/dashboard/customers/${sale.customerId}`} className="text-sm font-semibold text-ink hover:underline">
                            {sale.customerName}
                          </Link>
                        ) : (
                          <span className="text-sm font-semibold text-ink">{sale.customerName}</span>
                        )}
                        {sale.customer && <CustomerTypeBadge type={sale.customer.type} />}
                      </div>
                      {sale.cow && <p className="text-[11px] text-slate-400">{sale.cow.name} ({sale.cow.tagNumber})</p>}
                      {sale.notes && (
                        <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400">
                          <FileText className="h-3 w-3" /> {sale.notes}
                        </p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase ${info.color}`}>
                        {info.label}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                      {sale.quantity != null && sale.unitPrice != null ? (
                        <span>
                          {sale.quantity}{info.unit ? ` ${info.unit}` : ''} × {tk(sale.unitPrice)}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-sm font-bold text-ink">{tk(sale.amount)}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-sm font-medium text-brand-700">{tk(salePaidAmt)}</td>
                    <td className={`whitespace-nowrap px-5 py-4 text-sm font-semibold ${due > 0 ? 'text-red-600' : 'text-slate-300'}`}>
                      {due > 0 ? tk(due) : '—'}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4"><PaymentStatusPill status={status} /></td>
                    <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-500">{fmtDate(sale.createdAt)}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setModal({ sale })}
                          className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-ink"
                          aria-label={`Edit sale to ${sale.customerName}`}
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(sale)}
                          className="rounded-lg p-2 text-red-500 transition hover:bg-red-50 hover:text-red-700"
                          aria-label={`Delete sale to ${sale.customerName}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <SaleFormModal
          customers={customers}
          activeCows={activeCows}
          sale={modal.sale}
          defaultMilkPrice={defaultMilkPrice}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
