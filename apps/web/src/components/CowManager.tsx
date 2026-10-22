"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Search, BellRing } from 'lucide-react';
import type { AnimalDueItem, CowListItem } from '@farm/shared-types';
import { ageLabel } from '@farm/business-logic';
import AnimalFormModal from '@/components/animals/AnimalFormModal';
import { AnimalPhoto, PregnancyBadge, StatusBadge, categoryLabel, dueText, dueTone } from '@/components/animals/shared';

const FILTERS = [
  { value: 'active', label: 'In herd' },
  { value: 'pregnant', label: 'Pregnant' },
  { value: 'due', label: 'Due soon' },
  { value: 'sold', label: 'Sold' },
  { value: 'dead', label: 'Dead' },
  { value: 'all', label: 'All' },
] as const;
type Filter = (typeof FILTERS)[number]['value'];

export default function CowManager({
  initialCows,
  suggestedId,
  dueSoon,
}: {
  initialCows: CowListItem[];
  suggestedId: string;
  dueSoon: AnimalDueItem[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('active');
  const [adding, setAdding] = useState(false);

  // The most urgent reminder per animal, for the card badge and the "Due soon" filter.
  const dueByCow = new Map<string, AnimalDueItem>();
  for (const d of dueSoon) if (!dueByCow.has(d.cowId)) dueByCow.set(d.cowId, d);

  const counts: Record<Filter, number> = {
    active: initialCows.filter((c) => c.status === 'active').length,
    pregnant: initialCows.filter((c) => c.status === 'active' && c.summary.pregnancy === 'pregnant').length,
    due: dueByCow.size,
    sold: initialCows.filter((c) => c.status === 'sold').length,
    dead: initialCows.filter((c) => c.status === 'dead').length,
    all: initialCows.length,
  };

  const q = search.trim().toLowerCase();
  const shown = initialCows.filter((c) => {
    const matchesSearch =
      !q || c.tagNumber.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || (c.breed ?? '').toLowerCase().includes(q);
    const matchesFilter =
      filter === 'all' ||
      (filter === 'pregnant' ? c.status === 'active' && c.summary.pregnancy === 'pregnant' : filter === 'due' ? dueByCow.has(c.id) : c.status === filter);
    return matchesSearch && matchesFilter;
  });

  const mothers = initialCows.filter((c) => c.gender !== 'male').map(({ id, tagNumber, name }) => ({ id, tagNumber, name }));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[28px]">Animals</h1>
          <p className="mt-1 text-sm text-slate-500 sm:text-base">Photo, Cow ID, breeding and health records of every animal.</p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="inline-flex shrink-0 items-center gap-2 rounded-control bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 sm:py-2.5"
        >
          <Plus className="h-4 w-4" />
          Add animal
        </button>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-md lg:flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            aria-label="Search animals"
            placeholder="Search by Cow ID, name or breed..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-control border border-line bg-white py-3 pl-10 pr-4 text-base sm:py-2.5 sm:text-sm text-ink placeholder-slate-400 shadow-sm focus:border-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-600/10"
          />
        </div>
        {/* One swipeable row on phones. */}
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 sm:pb-0">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              aria-pressed={filter === f.value}
              className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-semibold transition sm:py-2 sm:text-xs ${
                filter === f.value ? 'bg-ink text-white shadow-card' : 'border border-line bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {f.label} <span className={filter === f.value ? 'text-slate-300' : 'text-slate-400'}>{counts[f.value]}</span>
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-card border border-dashed border-slate-300 bg-white py-14 text-center">
          <p className="text-sm text-slate-500">
            {initialCows.length === 0 ? 'No animals yet. Add your first animal with a photo.' : 'No animals match this search or filter.'}
          </p>
          {initialCows.length === 0 && (
            <button onClick={() => setAdding(true)} className="mt-4 inline-flex items-center gap-2 rounded-control bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700">
              <Plus className="h-4 w-4" /> Add animal
            </button>
          )}
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((c) => {
            const due = dueByCow.get(c.id);
            const details = [categoryLabel(c.category), c.breed, c.birthDate ? ageLabel(c.birthDate) : null].filter(Boolean).join(' · ');
            return (
              <li key={c.id}>
                <Link
                  href={`/dashboard/cows/${c.id}`}
                  className="group block overflow-hidden rounded-card border border-line bg-white shadow-card transition hover:border-slate-300 hover:shadow-md"
                >
                  <div className="relative">
                    <AnimalPhoto src={c.photoUrl} alt={`${c.tagNumber} ${c.name}`} className="aspect-[4/3] w-full" />
                    <span className="absolute left-2 top-2 sm:left-3 sm:top-3 rounded-lg bg-ink/85 px-2 py-1 font-mono text-xs font-bold text-white">{c.tagNumber}</span>
                    {c.status !== 'active' && (
                      <span className="absolute right-2 top-2 sm:right-3 sm:top-3"><StatusBadge status={c.status} /></span>
                    )}
                  </div>
                  <div className="space-y-2 p-3 sm:p-4">
                    <div>
                      <p className="truncate text-sm font-bold sm:text-base text-ink group-hover:underline">{c.name}</p>
                      <p className="truncate text-xs text-slate-500">{details || 'No details yet'}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {c.gender !== 'male' && <PregnancyBadge status={c.summary.pregnancy} />}
                      {due && (
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${dueTone(due.daysLeft)}`}>
                          <BellRing className="h-3 w-3" aria-hidden="true" /> {due.title}: {dueText(due.daysLeft)}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {adding && (
        <AnimalFormModal
          suggestedId={suggestedId}
          mothers={mothers}
          onClose={() => setAdding(false)}
          onSaved={(saved) => {
            setAdding(false);
            router.push(`/dashboard/cows/${saved.id}`);
          }}
        />
      )}
    </div>
  );
}
