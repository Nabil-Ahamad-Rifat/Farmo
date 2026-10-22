"use client";

import { useState } from 'react';
import type { FeedBatch } from '@farm/shared-types';
import { webApiClient } from '@farm/api-client';
import Modal, { FormError, FormFooter } from '@/components/sales/Modal';
import CustomerPicker, { type CustomerChoice, type PickerCustomer } from '@/components/sales/CustomerPicker';
import { PAYMENT_METHODS, inputCls, labelCls, tk, todayStr, toDay, fmtDate } from '@/components/sales/shared';

export const PRESET_FEED_NAMES = ['Bushi', 'Butta', 'Gom', 'Chaw', 'Khud', 'Soyabin', 'Khoil', 'Dhan', 'Kaher', 'Atta'];
const DAY_CHIPS = [1, 3, 7, 15, 30];

type PayMode = 'full' | 'partial' | 'credit';
const PAY_MODES: { value: PayMode; label: string; hint: string }[] = [
  { value: 'full', label: 'Fully paid', hint: 'Cash, nothing owed' },
  { value: 'partial', label: 'Partly paid', hint: 'Rest is owed' },
  { value: 'credit', label: 'On credit', hint: 'Baki, paid later' },
];

const round2 = (n: number) => Math.round(n * 100) / 100;
const addDays = (day: string, n: number) => {
  const d = new Date(day + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d;
};

export default function FeedPurchaseModal({
  suppliers,
  batch,
  presetSupplier,
  onClose,
  onSaved,
}: {
  suppliers: PickerCustomer[];
  /** Editing an existing purchase when set. */
  batch?: FeedBatch | null;
  /** Opened from a supplier's page: supplier is fixed. */
  presetSupplier?: { id: string; name: string };
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = !!batch;
  const initialSupplier: CustomerChoice = presetSupplier
    ? { kind: 'existing', ...presetSupplier }
    : batch?.supplier
      ? { kind: 'existing', id: batch.supplier.id, name: batch.supplier.name }
      : null;

  const [supplier, setSupplier] = useState<CustomerChoice>(initialSupplier);
  const [form, setForm] = useState({
    name: batch?.name ?? '',
    quantity: batch?.quantity.toString() ?? '',
    unitPrice: batch?.unitPrice.toString() ?? '',
    coverDays: batch?.coverDays ? String(batch.coverDays) : '',
    purchasedAt: batch ? toDay(batch.purchasedAt ?? batch.createdAt) : todayStr(),
    remainingQuantity: batch?.remainingQuantity.toString() ?? '',
    payMode: 'full' as PayMode,
    paidNow: '',
    paymentMethod: 'cash',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const qty = parseFloat(form.quantity) || 0;
  const price = parseFloat(form.unitPrice) || 0;
  const total = round2(qty * price);
  const days = parseInt(form.coverDays, 10) || 0;
  const paidNow = form.payMode === 'full' ? total : form.payMode === 'credit' ? 0 : parseFloat(form.paidNow) || 0;
  const owed = round2(Math.max(0, total - paidNow));
  const customDays = form.coverDays !== '' && !DAY_CHIPS.includes(days);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) return setError('Enter the feed name.');
    if (!(qty > 0)) return setError('Enter the quantity bought.');
    if (!editing) {
      if (paidNow > total) return setError('Paid now cannot be more than the total.');
      if (owed > 0 && !supplier) return setError('Choose who you bought from, so the due is tracked against them.');
    }

    const payload = {
      name: form.name.trim(),
      quantity: form.quantity,
      unitPrice: form.unitPrice,
      // null clears the days on edit ("Don't know").
      coverDays: days || null,
      purchasedAt: form.purchasedAt,
      ...(supplier ? (supplier.kind === 'existing' ? { supplierId: supplier.id } : { supplierName: supplier.name }) : {}),
      ...(editing
        ? { remainingQuantity: form.remainingQuantity }
        : { paidNow, paymentMethod: form.paymentMethod }),
    };

    setLoading(true);
    try {
      if (editing) await webApiClient.put(`/api/feed/${batch!.id}`, payload, 'Failed to save purchase');
      else await webApiClient.post('/api/feed', payload, 'Failed to save purchase');
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title={editing ? 'Edit feed purchase' : 'Buy feed'}
      subtitle={editing ? undefined : 'Paid in cash, partly, or on credit (baki) — and how long it will last.'}
      onClose={onClose}
    >
      <FormError message={error} />
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label htmlFor="feed-name" className={labelCls}>Feed / grain</label>
          <input
            id="feed-name"
            required
            autoFocus={!editing}
            list="feed-presets"
            placeholder="e.g. Bushi, Butta, Gom..."
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
            className={inputCls}
          />
          <datalist id="feed-presets">
            {PRESET_FEED_NAMES.map((n) => <option key={n} value={n} />)}
          </datalist>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {PRESET_FEED_NAMES.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => set({ name: n })}
                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition ${
                  form.name === n ? 'border-amber-600 bg-amber-600 text-white' : 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className={labelCls}>
            Bought from{!editing && owed === 0 && <span className="ml-1 font-normal normal-case text-slate-400">(optional when fully paid)</span>}
          </span>
          {presetSupplier ? (
            <p className="rounded-control border border-line bg-slate-50 px-3.5 py-2.5 text-sm font-semibold text-ink">{presetSupplier.name}</p>
          ) : (
            <CustomerPicker noun="supplier" customers={suppliers} value={supplier} onChange={setSupplier} />
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="feed-qty" className={labelCls}>Quantity (kg)</label>
            <input
              id="feed-qty"
              type="number"
              step="0.1"
              min="0"
              inputMode="decimal"
              required
              placeholder="e.g. 500"
              value={form.quantity}
              onChange={(e) => set({ quantity: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="feed-price" className={labelCls}>Price per kg (৳)</label>
            <input
              id="feed-price"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              required
              placeholder="e.g. 35"
              value={form.unitPrice}
              onChange={(e) => set({ unitPrice: e.target.value })}
              className={inputCls}
            />
          </div>
        </div>
        {total > 0 && (
          <p className="-mt-2 text-sm text-slate-600">
            Total: <span className="font-bold text-ink">{tk(total)}</span>
          </p>
        )}

        <div>
          <span className={labelCls}>How many days will it last?</span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Days it will last">
            <button
              type="button"
              role="radio"
              aria-checked={form.coverDays === ''}
              onClick={() => set({ coverDays: '' })}
              className={`rounded-control border px-3.5 py-2 text-sm font-semibold transition ${
                form.coverDays === '' ? 'border-slate-900 bg-ink text-white' : 'border-line bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              Don&apos;t know
            </button>
            {DAY_CHIPS.map((d) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={days === d && !customDays}
                onClick={() => set({ coverDays: String(d) })}
                className={`rounded-control border px-3.5 py-2 text-sm font-semibold transition ${
                  days === d && !customDays ? 'border-slate-900 bg-ink text-white' : 'border-line bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {d} day{d === 1 ? '' : 's'}
              </button>
            ))}
            <input
              type="number"
              min="1"
              max="366"
              step="1"
              inputMode="numeric"
              aria-label="Other number of days"
              placeholder="Other"
              value={customDays ? form.coverDays : ''}
              onChange={(e) => set({ coverDays: e.target.value })}
              className={`w-24 rounded-control border px-3 py-2 text-sm ${customDays ? 'border-slate-900 font-semibold' : 'border-line'} focus:outline-none focus:ring-2 focus:ring-slate-200`}
            />
          </div>
          {form.coverDays === '' && total > 0 && (
            <p className="mt-2 rounded-control border border-line bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
              The full {tk(total)} counts as feed cost on the day you bought it.
            </p>
          )}
          {days >= 1 && qty > 0 && (
            <p className="mt-2 rounded-control border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800" aria-live="polite">
              ≈ {round2(qty / days).toLocaleString()} kg/day · {tk(round2(total / days))}/day · lasts until{' '}
              {fmtDate(addDays(form.purchasedAt || todayStr(), days - 1))}
            </p>
          )}
        </div>

        <div className={editing ? 'grid grid-cols-2 gap-3' : ''}>
          <div>
            <label htmlFor="feed-date" className={labelCls}>Bought on</label>
            <input
              id="feed-date"
              type="date"
              max={todayStr()}
              value={form.purchasedAt}
              onChange={(e) => set({ purchasedAt: e.target.value })}
              className={inputCls}
            />
          </div>
          {editing && (
            <div>
              <label htmlFor="feed-remaining" className={labelCls}>Stock left now (kg)</label>
              <input
                id="feed-remaining"
                type="number"
                step="0.1"
                min="0"
                inputMode="decimal"
                value={form.remainingQuantity}
                onChange={(e) => set({ remainingQuantity: e.target.value })}
                className={inputCls}
              />
            </div>
          )}
        </div>

        {!editing && (
          <div className="rounded-control border border-line bg-slate-50/60 p-4">
            <span className={labelCls}>Payment</span>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Payment">
              {PAY_MODES.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  role="radio"
                  aria-checked={form.payMode === m.value}
                  onClick={() => set({ payMode: m.value })}
                  className={`rounded-control border px-3 py-2 text-left transition ${
                    form.payMode === m.value ? 'border-slate-900 bg-ink text-white' : 'border-line bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="block text-sm font-semibold">{m.label}</span>
                  <span className={`block text-[11px] ${form.payMode === m.value ? 'text-slate-300' : 'text-slate-500'}`}>{m.hint}</span>
                </button>
              ))}
            </div>

            {form.payMode !== 'credit' && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="feed-paid" className={labelCls}>Paid now (৳)</label>
                  <input
                    id="feed-paid"
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    readOnly={form.payMode === 'full'}
                    value={form.payMode === 'full' ? (total ? String(total) : '') : form.paidNow}
                    onChange={(e) => set({ paidNow: e.target.value })}
                    className={`${inputCls} ${form.payMode === 'full' ? 'bg-slate-100' : ''}`}
                  />
                </div>
                <div>
                  <label htmlFor="feed-method" className={labelCls}>Paid by</label>
                  <select
                    id="feed-method"
                    value={form.paymentMethod}
                    onChange={(e) => set({ paymentMethod: e.target.value })}
                    className={inputCls}
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <p className={`mt-3 text-sm font-semibold ${owed > 0 ? 'text-red-600' : 'text-brand-700'}`} aria-live="polite">
              {owed > 0
                ? `${tk(owed)} will be added to what you owe${supplier ? ` ${supplier.name}` : ''}`
                : 'Fully paid — nothing owed'}
            </p>
          </div>
        )}

        {editing && batch && batch.supplier && (
          <p className="rounded-control border border-line bg-slate-50 p-3 text-xs text-slate-600">
            Paid so far on this purchase: <strong>{tk(batch.paidAmount ?? 0)}</strong>. To change payments, open the supplier&apos;s page.
          </p>
        )}

        <FormFooter onCancel={onClose} loading={loading} label={editing ? 'Save changes' : 'Save purchase'} />
      </form>
    </Modal>
  );
}
