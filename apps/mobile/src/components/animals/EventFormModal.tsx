import { useEffect, useState } from 'react';
import { View, Pressable, Switch } from 'react-native';
import { Text } from '@/src/components/ui/Text';
import type { AnimalEvent } from '@farm/shared-types';
import { addDaysIso, expectedCalving } from '@farm/business-logic';
import { mobileApiClient } from '@/src/lib/apiClient';
import { generateIdempotencyKey } from '@/src/lib/idempotency';
import { fmtDate, toDay, todayStr } from '@/src/lib/format';
import { FormModal, TextField, ChipGroup, DateField, PrimaryButton } from '@/src/components/ui';
import { EVENT_TYPES, PhotoPicker, eventTypeInfo, photoBody, type PickedPhoto } from './shared';

const NEXT_DOSE = [
  { days: 30, label: '1 month' },
  { days: 90, label: '3 months' },
  { days: 180, label: '6 months' },
  { days: 365, label: '1 year' },
];

const RESULTS = [
  { value: 'positive', label: 'Pregnant' },
  { value: 'negative', label: 'Not pregnant' },
];

const GENDERS = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
];

function initialForm(event: AnimalEvent | null | undefined, initialType: string) {
  return {
    type: event?.type ?? initialType,
    date: event ? toDay(event.date) : todayStr(),
    title: event?.title ?? '',
    nextDueDate: event?.nextDueDate ? toDay(event.nextDueDate) : '',
    result: event?.result ?? '',
    value: event?.value != null ? String(event.value) : '',
    cost: event?.cost != null ? String(event.cost) : '',
    notes: event?.notes ?? '',
  };
}

