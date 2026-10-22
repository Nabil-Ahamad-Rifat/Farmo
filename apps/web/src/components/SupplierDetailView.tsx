"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Phone, MapPin, StickyNote, Wallet, Plus, Edit3, Trash2, Wheat, ShoppingBag, AlertCircle, PiggyBank, CheckCircle,
} from 'lucide-react';
import type { FeedBatch, SupplierDetail, SupplierPayment } from '@farm/shared-types';
import { webApiClient } from '@farm/api-client';
import FeedPurchaseModal from '@/components/feed/FeedPurchaseModal';
import SupplierFormModal from '@/components/feed/SupplierFormModal';
import PaymentFormModal from '@/components/sales/PaymentFormModal';
import { feedPayStatus } from '@/components/feed/shared';
import { SummaryCard, PaymentStatusPill, paymentMethodLabel, tk, fmtDate } from '@/components/sales/shared';
import { useConfirm, useToast } from '@/components/ui/Feedback';

type ModalState =
  | { kind: 'purchase'; batch: FeedBatch | null }
  | { kind: 'payment'; payment: SupplierPayment | null }
  | { kind: 'supplier' }
  | null;

export default function SupplierDetailView({ supplier }: { supplier: SupplierDetail }) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [modal, setModal] = useState<ModalState>(null);
  const done = () => {
    setModal(null);
    router.refresh();
  };

  async function deletePurchase(b: FeedBatch) {
    if (!(await confirm({ title: `Delete the ${b.name} purchase (${tk(b.quantity * b.unitPrice)}) from ${fmtDate(b.purchasedAt ?? b.createdAt)}?`, tone: 'danger' }))) return;
    try {
      await webApiClient.delete(`/api/feed/${b.id}`);
      router.refresh();
    } catch {
      toast('Failed to delete purchase.', 'error');
    }
  }

  async function deletePayment(p: SupplierPayment) {
    if (!(await confirm({ title: `Delete the ${tk(p.amount)} payment from ${fmtDate(p.paidAt)}? What you owe will go up by this amount.`, tone: 'danger' }))) return;
    try {
      await webApiClient.delete(`/api/supplier-payments/${p.id}`);
      router.refresh();
    } catch {
      toast('Failed to delete payment.', 'error');
    }
  }

  async function deleteSupplier() {
    if (!(await confirm({ title: `Delete ${supplier.name}? This cannot be undone.`, tone: 'danger' }))) return;
    try {
      await webApiClient.delete(`/api/suppliers/${supplier.id}`, 'Failed to delete supplier');
      router.push('/dashboard/suppliers');
      router.refresh();
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/dashboard/suppliers" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> All suppliers
      </Link>

      <div className="flex flex-col gap-4 rounded-card border border-line bg-white p-5 shadow-card sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-card bg-amber-600 text-lg font-bold text-white">
              {supplier.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-ink">{supplier.name}</h1>
              <p className="text-sm text-slate-500">
                Supplier since {fmtDate(supplier.createdAt)} · {supplier.purchasesCount} purchase{supplier.purchasesCount === 1 ? '' : 's'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
            {supplier.phone && (
              <a href={`tel:${supplier.phone}`} className="inline-flex items-center gap-1.5 hover:text-ink">
                <Phone className="h-4 w-4" /> {supplier.phone}
              </a>
            )}
            {supplier.address && (
              <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {supplier.address}</span>
            )}
            {supplier.notes && (
              <span className="inline-flex items-center gap-1.5"><StickyNote className="h-4 w-4" /> {supplier.notes}</span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setModal({ kind: 'payment', payment: null })}
            className="inline-flex items-center gap-2 rounded-control bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700"
          >
            <Wallet className="h-4 w-4" /> Pay supplier
          </button>
          <button
            onClick={() => setModal({ kind: 'purchase', batch: null })}
            className="inline-flex items-center gap-2 rounded-control bg-ink px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-700"
          >
            <Plus className="h-4 w-4" /> New purchase
          </button>
          <button
            onClick={() => setModal({ kind: 'supplier' })}
            className="inline-flex items-center gap-2 rounded-control border border-line bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <Edit3 className="h-4 w-4" /> Edit
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <SummaryCard label="Total bought" value={tk(supplier.totalBought)} Icon={ShoppingBag} tone="slate" />
        <SummaryCard label="Total paid" value={tk(supplier.totalPaid)} Icon={Wallet} tone="emerald" />
        {supplier.advance > 0 ? (
          <SummaryCard label="Advance paid" value={tk(supplier.advance)} Icon={PiggyBank} tone="emerald" />
        ) : supplier.totalDue > 0 ? (
          <SummaryCard label="You still owe" value={tk(supplier.totalDue)} Icon={AlertCircle} tone="red" />
        ) : (
          <SummaryCard label="You still owe" value={tk(0)} Icon={CheckCircle} tone="emerald" hint="All settled" />
        )}
      </div>

      <section className="rounded-card border border-line bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-bold text-ink">History</h2>
          <p className="text-xs text-slate-500">Payments clear the oldest purchases first.</p>
        </div>
        {supplier.history.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-slate-500">No purchases or payments yet.</p>
        ) : (
          <ol className="divide-y divide-slate-100">
            {supplier.history.map((entry) =>
              entry.kind === 'purchase' ? (
                <PurchaseRow
                  key={`b-${entry.purchase.id}`}
                  batch={entry.purchase}
                  onEdit={() => setModal({ kind: 'purchase', batch: entry.purchase })}
                  onDelete={() => deletePurchase(entry.purchase)}
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
        )}
      </section>

      {supplier.purchasesCount === 0 && (
        <div className="text-right">
          <button onClick={deleteSupplier} className="text-sm font-semibold text-red-600 hover:underline">
            Delete supplier
          </button>
        </div>
      )}

      {modal?.kind === 'purchase' && (
        <FeedPurchaseModal
          suppliers={[]}
          batch={modal.batch}
          presetSupplier={{ id: supplier.id, name: supplier.name }}
          onClose={() => setModal(null)}
          onSaved={done}
        />
      )}
      {modal?.kind === 'payment' && (
        <PaymentFormModal party={supplier} mode="pay" payment={modal.payment} onClose={() => setModal(null)} onSaved={done} />
      )}
      {modal?.kind === 'supplier' && (
        <SupplierFormModal supplier={supplier} onClose={() => setModal(null)} onSaved={done} />
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

function PurchaseRow({ batch, onEdit, onDelete }: { batch: FeedBatch; onEdit: () => void; onDelete: () => void }) {
  const total = batch.quantity * batch.unitPrice;
  const paid = batch.paidAmount ?? 0;
  const due = Math.max(0, total - paid);
  const s = batch.schedule;
  return (
    <li className="flex items-start gap-4 px-6 py-4">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-amber-100 text-amber-700">
        <Wheat className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-ink">
            Bought {batch.name}
            <span className="font-normal text-slate-500"> · {batch.quantity.toLocaleString()} kg × {tk(batch.unitPrice)}</span>
          </p>
          <PaymentStatusPill status={feedPayStatus(batch)} />
        </div>
        <p className="mt-0.5 text-xs text-slate-500">
          {fmtDate(batch.purchasedAt ?? batch.createdAt)}
          {s ? ` · ${s.coverDays} day${s.coverDays === 1 ? '' : 's'} · ${s.perDayQty.toLocaleString()} kg/day · ${tk(s.perDayCost)}/day` : ''}
          {due > 0 && paid > 0 ? ` · ${tk(paid)} paid, ${tk(due)} due` : ''}
        </p>
      </div>
      <p className="shrink-0 text-right text-sm font-bold text-ink">{tk(total)}</p>
      <RowActions label={`purchase of ${batch.name}`} onEdit={onEdit} onDelete={onDelete} />
    </li>
  );
}

function PaymentRow({ payment, onEdit, onDelete }: { payment: SupplierPayment; onEdit: () => void; onDelete: () => void }) {
  return (
    <li className="flex items-start gap-4 bg-amber-50/40 px-6 py-4">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-amber-100 text-amber-800">
        <Wallet className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">
          Paid supplier <span className="font-normal text-slate-500">· {paymentMethodLabel(payment.method)}</span>
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          {fmtDate(payment.paidAt)}
          {payment.note ? ` · ${payment.note}` : ''}
        </p>
      </div>
      <p className="shrink-0 text-right text-sm font-bold text-amber-800">−{tk(payment.amount)}</p>
      <RowActions label={`payment of ${tk(payment.amount)}`} onEdit={onEdit} onDelete={onDelete} />
    </li>
  );
}
