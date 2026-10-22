"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Search, AlertCircle, Users, PiggyBank, Phone, ChevronRight, HandCoins } from 'lucide-react';
import type { CustomerSummary } from '@farm/shared-types';
import CustomerFormModal from '@/components/sales/CustomerFormModal';
import PaymentFormModal from '@/components/sales/PaymentFormModal';
import { SummaryCard, CustomerTypeBadge, tk, fmtDate } from '@/components/sales/shared';

const chip = (active: boolean) =>
  `rounded-control px-3.5 py-2 text-xs font-semibold transition ${
    active ? 'bg-ink text-white shadow-card' : 'border border-line bg-white text-slate-600 hover:bg-slate-50'
  }`;

export default function CustomerManager({ customers }: { customers: CustomerSummary[] }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [owingOnly, setOwingOnly] = useState(false);
  const [adding, setAdding] = useState(false);
  const [paying, setPaying] = useState<CustomerSummary | null>(null);

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[28px]">Customers & Dues</h1>
          <p className="mt-1 text-slate-500">Who buys from you, who owes you, and how much.</p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-2 rounded-control bg-ink px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-700"
        >
          <Plus className="h-4 w-4" />
          Add customer
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <SummaryCard label="Total due to you" value={tk(totalDue)} Icon={AlertCircle} tone="red" />
        <SummaryCard label="Customers who owe" value={`${owing} of ${customers.length}`} Icon={Users} tone="slate" />
        <SummaryCard label="Advance held" value={tk(advance)} Icon={PiggyBank} tone="emerald" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            aria-label="Search customers"
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-control border border-line bg-white py-2.5 pl-10 pr-4 text-sm text-ink placeholder-slate-400 shadow-sm focus:border-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-600/10"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setOwingOnly(!owingOnly)} className={chip(owingOnly)} aria-pressed={owingOnly}>
            Owes money
          </button>
          <span className="mx-1 h-8 w-px bg-slate-200" aria-hidden="true" />
          {['all', 'regular', 'new'].map((t) => (
            <button key={t} onClick={() => setTypeFilter(t)} className={`${chip(typeFilter === t)} capitalize`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Phones: one row per customer with what is owed always visible. */}
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-card border border-line bg-white shadow-card sm:hidden">
        {filtered.length === 0 ? (
          <li className="py-12 text-center text-sm text-slate-500">Nothing matches this search.</li>
        ) : (
          filtered.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-4 py-3">
              <Link href={`/dashboard/customers/${c.id}`} className="min-w-0 flex-1">
                <span className="flex items-center gap-2"><span className="truncate text-sm font-semibold text-ink">{c.name}</span><CustomerTypeBadge type={c.type} /></span>
                <span className="block truncate text-xs text-slate-500">Bought {tk(c.totalSold)} · paid {tk(c.totalPaid)}</span>
              </Link>
              <span className={`shrink-0 text-sm font-bold tabular-nums ${c.totalDue > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                {c.totalDue > 0 ? tk(c.totalDue) : 'Clear'}
              </span>
              {c.totalDue > 0 && (
                <button onClick={() => setPaying(c)} aria-label={`Collect from ${c.name}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control border border-brand-200 bg-brand-50 text-brand-700">
                  <HandCoins className="h-4 w-4" />
                </button>
              )}
            </li>
          ))
        )}
      </ul>

      <div className="hidden overflow-x-auto rounded-card border border-line bg-white shadow-card sm:block">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              {['Customer', 'Phone', 'Total bought', 'Paid', 'Due', 'Last purchase'].map((h) => (
                <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">{h}</th>
              ))}
              <th className="px-5 py-3.5"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-sm text-slate-500">
                  {customers.length === 0 ? 'No customers yet. Add one, or record a sale and it is added for you.' : 'No customers match.'}
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className="transition hover:bg-slate-50/60">
                  <td className="whitespace-nowrap px-5 py-4">
                    <Link href={`/dashboard/customers/${c.id}`} className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-ink hover:underline">{c.name}</span>
                      <CustomerTypeBadge type={c.type} />
                    </Link>
                    <p className="text-[11px] text-slate-400">{c.salesCount} sale{c.salesCount === 1 ? '' : 's'}</p>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                    {c.phone ? (
                      <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1 hover:text-ink">
                        <Phone className="h-3.5 w-3.5" /> {c.phone}
                      </a>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-sm font-medium text-ink">{tk(c.totalSold)}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-sm font-medium text-brand-700">{tk(c.totalPaid)}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-sm">
                    {c.totalDue > 0 ? (
                      <span className="font-bold text-red-600">{tk(c.totalDue)}</span>
                    ) : c.advance > 0 ? (
                      <span className="font-semibold text-brand-700">Advance {tk(c.advance)}</span>
                    ) : (
                      <span className="font-semibold text-slate-400">Clear</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-500">
                    {c.lastPurchaseAt ? fmtDate(c.lastPurchaseAt) : '—'}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {c.totalDue > 0 && (
                        <button
                          onClick={() => setPaying(c)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100"
                        >
                          <HandCoins className="h-3.5 w-3.5" /> Collect
                        </button>
                      )}
                      <Link
                        href={`/dashboard/customers/${c.id}`}
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        aria-label={`Open ${c.name}`}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {adding && (
        <CustomerFormModal
          onClose={() => setAdding(false)}
          onSaved={(saved) => {
            setAdding(false);
            router.push(`/dashboard/customers/${saved.id}`);
          }}
        />
      )}
      {paying && (
        <PaymentFormModal
          party={paying}
          onClose={() => setPaying(null)}
          onSaved={() => {
            setPaying(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
