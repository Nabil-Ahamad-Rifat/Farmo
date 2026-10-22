"use client";

import Link from 'next/link';
import { BellRing, ArrowRight } from 'lucide-react';
import type { AnimalDueItem } from '@farm/shared-types';
import { fmtDate } from '@/components/sales/shared';
import { dueText, dueTone, eventTypeInfo } from './shared';

/** Dashboard reminders: vaccines/deworming due, calvings expected and pregnancy checks, soonest first. */
export default function DueSoonPanel({ items }: { items: AnimalDueItem[] }) {
  const overdue = items.filter((i) => i.daysLeft < 0).length;
  return (
    <div className="rounded-card border border-sky-100 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-control bg-sky-50 text-sky-700">
            <BellRing className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-ink">Animals due soon</h2>
            <p className="text-xs text-slate-500">
              {items.length} reminder{items.length === 1 ? '' : 's'}
              {overdue > 0 ? ` · ${overdue} overdue` : ''}
            </p>
          </div>
        </div>
        <Link href="/dashboard/cows" className="inline-flex items-center gap-1.5 self-start rounded-control bg-ink px-3 py-2 text-xs font-semibold text-white transition hover:bg-navy-700 sm:self-auto">
          All animals <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <ul className="mt-2 grid gap-x-6 divide-y divide-slate-100 md:grid-cols-2 md:divide-y-0">
        {items.slice(0, 8).map((d) => {
          const t = eventTypeInfo(d.kind);
          return (
            <li key={`${d.cowId}-${d.kind}-${d.title}`} className="md:border-b md:border-slate-100">
              <Link href={`/dashboard/cows/${d.cowId}`} className="flex items-center gap-3 rounded-lg px-2 py-3 transition hover:bg-slate-50">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${t.color}`}>
                  <t.Icon className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">
                    <span className="font-mono">{d.tagNumber}</span>
                    {d.name !== d.tagNumber && <span className="font-normal text-slate-500"> · {d.name}</span>}
                  </p>
                  <p className="truncate text-xs text-slate-500">{d.title} · {fmtDate(d.dueDate)}</p>
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${dueTone(d.daysLeft)}`}>{dueText(d.daysLeft)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      {items.length > 8 && <p className="mt-2 text-center text-xs font-semibold text-slate-500">+ {items.length - 8} more</p>}
    </div>
  );
}
