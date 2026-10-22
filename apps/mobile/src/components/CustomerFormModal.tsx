import { useEffect, useState } from 'react';
import { View, Pressable } from 'react-native';
import type { Customer } from '@farm/shared-types';
import { Text } from '@/src/components/ui/Text';
import { mobileApiClient } from '@/src/lib/apiClient';
import { generateIdempotencyKey } from '@/src/lib/idempotency';
import { FieldLabel, FormError, FormFooter, FormModal, TextField, useToast } from '@/src/components/ui';

const TYPES = [
  { value: 'regular', label: 'Regular', hint: 'Buys often (e.g. daily milk)' },
  { value: 'new', label: 'New', hint: 'First time or occasional' },
];

const fromCustomer = (c?: Customer | null) => ({
  name: c?.name ?? '',
  phone: c?.phone ?? '',
  address: c?.address ?? '',
  type: c?.type ?? 'new',
  notes: c?.notes ?? '',
});

/** Add a customer or edit one, like the web's CustomerFormModal. */
export function CustomerFormModal({
  visible,
  customer,
  onClose,
  onSaved,
}: {
  visible: boolean;
  customer?: Customer | null;
  onClose: () => void;
  onSaved: (saved: Customer) => void;
}) {
  const editing = !!customer;
  const toast = useToast();
  const [form, setForm] = useState(() => fromCustomer(customer));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [key, setKey] = useState(generateIdempotencyKey);

  // Fresh form each time the sheet opens.
  useEffect(() => {
    if (!visible) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(fromCustomer(customer));
    setError('');
    setKey(generateIdempotencyKey());
  }, [visible, customer]);

  async function submit() {
    setError('');
    if (!form.name.trim()) return setError('Please enter the customer name.');
    setLoading(true);
    try {
      const saved = editing
        ? await mobileApiClient.put<Customer>(`/api/customers/${customer!.id}`, form, 'Failed to save customer')
        : await mobileApiClient.post<Customer>('/api/customers', form, 'Failed to save customer', { idempotencyKey: key });
      toast(editing ? 'Customer saved' : `${saved.name} added`);
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
      title={editing ? 'Edit customer' : 'Add customer'}
      onClose={onClose}
      footer={<FormFooter onCancel={onClose} onSubmit={submit} loading={loading} label={editing ? 'Save changes' : 'Add customer'} />}
    >
      <FormError message={error} />
      <TextField label="Name *" placeholder="e.g. Abdul Karim" autoCapitalize="words" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
      <View>
        <FieldLabel label="Customer type" />
        <View className="flex-row gap-2">
          {TYPES.map((t) => {
            const active = form.type === t.value;
            return (
              <Pressable
                key={t.value}
                onPress={() => setForm({ ...form, type: t.value })}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                className={`flex-1 rounded-control px-3.5 py-2.5 ${active ? 'bg-ink' : 'border border-line bg-white'}`}
              >
                <Text className={`text-sm font-semibold ${active ? 'text-white' : 'text-slate-700'}`}>{t.label}</Text>
                <Text className={`text-xs ${active ? 'text-slate-300' : 'text-slate-500'}`}>{t.hint}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <TextField label="Phone" placeholder="01XXXXXXXXX" keyboardType="phone-pad" value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} />
      <TextField label="Address / area" placeholder="Optional" value={form.address} onChangeText={(v) => setForm({ ...form, address: v })} />
      <TextField label="Note" placeholder="e.g. Takes 2 L every morning" value={form.notes} onChangeText={(v) => setForm({ ...form, notes: v })} />
    </FormModal>
  );
}
