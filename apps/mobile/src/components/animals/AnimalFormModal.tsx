import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/src/components/ui/Text';
import type { AnimalDetail, Cow } from '@farm/shared-types';
import { ageLabel } from '@farm/business-logic';
import { isQueued } from '@farm/api-client';
import { mobileApiClient } from '@/src/lib/apiClient';
import { generateIdempotencyKey } from '@/src/lib/idempotency';
import { toDay, todayStr } from '@/src/lib/format';
import { FormModal, TextField, ChipGroup, SelectField, DateField, PrimaryButton } from '@/src/components/ui';
import { CATEGORIES, PhotoPicker, STATUSES, photoBody, type PickedPhoto } from './shared';

export type MotherOption = Pick<Cow, 'id' | 'tagNumber' | 'name'>;

const GENDERS = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
];

const SOURCES = [
  { value: 'born', label: 'Born on farm' },
  { value: 'purchased', label: 'Bought' },
];

const day = (d: Date | string | null | undefined) => (d ? toDay(d) : '');

function initialForm(animal: Cow | null | undefined, suggestedId: string) {
  return {
    tagNumber: animal?.tagNumber ?? suggestedId,
    name: animal && animal.name !== animal.tagNumber ? animal.name : '',
    gender: (animal?.gender ?? 'female') as string,
    category: (animal?.category ?? '') as string,
    breed: animal?.breed ?? '',
    color: animal?.color ?? '',
    birthDate: day(animal?.birthDate),
    source: (animal?.source ?? '') as string,
    purchaseDate: day(animal?.purchaseDate),
    purchasePrice: animal?.purchasePrice != null ? String(animal.purchasePrice) : '',
    motherId: animal?.motherId ?? '',
    // "sick" from the old form is now a treatment record, not a status.
    status: STATUSES.some((x) => x.value === animal?.status) ? animal!.status : 'active',
    notes: animal?.notes ?? '',
  };
}

/** Add an animal (photo required) or edit its details, like the web app's AnimalFormModal. */
export function AnimalFormModal({
  visible,
  animal,
  suggestedId = '',
  mothers,
  onClose,
  onSaved,
}: {
  visible: boolean;
  animal?: Cow | null;
  /** Next free Cow ID (C-001...), prefilled when adding. */
  suggestedId?: string;
  /** Female animals that can be picked as the mother. */
  mothers: MotherOption[];
  onClose: () => void;
  onSaved: (saved: AnimalDetail) => void;
}) {
  const editing = !!animal;
  const [form, setForm] = useState(() => initialForm(animal, suggestedId));
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [createKey, setCreateKey] = useState(generateIdempotencyKey);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  // Fresh form each time the sheet opens (the modal stays mounted between uses).
  useEffect(() => {
    if (!visible) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(initialForm(animal, suggestedId));
    setPhoto(null);
    setError('');
    setCreateKey(generateIdempotencyKey());
  }, [visible, animal, suggestedId]);

  async function handleSubmit() {
    setError('');
    if (!editing && !photo) {
      setError('Please add a photo of the animal');
      return;
    }
    if (!form.tagNumber.trim()) {
      setError('Please enter a Cow ID');
      return;
    }
    setSaving(true);
    try {
      const body = {
        ...form,
        motherId: form.source === 'purchased' ? '' : form.motherId,
        ...(photo ? { photo: photoBody(photo) } : {}),
      };
      const saved = editing
        ? await mobileApiClient.put<AnimalDetail>(`/api/cows/${animal!.id}`, body, 'Failed to save animal')
        : await mobileApiClient.post<AnimalDetail>('/api/cows', body, 'Failed to save animal', { idempotencyKey: createKey });
      // Saved offline: there is no animal page yet, so just close (it uploads later).
      if (isQueued(saved)) onClose();
      else onSaved(saved);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const age = form.birthDate && form.birthDate <= todayStr() ? ageLabel(form.birthDate + 'T12:00:00Z') : null;
  const motherOptions = [
    { value: '', label: 'Not known / not on this farm' },
    ...mothers
      .filter((m) => m.id !== animal?.id)
      .map((m) => ({ value: m.id, label: `${m.tagNumber}${m.name !== m.tagNumber ? ` · ${m.name}` : ''}` })),
  ];

  return (
    <FormModal
      visible={visible}
      title={editing ? `Edit ${animal!.tagNumber}` : 'Add animal'}
      subtitle={editing ? undefined : 'Fields with * are required'}
      onClose={onClose}
    >
      {error ? (
        <View className="rounded-xl border border-red-100 bg-red-50 p-3">
          <Text className="text-xs font-medium text-red-700">{error}</Text>
        </View>
      ) : null}
      {!editing ? (
        <PhotoPicker
          value={photo}
          onChange={(p) => {
            setPhoto(p);
            setError('');
          }}
          required
        />
      ) : null}
      <TextField label="Cow ID *" maxLength={30} autoCapitalize="characters" value={form.tagNumber} onChangeText={(v) => set({ tagNumber: v })} />
      <TextField label="Name" placeholder="e.g. Lali" maxLength={100} value={form.name} onChangeText={(v) => set({ name: v })} />
      <ChipGroup label="Gender" options={GENDERS} value={form.gender} onChange={(v) => set({ gender: v })} />
      <ChipGroup label="Type" options={CATEGORIES} value={form.category} onChange={(v) => set({ category: v })} />
      <TextField label="Breed" placeholder="e.g. Shahiwal, Friesian cross" value={form.breed} onChangeText={(v) => set({ breed: v })} />
      <TextField label="Colour" placeholder="e.g. Red, black & white" value={form.color} onChangeText={(v) => set({ color: v })} />
      <View>
        <DateField label="Birth date" value={form.birthDate} maxDate={new Date()} onChange={(v) => set({ birthDate: v })} />
        {age ? <Text className="mt-1 text-xs font-semibold text-slate-600">Age {age}</Text> : null}
      </View>
      <ChipGroup label="Where from" options={SOURCES} value={form.source} onChange={(v) => set({ source: v })} />
      {form.source === 'purchased' ? (
        <>
          <DateField label="Bought on" value={form.purchaseDate} maxDate={new Date()} onChange={(v) => set({ purchaseDate: v })} />
          <TextField label="Price (৳)" placeholder="e.g. 85000" keyboardType="decimal-pad" value={form.purchasePrice} onChangeText={(v) => set({ purchasePrice: v })} />
        </>
      ) : (
        <SelectField label="Mother" placeholder="Not known / not on this farm" value={form.motherId} options={motherOptions} onChange={(v) => set({ motherId: v })} />
      )}
      {editing ? <ChipGroup label="Status" options={STATUSES} value={form.status} onChange={(v) => set({ status: v })} /> : null}
      <TextField label="Notes" placeholder="Anything worth remembering" multiline value={form.notes} onChangeText={(v) => set({ notes: v })} />
      <PrimaryButton label={editing ? 'Save changes' : 'Add animal'} loading={saving} onPress={handleSubmit} />
    </FormModal>
  );
}
