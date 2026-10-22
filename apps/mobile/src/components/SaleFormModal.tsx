import { useEffect, useMemo, useState } from 'react';
import { View, Pressable } from 'react-native';
import { Milk, BadgeCheck, Package } from 'lucide-react-native';
import { Text } from '@/src/components/ui/Text';
import type { Cow, Sale } from '@farm/shared-types';
import { calculateSaleAmount } from '@farm/business-logic';
import { mobileApiClient } from '@/src/lib/apiClient';
import { generateIdempotencyKey } from '@/src/lib/idempotency';
import { PAYMENT_METHODS, tk, todayStr, toDay } from '@/src/lib/format';
import { FormModal, FormFooter, FormError, FieldLabel, TextField, ChipGroup, DateField, SelectField, useToast } from '@/src/components/ui';
import { PartyPickerField, type PartyChoice, type PickerParty } from '@/src/components/PartyPickerField';
import { colors } from '@/src/theme';

const PRODUCTS = [
  { value: 'milk', label: 'Milk', unit: 'L', Icon: Milk },
  { value: 'cow_sale', label: 'Cow', unit: 'head', Icon: BadgeCheck },
  { value: 'other', label: 'Other', unit: '', Icon: Package },
];

/** Paid part of an existing sale (derived for customer sales, hand-set status for older ones). */
const salePaid = (s: Sale) => (s.customerId ? s.paidAmount ?? 0 : s.status === 'paid' ? s.amount : 0);

/**
 * Record or edit a sale, like the web's SaleFormModal. Opens when `open` is
 * true. New milk sales start at the customer's last milk price, or the farm's
 * default price. "Paid now" follows the total until it is changed.
 */
