"use client";

import { useState } from 'react';
import type { Supplier } from '@farm/shared-types';
import { webApiClient } from '@farm/api-client';
import Modal, { FormError, FormFooter } from '@/components/sales/Modal';
import { inputCls, labelCls } from '@/components/sales/shared';

export default function SupplierFormModal({
  supplier,
  onClose,
  onSaved,
}: {
  supplier?: Supplier | null;
  onClose: () => void;
  onSaved: (saved: Supplier) => void;
}) {
  const editing = !!supplier;
  const [form, setForm] = useState({
    name: supplier?.name ?? '',
    phone: supplier?.phone ?? '',
    address: supplier?.address ?? '',
    notes: supplier?.notes ?? '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const saved = editing
        ? await webApiClient.put<Supplier>(`/api/suppliers/${supplier!.id}`, form, 'Failed to save supplier')
        : await webApiClient.post<Supplier>('/api/suppliers', form, 'Failed to save supplier');
      onSaved(saved);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title={editing ? 'Edit supplier' : 'Add supplier'} onClose={onClose}>
      <FormError message={error} />
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label htmlFor="sup-name" className={labelCls}>Name / shop</label>
          <input
            id="sup-name"
            required
            autoFocus
            placeholder="e.g. Rahim Feed Store"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputCls}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="sup-phone" className={labelCls}>Phone</label>
            <input
              id="sup-phone"
              type="tel"
              inputMode="tel"
              placeholder="01XXXXXXXXX"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="sup-address" className={labelCls}>Bazaar / address</label>
            <input
              id="sup-address"
              placeholder="Optional"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label htmlFor="sup-notes" className={labelCls}>Note</label>
          <input
            id="sup-notes"
            placeholder="e.g. Gives baki up to 2 weeks"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className={inputCls}
          />
        </div>

        <FormFooter onCancel={onClose} loading={loading} label={editing ? 'Save changes' : 'Add supplier'} />
      </form>
    </Modal>
  );
}
