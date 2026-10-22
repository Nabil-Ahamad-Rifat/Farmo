import Link from 'next/link';
import { ArrowLeft, type LucideIcon } from 'lucide-react';

export const cardCls = 'rounded-card border border-line bg-white shadow-card';

export function Card({ className = '', children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`${cardCls} ${className}`} {...rest}>
      {children}
    </div>
  );
}

/** Title row of a card: optional icon, title, one-line description, actions on the right. */
export function CardHeader({
  title,
  subtitle,
  Icon,
  actions,
  className = '',
  id,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  Icon?: LucideIcon;
  actions?: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div className={`flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-6 ${className}`}>
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-slate-100 text-slate-600">
            <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
          </div>
        )}
        <div className="min-w-0">
          <h2 id={id} className="text-[15px] font-semibold text-ink">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Page title with description and actions; optional back link above it. */
export function PageHeader({
  title,
  subtitle,
  actions,
  back,
  eyebrow,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
  /** Small label above the title, e.g. "Selling". */
  eyebrow?: string;
}) {
  return (
    <div className="space-y-3">
      {back && (
        <Link href={back.href} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-ink">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.08em] text-brand-700">{eyebrow}</p>}
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[28px] sm:leading-9">{title}</h1>
          {subtitle && <p className="mt-1 max-w-2xl text-sm text-slate-500">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
