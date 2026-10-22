"use client";

import { useState } from 'react';
import type { Payment, SupplierPayment } from '@farm/shared-types';
import { webApiClient } from '@farm/api-client';
import Modal, { FormError, FormFooter } from './Modal';
import { PAYMENT_METHODS, inputCls, labelCls, tk, todayStr, toDay } from './shared';

/** Wording and endpoints for money coming in from a customer vs going out to a supplier. */
const MODES = {
  collect: {
    newTitle: 'Collect payment',
    owes: 'currently owes',
    amountLabel: 'Amount received (৳)',
    notePlaceholder: 'e.g. September milk bill',
    create: (id: string) => `/api/customers/${id}/payments`,
    update: (id: string) => `/api/payments/${id}`,
  },
  pay: {
    newTitle: 'Pay supplier',
    owes: 'you owe',
    amountLabel: 'Amount paid (৳)',
    notePlaceholder: 'e.g. Bushi bill, week 2',
    create: (id: string) => `/api/suppliers/${id}/payments`,
    update: (id: string) => `/api/supplier-payments/${id}`,
  },
} as const;

export type PaymentMode = keyof typeof MODES;

export default function PaymentFormModal({
  party,
  mode = 'collect',
  payment,
  onClose,
  onSaved,
}: {
  /** The customer (collect) or supplier (pay), and what is owed between you. */
  party: { id: string; name: string; totalDue: number };
  mode?: PaymentMode;
  /** Editing an existing payment when set. */
  payment?: Payment | SupplierPayment | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const copy = MODES[mode];
  const editing = !!payment;
  const [form, setForm] = useState({
    amount: payment ? String(payment.amount) : party.totalDue > 0 ? String(party.totalDue) : '',
    method: payment?.method ?? 'cash',
    paidAt: payment ? toDay(payment.paidAt) : todayStr(),
    note: payment?.note ?? '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const amount = parseFloat(form.amount) || 0;
  // When editing, the old amount is already counted in totalDue.
  const dueBefore = party.totalDue + (editing ? payment!.amount : 0);
  const after = dueBefore - amount;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!(amount > 0)) return setError(mode === 'pay' ? 'Enter the amount paid.' : 'Enter the amount received.');
    setLoading(true);
    try {
      if (editing) await webApiClient.put(copy.update(payment!.id), form, 'Failed to save payment');
      else await webApiClient.post(copy.create(party.id), form, 'Failed to save payment');
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title={editing ? 'Edit payment' : copy.newTitle}
      subtitle={`${party.name} · ${copy.owes} ${tk(party.totalDue)}`}
      onClose={onClose}
    >
      <FormError message={error} />
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label htmlFor="pay-amount" className={labelCls}>{copy.amountLabel}</label>
          <input
            id="pay-amount"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            autoFocus
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className={`${inputCls} text-lg font-semibold`}
          />
          {dueBefore > 0 && !editing && (
            <button
              type="button"
              onClick={() => setForm({ ...form, amount: String(dueBefore) })}
              className="mt-2 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Full due {tk(dueBefore)}
            </button>
          )}
          <p className={`mt-2 text-sm font-semibold ${after > 0 ? 'text-red-600' : 'text-brand-700'}`} aria-live="polite">
            {after > 0
              ? `Still due after this: ${tk(after)}`
              : after < 0
                ? `Fully cleared, ${tk(-after)} kept as advance`
                : 'Fully cleared'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="pay-method" className={labelCls}>Paid by</label>
            <select
              id="pay-method"
              value={form.method}
              onChange={(e) => setForm({ ...form, method: e.target.value })}
              className={inputCls}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="pay-date" className={labelCls}>Date</label>
            <input
              id="pay-date"
              type="date"
              max={todayStr()}
              value={form.paidAt}
              onChange={(e) => setForm({ ...form, paidAt: e.target.value })}
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label htmlFor="pay-note" className={labelCls}>Note</label>
          <input
            id="pay-note"
            type="text"
            placeholder={copy.notePlaceholder}
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            className={inputCls}
          />
        </div>

        <FormFooter onCancel={onClose} loading={loading} label={editing ? 'Save changes' : 'Save payment'} />
      </form>
    </Modal>
  );
}
