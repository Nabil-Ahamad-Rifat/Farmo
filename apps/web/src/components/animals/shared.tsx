"use client";

import { useRef, useState } from 'react';
import {
  Syringe, Dna, Stethoscope, Baby, Pill, Bug, Scale, StickyNote, Camera, ImagePlus, PawPrint, type LucideIcon,
} from 'lucide-react';

/** Each kind of history record: label, icon, colour and what its title field means. */
export const EVENT_TYPES: {
  value: string;
  label: string;
  Icon: LucideIcon;
  color: string;
  titleLabel?: string;
  titlePlaceholder?: string;
  breeding?: boolean;
}[] = [
  { value: 'vaccine', label: 'Vaccine', Icon: Syringe, color: 'bg-sky-50 text-sky-700 border-sky-200', titleLabel: 'Vaccine name', titlePlaceholder: 'e.g. FMD, LSD, Anthrax' },
  { value: 'insemination', label: 'Semen / AI', Icon: Dna, color: 'bg-violet-50 text-violet-700 border-violet-200', titleLabel: 'Bull / semen straw', titlePlaceholder: 'e.g. Holstein straw #A12', breeding: true },
  { value: 'pregnancy_check', label: 'Pregnancy check', Icon: Stethoscope, color: 'bg-pink-50 text-pink-700 border-pink-200', titleLabel: 'Checked by', titlePlaceholder: 'e.g. Dr. Rahim', breeding: true },
  { value: 'calving', label: 'Calving', Icon: Baby, color: 'bg-brand-50 text-brand-700 border-brand-200', titleLabel: 'Note', titlePlaceholder: 'e.g. Normal delivery', breeding: true },
  { value: 'treatment', label: 'Treatment', Icon: Pill, color: 'bg-red-50 text-red-700 border-red-200', titleLabel: 'Illness / medicine', titlePlaceholder: 'e.g. Fever, antibiotic' },
  { value: 'deworming', label: 'Deworming', Icon: Bug, color: 'bg-amber-50 text-amber-700 border-amber-200', titleLabel: 'Medicine', titlePlaceholder: 'e.g. Albendazole' },
  { value: 'weight', label: 'Weight', Icon: Scale, color: 'bg-slate-50 text-slate-700 border-line' },
  { value: 'other', label: 'Other', Icon: StickyNote, color: 'bg-slate-50 text-slate-700 border-line', titleLabel: 'What happened', titlePlaceholder: 'e.g. Hoof trimming' },
];

export const eventTypeInfo = (type: string) => EVENT_TYPES.find((t) => t.value === type) ?? EVENT_TYPES[EVENT_TYPES.length - 1];

export const STATUSES = [
  { value: 'active', label: 'In herd', color: 'bg-brand-50 text-brand-700 border-brand-200' },
  { value: 'sold', label: 'Sold', color: 'bg-slate-100 text-slate-700 border-line' },
  { value: 'dead', label: 'Dead', color: 'bg-red-50 text-red-700 border-red-200' },
] as const;

/** Older records may still say "sick"; show them as they are. */
export function StatusBadge({ status }: { status: string }) {
  const s = STATUSES.find((x) => x.value === status) ?? { label: status, color: 'bg-amber-50 text-amber-700 border-amber-200' };
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${s.color}`}>{s.label}</span>;
}

export const CATEGORIES = [
  { value: 'cow', label: 'Cow' },
  { value: 'heifer', label: 'Heifer' },
  { value: 'calf', label: 'Calf' },
  { value: 'bull', label: 'Bull' },
] as const;

export const categoryLabel = (c?: string | null) => CATEGORIES.find((x) => x.value === c)?.label ?? null;

const PREGNANCY: Record<string, { label: string; color: string }> = {
  pregnant: { label: 'Pregnant', color: 'bg-pink-50 text-pink-700 border-pink-200' },
  inseminated: { label: 'AI done', color: 'bg-violet-50 text-violet-700 border-violet-200' },
  open: { label: 'Not pregnant', color: 'bg-slate-50 text-slate-600 border-line' },
};

export function PregnancyBadge({ status }: { status: string }) {
  const p = PREGNANCY[status];
  if (!p) return null;
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${p.color}`}>{p.label}</span>;
}

