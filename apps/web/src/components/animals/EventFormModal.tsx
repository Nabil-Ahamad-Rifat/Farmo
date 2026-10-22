"use client";

import { useState } from 'react';
import type { AnimalEvent } from '@farm/shared-types';
import { addDaysIso, expectedCalving } from '@farm/business-logic';
import { webApiClient } from '@farm/api-client';
import Modal, { FormError, FormFooter } from '@/components/sales/Modal';
import { fmtDate, inputCls, labelCls, toDay, todayStr } from '@/components/sales/shared';
import { ChoiceChips, EVENT_TYPES, PhotoPicker, eventTypeInfo, type PickedPhoto } from './shared';

const NEXT_DOSE = [
  { days: 30, label: '1 month' },
  { days: 90, label: '3 months' },
  { days: 180, label: '6 months' },
  { days: 365, label: '1 year' },
];

const RESULTS = [
  { value: 'positive', label: 'Pregnant' },
  { value: 'negative', label: 'Not pregnant' },
] as const;

const GENDERS = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
] as const;

/** Add or edit one history record. A new calving can add the calf as its own animal. */
export default function EventFormModal({
  cowId,
  isFemale,
  event,
  initialType = 'vaccine',
  suggestedCalfId,
  onClose,
  onSaved,
}: {
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
  const [form, setForm] = useState({
    type: event?.type ?? initialType,
    date: event ? toDay(event.date) : todayStr(),
    title: event?.title ?? '',
    nextDueDate: event?.nextDueDate ? toDay(event.nextDueDate) : '',
    result: event?.result ?? '',
    value: event?.value != null ? String(event.value) : '',
    cost: event?.cost != null ? String(event.cost) : '',
    notes: event?.notes ?? '',
  });
  const [addCalf, setAddCalf] = useState(false);
  const [calf, setCalf] = useState({ tagNumber: suggestedCalfId, name: '', gender: 'female' as 'female' | 'male' });
  const [calfPhoto, setCalfPhoto] = useState<PickedPhoto | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const info = eventTypeInfo(form.type);
  const types = EVENT_TYPES.filter((t) => isFemale || !t.breeding || t.value === form.type);
  const hasDose = form.type === 'vaccine' || form.type === 'deworming';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (addCalf && !calfPhoto) {
      setError('Please add a photo of the calf');
      return;
    }
    setLoading(true);
    try {
      const body = {
        ...form,
        ...(addCalf && calfPhoto
          ? { createCalf: { ...calf, photo: { data: calfPhoto.data, mimeType: calfPhoto.mimeType, width: calfPhoto.width, height: calfPhoto.height } } }
          : {}),
      };
      if (editing) await webApiClient.put(`/api/animal-events/${event!.id}`, body, 'Failed to save record');
      else await webApiClient.post(`/api/cows/${cowId}/events`, body, 'Failed to save record');
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title={editing ? `Edit ${info.label.toLowerCase()} record` : 'Add record'} onClose={onClose}>
      <FormError message={error} />
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <span className={labelCls}>Record type</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Record type">
            {types.map((t) => (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={form.type === t.value}
                onClick={() => set({ type: t.value })}
                className={`flex flex-col items-center gap-1 rounded-control border px-2 py-2.5 text-xs font-semibold transition ${
                  form.type === t.value ? 'border-slate-900 bg-ink text-white' : 'border-line bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <t.Icon className="h-4 w-4" aria-hidden="true" />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="ev-date" className={labelCls}>Date</label>
          <input id="ev-date" type="date" required max={todayStr()} value={form.date} onChange={(e) => set({ date: e.target.value })} className={inputCls} />
        </div>

        {info.titleLabel && (
          <div>
            <label htmlFor="ev-title" className={labelCls}>
              {info.titleLabel} {form.type === 'vaccine' && <span className="text-red-600">*</span>}
            </label>
            <input
              id="ev-title"
              required={form.type === 'vaccine'}
              maxLength={150}
              placeholder={info.titlePlaceholder}
              value={form.title}
              onChange={(e) => set({ title: e.target.value })}
              className={inputCls}
            />
          </div>
        )}

        {hasDose && (
          <div>
            <label htmlFor="ev-next" className={labelCls}>Next dose due</label>
            <div className="mb-2 flex flex-wrap gap-2">
              {NEXT_DOSE.map((n) => {
                const d = form.date ? addDaysIso(form.date + 'T12:00:00Z', n.days) : '';
                return (
                  <button
                    key={n.days}
                    type="button"
                    onClick={() => set({ nextDueDate: d })}
                    className={`rounded-control border px-3 py-1.5 text-xs font-semibold transition ${
                      form.nextDueDate === d ? 'border-slate-900 bg-ink text-white' : 'border-line bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {n.label}
                  </button>
                );
              })}
            </div>
            <input id="ev-next" type="date" min={form.date} value={form.nextDueDate} onChange={(e) => set({ nextDueDate: e.target.value })} className={inputCls} />
            <p className="mt-1 text-xs text-slate-500">You will be reminded on the dashboard a week before.</p>
          </div>
        )}

        {form.type === 'insemination' && form.date && (
          <p className="rounded-control border border-violet-100 bg-violet-50 px-3.5 py-2.5 text-sm text-violet-800">
            If she is pregnant, calving is expected around <strong>{fmtDate(expectedCalving(form.date + 'T12:00:00Z'))}</strong>. Check pregnancy after about 60 days.
          </p>
        )}

        {form.type === 'pregnancy_check' && (
          <div>
            <span className={labelCls}>Result <span className="text-red-600">*</span></span>
            <ChoiceChips label="Result" options={RESULTS} value={form.result as 'positive' | 'negative'} onChange={(v) => set({ result: v })} />
          </div>
        )}

        {form.type === 'weight' && (
          <div>
            <label htmlFor="ev-weight" className={labelCls}>Weight (kg) <span className="text-red-600">*</span></label>
            <input id="ev-weight" type="number" required min="0" step="any" inputMode="decimal" placeholder="e.g. 320" value={form.value} onChange={(e) => set({ value: e.target.value })} className={inputCls} />
          </div>
        )}

        {form.type === 'calving' && !editing && (
          <div className="space-y-3 rounded-control border border-brand-100 bg-brand-50/50 p-3.5">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <input type="checkbox" checked={addCalf} onChange={(e) => setAddCalf(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
              Add the calf as a new animal
            </label>
            {addCalf && (
              <>
                <PhotoPicker id="calf-photo" label="Calf photo" value={calfPhoto} onChange={setCalfPhoto} required />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="calf-tag" className={labelCls}>Calf ID <span className="text-red-600">*</span></label>
                    <input id="calf-tag" required maxLength={30} value={calf.tagNumber} onChange={(e) => setCalf({ ...calf, tagNumber: e.target.value })} className={`${inputCls} font-mono`} />
                  </div>
                  <div>
                    <label htmlFor="calf-name" className={labelCls}>Name</label>
                    <input id="calf-name" maxLength={100} placeholder="Optional" value={calf.name} onChange={(e) => setCalf({ ...calf, name: e.target.value })} className={inputCls} />
                  </div>
                </div>
                <div>
                  <span className={labelCls}>Calf gender</span>
                  <ChoiceChips label="Calf gender" options={GENDERS} value={calf.gender} onChange={(v) => setCalf({ ...calf, gender: v })} />
                </div>
              </>
            )}
          </div>
        )}

        <div>
          <label htmlFor="ev-cost" className={labelCls}>Cost (৳)</label>
          <input id="ev-cost" type="number" min="0" step="any" inputMode="decimal" placeholder="Vet, medicine, semen… (optional)" value={form.cost} onChange={(e) => set({ cost: e.target.value })} className={inputCls} />
        </div>

        <div>
          <label htmlFor="ev-notes" className={labelCls}>Notes</label>
          <textarea id="ev-notes" rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} className={inputCls} />
        </div>

        <FormFooter onCancel={onClose} loading={loading} label={editing ? 'Save changes' : 'Add record'} />
      </form>
    </Modal>
  );
}
