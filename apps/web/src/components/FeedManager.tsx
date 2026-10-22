"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus, Search, Trash2, Edit3, Wheat, AlertTriangle, BarChart2, Droplets, CalendarClock, Store, ShoppingBag, Wallet, ChevronLeft, ChevronRight,
} from 'lucide-react';
import type { FeedBatch } from '@farm/shared-types';
import { webApiClient } from '@farm/api-client';
import { farmMonth, feedMonthSummary, isLowStock, shiftMonth, stockPercentage, totalStockValue } from '@farm/business-logic';
import FeedPurchaseModal, { PRESET_FEED_NAMES } from '@/components/feed/FeedPurchaseModal';
import type { PickerCustomer } from '@/components/sales/CustomerPicker';
import { PaymentStatusPill, SummaryCard, tk, fmtDate, monthLabel, inputCls, labelCls } from '@/components/sales/shared';
import Modal, { FormError, FormFooter } from '@/components/sales/Modal';
import { feedPayStatus } from '@/components/feed/shared';
import { useConfirm, useToast } from '@/components/ui/Feedback';

export default function FeedManager({
  initialFeed,
  suppliers,
  feedCostToday,
  totalPayable,
  month,
}: {
  initialFeed: FeedBatch[];
  suppliers: PickerCustomer[];
  /** Today's feed cost: per-day share of purchases with days set, plus purchases without days bought today. */
  feedCostToday: number;
  totalPayable: number;
  /** "YYYY-MM" shown in the feed account. */
  month: string;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'month' | 'stock'>('month');
  const [purchaseModal, setPurchaseModal] = useState<{ batch: FeedBatch | null } | null>(null);
  const [usageFeed, setUsageFeed] = useState<FeedBatch | null>(null);
  const [usageForm, setUsageForm] = useState({ quantity: '', note: '' });
  const [usageError, setUsageError] = useState('');
  const [loading, setLoading] = useState(false);

  function openUsageModal(feed: FeedBatch) {
    setUsageFeed(feed);
    setUsageForm({ quantity: '', note: '' });
    setUsageError('');
  }

  async function handleUsageSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!usageFeed) return;
    setLoading(true);
    setUsageError('');

    try {
      await webApiClient.post('/api/feed/usage', { feedBatchId: usageFeed.id, ...usageForm }, 'Failed to record usage');
      setUsageFeed(null);
      router.refresh();
    } catch (err) {
      setUsageError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(item: FeedBatch) {
    const owedNote = item.supplier ? ` Payments to ${item.supplier.name} stay and count towards their other purchases.` : '';
    if (!(await confirm({ title: `Delete the ${item.name} purchase of ${item.quantity} kg?${owedNote}`, tone: 'danger' }))) return;

    try {
      await webApiClient.delete(`/api/feed/${item.id}`);
      router.refresh();
    } catch {
      toast('Failed to delete feed batch.', 'error');
    }
  }

  const summary = feedMonthSummary(initialFeed, month);
  const current = farmMonth();
  const q = search.toLowerCase();
  // "This month" lists that month's purchases; "In stock" lists everything with stock left, from any month.
  const shown = view === 'stock' ? initialFeed.filter((b) => b.remainingQuantity > 0) : summary.purchases;
  const filteredFeed = shown.filter(
    (item) => item.name.toLowerCase().includes(q) || (item.supplier?.name ?? '').toLowerCase().includes(q),
  );
  const runningLow = initialFeed.filter((b) => b.schedule && b.schedule.remaining > 0 && b.schedule.daysLeft <= 1);
  const monthHref = (m: string) => `/dashboard/feed?month=${m}`;
  const navBtn = 'inline-flex h-10 w-10 items-center justify-center rounded-control border border-line bg-white text-slate-600 transition hover:bg-slate-50';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[28px]">Feed Inventory</h1>
          <p className="mt-1 text-slate-500">What you bought each month, from whom, what it cost and what is still owed.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <nav aria-label="Choose month" className="flex items-center gap-2">
            <Link href={monthHref(shiftMonth(month, -1))} className={navBtn} aria-label="Previous month">
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <p className="min-w-36 text-center text-base font-bold text-ink" aria-live="polite">{monthLabel(month)}</p>
            {month < current ? (
              <Link href={monthHref(shiftMonth(month, 1))} className={navBtn} aria-label="Next month">
                <ChevronRight className="h-4 w-4" />
              </Link>
            ) : (
              <span className={`${navBtn} cursor-not-allowed opacity-40`} aria-hidden="true">
                <ChevronRight className="h-4 w-4" />
              </span>
            )}
          </nav>
          <button
            onClick={() => setPurchaseModal({ batch: null })}
            className="inline-flex items-center gap-2 rounded-control bg-ink px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-700"
          >
            <Plus className="h-4 w-4" />
            Buy feed
          </button>
        </div>
      </div>

      {/* This month's feed account */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <SummaryCard
          label="Feed bought"
          value={`${summary.totals.kg.toLocaleString('en-IN')} kg`}
          Icon={Wheat}
          tone="slate"
          hint={`${summary.totals.count} purchase${summary.totals.count === 1 ? '' : 's'} in ${monthLabel(month)}`}
        />
        <SummaryCard label="Total spent" value={tk(summary.totals.spent)} Icon={ShoppingBag} tone="slate" hint="All feed bought this month" />
        <SummaryCard label="Paid" value={tk(summary.totals.paid)} Icon={Wallet} tone="emerald" />
        <SummaryCard label="Still owed" value={tk(summary.totals.owed)} Icon={Store} tone="red" hint="For this month's feed" />
      </div>

      {summary.byFeed.length > 0 && (
        <section aria-label="Subtotal per feed" className="overflow-x-auto rounded-card border border-line bg-white shadow-card">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {['Feed', 'Purchases', 'Quantity', 'Avg price', 'Spent'].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {summary.byFeed.map((f) => (
                <tr key={f.name}>
                  <td className="whitespace-nowrap px-5 py-3 text-sm font-semibold text-ink">{f.name}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-sm text-slate-600">{f.count}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-sm text-slate-600">{f.kg.toLocaleString('en-IN')} kg</td>
                  <td className="whitespace-nowrap px-5 py-3 text-sm text-slate-600">{tk(Math.round((f.spent / f.kg) * 100) / 100)}/kg</td>
                  <td className="whitespace-nowrap px-5 py-3 text-sm font-bold text-ink">{tk(f.spent)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50">
              <tr className="text-sm font-bold text-ink">
                <td className="px-5 py-3">Total</td>
                <td className="px-5 py-3">{summary.totals.count}</td>
                <td className="px-5 py-3">{summary.totals.kg.toLocaleString('en-IN')} kg</td>
                <td />
                <td className="px-5 py-3">{tk(summary.totals.spent)}</td>
              </tr>
            </tfoot>
          </table>
        </section>
      )}

      <p className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
        <span>
          <CalendarClock className="mr-1 inline h-3.5 w-3.5" />
          Feed cost today: <strong className="text-slate-700">{tk(feedCostToday)}</strong>
        </span>
        <span>
          <BarChart2 className="mr-1 inline h-3.5 w-3.5" />
          Stock value now: <strong className="text-slate-700">{tk(Math.round(totalStockValue(initialFeed)))}</strong>
        </span>
        <Link href="/dashboard/suppliers" className="hover:underline">
          <Store className="mr-1 inline h-3.5 w-3.5" />
          You owe suppliers in total: <strong className="text-red-600">{tk(totalPayable)}</strong> →
        </Link>
      </p>

      {runningLow.length > 0 && (
        <div role="status" className="flex items-start gap-3 rounded-card border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <span className="font-semibold">Running out soon:</span>{' '}
            {runningLow.map((b) => `${b.name} (${b.schedule!.remaining.toLocaleString()} kg left)`).join(', ')}. Time to buy more.
          </p>
        </div>
      )}

      {/* Quick filter + search */}
      <div className="flex flex-wrap gap-2">
        <span className="self-center text-xs font-medium text-slate-500">Quick filter:</span>
        {PRESET_FEED_NAMES.map((name) => (
          <button
            key={name}
            onClick={() => setSearch(search === name ? '' : name)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
              search === name ? 'border-amber-600 bg-amber-600 text-white' : 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="flex gap-2" role="tablist" aria-label="Which feed to list">
        {[
          { value: 'month', label: `Bought in ${monthLabel(month)}` },
          { value: 'stock', label: 'All in stock now' },
        ].map((v) => (
          <button
            key={v.value}
            role="tab"
            aria-selected={view === v.value}
            onClick={() => setView(v.value as 'month' | 'stock')}
            className={`rounded-control px-3.5 py-2 text-xs font-semibold transition ${
              view === v.value ? 'bg-ink text-white shadow-card' : 'border border-line bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>
      <div className="relative max-w-md flex-1">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          aria-label="Search feed"
          placeholder="Search feed or supplier..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-control border border-line bg-white py-2.5 pl-10 pr-4 text-sm text-ink placeholder-slate-400 shadow-sm focus:border-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-600/10"
        />
      </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-card border border-line bg-white shadow-card">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              {['Feed', 'Supplier', 'Bought', 'Total', 'Per day', 'Days left', 'Stock left'].map((h) => (
                <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">{h}</th>
              ))}
              <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {filteredFeed.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-10 text-center text-sm text-slate-500">
                  {initialFeed.length === 0
                    ? 'No feed bought yet. Use “Buy feed” to record your first purchase.'
                    : shown.length === 0
                      ? view === 'month'
                        ? `No feed bought in ${monthLabel(month)}.`
                        : 'No feed in stock.'
                      : 'No feed matches.'}
                </td>
              </tr>
            ) : (
              filteredFeed.map((item) => <FeedRow key={item.id} item={item} onUse={openUsageModal} onEdit={(b) => setPurchaseModal({ batch: b })} onDelete={handleDelete} />)
            )}
          </tbody>
        </table>
      </div>

      {purchaseModal && (
        <FeedPurchaseModal
          suppliers={suppliers}
          batch={purchaseModal.batch}
          onClose={() => setPurchaseModal(null)}
          onSaved={() => {
            setPurchaseModal(null);
            router.refresh();
          }}
        />
      )}

      {/* Feed Usage Modal */}
      {usageFeed && (
        <Modal title={usageFeed.schedule ? 'Record extra use' : 'Record feed use'} subtitle={usageFeed.name} onClose={() => setUsageFeed(null)}>
          <div className="mt-4 rounded-control border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-900">
            In stock: <span className="font-semibold">{usageFeed.remainingQuantity.toLocaleString()} kg</span>
            {usageFeed.schedule && (
              <p className="mt-1 text-xs">
                {usageFeed.schedule.perDayQty.toLocaleString()} kg/day is taken off automatically. Record only extra use here; it lowers stock, not cost.
              </p>
            )}
          </div>
          <FormError message={usageError} />
          <form onSubmit={handleUsageSubmit} className="mt-4 space-y-4">
            <div>
              <label htmlFor="usage-qty" className={labelCls}>Quantity used (kg)</label>
              <input
                id="usage-qty"
                type="number"
                step="0.1"
                min="0.1"
                max={usageFeed.remainingQuantity}
                required
                autoFocus
                inputMode="decimal"
                placeholder="e.g. 50"
                value={usageForm.quantity}
                onChange={(e) => setUsageForm({ ...usageForm, quantity: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="usage-note" className={labelCls}>Note (optional)</label>
              <input
                id="usage-note"
                placeholder={usageFeed.schedule ? 'e.g. Spilled, given to calves' : 'e.g. Morning feeding'}
                value={usageForm.note}
                onChange={(e) => setUsageForm({ ...usageForm, note: e.target.value })}
                className={inputCls}
              />
            </div>
            {usageForm.quantity && !usageFeed.schedule && (
              <p className="text-xs text-slate-500">
                Stock value used: <span className="font-semibold text-ink">{tk(parseFloat(usageForm.quantity) * usageFeed.unitPrice)}</span> (the cost was counted when the feed was bought)
              </p>
            )}
            <FormFooter onCancel={() => setUsageFeed(null)} loading={loading} label="Record use" />
          </form>
        </Modal>
      )}
    </div>
  );
}

function FeedRow({
  item,
  onUse,
  onEdit,
  onDelete,
}: {
  item: FeedBatch;
  onUse: (b: FeedBatch) => void;
  onEdit: (b: FeedBatch) => void;
  onDelete: (b: FeedBatch) => void;
}) {
  const s = item.schedule;
  const total = item.quantity * item.unitPrice;
  const status = feedPayStatus(item);
  const due = item.supplierId ? Math.max(0, total - (item.paidAmount ?? 0)) : 0;
  const low = s ? s.remaining > 0 && s.daysLeft <= 1 : isLowStock(item);
  const finished = s ? s.remaining <= 0 : item.remainingQuantity <= 0;
  const pct = s ? Math.round((s.daysLeft / s.coverDays) * 100) : stockPercentage(item);

  return (
    <tr className={`transition hover:bg-slate-50/50 ${finished ? 'opacity-60' : ''}`}>
      <td className="whitespace-nowrap px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <Wheat className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">{item.name}</p>
            <p className="text-[11px] text-slate-400">{fmtDate(item.purchasedAt ?? item.createdAt)}</p>
          </div>
        </div>
      </td>
      <td className="whitespace-nowrap px-5 py-4 text-sm">
        {item.supplier ? (
          <Link href={`/dashboard/suppliers/${item.supplier.id}`} className="font-medium text-slate-700 hover:text-ink hover:underline">
            {item.supplier.name}
          </Link>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>
      <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
        <span className="font-medium text-ink">{item.quantity.toLocaleString()} kg</span>
        <span className="block text-[11px] text-slate-400">at {tk(item.unitPrice)}/kg</span>
      </td>
      <td className="whitespace-nowrap px-5 py-4 text-sm">
        <p className="mb-1 font-bold text-ink">{tk(total)}</p>
        <PaymentStatusPill status={status} />
        {due > 0 && <span className="ml-1 text-[11px] font-semibold text-red-600">{tk(due)} due</span>}
      </td>
      <td className="whitespace-nowrap px-5 py-4 text-sm">
        {s ? (
          <>
            <p className="font-semibold text-ink">{tk(s.perDayCost)}</p>
            <p className="text-[11px] text-slate-500">{s.perDayQty.toLocaleString()} kg/day</p>
          </>
        ) : (
          <span className="text-xs text-slate-400">Days not set</span>
        )}
      </td>
      <td className="whitespace-nowrap px-5 py-4 text-sm">
        <div className="w-28">
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full transition-all ${low ? 'bg-red-400' : 'bg-brand-400'}`}
              style={{ width: `${Math.max(0, Math.min(pct, 100))}%` }}
            />
          </div>
          {s ? (
            <p className={`mt-1 text-[11px] font-semibold ${low ? 'text-red-600' : finished ? 'text-slate-400' : 'text-slate-600'}`}>
              {finished
                ? `Finished ${fmtDate(s.runsOutOn)}`
                : s.daysLeft === 0
                  ? 'Last day today'
                  : `${s.daysLeft} day${s.daysLeft === 1 ? '' : 's'} left · to ${fmtDate(s.runsOutOn).replace(/ \d{4}$/, '')}`}
            </p>
          ) : (
            <p className="mt-1 text-[11px] text-slate-400">{pct}% remaining</p>
          )}
        </div>
      </td>
      <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-ink">
        <div className="flex items-center gap-2">
          <span>{item.remainingQuantity.toLocaleString()} kg</span>
          {low && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
              <AlertTriangle className="h-3 w-3" /> {s ? 'Running low' : 'Low Stock'}
            </span>
          )}
        </div>
      </td>
      <td className="whitespace-nowrap px-5 py-4 text-right text-sm">
        <div className="flex justify-end gap-2">
          <button
            onClick={() => onUse(item)}
            disabled={finished}
            className="flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 disabled:opacity-40"
            title={s ? 'Record extra use' : 'Record feed usage'}
          >
            <Droplets className="h-3.5 w-3.5" /> Use
          </button>
          <button onClick={() => onEdit(item)} className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-ink" aria-label={`Edit ${item.name}`}>
            <Edit3 className="h-4 w-4" />
          </button>
          <button onClick={() => onDelete(item)} className="rounded-lg p-1.5 text-red-500 transition hover:bg-red-50 hover:text-red-700" aria-label={`Delete ${item.name}`}>
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}