export function SaleFormModal({
  open,
  sale,
  customers,
  activeCows,
  defaultMilkPrice,
  presetCustomer,
  onClose,
  onSaved,
}: {
  open: boolean;
  sale?: Sale | null;
  customers: PickerParty[];
  activeCows: Pick<Cow, 'id' | 'name' | 'tagNumber'>[];
  defaultMilkPrice: number;
  /** Opened from a customer's page: the customer is fixed. */
  presetCustomer?: PickerParty;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = !!sale;
  const toast = useToast();
  const [customer, setCustomer] = useState<PartyChoice>(null);
  const [newType, setNewType] = useState<'new' | 'regular'>('new');
  const [form, setForm] = useState({
    saleType: 'milk',
    quantity: '',
    unitPrice: '',
    amount: '',
    paidNow: '',
    paidTouched: false,
    paymentMethod: 'cash',
    saleDate: todayStr(),
    cowId: '',
    notes: '',
  });
  const [priceTouched, setPriceTouched] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [key, setKey] = useState(generateIdempotencyKey);

  const lastPriceOf = (choice: PartyChoice) => {
    if (choice?.kind !== 'existing') return null;
    const known = presetCustomer?.id === choice.id ? presetCustomer : customers.find((c) => c.id === choice.id);
    return known?.lastMilkPrice ?? null;
  };
  const suggestedPrice = (choice: PartyChoice) => String(lastPriceOf(choice) ?? defaultMilkPrice);

  // Reset each time the form opens.
  useEffect(() => {
    if (!open) return;
    const initial: PartyChoice = presetCustomer
      ? { kind: 'existing', id: presetCustomer.id, name: presetCustomer.name }
      : sale?.customer
        ? { kind: 'existing', id: sale.customer.id, name: sale.customer.name }
        : sale
          ? { kind: 'new', name: sale.customerName }
          : null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCustomer(initial);
    setNewType('new');
    setForm({
      saleType: sale ? (PRODUCTS.some((p) => p.value === sale.saleType) ? sale.saleType : 'other') : 'milk',
      quantity: sale?.quantity?.toString() ?? '',
      unitPrice: sale ? sale.unitPrice?.toString() ?? '' : suggestedPrice(initial),
      amount: sale ? String(sale.amount) : '',
      paidNow: '',
      paidTouched: false,
      paymentMethod: 'cash',
      saleDate: sale ? toDay(sale.createdAt) : todayStr(),
      cowId: sale?.cowId ?? '',
      notes: sale?.notes ?? '',
    });
    setPriceTouched(false);
    setError('');
    setKey(generateIdempotencyKey());
    // Only re-run when the form opens or switches sale; the rest is read fresh then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sale]);

  const prefilling = !editing && !priceTouched && form.saleType === 'milk';
  const auto = calculateSaleAmount(form.quantity, form.unitPrice);
  const total = auto ?? (parseFloat(form.amount) || 0);
  const paidNow = form.paidTouched ? parseFloat(form.paidNow) || 0 : total;
  const due = Math.max(0, total - paidNow);
  const unit = PRODUCTS.find((p) => p.value === form.saleType)?.unit ?? '';

  // Keep a cow already linked to this sale selectable even though it is now "sold".
  const cowOptions = useMemo(() => {
    const list = [...activeCows];
    if (sale?.cow && !list.some((c) => c.id === sale.cow!.id)) list.unshift(sale.cow);
    return [{ value: '', label: 'Not linked' }, ...list.map((c) => ({ value: c.id, label: `${c.name} (${c.tagNumber})` }))];
  }, [activeCows, sale]);

  function chooseCustomer(choice: PartyChoice) {
    setCustomer(choice);
    if (prefilling) setForm((f) => ({ ...f, unitPrice: suggestedPrice(choice) }));
  }

  function chooseProduct(saleType: string) {
    if (editing || priceTouched) return setForm((f) => ({ ...f, saleType }));
    // The milk price doesn't apply to a cow or other product.
    setForm((f) => ({ ...f, saleType, unitPrice: saleType === 'milk' ? suggestedPrice(customer) : '' }));
  }

  async function save() {
    setError('');
    if (!customer) return setError('Please choose or add a customer.');
    if (!(total > 0)) return setError('Enter the quantity and price, or the total amount.');
    if (!editing && paidNow > total) return setError('Paid now cannot be more than the total.');

    const payload = {
      ...(customer.kind === 'existing' ? { customerId: customer.id } : { customerName: customer.name, customerType: newType }),
      saleType: form.saleType,
      quantity: form.quantity || undefined,
      unitPrice: form.unitPrice || undefined,
      amount: total,
      saleDate: form.saleDate,
      cowId: form.saleType === 'cow_sale' ? form.cowId || undefined : undefined,
      notes: form.notes,
      ...(editing ? {} : { paidNow, paymentMethod: form.paymentMethod }),
    };
    setSaving(true);
    try {
      if (editing) await mobileApiClient.put(`/api/sales/${sale!.id}`, payload, 'Failed to save sale');
      else await mobileApiClient.post('/api/sales', payload, 'Failed to save sale', { idempotencyKey: key });
      toast(editing ? 'Sale updated' : 'Sale saved');
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
      title={editing ? 'Edit sale' : 'Record a sale'}
      subtitle={editing ? undefined : 'Milk, cow or any other product — paid in full, partly, or on credit.'}
      onClose={onClose}
      footer={<FormFooter onCancel={onClose} onSubmit={save} loading={saving} label={editing ? 'Save changes' : 'Save sale'} />}
    >
      <FormError message={error} />
      {presetCustomer ? (
        <View>
          <FieldLabel label="Customer" />
          <Text className="rounded-control border border-line bg-slate-50 px-3.5 py-2.5 text-sm font-semibold text-ink">{presetCustomer.name}</Text>
        </View>
      ) : (
        <View>
          <PartyPickerField label="Customer" noun="customer" parties={customers} value={customer} onChange={chooseCustomer} />
          {customer?.kind === 'new' && !editing ? (
            <View className="mt-2 flex-row items-center gap-2">
              <Text className="text-xs font-semibold text-slate-600">Customer type:</Text>
              {(['new', 'regular'] as const).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setNewType(t)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: newType === t }}
                  className={`rounded-lg px-3 py-1.5 ${newType === t ? 'bg-ink' : 'border border-line bg-white'}`}
                >
                  <Text className={`text-xs font-semibold capitalize ${newType === t ? 'text-white' : 'text-slate-600'}`}>{t}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      )}

      <View>
        <FieldLabel label="What was sold" />
        <View className="flex-row gap-2">
          {PRODUCTS.map(({ value, label, Icon }) => {
            const active = form.saleType === value;
            return (
              <Pressable
                key={value}
                onPress={() => chooseProduct(value)}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                className={`h-11 flex-1 flex-row items-center justify-center gap-2 rounded-control ${active ? 'bg-ink' : 'border border-line bg-white'}`}
              >
                <Icon size={16} color={active ? colors.white : colors.slate600} />
                <Text className={`text-sm font-semibold ${active ? 'text-white' : 'text-slate-600'}`}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {form.saleType === 'cow_sale' ? (
        <SelectField label="Which cow" placeholder="Not linked" value={form.cowId} options={cowOptions} onChange={(v) => setForm({ ...form, cowId: v })} />
      ) : null}

      <View className="flex-row gap-3">
        <View className="flex-1">
          <TextField
            label={`Quantity${unit ? ` (${unit})` : ''}`}
            keyboardType="decimal-pad"
            placeholder={form.saleType === 'milk' ? 'e.g. 10' : 'Optional'}
            value={form.quantity}
            onChangeText={(v) => setForm({ ...form, quantity: v })}
          />
        </View>
        <View className="flex-1">
          <TextField
            label={`Price per ${unit || 'unit'} (৳)`}
            keyboardType="decimal-pad"
            placeholder={form.saleType === 'milk' ? 'e.g. 90' : 'Optional'}
            value={form.unitPrice}
            onChangeText={(v) => {
              setPriceTouched(true);
              setForm({ ...form, unitPrice: v });
            }}
            hint={prefilling ? (lastPriceOf(customer) != null ? 'Last price for this customer' : 'Default price (Settings)') : undefined}
          />
        </View>
      </View>

      {auto !== null ? (
        <View>
          <FieldLabel label="Total (৳) = quantity × price" />
          <Text className="h-11 rounded-control border border-brand-200 bg-brand-50 px-3.5 py-2.5 text-base font-semibold text-ink">{auto.toFixed(2)}</Text>
        </View>
      ) : (
        <TextField label="Total (৳)" placeholder="e.g. 850" keyboardType="decimal-pad" value={form.amount} onChangeText={(v) => setForm({ ...form, amount: v })} />
      )}

      {!editing ? (
        <View className="gap-3 rounded-control border border-line bg-slate-50 p-4">
          <TextField
            label="Paid now (৳)"
            keyboardType="decimal-pad"
            value={form.paidTouched ? form.paidNow : total ? String(total) : ''}
            onChangeText={(v) => setForm({ ...form, paidNow: v, paidTouched: true })}
          />
          <View className="flex-row flex-wrap gap-2">
            <QuickButton label="Fully paid" onPress={() => setForm({ ...form, paidNow: '', paidTouched: false })} />
            <QuickButton label="On credit (baki)" onPress={() => setForm({ ...form, paidNow: '0', paidTouched: true })} />
          </View>
          {paidNow > 0 ? (
            <ChipGroup label="Paid by" options={PAYMENT_METHODS} value={form.paymentMethod} onChange={(v) => setForm({ ...form, paymentMethod: v })} />
          ) : null}
          <Text className={`text-sm font-semibold ${due > 0 ? 'text-red-600' : 'text-brand-700'}`}>
            {due > 0 ? `${tk(due)} will be added to this customer's due` : 'Fully paid'}
          </Text>
        </View>
      ) : (
        <Text className="rounded-control border border-line bg-slate-50 p-3 text-xs text-slate-600">
          Paid so far on this sale: <Text className="font-bold">{tk(salePaid(sale!))}</Text>. To change payments, open the customer&apos;s page.
        </Text>
      )}

      <DateField label="Date" value={form.saleDate} onChange={(v) => setForm({ ...form, saleDate: v })} maxDate={new Date()} />
      <TextField label="Note" placeholder="Optional" value={form.notes} onChangeText={(v) => setForm({ ...form, notes: v })} />
    </FormModal>
  );
}

function QuickButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" className="rounded-lg border border-line bg-white px-3 py-2">
      <Text className="text-xs font-semibold text-slate-600">{label}</Text>
    </Pressable>
  );
}
