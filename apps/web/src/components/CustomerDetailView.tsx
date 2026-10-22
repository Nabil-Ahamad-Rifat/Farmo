"use client";

import { useConfirm, useToast } from '@/components/ui/Feedback';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Phone, MapPin, StickyNote, HandCoins, Plus, Edit3, Trash2, ShoppingBag, Wallet, AlertCircle, PiggyBank, CheckCircle,
} from 'lucide-react';
import type { Cow, CustomerDetail, CustomerHistoryEntry, Payment, Sale } from '@farm/shared-types';
import { monthKey, type MonthSummary } from '@farm/business-logic';
import { webApiClient } from '@farm/api-client';
import SaleFormModal from '@/components/sales/SaleFormModal';
import PaymentFormModal from '@/components/sales/PaymentFormModal';
import CustomerFormModal from '@/components/sales/CustomerFormModal';
import {
  SummaryCard, CustomerTypeBadge, PaymentStatusPill, productTypeInfo, paymentMethodLabel, salePaid, tk, fmtDate, monthLabel,
} from '@/components/sales/shared';

type ModalState =
  | { kind: 'sale'; sale: Sale | null }
  | { kind: 'payment'; payment: Payment | null }
  | { kind: 'customer' }
  | null;

export default function CustomerDetailView({
  customer,
  activeCows,
  defaultMilkPrice,
  months,
}: {
  customer: CustomerDetail;
  activeCows: Pick<Cow, 'id' | 'name' | 'tagNumber'>[];
  defaultMilkPrice: number;
  /** Per-month totals and running balance, newest first. */
  months: MonthSummary[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [modal, setModal] = useState<ModalState>(null);
  const done = () => {
    setModal(null);
    router.refresh();
  };

  async function deleteSale(sale: Sale) {
    if (!(await confirm({ title: `Delete the ${tk(sale.amount)} sale from ${fmtDate(sale.createdAt)}?`, tone: 'danger' }))) return;
    try {
      await webApiClient.delete(`/api/sales/${sale.id}`);
      router.refresh();
    } catch {
      toast('Failed to delete sale.', 'error');
    }
  }

  async function deletePayment(p: Payment) {
    if (!(await confirm({ title: `Delete the ${tk(p.amount)} payment from ${fmtDate(p.paidAt)}? Their due will go up by this amount.`, tone: 'danger' }))) return;
    try {
      await webApiClient.delete(`/api/payments/${p.id}`);
      router.refresh();
    } catch {
      toast('Failed to delete payment.', 'error');
    }
  }

  async function deleteCustomer() {
    if (!(await confirm({ title: `Delete ${customer.name}? This cannot be undone.`, tone: 'danger' }))) return;
    try {
      await webApiClient.delete(`/api/customers/${customer.id}`, 'Failed to delete customer');
      router.push('/dashboard/customers');
      router.refresh();
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/dashboard/customers" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> All customers
      </Link>

      <div className="flex flex-col gap-4 rounded-card border border-line bg-white p-5 shadow-card sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-card bg-ink text-lg font-bold text-white">
              {customer.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-ink">{customer.name}</h1>
                <CustomerTypeBadge type={customer.type} />
              </div>
              <p className="text-sm text-slate-500">
                Customer since {fmtDate(customer.createdAt)} · {customer.salesCount} sale{customer.salesCount === 1 ? '' : 's'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
            {customer.phone && (
              <a href={`tel:${customer.phone}`} className="inline-flex items-center gap-1.5 hover:text-ink">
                <Phone className="h-4 w-4" /> {customer.phone}
              </a>
            )}
            {customer.address && (
              <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {customer.address}</span>
            )}
            {customer.notes && (
              <span className="inline-flex items-center gap-1.5"><StickyNote className="h-4 w-4" /> {customer.notes}</span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setModal({ kind: 'payment', payment: null })}
            className="inline-flex items-center gap-2 rounded-control bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
          >
            <HandCoins className="h-4 w-4" /> Collect payment
          </button>
          <button
            onClick={() => setModal({ kind: 'sale', sale: null })}
            className="inline-flex items-center gap-2 rounded-control bg-ink px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-700"
          >
            <Plus className="h-4 w-4" /> New sale
          </button>
          <button
            onClick={() => setModal({ kind: 'customer' })}
            className="inline-flex items-center gap-2 rounded-control border border-line bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <Edit3 className="h-4 w-4" /> Edit
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <SummaryCard label="Total bought" value={tk(customer.totalSold)} Icon={ShoppingBag} tone="slate" />
        <SummaryCard label="Total paid" value={tk(customer.totalPaid)} Icon={Wallet} tone="emerald" />
        {customer.advance > 0 ? (
          <SummaryCard label="Advance (credit)" value={tk(customer.advance)} Icon={PiggyBank} tone="emerald" />
        ) : customer.totalDue > 0 ? (
          <SummaryCard label="Still due" value={tk(customer.totalDue)} Icon={AlertCircle} tone="red" />
        ) : (
          <SummaryCard label="Still due" value={tk(0)} Icon={CheckCircle} tone="emerald" hint="All settled" />
        )}
      </div>

      <section className="rounded-card border border-line bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-bold text-ink">History</h2>
          <p className="text-xs text-slate-500">Payments clear the oldest sales first.</p>
        </div>
        {customer.history.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-slate-500">No sales or payments yet.</p>
        ) : (
          groupByMonth(customer.history).map(({ month, entries }) => (
            <div key={month} id={`m-${month}`} className="scroll-mt-6">
              <MonthHeading month={month} summary={months.find((m) => m.month === month)} />
              <ol className="divide-y divide-slate-100">
                {entries.map((entry) =>
                  entry.kind === 'sale' ? (
                    <SaleRow
                      key={`s-${entry.sale.id}`}
                      sale={entry.sale}
                      onEdit={() => setModal({ kind: 'sale', sale: entry.sale })}
                      onDelete={() => deleteSale(entry.sale)}
                    />
                  ) : (
                    <PaymentRow
                      key={`p-${entry.payment.id}`}
                      payment={entry.payment}
                      onEdit={() => setModal({ kind: 'payment', payment: entry.payment })}
                      onDelete={() => deletePayment(entry.payment)}
                    />
                  ),
                )}
              </ol>
            </div>
          ))
        )}
      </section>

      {customer.salesCount === 0 && (
        <div className="text-right">
          <button onClick={deleteCustomer} className="text-sm font-semibold text-red-600 hover:underline">
            Delete customer
          </button>
        </div>
      )}

      {modal?.kind === 'sale' && (
        <SaleFormModal
          customers={[]}
          activeCows={activeCows}
          sale={modal.sale}
          presetCustomer={{ id: customer.id, name: customer.name, type: customer.type, lastMilkPrice: customer.lastMilkPrice }}
          defaultMilkPrice={defaultMilkPrice}
          onClose={() => setModal(null)}
          onSaved={done}
        />
      )}
      {modal?.kind === 'payment' && (
        <PaymentFormModal party={customer} payment={modal.payment} onClose={() => setModal(null)} onSaved={done} />
      )}
      {modal?.kind === 'customer' && (
        <CustomerFormModal customer={customer} onClose={() => setModal(null)} onSaved={done} />
      )}
    </div>
  );
}

/** History is newest first, so months come out newest first too. */
function groupByMonth(history: CustomerHistoryEntry[]) {
  const groups: { month: string; entries: CustomerHistoryEntry[] }[] = [];
  for (const entry of history) {
    const month = monthKey(entry.date);
    const last = groups[groups.length - 1];
    if (last?.month === month) last.entries.push(entry);
    else groups.push({ month, entries: [entry] });
  }
  return groups;
}

function MonthHeading({ month, summary }: { month: string; summary?: MonthSummary }) {
  const label = monthLabel(month);
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-y border-slate-100 bg-slate-50 px-6 py-2.5">
      <h3 className="text-sm font-bold text-ink">{label}</h3>
      {summary && (
        <p className="flex flex-wrap gap-x-4 text-xs text-slate-600">
          {summary.milkLitres > 0 && <span><strong className="text-ink">{summary.milkLitres.toLocaleString('en-IN')} L</strong> milk</span>}
          <span>Sold <strong className="text-ink">{tk(summary.sold)}</strong></span>
          <span>Paid <strong className="text-brand-700">{tk(summary.paid)}</strong></span>
          <span>
            {summary.closing > 0 ? (
              <>Due at month end <strong className="text-red-600">{tk(summary.closing)}</strong></>
            ) : summary.closing < 0 ? (
              <>Advance <strong className="text-brand-700">{tk(-summary.closing)}</strong></>
            ) : (
              <strong className="text-slate-400">Clear at month end</strong>
            )}
          </span>
        </p>
      )}
    </div>
  );
}

function RowActions({ label, onEdit, onDelete }: { label: string; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex shrink-0 gap-1">
      <button onClick={onEdit} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-ink" aria-label={`Edit ${label}`}>
        <Edit3 className="h-4 w-4" />
      </button>
      <button onClick={onDelete} className="rounded-lg p-2 text-red-500 hover:bg-red-50 hover:text-red-700" aria-label={`Delete ${label}`}>
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function SaleRow({ sale, onEdit, onDelete }: { sale: Sale; onEdit: () => void; onDelete: () => void }) {
  const info = productTypeInfo(sale.saleType);
  const paid = salePaid(sale);
  const due = Math.max(0, sale.amount - paid);
  return (
    <li className="flex items-start gap-4 px-6 py-4">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-slate-100 text-slate-600">
        <ShoppingBag className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-ink">
            Sold {info.label.toLowerCase()}
            {sale.quantity != null && sale.unitPrice != null && (
              <span className="font-normal text-slate-500">
                {' '}· {sale.quantity}{info.unit ? ` ${info.unit}` : ''} × {tk(sale.unitPrice)}
              </span>
            )}
            {sale.cow && <span className="font-normal text-slate-500"> · {sale.cow.name} ({sale.cow.tagNumber})</span>}
          </p>
          <PaymentStatusPill status={sale.status} />
        </div>
        <p className="mt-0.5 text-xs text-slate-500">
          {fmtDate(sale.createdAt)}
          {sale.notes ? ` · ${sale.notes}` : ''}
          {due > 0 && paid > 0 ? ` · ${tk(paid)} paid, ${tk(due)} due` : ''}
        </p>
      </div>
      <p className="shrink-0 text-right text-sm font-bold text-ink">{tk(sale.amount)}</p>
      <RowActions label={`sale of ${tk(sale.amount)}`} onEdit={onEdit} onDelete={onDelete} />
    </li>
  );
}

function PaymentRow({ payment, onEdit, onDelete }: { payment: Payment; onEdit: () => void; onDelete: () => void }) {
  return (
    <li className="flex items-start gap-4 bg-brand-50/40 px-6 py-4">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-brand-100 text-brand-700">
        <HandCoins className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">
          Received payment <span className="font-normal text-slate-500">· {paymentMethodLabel(payment.method)}</span>
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          {fmtDate(payment.paidAt)}
          {payment.note ? ` · ${payment.note}` : ''}
        </p>
      </div>
      <p className="shrink-0 text-right text-sm font-bold text-brand-700">+{tk(payment.amount)}</p>
      <RowActions label={`payment of ${tk(payment.amount)}`} onEdit={onEdit} onDelete={onDelete} />
    </li>
  );
}
