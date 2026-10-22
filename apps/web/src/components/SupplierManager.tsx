"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Search, AlertCircle, Store, PiggyBank, Phone, ChevronRight, Wallet } from 'lucide-react';
import type { SupplierSummary } from '@farm/shared-types';
import SupplierFormModal from '@/components/feed/SupplierFormModal';
import PaymentFormModal from '@/components/sales/PaymentFormModal';
import { SummaryCard, tk, fmtDate } from '@/components/sales/shared';

export default function SupplierManager({ suppliers }: { suppliers: SupplierSummary[] }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [owedOnly, setOwedOnly] = useState(false);
  const [adding, setAdding] = useState(false);
  const [paying, setPaying] = useState<SupplierSummary | null>(null);

  const q = search.trim().toLowerCase();
  const filtered = suppliers.filter(
    (s) => (!q || s.name.toLowerCase().includes(q) || (s.phone ?? '').includes(q)) && (!owedOnly || s.totalDue > 0),
  );

  const totalDue = suppliers.reduce((sum, s) => sum + s.totalDue, 0);
  const owed = suppliers.filter((s) => s.totalDue > 0).length;
  const advance = suppliers.reduce((sum, s) => sum + s.advance, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[28px]">Suppliers & Payables</h1>
          <p className="mt-1 text-slate-500">Where you buy feed, what you owe each one, and what you have paid.</p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-2 rounded-control bg-ink px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-700"
        >
          <Plus className="h-4 w-4" />
          Add supplier
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <SummaryCard label="Total you owe" value={tk(totalDue)} Icon={AlertCircle} tone="red" />
        <SummaryCard label="Suppliers owed" value={`${owed} of ${suppliers.length}`} Icon={Store} tone="slate" />
        <SummaryCard label="Advance paid" value={tk(advance)} Icon={PiggyBank} tone="emerald" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            aria-label="Search suppliers"
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-control border border-line bg-white py-2.5 pl-10 pr-4 text-sm text-ink placeholder-slate-400 shadow-sm focus:border-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-600/10"
          />
        </div>
        <button
          onClick={() => setOwedOnly(!owedOnly)}
          aria-pressed={owedOnly}
          className={`rounded-control px-3.5 py-2 text-xs font-semibold transition ${
            owedOnly ? 'bg-ink text-white shadow-card' : 'border border-line bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          I owe money
        </button>
      </div>

      {/* Phones: one row per supplier with what you owe always visible. */}
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-card border border-line bg-white shadow-card sm:hidden">
        {filtered.length === 0 ? (
          <li className="py-12 text-center text-sm text-slate-500">Nothing matches this search.</li>
        ) : (
          filtered.map((s) => (
            <li key={s.id} className="flex items-center gap-3 px-4 py-3">
              <Link href={`/dashboard/suppliers/${s.id}`} className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">{s.name}</span>
                <span className="block truncate text-xs text-slate-500">Bought {tk(s.totalBought)} · paid {tk(s.totalPaid)}</span>
              </Link>
              <span className={`shrink-0 text-sm font-bold tabular-nums ${s.totalDue > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                {s.totalDue > 0 ? tk(s.totalDue) : 'Clear'}
              </span>
              {s.totalDue > 0 && (
                <button onClick={() => setPaying(s)} aria-label={`Pay ${s.name}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control border border-amber-200 bg-amber-50 text-amber-800">
                  <Wallet className="h-4 w-4" />
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
              {['Supplier', 'Phone', 'Total bought', 'Paid', 'You owe', 'Last purchase'].map((h) => (
                <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">{h}</th>
              ))}
              <th className="px-5 py-3.5"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-sm text-slate-500">
                  {suppliers.length === 0
                    ? 'No suppliers yet. Add one, or buy feed on credit and the supplier is added for you.'
                    : 'No suppliers match.'}
                </td>
              </tr>
            ) : (
              filtered.map((s) => (
                <tr key={s.id} className="transition hover:bg-slate-50/60">
                  <td className="whitespace-nowrap px-5 py-4">
                    <Link href={`/dashboard/suppliers/${s.id}`} className="text-sm font-semibold text-ink hover:underline">
                      {s.name}
                    </Link>
                    <p className="text-[11px] text-slate-400">
                      {s.purchasesCount} purchase{s.purchasesCount === 1 ? '' : 's'}
                      {s.address ? ` · ${s.address}` : ''}
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                    {s.phone ? (
                      <a href={`tel:${s.phone}`} className="inline-flex items-center gap-1 hover:text-ink">
                        <Phone className="h-3.5 w-3.5" /> {s.phone}
                      </a>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-sm font-medium text-ink">{tk(s.totalBought)}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-sm font-medium text-brand-700">{tk(s.totalPaid)}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-sm">
                    {s.totalDue > 0 ? (
                      <span className="font-bold text-red-600">{tk(s.totalDue)}</span>
                    ) : s.advance > 0 ? (
                      <span className="font-semibold text-brand-700">Advance {tk(s.advance)}</span>
                    ) : (
                      <span className="font-semibold text-slate-400">Clear</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-500">{s.lastPurchaseAt ? fmtDate(s.lastPurchaseAt) : '—'}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {s.totalDue > 0 && (
                        <button
                          onClick={() => setPaying(s)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                        >
                          <Wallet className="h-3.5 w-3.5" /> Pay
                        </button>
                      )}
                      <Link
                        href={`/dashboard/suppliers/${s.id}`}
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        aria-label={`Open ${s.name}`}
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
        <SupplierFormModal
          onClose={() => setAdding(false)}
          onSaved={(saved) => {
            setAdding(false);
            router.push(`/dashboard/suppliers/${saved.id}`);
          }}
        />
      )}
      {paying && (
        <PaymentFormModal
          party={paying}
          mode="pay"
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
