"use client";

import { Search } from 'lucide-react';
import type { Tone } from './StatCard';

const BADGE: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  brand: 'bg-brand-50 text-brand-700 ring-brand-200',
  danger: 'bg-red-50 text-red-700 ring-red-200',
  warning: 'bg-amber-50 text-amber-800 ring-amber-200',
  info: 'bg-sky-50 text-sky-700 ring-sky-200',
};

export function Badge({ tone = 'neutral', children, className = '' }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${BADGE[tone]} ${className}`}>
      {children}
    </span>
  );
}

/** Class for a filter chip; active chips are ink. */
export const chipCls = (active: boolean) =>
  `inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-colors duration-200 sm:py-1.5 sm:text-xs ${
    active ? 'border-ink bg-ink text-white' : 'border-line bg-white text-slate-600 hover:border-slate-300 hover:text-ink'
  }`;

/** A row of single-choice filter chips; one swipeable line on phones. */
export function Chips<T extends string>({
  options,
  value,
  onChange,
  label,
  counts,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  counts?: Partial<Record<T, number>>;
}) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 sm:pb-0" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)} aria-pressed={value === o.value} className={chipCls(value === o.value)}>
          {o.label}
          {counts?.[o.value] !== undefined && <span className={value === o.value ? 'text-slate-300' : 'text-slate-400'}>{counts[o.value]}</span>}
        </button>
      ))}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  label,
  className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
      <input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-control border border-line bg-white pl-10 pr-4 text-base text-ink shadow-sm placeholder:text-slate-400 transition-colors focus:border-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-600/10 sm:h-10 sm:text-sm"
      />
    </div>
  );
}

/** The bar above a list: search on the left, chips on the right (stacked on phones). */
export function FilterBar({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">{children}</div>;
}
