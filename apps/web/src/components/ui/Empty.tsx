import type { LucideIcon } from 'lucide-react';

/** Shown when a list has nothing to show; says why and offers the next step. */
export function EmptyState({ Icon, title, body, action }: { Icon?: LucideIcon; title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {Icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-card bg-slate-100 text-slate-400">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </div>
      )}
      <p className="mt-3 text-sm font-semibold text-ink">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-slate-500">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-control bg-slate-200/70 ${className}`} aria-hidden="true" />;
}