/** "Overdue 3 d", "Today", "In 5 d". */
export function dueText(daysLeft: number) {
  if (daysLeft < 0) return `Overdue ${-daysLeft} d`;
  if (daysLeft === 0) return 'Today';
  if (daysLeft === 1) return 'Tomorrow';
  return `In ${daysLeft} d`;
}

export const dueTone = (daysLeft: number) =>
  daysLeft < 0 ? 'bg-red-50 text-red-700 border-red-200' : daysLeft <= 3 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-600 border-line';

/** Days from today (UTC calendar days, like the server) to a "YYYY-MM-DD" day. */
export function daysUntil(day: string) {
  const today = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
  return Math.round((Date.parse(day + 'T00:00:00Z') - today) / 86_400_000);
}

/** An animal's photo, or a placeholder for animals added before photos existed. */
export function AnimalPhoto({ src, alt, className }: { src: string | null | undefined; alt: string; className?: string }) {
  if (!src) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 text-slate-300 ${className ?? ''}`}>
        <PawPrint className="h-1/3 w-1/3" aria-hidden="true" />
      </div>
    );
  }
  // Plain <img>: photos sit behind the login cookie, which next/image's optimiser would not send.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" className={`object-cover ${className ?? ''}`} />;
}

export interface PickedPhoto {
  /** Base64 without the data: prefix, as the API wants it. */
  data: string;
  mimeType: 'image/jpeg';
  width: number;
  height: number;
  /** data: URL for the preview (allowed by the CSP's img-src). */
  preview: string;
}

const MAX_SIDE = 800;

/** Shrink a picked image to at most 800 px on its longest side, as a JPEG (about 50-120 KB; the server takes up to 600 KB). */
export async function resizePhoto(file: File): Promise<PickedPhoto> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose a photo');
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('This photo could not be read. Please try a JPEG or PNG.');
  });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot prepare photos');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const preview = canvas.toDataURL('image/jpeg', 0.75);
  return { data: preview.slice(preview.indexOf(',') + 1), mimeType: 'image/jpeg', width, height, preview };
}

/** Pick a photo from files or, on a phone, the camera. Shows a preview once chosen. */
export function PhotoPicker({
  value,
  onChange,
  label = 'Photo',
  required,
  id,
}: {
  value: PickedPhoto | null;
  onChange: (p: PickedPhoto | null) => void;
  label?: string;
  required?: boolean;
  id: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setBusy(true);
    try {
      onChange(await resizePhoto(file));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const btn = 'inline-flex items-center gap-1.5 rounded-control border border-line bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50';
  return (
    <div>
      <span className="mb-1 block text-xs font-semibold uppercase text-slate-600">
        {label} {required && <span className="text-red-600">*</span>}
      </span>
      <div className="flex items-center gap-4">
        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-card border border-line bg-slate-50">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value.preview} alt="Chosen photo" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-300">
              <Camera className="h-8 w-8" aria-hidden="true" />
            </div>
          )}
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btn} onClick={() => cameraRef.current?.click()} disabled={busy}>
              <Camera className="h-4 w-4" /> Take photo
            </button>
            <button type="button" className={btn} onClick={() => fileRef.current?.click()} disabled={busy}>
              <ImagePlus className="h-4 w-4" /> {value ? 'Change' : 'Choose file'}
            </button>
          </div>
          <p className="text-xs text-slate-500">{busy ? 'Preparing photo…' : 'A clear side view helps you recognise the animal.'}</p>
          {error && <p className="text-xs font-medium text-red-600">{error}</p>}
        </div>
      </div>
      <input ref={fileRef} id={id} type="file" accept="image/*" className="hidden" onChange={pick} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} />
    </div>
  );
}

/** Pill-style single choice used across the animal forms. */
export function ChoiceChips<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string }[];
  value: T | '';
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-control border px-3 py-1.5 text-xs font-semibold transition ${
            value === o.value ? 'border-slate-900 bg-ink text-white' : 'border-line bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
