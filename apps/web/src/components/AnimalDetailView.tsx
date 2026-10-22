"use client";

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Edit3, Trash2, Plus, ImagePlus, Star, Baby, CalendarClock, Syringe, Wallet, HeartPulse, StickyNote } from 'lucide-react';
import type { AnimalDetail, AnimalEvent } from '@farm/shared-types';
import { ageLabel } from '@farm/business-logic';
import { webApiClient } from '@farm/api-client';
import AnimalFormModal, { type MotherOption } from '@/components/animals/AnimalFormModal';
import EventFormModal from '@/components/animals/EventFormModal';
import {
  AnimalPhoto, PregnancyBadge, StatusBadge, categoryLabel, daysUntil, dueText, dueTone, eventTypeInfo, resizePhoto,
} from '@/components/animals/shared';
import { fmtDate, tk } from '@/components/sales/shared';
import { useConfirm, useToast } from '@/components/ui/Feedback';

type ModalState = { kind: 'edit' } | { kind: 'event'; event: AnimalEvent | null; type?: string } | null;

const PREGNANCY_TEXT: Record<string, string> = {
  pregnant: 'Pregnant',
  inseminated: 'AI done, not checked yet',
  open: 'Not pregnant',
  unknown: 'No breeding records',
};

/** One line describing a history record, e.g. "Result: pregnant" or "320 kg". */
function eventDetail(e: AnimalEvent) {
  const parts: string[] = [];
  if (e.type === 'weight' && e.value != null) parts.push(`${e.value.toLocaleString()} kg`);
  if (e.type === 'pregnancy_check' && e.result) parts.push(e.result === 'positive' ? 'Result: pregnant' : 'Result: not pregnant');
  if (e.title) parts.push(e.title);
  return parts.join(' · ');
}

