import { useEffect, useState } from 'react';
import type { Supplier } from '@farm/shared-types';
import { mobileApiClient } from '@/src/lib/apiClient';
import { generateIdempotencyKey } from '@/src/lib/idempotency';
import { FormModal, FormFooter, FormError, TextField } from '@/src/components/ui';

/** Add or edit a supplier, like the web's feed/SupplierFormModal. */
export function SupplierFormModal({
  visible,
  supplier,
  onClose,
  onSaved,
}: {
  visible: boolean;
  supplier?: Supplier | null;
  onClose: () => void;
  onSaved: (saved: Supplier) => void;
}) {
  const editing = !!supplier;
  const [form, setForm] = useState({ name: '', phone: '', address: '', notes: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [createKey, setCreateKey] = useState(generateIdempotencyKey);

  // Fresh form each time the sheet opens.
  useEffect(() => {
    if (!visible) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({ name: supplier?.name ?? '', phone: supplier?.phone ?? '', address: supplier?.address ?? '', notes: supplier?.notes ?? '' });
    setError('');
    setCreateKey(generateIdempotencyKey());
  }, [visible, supplier]);

  async function submit() {
    setError('');
    if (!form.name.trim()) {
      setError('Please enter the supplier name');
      return;
    }
    setLoading(true);
    try {
      const saved = editing
        ? await mobileApiClient.put<Supplier>(`/api/suppliers/${supplier!.id}`, form, 'Failed to save supplier')
        : await mobileApiClient.post<Supplier>('/api/suppliers', form, 'Failed to save supplier', { idempotencyKey: createKey });
      onSaved(saved);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <FormModal
      visible={visible}
      title={editing ? 'Edit supplier' : 'Add supplier'}
      onClose={onClose}
      footer={<FormFooter onCancel={onClose} onSubmit={submit} loading={loading} label={editing ? 'Save changes' : 'Add supplier'} />}
    >
      <FormError message={error} />
      <TextField label="Name / shop *" placeholder="e.g. Rahim Feed Store" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
      <TextField label="Phone" placeholder="01XXXXXXXXX" keyboardType="phone-pad" value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} />
      <TextField label="Bazaar / address" placeholder="Optional" value={form.address} onChangeText={(v) => setForm({ ...form, address: v })} />
      <TextField label="Note" placeholder="e.g. Gives baki up to 2 weeks" value={form.notes} onChangeText={(v) => setForm({ ...form, notes: v })} />
    </FormModal>
  );
}
