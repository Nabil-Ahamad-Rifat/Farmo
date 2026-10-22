"use client";

import { useState } from 'react';
import type { FinanceReport } from '@/lib/finance';
import { fmtDate, monthLabel, tk } from '@/components/sales/shared';

// Chart colours (validated for colour-blind separation): income blue, costs orange.
const INCOME = '#2a78d6';
const COSTS = '#eb6834';

const signed = (n: number) => (n < 0 ? '− ' + tk(-n) : tk(n));

/** Short label of a chart bucket: "7 Oct" for a day, "Oct 26" for a month. */
const bucketLabel = (key: string) =>
  key.length === 7
    ? new Date(key + '-01T00:00:00Z').toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' })
    : new Date(key + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** Income vs costs per day (or per month for long ranges), with a tooltip per pair. */
export default function IncomeCostChart({
  chart,
  title = 'Income and costs',
  action,
}: {
  chart: FinanceReport['chart'];
  title?: string;
  action?: React.ReactNode;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...chart.flatMap((b) => [b.income, b.costs]));
  const H = 160;
  const h = (v: number) => (v > 0 ? Math.max(2, (v / max) * H) : 0);
  const active = hover !== null ? chart[hover] : null;
  const ticks = chart.length <= 1 ? [0] : [0, Math.floor((chart.length - 1) / 2), chart.length - 1];

  return (
    <section className="rounded-card border border-line bg-white p-5 shadow-card sm:p-6" aria-labelledby="chart-h">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="chart-h" className="text-[15px] font-semibold text-ink">{title}</h2>
          <p className="text-xs text-slate-500">{chart[0]?.key.length === 7 ? 'Per month' : 'Per day'} · profit view</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex gap-4 text-xs font-semibold text-slate-600">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: INCOME }} /> Income</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: COSTS }} /> Costs</span>
          </div>
          {action}
        </div>
      </div>

      <div className="mt-3 h-12 text-sm" aria-live="polite">
        {active ? (
          <div className="inline-flex flex-wrap gap-x-4 rounded-control border border-line bg-white px-3 py-2 shadow-sm">
            <span className="font-semibold text-ink">{active.key.length === 7 ? monthLabel(active.key) : fmtDate(active.key)}</span>
            <span className="text-slate-600">Income <b className="text-ink">{tk(active.income)}</b></span>
            <span className="text-slate-600">Costs <b className="text-ink">{tk(active.costs)}</b></span>
            <span className="text-slate-600">Profit <b className={active.profit < 0 ? 'text-red-600' : 'text-brand-700'}>{signed(active.profit)}</b></span>
          </div>
        ) : (
          <p className="pt-2 text-xs text-slate-400">Point at or tap a bar to see its numbers. Highest: {tk(max)}</p>
        )}
      </div>

      <div className="relative border-b border-line" style={{ height: H }} onMouseLeave={() => setHover(null)}>
        <div className="absolute inset-x-0 top-0 border-t border-dashed border-slate-100" aria-hidden="true" />
        <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-slate-100" aria-hidden="true" />
        <div className="relative flex h-full items-end gap-[2px]">
          {chart.map((b, i) => (
            <button
              key={b.key}
              type="button"
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onClick={() => setHover(i)}
              aria-label={`${b.key}: income ${tk(b.income)}, costs ${tk(b.costs)}`}
              className={`flex h-full min-w-0 flex-1 items-end justify-center gap-[2px] rounded-t px-[1px] ${hover === i ? 'bg-slate-100' : ''}`}
            >
              <span className="w-full max-w-[14px] rounded-t-[4px]" style={{ height: h(b.income), background: INCOME }} />
              <span className="w-full max-w-[14px] rounded-t-[4px]" style={{ height: h(b.costs), background: COSTS }} />
            </button>
          ))}
        </div>
      </div>
      <div className="relative mt-1.5 h-4 text-[11px] text-slate-400">
        {ticks.map((t, i) => (
          <span
            key={t}
            className="absolute whitespace-nowrap"
            style={i === 0 ? { left: 0 } : i === ticks.length - 1 ? { right: 0 } : { left: `${((t + 0.5) / chart.length) * 100}%`, transform: 'translateX(-50%)' }}
          >
            {bucketLabel(chart[t].key)}
          </span>
        ))}
      </div>
    </section>
  );
}