export default function AnimalDetailView({
  animal,
  mothers,
  suggestedId,
}: {
  animal: AnimalDetail;
  mothers: MotherOption[];
  suggestedId: string;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [modal, setModal] = useState<ModalState>(null);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const done = () => {
    setModal(null);
    router.refresh();
  };

  const isFemale = animal.gender !== 'male';
  const s = animal.summary;
  const selected = animal.photos.find((p) => p.id === selectedPhotoId) ?? animal.photos[0] ?? null;
  const nextDose = s.dueDoses[0] ?? null;

  async function addPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoError('');
    setPhotoBusy(true);
    try {
      const p = await resizePhoto(file);
      const saved = await webApiClient.post<{ id: string }>(
        `/api/cows/${animal.id}/photos`,
        { data: p.data, mimeType: p.mimeType, width: p.width, height: p.height },
        'Failed to save photo',
      );
      setSelectedPhotoId(saved.id);
      router.refresh();
    } catch (err) {
      setPhotoError((err as Error).message);
    } finally {
      setPhotoBusy(false);
    }
  }

  async function setMain(photoId: string) {
    setPhotoError('');
    try {
      await webApiClient.put(`/api/cows/${animal.id}/photos/${photoId}/main`, undefined, 'Failed to set main photo');
      router.refresh();
    } catch (err) {
      setPhotoError((err as Error).message);
    }
  }

  async function deletePhoto(photoId: string) {
    if (!(await confirm({ title: 'Delete this photo?', tone: 'danger' }))) return;
    setPhotoError('');
    try {
      await webApiClient.delete(`/api/cows/${animal.id}/photos/${photoId}`, 'Failed to delete photo');
      setSelectedPhotoId(null);
      router.refresh();
    } catch (err) {
      setPhotoError((err as Error).message);
    }
  }

  async function deleteEvent(e: AnimalEvent) {
    const label = eventTypeInfo(e.type).label.toLowerCase();
    if (!(await confirm({ title: `Delete the ${label} record from ${fmtDate(e.date)}?${e.calfId ? ' The calf stays as its own animal.' : ''}`, tone: 'danger' }))) return;
    try {
      await webApiClient.delete(`/api/animal-events/${e.id}`, 'Failed to delete record');
      router.refresh();
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  }

  async function deleteAnimal() {
    if (!(await confirm({ title: `Delete ${animal.tagNumber} (${animal.name}) with all its photos and records? This cannot be undone.`, tone: 'danger' }))) return;
    try {
      await webApiClient.delete(`/api/cows/${animal.id}`, 'Failed to delete animal');
      router.push('/dashboard/cows');
      router.refresh();
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  }

  const facts: [string, React.ReactNode][] = [
    ['Gender', animal.gender === 'male' ? 'Male' : animal.gender === 'female' ? 'Female' : null],
    ['Type', categoryLabel(animal.category)],
    ['Breed', animal.breed],
    ['Colour', animal.color],
    ['Born', animal.birthDate ? `${fmtDate(animal.birthDate)} (${ageLabel(animal.birthDate)})` : null],
    [
      'From',
      animal.source === 'born'
        ? 'Born on farm'
        : animal.source === 'purchased'
          ? ['Bought', animal.purchaseDate ? fmtDate(animal.purchaseDate) : null, animal.purchasePrice != null ? `for ${tk(animal.purchasePrice)}` : null].filter(Boolean).join(' ')
          : null,
    ],
    [
      'Mother',
      animal.mother ? (
        <Link href={`/dashboard/cows/${animal.mother.id}`} className="font-semibold text-brand-700 hover:underline">
          {animal.mother.tagNumber}{animal.mother.name !== animal.mother.tagNumber ? ` · ${animal.mother.name}` : ''}
        </Link>
      ) : null,
    ],
    ['Latest weight', s.latestWeight ? `${s.latestWeight.value.toLocaleString()} kg (${fmtDate(s.latestWeight.date)})` : null],
  ];

  return (
    <div className="space-y-6">
      <Link href="/dashboard/cows" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> All animals
      </Link>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* Photos */}
        <div className="space-y-3 rounded-card border border-line bg-white p-4 shadow-sm">
          <AnimalPhoto src={selected?.url} alt={`${animal.tagNumber} ${animal.name}`} className="aspect-[4/3] w-full rounded-control" />
          <div className="flex flex-wrap items-center gap-2">
            {animal.photos.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedPhotoId(p.id)}
                aria-label="Show photo"
                aria-pressed={selected?.id === p.id}
                className={`relative h-16 w-16 overflow-hidden rounded-lg border-2 ${selected?.id === p.id ? 'border-slate-900' : 'border-transparent'}`}
              >
                <AnimalPhoto src={p.url} alt="" className="h-full w-full" />
                {p.id === animal.mainPhotoId && (
                  <Star className="absolute right-0.5 top-0.5 h-3.5 w-3.5 fill-amber-400 text-amber-500" aria-label="Main photo" />
                )}
              </button>
            ))}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={photoBusy}
              className="flex h-16 w-16 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 text-[10px] font-semibold text-slate-500 hover:bg-slate-50 disabled:opacity-50"
            >
              <ImagePlus className="h-4 w-4" />
              {photoBusy ? '…' : 'Add'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={addPhoto} aria-label="Add photo" />
          </div>
          {selected && animal.photos.length > 1 && (
            <div className="flex gap-2">
              {selected.id !== animal.mainPhotoId && (
                <button onClick={() => setMain(selected.id)} className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                  <Star className="h-3.5 w-3.5" /> Make main photo
                </button>
              )}
              <button onClick={() => deletePhoto(selected.id)} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50">
                <Trash2 className="h-3.5 w-3.5" /> Delete photo
              </button>
            </div>
          )}
          {photoError && <p role="alert" className="text-xs font-medium text-red-600">{photoError}</p>}
        </div>

        {/* Details */}
        <div className="space-y-4 rounded-card border border-line bg-white p-5 shadow-card sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-ink px-2 py-1 font-mono text-sm font-bold text-white">{animal.tagNumber}</span>
                <StatusBadge status={animal.status} />
                {isFemale && <PregnancyBadge status={s.pregnancy} />}
              </div>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink">{animal.name}</h1>
              <p className="text-sm text-slate-500">Added {fmtDate(animal.createdAt)}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setModal({ kind: 'edit' })} className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-control border border-line px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:flex-none">
                <Edit3 className="h-4 w-4" /> Edit details
              </button>
              <button onClick={deleteAnimal} aria-label="Delete animal" className="flex h-11 w-11 items-center justify-center rounded-control border border-red-200 text-red-600 hover:bg-red-50">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {facts.filter(([, v]) => v).map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <dt className="w-24 shrink-0 text-slate-500">{k}</dt>
                <dd className="font-medium text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          {animal.notes && (
            <p className="flex items-start gap-1.5 rounded-control bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /> {animal.notes}
            </p>
          )}

          {/* Summary */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            {isFemale && (
              <SummaryTile Icon={HeartPulse} label="Breeding">
                <p className="font-bold text-ink">{PREGNANCY_TEXT[s.pregnancy]}</p>
                {s.lastInsemination && <p className="text-xs text-slate-500">Last AI {fmtDate(s.lastInsemination.date)}</p>}
                {s.pregnancyCheckDue && <p className="text-xs text-slate-500">Check due {fmtDate(s.pregnancyCheckDue)}</p>}
              </SummaryTile>
            )}
            {isFemale && (
              <SummaryTile Icon={Baby} label="Expected calving">
                {s.expectedCalving ? (
                  <>
                    <p className="font-bold text-ink">{fmtDate(s.expectedCalving)}</p>
                    <p className="text-xs text-slate-500">{dueText(daysUntil(s.expectedCalving))}</p>
                  </>
                ) : (
                  <p className="text-slate-500">{s.lastCalving ? `Last calved ${fmtDate(s.lastCalving)}` : '—'}</p>
                )}
              </SummaryTile>
            )}
            <SummaryTile Icon={Syringe} label="Next dose">
              {nextDose ? (
                <>
                  <p className="font-bold text-ink">{nextDose.title}</p>
                  <span className={`mt-0.5 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${dueTone(daysUntil(nextDose.dueDate))}`}>
                    {fmtDate(nextDose.dueDate)} · {dueText(daysUntil(nextDose.dueDate))}
                  </span>
                </>
              ) : (
                <p className="text-slate-500">{s.lastVaccine ? `Last: ${s.lastVaccine.title}, ${fmtDate(s.lastVaccine.date)}` : 'No vaccines recorded'}</p>
              )}
            </SummaryTile>
            <SummaryTile Icon={Wallet} label="Care cost (all records)">
              <p className="font-bold text-ink">{tk(s.careCost)}</p>
            </SummaryTile>
          </div>
        </div>
      </div>

      {animal.calves.length > 0 && (
        <div className="rounded-card border border-line bg-white p-5 shadow-card sm:p-6">
          <h2 className="text-base font-bold text-ink">Calves</h2>
          <ul className="mt-3 flex flex-wrap gap-3">
            {animal.calves.map((c) => (
              <li key={c.id}>
                <Link href={`/dashboard/cows/${c.id}`} className="flex items-center gap-3 rounded-control border border-line p-2 pr-4 hover:bg-slate-50">
                  <AnimalPhoto src={c.photoUrl} alt={c.tagNumber} className="h-12 w-12 rounded-lg" />
                  <div>
                    <p className="font-mono text-sm font-bold text-ink">{c.tagNumber}</p>
                    <p className="text-xs text-slate-500">
                      {[c.name !== c.tagNumber ? c.name : null, c.gender === 'male' ? 'Male' : 'Female', c.birthDate ? `born ${fmtDate(c.birthDate)}` : null].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* History */}
      <div className="rounded-card border border-line bg-white p-5 shadow-card sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-ink">History</h2>
            <p className="text-xs text-slate-500">Vaccines, AI, pregnancy checks, calvings, treatments and more</p>
          </div>
          <button
            onClick={() => setModal({ kind: 'event', event: null })}
            className="inline-flex h-11 items-center gap-1.5 rounded-control bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" /> Add record
          </button>
        </div>
        {animal.events.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">No records yet. Add vaccines, AI and other events to get reminders.</p>
        ) : (
          <ol className="mt-4 space-y-1">
            {animal.events.map((e) => {
              const t = eventTypeInfo(e.type);
              const detail = eventDetail(e);
              return (
                <li key={e.id} className="group flex gap-3 rounded-control px-2 py-3 hover:bg-slate-50">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-control border ${t.color}`}>
                    <t.Icon className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">
                      {t.label}
                      <span className="ml-2 text-xs font-normal text-slate-500">{fmtDate(e.date)}</span>
                    </p>
                    {detail && <p className="text-sm text-slate-700">{detail}</p>}
                    <div className="flex flex-wrap gap-x-4 text-xs text-slate-500">
                      {e.nextDueDate && (
                        <span className="inline-flex items-center gap-1"><CalendarClock className="h-3 w-3" /> Next due {fmtDate(e.nextDueDate)}</span>
                      )}
                      {e.cost != null && e.cost > 0 && <span>Cost {tk(e.cost)}</span>}
                      {e.calfId && (
                        <Link href={`/dashboard/cows/${e.calfId}`} className="font-semibold text-brand-700 hover:underline">View calf →</Link>
                      )}
                    </div>
                    {e.notes && <p className="mt-0.5 text-xs italic text-slate-500">{e.notes}</p>}
                  </div>
                  <div className="flex shrink-0 items-start gap-1">
                    <button onClick={() => setModal({ kind: 'event', event: e })} aria-label="Edit record" className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-ink">
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button onClick={() => deleteEvent(e)} aria-label="Delete record" className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {modal?.kind === 'edit' && <AnimalFormModal animal={animal} mothers={mothers} onClose={() => setModal(null)} onSaved={done} />}
      {modal?.kind === 'event' && (
        <EventFormModal
          cowId={animal.id}
          isFemale={isFemale}
          event={modal.event}
          initialType={modal.type}
          suggestedCalfId={suggestedId}
          onClose={() => setModal(null)}
          onSaved={done}
        />
      )}
    </div>
  );
}

function SummaryTile({ Icon, label, children }: { Icon: typeof Baby; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-control border border-slate-100 bg-slate-50/60 p-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
      <div className="min-w-0 text-sm">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
        {children}
      </div>
    </div>
  );
}
