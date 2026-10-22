import { useEffect, useState } from 'react';
import { View, Pressable } from 'react-native';
import { Text, TextInput } from '@/src/components/ui/Text';
import type { FeedBatch } from '@farm/shared-types';
import { mobileApiClient } from '@/src/lib/apiClient';
import { generateIdempotencyKey } from '@/src/lib/idempotency';
import { PAYMENT_METHODS, fmtDate, tk, todayStr, toDay } from '@/src/lib/format';
import { FormModal, FormFooter, FormError, FieldLabel, TextField, ChipGroup, DateField } from '@/src/components/ui';
import { colors } from '@/src/theme';
import { PartyPickerField, type PartyChoice, type PickerParty } from '@/src/components/PartyPickerField';

export const PRESET_FEED_NAMES = ['Bushi', 'Butta', 'Gom', 'Chaw', 'Khud', 'Soyabin', 'Khoil', 'Dhan', 'Kaher', 'Atta'];
const DAY_CHIPS = [1, 3, 7, 15, 30];
const PAY_MODES = [
  { value: 'full', label: 'Fully paid' },
  { value: 'partial', label: 'Partly paid' },
  { value: 'credit', label: 'On credit (baki)' },
];
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Buy feed (supplier, days it lasts, paid/partly/baki) or edit a purchase. Opens when `open` is true. */
export function FeedPurchaseModal({
  open,
  batch,
  suppliers,
  presetSupplier,
  onClose,
  onSaved,
}: {
  open: boolean;
  batch?: FeedBatch | null;
  suppliers: PickerParty[];
  presetSupplier?: { id: string; name: string };
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = !!batch;
  const [supplier, setSupplier] = useState<PartyChoice>(null);
  const [form, setForm] = useState({
    name: '',
    quantity: '',
    unitPrice: '',
    coverDays: '',
    purchasedAt: todayStr(),
    remainingQuantity: '',
    payMode: 'full',
    paidNow: '',
    paymentMethod: 'cash',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [key, setKey] = useState(generateIdempotencyKey);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupplier(
      presetSupplier
        ? { kind: 'existing', ...presetSupplier }
        : batch?.supplier
          ? { kind: 'existing', id: batch.supplier.id, name: batch.supplier.name }
          : null,
    );
    setForm({
      name: batch?.name ?? '',
      quantity: batch ? String(batch.quantity) : '',
      unitPrice: batch ? String(batch.unitPrice) : '',
      coverDays: batch?.coverDays ? String(batch.coverDays) : '',
      purchasedAt: batch ? toDay(batch.purchasedAt ?? batch.createdAt) : todayStr(),
      remainingQuantity: batch ? String(batch.remainingQuantity) : '',
      payMode: 'full',
      paidNow: '',
      paymentMethod: 'cash',
    });
    setError('');
    setKey(generateIdempotencyKey());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, batch]);

  const qty = parseFloat(form.quantity) || 0;
  const total = round2(qty * (parseFloat(form.unitPrice) || 0));
  const days = parseInt(form.coverDays, 10) || 0;
  const paidNow = form.payMode === 'full' ? total : form.payMode === 'credit' ? 0 : parseFloat(form.paidNow) || 0;
  const owed = round2(Math.max(0, total - paidNow));
  const customDays = form.coverDays !== '' && !DAY_CHIPS.includes(days);
  const lastDay = (() => {
    const d = new Date((form.purchasedAt || todayStr()) + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + Math.max(0, days - 1));
    return d;
  })();

  async function save() {
    setError('');
    if (!form.name.trim()) return setError('Enter the feed name.');
    if (!(qty > 0)) return setError('Enter the quantity bought.');
    if (!editing && paidNow > total) return setError('Paid now cannot be more than the total.');
    if (!editing && owed > 0 && !supplier) return setError('Choose who you bought from, so the due is tracked against them.');

    const payload = {
      name: form.name.trim(),
      quantity: form.quantity,
      unitPrice: form.unitPrice,
      // null clears the days on edit ("Don't know").
      coverDays: days || null,
      purchasedAt: form.purchasedAt,
      ...(supplier ? (supplier.kind === 'existing' ? { supplierId: supplier.id } : { supplierName: supplier.name }) : {}),
      ...(editing ? { remainingQuantity: form.remainingQuantity } : { paidNow, paymentMethod: form.paymentMethod }),
    };
    setSaving(true);
    try {
      if (editing) await mobileApiClient.put(`/api/feed/${batch!.id}`, payload, 'Failed to save purchase');
      else await mobileApiClient.post('/api/feed', payload, 'Failed to save purchase', { idempotencyKey: key });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormModal
      visible={open}
      title={editing ? 'Edit feed purchase' : 'Buy feed'}
      subtitle="Paid in cash, partly, or on credit (baki) — and how long it will last."
      onClose={onClose}
      footer={<FormFooter onCancel={onClose} onSubmit={save} loading={saving} label={editing ? 'Save changes' : 'Save purchase'} />}
    >
      <FormError message={error} />
      <View>
        <TextField label="Feed / grain" placeholder="e.g. Bushi, Butta, Gom..." value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
        <View className="mt-2 flex-row flex-wrap gap-2">
          {PRESET_FEED_NAMES.map((n) => (
            <Pressable
              key={n}
              onPress={() => setForm({ ...form, name: n })}
              className={`rounded-full border px-3 py-1.5 ${form.name === n ? 'border-amber-600 bg-amber-600' : 'border-amber-200 bg-amber-50'}`}
            >
              <Text className={`text-xs font-semibold ${form.name === n ? 'text-white' : 'text-amber-800'}`}>{n}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      {presetSupplier ? (
        <View>
          <FieldLabel label="Bought from" />
          <Text className="rounded-control border border-line bg-slate-50 px-3.5 py-3 text-base font-semibold text-ink">{presetSupplier.name}</Text>
        </View>
      ) : (
        <PartyPickerField label="Bought from" noun="supplier" parties={suppliers} value={supplier} onChange={setSupplier} />
      )}
      <View className="flex-row gap-3">
        <View className="flex-1">
          <TextField label="Quantity (kg)" keyboardType="decimal-pad" placeholder="e.g. 500" value={form.quantity} onChangeText={(v) => setForm({ ...form, quantity: v })} />
        </View>
        <View className="flex-1">
          <TextField label="Price per kg (৳)" keyboardType="decimal-pad" placeholder="e.g. 35" value={form.unitPrice} onChangeText={(v) => setForm({ ...form, unitPrice: v })} />
        </View>
      </View>
      {total > 0 ? <Text className="text-sm text-slate-600">Total: <Text className="font-bold text-ink">{tk(total)}</Text></Text> : null}

      <View>
        <FieldLabel label="How many days will it last?" />
        <View className="flex-row flex-wrap gap-2">
          <Pressable onPress={() => setForm({ ...form, coverDays: '' })} className={`rounded-control px-3.5 py-2.5 ${form.coverDays === '' ? 'bg-ink' : 'border border-line bg-white'}`}>
            <Text className={`text-sm font-semibold ${form.coverDays === '' ? 'text-white' : 'text-slate-600'}`}>Don&apos;t know</Text>
          </Pressable>
          {DAY_CHIPS.map((d) => {
            const active = days === d && !customDays;
            return (
              <Pressable key={d} onPress={() => setForm({ ...form, coverDays: String(d) })} className={`rounded-control px-3.5 py-2.5 ${active ? 'bg-ink' : 'border border-line bg-white'}`}>
                <Text className={`text-sm font-semibold ${active ? 'text-white' : 'text-slate-600'}`}>
                  {d} day{d === 1 ? '' : 's'}
                </Text>
              </Pressable>
            );
          })}
          <TextInput
            keyboardType="number-pad"
            placeholder="Other"
            placeholderTextColor={colors.slate400}
            value={customDays ? form.coverDays : ''}
            onChangeText={(v) => setForm({ ...form, coverDays: v.replace(/[^0-9]/g, '') })}
            className={`w-20 rounded-control border bg-white px-3 py-2 text-sm text-ink ${customDays ? 'border-ink' : 'border-line'}`}
            accessibilityLabel="Other number of days"
          />
        </View>
        {form.coverDays === '' && total > 0 ? (
          <Text className="mt-2 rounded-control bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
            The full {tk(total)} counts as feed cost on the day you bought it.
          </Text>
        ) : null}
        {days >= 1 && qty > 0 ? (
          <Text className="mt-2 rounded-control bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
            ≈ {round2(qty / days)} kg/day · {tk(round2(total / days))}/day · lasts until {fmtDate(lastDay)}
          </Text>
        ) : null}
      </View>

      <DateField label="Bought on" value={form.purchasedAt} onChange={(v) => setForm({ ...form, purchasedAt: v })} maxDate={new Date()} />
      {editing ? (
        <TextField label="Stock left now (kg)" keyboardType="decimal-pad" value={form.remainingQuantity} onChangeText={(v) => setForm({ ...form, remainingQuantity: v })} />
      ) : (
        <View className="gap-3 rounded-card border border-line bg-slate-50 p-3">
          <ChipGroup label="Payment" options={PAY_MODES} value={form.payMode} onChange={(v) => setForm({ ...form, payMode: v })} />
          {form.payMode === 'partial' ? (
            <TextField label="Paid now (৳)" keyboardType="decimal-pad" value={form.paidNow} onChangeText={(v) => setForm({ ...form, paidNow: v })} />
          ) : null}
          {form.payMode !== 'credit' ? (
            <ChipGroup label="Paid by" options={PAYMENT_METHODS} value={form.paymentMethod} onChange={(v) => setForm({ ...form, paymentMethod: v })} />
          ) : null}
          <Text className={`text-sm font-semibold ${owed > 0 ? 'text-red-600' : 'text-brand-700'}`}>
            {owed > 0 ? `${tk(owed)} will be added to what you owe${supplier ? ` ${supplier.name}` : ''}` : 'Fully paid — nothing owed'}
          </Text>
        </View>
      )}
    </FormModal>
  );
}
