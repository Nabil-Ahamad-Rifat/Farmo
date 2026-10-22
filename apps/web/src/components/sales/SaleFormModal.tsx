"use client";

import { useMemo, useState } from 'react';
import type { Cow, Sale } from '@farm/shared-types';
import { webApiClient } from '@farm/api-client';
import { calculateSaleAmount } from '@farm/business-logic';
import Modal, { FormError, FormFooter } from './Modal';
import CustomerPicker, { type CustomerChoice, type PickerCustomer } from './CustomerPicker';
import { PRODUCT_TYPES, PAYMENT_METHODS, inputCls, labelCls, tk, todayStr, toDay, salePaid, productTypeInfo } from './shared';

export default function SaleFormModal({
  customers,
  activeCows,
  sale,
  presetCustomer,
  defaultMilkPrice,
  onClose,
  onSaved,
}: {
  customers: PickerCustomer[];
  activeCows: Pick<Cow, 'id' | 'name' | 'tagNumber'>[];
  /** Editing an existing sale when set. */
  sale?: Sale | null;
  /** Opened from a customer's page: customer is fixed. */
  presetCustomer?: PickerCustomer;
  /** Milk price per litre for customers with no earlier milk sale (from Settings). */
  defaultMilkPrice: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = !!sale;
  const initialCustomer: CustomerChoice = presetCustomer
    ? { kind: 'existing', id: presetCustomer.id, name: presetCustomer.name, type: presetCustomer.type }
    : sale?.customer
      ? { kind: 'existing', id: sale.customer.id, name: sale.customer.name, type: sale.customer.type }
      : null;

  // New milk sales start at the customer's last milk price, or the farm default.
  const lastPriceOf = (choice: CustomerChoice) => {
    if (choice?.kind !== 'existing') return null;
    const known = presetCustomer?.id === choice.id ? presetCustomer : customers.find((c) => c.id === choice.id);
    return known?.lastMilkPrice ?? null;
  };
  const suggestedPrice = (choice: CustomerChoice) => lastPriceOf(choice) ?? defaultMilkPrice;
  const priceSource = (choice: CustomerChoice) =>
    lastPriceOf(choice) != null ? 'Last price for this customer' : 'Default price (Settings)';

  const [customer, setCustomer] = useState<CustomerChoice>(initialCustomer);
  // Once the user types a price it is never overwritten.
  const [priceTouched, setPriceTouched] = useState(false);
  const [form, setForm] = useState({
    saleType: sale ? (PRODUCT_TYPES.some((t) => t.value === sale.saleType) ? sale.saleType : 'other') : 'milk',
    quantity: sale?.quantity?.toString() ?? '',
    unitPrice: sale ? sale.unitPrice?.toString() ?? '' : String(suggestedPrice(initialCustomer)),
    amount: sale?.amount.toString() ?? '',
    paidNow: '',
    paidTouched: false,
    paymentMethod: 'cash',
    saleDate: sale ? toDay(sale.createdAt) : todayStr(),
    cowId: sale?.cowId ?? '',
    notes: sale?.notes ?? '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const prefilling = !editing && !priceTouched && form.saleType === 'milk';

  function chooseCustomer(choice: CustomerChoice) {
    setCustomer(choice);
    if (prefilling) setForm((f) => ({ ...f, unitPrice: String(suggestedPrice(choice)) }));
  }

  function chooseProduct(saleType: string) {
    if (editing || priceTouched) return setForm((f) => ({ ...f, saleType }));
    // The milk price doesn't apply to a cow or other product.
    setForm((f) => ({ ...f, saleType, unitPrice: saleType === 'milk' ? String(suggestedPrice(customer)) : '' }));
  }

  const auto = calculateSaleAmount(form.quantity, form.unitPrice);
  const total = auto ?? (parseFloat(form.amount) || 0);
  // "Paid now" follows the total until the user edits it.
  const paidNow = form.paidTouched ? parseFloat(form.paidNow) || 0 : total;
  const due = Math.max(0, total - paidNow);
  const unit = productTypeInfo(form.saleType).unit;

  // Keep a cow already linked to this sale selectable even though it is now "sold".
  const cowOptions = useMemo(() => {
    const list = [...activeCows];
    if (sale?.cow && !list.some((c) => c.id === sale.cow!.id)) list.unshift(sale.cow);
    return list;
  }, [activeCows, sale]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!customer) return setError('Please choose or add a customer.');
    if (!(total > 0)) return setError('Enter the quantity and price, or the total amount.');
    if (!editing && paidNow > total) return setError('Paid now cannot be more than the total.');

    const payload = {
      ...(customer.kind === 'existing'
        ? { customerId: customer.id }
        : { customerName: customer.name, customerType: customer.type }),
      saleType: form.saleType,
      quantity: form.quantity || undefined,
      unitPrice: form.unitPrice || undefined,
      amount: total,
      saleDate: form.saleDate,
      cowId: form.saleType === 'cow_sale' ? form.cowId || undefined : undefined,
      notes: form.notes,
      ...(editing ? {} : { paidNow, paymentMethod: form.paymentMethod }),
    };

    setLoading(true);
    try {
      if (editing) await webApiClient.put(`/api/sales/${sale!.id}`, payload, 'Failed to save sale');
      else await webApiClient.post('/api/sales', payload, 'Failed to save sale');
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title={editing ? 'Edit sale' : 'Record a sale'}
      subtitle={editing ? undefined : 'Milk, cow or any other product — paid in full, partly, or on credit.'}
      onClose={onClose}
    >
      <FormError message={error} />
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <span className={labelCls}>Customer</span>
          {presetCustomer ? (
            <p className="rounded-control border border-line bg-slate-50 px-3.5 py-2.5 text-sm font-semibold text-ink">
              {presetCustomer.name}
            </p>
          ) : (
            <CustomerPicker customers={customers} value={customer} onChange={chooseCustomer} />
          )}
          {customer?.kind === 'new' && (
            <div className="mt-2 flex items-center gap-2 text-xs">
              <span className="font-semibold text-slate-600">Customer type:</span>
              {(['new', 'regular'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setCustomer({ ...customer, type: t })}
                  className={`rounded-lg px-3 py-1.5 font-semibold capitalize transition ${
                    customer.type === t ? 'bg-ink text-white' : 'border border-line bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <span className={labelCls}>What was sold</span>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Product type">
            {PRODUCT_TYPES.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={form.saleType === value}
                onClick={() => chooseProduct(value)}
                className={`flex items-center justify-center gap-2 rounded-control border px-3 py-2.5 text-sm font-semibold transition ${
                  form.saleType === value
                    ? 'border-slate-900 bg-ink text-white'
                    : 'border-line bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {form.saleType === 'cow_sale' && (
          <div>
            <label htmlFor="sale-cow" className={labelCls}>Which cow</label>
            <select
              id="sale-cow"
              value={form.cowId}
              onChange={(e) => setForm({ ...form, cowId: e.target.value })}
              className={inputCls}
            >
              <option value="">Not linked</option>
              {cowOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.tagNumber})</option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="sale-qty" className={labelCls}>Quantity{unit ? ` (${unit})` : ''}</label>
            <input
              id="sale-qty"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              placeholder={form.saleType === 'milk' ? 'e.g. 10' : 'Optional'}
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="sale-price" className={labelCls}>Price per {unit || 'unit'} (৳)</label>
            <input
              id="sale-price"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              placeholder={form.saleType === 'milk' ? 'e.g. 90' : 'Optional'}
              value={form.unitPrice}
              onChange={(e) => {
                setPriceTouched(true);
                setForm({ ...form, unitPrice: e.target.value });
              }}
              className={inputCls}
            />
            {prefilling && <p className="mt-1 text-[11px] text-slate-500">{priceSource(customer)}</p>}
          </div>
        </div>

        <div>
          <label htmlFor="sale-total" className={labelCls}>
            Total (৳){auto !== null && <span className="ml-2 font-normal normal-case text-brand-600">= quantity × price</span>}
          </label>
          <input
            id="sale-total"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            readOnly={auto !== null}
            placeholder="e.g. 850"
            value={auto !== null ? auto.toFixed(2) : form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className={`${inputCls} ${auto !== null ? 'border-brand-200 bg-brand-50 font-semibold' : ''}`}
          />
        </div>

        {!editing && (
          <div className="rounded-control border border-line bg-slate-50/60 p-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="sale-paid" className={labelCls}>Paid now (৳)</label>
                <input
                  id="sale-paid"
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  value={form.paidTouched ? form.paidNow : total ? String(total) : ''}
                  onChange={(e) => setForm({ ...form, paidNow: e.target.value, paidTouched: true })}
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="sale-method" className={labelCls}>Paid by</label>
                <select
                  id="sale-method"
                  value={form.paymentMethod}
                  disabled={paidNow <= 0}
                  onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                  className={`${inputCls} disabled:bg-slate-100 disabled:text-slate-400`}
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, paidNow: '', paidTouched: false })}
                className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Fully paid
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, paidNow: '0', paidTouched: true })}
                className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                On credit (baki)
              </button>
            </div>
            <p className={`mt-3 text-sm font-semibold ${due > 0 ? 'text-red-600' : 'text-brand-700'}`} aria-live="polite">
              {due > 0 ? `${tk(due)} will be added to this customer's due` : 'Fully paid'}
            </p>
          </div>
        )}

        {editing && sale && (
          <p className="rounded-control border border-line bg-slate-50 p-3 text-xs text-slate-600">
            Paid so far on this sale: <strong>{tk(salePaid(sale))}</strong>. To change payments, open the customer&apos;s page.
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="sale-date" className={labelCls}>Date</label>
            <input
              id="sale-date"
              type="date"
              max={todayStr()}
              value={form.saleDate}
              onChange={(e) => setForm({ ...form, saleDate: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="sale-notes" className={labelCls}>Note</label>
            <input
              id="sale-notes"
              type="text"
              placeholder="Optional"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className={inputCls}
            />
          </div>
        </div>

        <FormFooter onCancel={onClose} loading={loading} label={editing ? 'Save changes' : 'Save sale'} />
      </form>
    </Modal>
  );
}