/** Add or edit one history record. A new calving can add the calf as its own animal. */
export function EventFormModal({
  visible,
  cowId,
  isFemale,
  event,
  initialType = 'vaccine',
  suggestedCalfId,
  onClose,
  onSaved,
}: {
  visible: boolean;
  cowId: string;
  /** Breeding records (AI, pregnancy check, calving) are offered only for females. */
  isFemale: boolean;
  event?: AnimalEvent | null;
  initialType?: string;
  suggestedCalfId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = !!event;
  const [form, setForm] = useState(() => initialForm(event, initialType));
  const [addCalf, setAddCalf] = useState(false);
  const [calf, setCalf] = useState({ tagNumber: suggestedCalfId, name: '', gender: 'female' });
  const [calfPhoto, setCalfPhoto] = useState<PickedPhoto | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [createKey, setCreateKey] = useState(generateIdempotencyKey);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    if (!visible) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(initialForm(event, initialType));
    setAddCalf(false);
    setCalf({ tagNumber: suggestedCalfId, name: '', gender: 'female' });
    setCalfPhoto(null);
    setError('');
    setCreateKey(generateIdempotencyKey());
  }, [visible, event, initialType, suggestedCalfId]);

  const info = eventTypeInfo(form.type);
  const types = EVENT_TYPES.filter((t) => isFemale || !t.breeding || t.value === form.type);
  const hasDose = form.type === 'vaccine' || form.type === 'deworming';

  async function handleSubmit() {
    setError('');
    if (form.type === 'vaccine' && !form.title.trim()) return setError('Please enter the vaccine name');
    if (form.type === 'pregnancy_check' && !form.result) return setError('Please pick the result');
    if (form.type === 'weight' && !form.value) return setError('Please enter the weight');
    if (addCalf && !calfPhoto) return setError('Please add a photo of the calf');
    setSaving(true);
    try {
      const body = {
        ...form,
        ...(addCalf && calfPhoto ? { createCalf: { ...calf, photo: photoBody(calfPhoto) } } : {}),
      };
      if (editing) await mobileApiClient.put(`/api/animal-events/${event!.id}`, body, 'Failed to save record');
      else await mobileApiClient.post(`/api/cows/${cowId}/events`, body, 'Failed to save record', { idempotencyKey: createKey });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormModal visible={visible} title={editing ? `Edit ${info.label.toLowerCase()} record` : 'Add record'} onClose={onClose}>
      {error ? (
        <View className="rounded-xl border border-red-100 bg-red-50 p-3">
          <Text className="text-xs font-medium text-red-700">{error}</Text>
        </View>
      ) : null}
      <View>
        <Text className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-600">Record type</Text>
        <View className="flex-row flex-wrap gap-2">
          {types.map((t) => {
            const active = form.type === t.value;
            return (
              <Pressable
                key={t.value}
                onPress={() => set({ type: t.value })}
                className={`w-[23%] min-w-[72px] flex-grow items-center gap-1 rounded-xl px-2 py-2.5 ${active ? 'bg-slate-900' : 'border border-slate-200 bg-white'}`}
              >
                <t.Icon size={16} color={active ? 'white' : t.color} />
                <Text className={`text-center text-[11px] font-semibold ${active ? 'text-white' : 'text-slate-600'}`}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <DateField label="Date" value={form.date} maxDate={new Date()} onChange={(v) => set({ date: v })} />
      {info.titleLabel ? (
        <TextField
          label={`${info.titleLabel}${form.type === 'vaccine' ? ' *' : ''}`}
          maxLength={150}
          placeholder={info.titlePlaceholder}
          value={form.title}
          onChangeText={(v) => set({ title: v })}
        />
      ) : null}
      {hasDose ? (
        <View>
          <ChipGroup
            label="Next dose due"
            options={NEXT_DOSE.map((n) => ({ value: form.date ? addDaysIso(form.date + 'T12:00:00Z', n.days) : String(n.days), label: n.label }))}
            value={form.nextDueDate}
            onChange={(v) => set({ nextDueDate: v })}
          />
          <View className="mt-2">
            <DateField label="Or pick a day" value={form.nextDueDate} onChange={(v) => set({ nextDueDate: v })} />
          </View>
          <Text className="mt-1 text-[11px] text-slate-500">You will be reminded on the Overview a week before.</Text>
        </View>
      ) : null}
      {form.type === 'insemination' && form.date ? (
        <View className="rounded-xl border border-violet-100 bg-violet-50 p-3">
          <Text className="text-xs text-violet-800">
            If she is pregnant, calving is expected around{' '}
            <Text className="font-bold">{fmtDate(expectedCalving(form.date + 'T12:00:00Z'))}</Text>. Check pregnancy after about 60 days.
          </Text>
        </View>
      ) : null}
      {form.type === 'pregnancy_check' ? (
        <ChipGroup label="Result *" options={RESULTS} value={form.result} onChange={(v) => set({ result: v })} />
      ) : null}
      {form.type === 'weight' ? (
        <TextField label="Weight (kg) *" placeholder="e.g. 320" keyboardType="decimal-pad" value={form.value} onChangeText={(v) => set({ value: v })} />
      ) : null}
      {form.type === 'calving' && !editing ? (
        <View className="gap-3 rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-semibold text-slate-800">Add the calf as a new animal</Text>
            <Switch value={addCalf} onValueChange={setAddCalf} />
          </View>
          {addCalf ? (
            <>
              <PhotoPicker label="Calf photo" value={calfPhoto} onChange={setCalfPhoto} required />
              <TextField label="Calf ID *" maxLength={30} value={calf.tagNumber} onChangeText={(v) => setCalf({ ...calf, tagNumber: v })} />
              <TextField label="Name" maxLength={100} placeholder="Optional" value={calf.name} onChangeText={(v) => setCalf({ ...calf, name: v })} />
              <ChipGroup label="Calf gender" options={GENDERS} value={calf.gender} onChange={(v) => setCalf({ ...calf, gender: v })} />
            </>
          ) : null}
        </View>
      ) : null}
      <TextField label="Cost (৳)" placeholder="Vet, medicine, semen… (optional)" keyboardType="decimal-pad" value={form.cost} onChangeText={(v) => set({ cost: v })} />
      <TextField label="Notes" multiline value={form.notes} onChangeText={(v) => set({ notes: v })} />
      <PrimaryButton label={editing ? 'Save changes' : 'Add record'} loading={saving} onPress={handleSubmit} />
    </FormModal>
  );
}
