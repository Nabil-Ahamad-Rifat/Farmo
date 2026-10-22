"use client";

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function Modal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/40 backdrop-blur-[2px] sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Phones: a sheet from the bottom; larger screens: a centred card. */}
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-line bg-white px-5 pb-5 shadow-pop sm:pb-6 sm:rounded-card sm:px-6">
        <div className="sticky top-0 z-10 -mx-5 flex items-start justify-between border-b border-line bg-white px-5 pb-4 pt-5 sm:-mx-6 sm:px-6 sm:pt-6">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 -mt-1 flex h-10 w-10 items-center justify-center rounded-control text-slate-400 transition-colors hover:bg-slate-100 hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function FormError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div role="alert" className="mt-4 rounded-control border border-red-200 bg-red-50 px-3.5 py-3 text-sm font-medium text-red-700">
      {message}
    </div>
  );
}

export function FormFooter({ onCancel, loading, label }: { onCancel: () => void; loading: boolean; label: string }) {
  return (
    // Stays in view at the bottom of long forms.
    <div className="sticky bottom-0 -mx-5 -mb-5 flex justify-end gap-2 border-t border-line bg-white px-5 py-4 sm:-mx-6 sm:-mb-6 sm:px-6">
      <Button variant="secondary" size="lg" onClick={onCancel} className="flex-1 sm:flex-none sm:h-10">
        Cancel
      </Button>
      <Button type="submit" size="lg" loading={loading} className="flex-[2] sm:flex-none sm:h-10">
        {loading ? 'Saving…' : label}
      </Button>
    </div>
  );
}
