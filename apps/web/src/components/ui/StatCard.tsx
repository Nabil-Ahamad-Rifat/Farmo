import Link from 'next/link';
import { ArrowUpRight, type LucideIcon } from 'lucide-react';

export type Tone = 'neutral' | 'brand' | 'danger' | 'warning' | 'info';

/** Icon chip colours per tone (status colours only where the number means it). */
export const TONE_ICON: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-600',
  brand: 'bg-brand-50 text-brand-700',
  danger: 'bg-red-50 text-red-600',
  warning: 'bg-amber-50 text-amber-700',
  info: 'bg-sky-50 text-sky-700',
};

const VALUE: Record<Tone, string> = {
  neutral: 'text-ink',
  brand: 'text-ink',
  danger: 'text-red-600',
  warning: 'text-ink',
  info: 'text-ink',
};

/** A headline number: label, value, optional hint and icon; a link when `href` is given. */
export function StatCard({
  label,
  value,
  hint,
  Icon,
  tone = 'neutral',
  href,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  Icon?: LucideIcon;
  tone?: Tone;
  href?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-slate-500">{label}</p>
        {Icon && (
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-control ${TONE_ICON[tone]}`}>
            <Icon className="h-4 w-4" aria-hidden="true" />
          </div>
        )}
      </div>
      <p className={`mt-2 truncate text-xl font-bold tracking-tight tabular-nums sm:text-2xl ${VALUE[tone]}`}>{value}</p>
      {hint && (
        <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
          <span className="min-w-0 truncate">{hint}</span>
          {href && <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-400 transition-colors group-hover:text-ink" aria-hidden="true" />}
        </p>
      )}
    </>
  );
  const cls = 'block h-full rounded-card border border-line bg-white p-4 shadow-card sm:p-5';
  return href ? (
    <Link href={href} className={`group ${cls} transition-[border-color,box-shadow] duration-200 hover:border-slate-300 hover:shadow-raised`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
