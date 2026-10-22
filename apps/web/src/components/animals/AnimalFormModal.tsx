"use client";

import { useState } from 'react';
import type { AnimalDetail, Cow } from '@farm/shared-types';
import { ageLabel } from '@farm/business-logic';
import { webApiClient } from '@farm/api-client';
import Modal, { FormError, FormFooter } from '@/components/sales/Modal';
import { inputCls, labelCls, toDay, todayStr } from '@/components/sales/shared';
import { CATEGORIES, ChoiceChips, PhotoPicker, STATUSES, type PickedPhoto } from './shared';

export type MotherOption = Pick<Cow, 'id' | 'tagNumber' | 'name'>;

const GENDERS = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
] as const;

const SOURCES = [
  { value: 'born', label: 'Born on farm' },
  { value: 'purchased', label: 'Bought' },
] as const;

const day = (d: Date | string | null | undefined) => (d ? toDay(d) : '');

/** Add an animal (photo required) or edit its details. Photos of an existing animal are managed on its page. */
export default function AnimalFormModal({
  animal,
  suggestedId,
  mothers,
  onClose,
  onSaved,
}: {
  animal?: Cow | null;
  /** Next free Cow ID (C-001...), prefilled when adding. */
  suggestedId?: string;
  /** Female animals that can be picked as the mother. */
  mothers: MotherOption[];
  onClose: () => void;
  onSaved: (saved: AnimalDetail) => void;
}) {
  const editing = !!animal;
  const [form, setForm] = useState({
    tagNumber: animal?.tagNumber ?? suggestedId ?? '',
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
  });
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!editing && !photo) {
      setError('Please add a photo of the animal');
      return;
    }
    setLoading(true);
    try {
      const body = {
        ...form,
        motherId: form.source === 'purchased' ? '' : form.motherId,
        ...(photo ? { photo: { data: photo.data, mimeType: photo.mimeType, width: photo.width, height: photo.height } } : {}),
      };
      const saved = editing
        ? await webApiClient.put<AnimalDetail>(`/api/cows/${animal!.id}`, body, 'Failed to save animal')
        : await webApiClient.post<AnimalDetail>('/api/cows', body, 'Failed to save animal');
      onSaved(saved);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const age = form.birthDate && form.birthDate <= todayStr() ? ageLabel(form.birthDate + 'T12:00:00Z') : null;
  const motherChoices = mothers.filter((m) => m.id !== animal?.id);

  return (
    <Modal title={editing ? `Edit ${animal!.tagNumber}` : 'Add animal'} subtitle={editing ? undefined : 'Fields with * are required'} onClose={onClose}>
      <FormError message={error} />
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        {!editing && (
          <PhotoPicker
            id="animal-photo"
            value={photo}
            onChange={(p) => {
              setPhoto(p);
              setError('');
            }}
            required
          />
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="animal-tag" className={labelCls}>Cow ID <span className="text-red-600">*</span></label>
            <input
              id="animal-tag"
              required
              maxLength={30}
              value={form.tagNumber}
              onChange={(e) => set({ tagNumber: e.target.value })}
              className={`${inputCls} font-mono`}
            />
          </div>
          <div>
            <label htmlFor="animal-name" className={labelCls}>Name</label>
            <input
              id="animal-name"
              placeholder="e.g. Lali"
              maxLength={100}
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              className={inputCls}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <span className={labelCls}>Gender</span>
            <ChoiceChips label="Gender" options={GENDERS} value={form.gender as 'female' | 'male'} onChange={(v) => set({ gender: v })} />
          </div>
          <div>
            <span className={labelCls}>Type</span>
            <ChoiceChips label="Type" options={CATEGORIES} value={form.category as (typeof CATEGORIES)[number]['value']} onChange={(v) => set({ category: v })} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="animal-breed" className={labelCls}>Breed</label>
            <input id="animal-breed" placeholder="e.g. Shahiwal, Friesian cross" value={form.breed} onChange={(e) => set({ breed: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label htmlFor="animal-color" className={labelCls}>Colour</label>
            <input id="animal-color" placeholder="e.g. Red, black & white" value={form.color} onChange={(e) => set({ color: e.target.value })} className={inputCls} />
          </div>
        </div>

        <div>
          <label htmlFor="animal-birth" className={labelCls}>Birth date</label>
          <div className="flex items-center gap-3">
            <input id="animal-birth" type="date" max={todayStr()} value={form.birthDate} onChange={(e) => set({ birthDate: e.target.value })} className={inputCls} />
            {age && <span className="shrink-0 text-sm font-semibold text-slate-600">Age {age}</span>}
          </div>
        </div>

        <div>
          <span className={labelCls}>Where from</span>
          <ChoiceChips label="Where from" options={SOURCES} value={form.source as 'born' | 'purchased'} onChange={(v) => set({ source: v })} />
        </div>

        {form.source === 'purchased' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="animal-pdate" className={labelCls}>Bought on</label>
              <input id="animal-pdate" type="date" max={todayStr()} value={form.purchaseDate} onChange={(e) => set({ purchaseDate: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label htmlFor="animal-price" className={labelCls}>Price (৳)</label>
              <input id="animal-price" type="number" min="0" step="any" inputMode="decimal" placeholder="e.g. 85000" value={form.purchasePrice} onChange={(e) => set({ purchasePrice: e.target.value })} className={inputCls} />
            </div>
          </div>
        )}

        {form.source !== 'purchased' && (
          <div>
            <label htmlFor="animal-mother" className={labelCls}>Mother</label>
            <select id="animal-mother" value={form.motherId} onChange={(e) => set({ motherId: e.target.value })} className={inputCls}>
              <option value="">Not known / not on this farm</option>
              {motherChoices.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.tagNumber}{m.name !== m.tagNumber ? ` · ${m.name}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {editing && (
          <div>
            <span className={labelCls}>Status</span>
            <ChoiceChips label="Status" options={STATUSES} value={form.status as (typeof STATUSES)[number]['value']} onChange={(v) => set({ status: v })} />
          </div>
        )}

        <div>
          <label htmlFor="animal-notes" className={labelCls}>Notes</label>
          <textarea id="animal-notes" rows={2} placeholder="Anything worth remembering" value={form.notes} onChange={(e) => set({ notes: e.target.value })} className={inputCls} />
        </div>

        <FormFooter onCancel={onClose} loading={loading} label={editing ? 'Save changes' : 'Add animal'} />
      </form>
    </Modal>
  );
}
