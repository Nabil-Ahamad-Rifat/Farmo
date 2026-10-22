"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Search, HandCoins, PiggyBank, Users, Wallet, ChevronRight, Phone } from 'lucide-react';
import type { WorkerListItem } from '@farm/shared-types';
import { SummaryCard, tk } from '@/components/sales/shared';
import { WorkerFormModal, WorkerPaymentModal } from '@/components/workers/WorkerModals';
import { BalancePill, WorkerStatusBadge, payLabel } from '@/components/workers/shared';

const FILTERS = [
  { value: 'active', label: 'Working' },
  { value: 'owed', label: 'You owe' },
  { value: 'advance', label: 'Advance' },
  { value: 'left', label: 'Left' },
  { value: 'all', label: 'All' },
] as const;
type Filter = (typeof FILTERS)[number]['value'];

export default function EmployeeManager({ workers }: { workers: WorkerListItem[] }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('active');
  const [adding, setAdding] = useState(false);
  const [paying, setPaying] = useState<WorkerListItem | null>(null);

  // Farm-wide totals: never affected by the search box or filter.
  const owed = workers.reduce((s, w) => s + Math.max(0, w.account.balance), 0);
  const advances = workers.reduce((s, w) => s + Math.max(0, -w.account.balance), 0);
  const monthEarned = workers.reduce((s, w) => s + w.thisMonth.earned, 0);
  const monthPaid = workers.reduce((s, w) => s + w.thisMonth.paid, 0);
  const working = workers.filter((w) => w.status !== 'left').length;

  const matches: Record<Filter, (w: WorkerListItem) => boolean> = {
    active: (w) => w.status !== 'left',
    owed: (w) => w.account.balance > 0.004,
    advance: (w) => w.account.balance < -0.004,
    left: (w) => w.status === 'left',
    all: () => true,
  };
  const q = search.trim().toLowerCase();
  const shown = workers.filter(
    (w) => matches[filter](w) && (!q || w.name.toLowerCase().includes(q) || w.role.toLowerCase().includes(q) || (w.phone ?? '').includes(q)),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[28px]">Workers</h1>
          <p className="mt-1 text-sm text-slate-500 sm:text-base">Pay, advances and absences of every worker. Monthly pay is salary ÷ 30 per day.</p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="inline-flex shrink-0 items-center gap-2 rounded-control bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 sm:py-2.5"
        >
          <Plus className="h-4 w-4" /> Add worker
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard label="You owe workers" value={tk(owed)} Icon={HandCoins} tone={owed > 0 ? 'red' : 'slate'} hint="Earned but not paid yet" />
        <SummaryCard label="Advances given" value={tk(advances)} Icon={PiggyBank} tone="slate" hint="Paid more than earned" />
        <SummaryCard label="Labour this month" value={tk(monthEarned)} Icon={Wallet} tone="slate" hint={`Paid ${tk(monthPaid)} this month`} />
        <SummaryCard label="Working now" value={String(working)} Icon={Users} tone="emerald" hint={`${workers.length} in total`} />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-md lg:flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            aria-label="Search workers"
            placeholder="Search by name, work or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-control border border-line bg-white py-3 pl-10 pr-4 text-base text-ink placeholder-slate-400 shadow-sm focus:border-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-600/10 sm:py-2.5 sm:text-sm"
          />
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 sm:pb-0">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              aria-pressed={filter === f.value}
              className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-semibold transition sm:py-2 sm:text-xs ${
                filter === f.value ? 'bg-ink text-white shadow-card' : 'border border-line bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {f.label} <span className={filter === f.value ? 'text-slate-300' : 'text-slate-400'}>{workers.filter(matches[f.value]).length}</span>
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-card border border-dashed border-slate-300 bg-white py-14 text-center">
          <p className="text-sm text-slate-500">{workers.length === 0 ? 'No workers yet. Add your first worker.' : 'No workers match this search or filter.'}</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-card border border-line bg-white shadow-card">
          {shown.map((w) => (
            <li key={w.id} className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-slate-50 sm:px-5">
              <Link href={`/dashboard/employees/${w.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-card bg-ink text-base font-bold text-white">
                  {w.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="truncate text-sm font-bold text-ink sm:text-base">{w.name}</p>
                    {w.status === 'left' && <WorkerStatusBadge status="left" />}
                  </div>
                  <p className="truncate text-xs text-slate-500">
                    {w.role} · {payLabel(w)}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-500">
                    {w.phone && <><Phone className="h-3 w-3" /> {w.phone} · </>}
                    This month {tk(w.thisMonth.earned)}
                    {w.thisMonth.daysAbsent > 0 ? ` · ${w.thisMonth.daysAbsent} absent` : ''}
                  </p>
                </div>
                <div className="hidden shrink-0 sm:block">
                  <BalancePill account={w.account} />
                </div>
                <ChevronRight className="hidden h-4 w-4 shrink-0 text-slate-300 sm:block" />
              </Link>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <div className="sm:hidden">
                  <BalancePill account={w.account} />
                </div>
                <button
                  type="button"
                  onClick={() => setPaying(w)}
                  aria-label={`Pay ${w.name}`}
                  className="inline-flex h-10 items-center gap-1.5 rounded-control border border-brand-200 bg-brand-50 px-3.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-100"
                >
                  <Wallet className="h-4 w-4" /> Pay
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <WorkerFormModal
          onClose={() => setAdding(false)}
          onSaved={(saved) => {
            setAdding(false);
            router.push(`/dashboard/employees/${saved.id}`);
          }}
        />
      )}
      {paying && (
        <WorkerPaymentModal
          worker={paying}
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
