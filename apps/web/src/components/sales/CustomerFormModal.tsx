"use client";

import { useState } from 'react';
import type { Customer } from '@farm/shared-types';
import { webApiClient } from '@farm/api-client';
import Modal, { FormError, FormFooter } from './Modal';
import { inputCls, labelCls } from './shared';

export default function CustomerFormModal({
  customer,
  onClose,
  onSaved,
}: {
  customer?: Customer | null;
  onClose: () => void;
  onSaved: (saved: Customer) => void;
}) {
  const editing = !!customer;
  const [form, setForm] = useState({
    name: customer?.name ?? '',
    phone: customer?.phone ?? '',
    address: customer?.address ?? '',
    type: customer?.type ?? 'new',
    notes: customer?.notes ?? '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const saved = editing
        ? await webApiClient.put<Customer>(`/api/customers/${customer!.id}`, form, 'Failed to save customer')
        : await webApiClient.post<Customer>('/api/customers', form, 'Failed to save customer');
      onSaved(saved);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title={editing ? 'Edit customer' : 'Add customer'} onClose={onClose}>
      <FormError message={error} />
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label htmlFor="cust-name" className={labelCls}>Name</label>
          <input
            id="cust-name"
            required
            autoFocus
            placeholder="e.g. Abdul Karim"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputCls}
          />
        </div>

        <div>
          <span className={labelCls}>Customer type</span>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Customer type">
            {[
              { value: 'regular', label: 'Regular', hint: 'Buys often (e.g. daily milk)' },
              { value: 'new', label: 'New', hint: 'First time or occasional' },
            ].map((t) => (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={form.type === t.value}
                onClick={() => setForm({ ...form, type: t.value })}
                className={`rounded-control border px-3.5 py-2.5 text-left transition ${
                  form.type === t.value ? 'border-slate-900 bg-ink text-white' : 'border-line bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="block text-sm font-semibold">{t.label}</span>
                <span className={`block text-xs ${form.type === t.value ? 'text-slate-300' : 'text-slate-500'}`}>{t.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="cust-phone" className={labelCls}>Phone</label>
            <input
              id="cust-phone"
              type="tel"
              inputMode="tel"
              placeholder="01XXXXXXXXX"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="cust-address" className={labelCls}>Address / area</label>
            <input
              id="cust-address"
              placeholder="Optional"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label htmlFor="cust-notes" className={labelCls}>Note</label>
          <input
            id="cust-notes"
            placeholder="e.g. Takes 2 L every morning"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className={inputCls}
          />
        </div>

        <FormFooter onCancel={onClose} loading={loading} label={editing ? 'Save changes' : 'Add customer'} />
      </form>
    </Modal>
  );
}
