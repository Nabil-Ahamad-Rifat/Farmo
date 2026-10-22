"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { Button } from './Button';

type ConfirmOptions = {
  title: string;
  body?: React.ReactNode;
  confirmLabel?: string;
  /** "danger" for deletes: red button. */
  tone?: 'danger' | 'default';
};
type ToastTone = 'success' | 'error' | 'info';
type Toast = { id: number; message: string; tone: ToastTone };

const FeedbackContext = createContext<{
  confirm: (o: ConfirmOptions) => Promise<boolean>;
  toast: (message: string, tone?: ToastTone) => void;
} | null>(null);

/**
 * Styled replacements for window.confirm/alert: `const confirm = useConfirm();
 * if (await confirm({ title })) ...` and `useToast()('Saved')`.
 * Falls back to the browser dialogs outside the provider.
 */
export function useConfirm() {
  const ctx = useContext(FeedbackContext);
  return ctx?.confirm ?? (async (o: ConfirmOptions) => window.confirm(o.title));
}

export function useToast() {
  const ctx = useContext(FeedbackContext);
  return ctx?.toast ?? ((message: string) => window.alert(message));
}

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const confirm = useCallback((o: ConfirmOptions) => new Promise<boolean>((resolve) => setDialog({ ...o, resolve })), []);
  const toast = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 6000 : 3500);
  }, []);

  const close = (value: boolean) => {
    dialog?.resolve(value);
    setDialog(null);
  };

  useEffect(() => {
    if (!dialog) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dialog.resolve(false);
        setDialog(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog]);

  return (
    <FeedbackContext.Provider value={{ confirm, toast }}>
      {children}

      {dialog && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-navy-950/40 backdrop-blur-[2px] sm:items-center sm:p-4" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
          <div className="w-full max-w-md rounded-t-2xl border border-line bg-white p-5 shadow-pop sm:rounded-card sm:p-6">
            <div className="flex gap-4">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${dialog.tone === 'danger' ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2 id="confirm-title" className="text-base font-semibold text-ink">{dialog.title}</h2>
                {dialog.body && <div className="mt-1 text-sm text-slate-600">{dialog.body}</div>}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => close(false)} className="flex-1 sm:flex-none">Cancel</Button>
              <Button variant={dialog.tone === 'danger' ? 'danger' : 'primary'} onClick={() => close(true)} autoFocus className="flex-1 sm:flex-none">
                {dialog.confirmLabel ?? (dialog.tone === 'danger' ? 'Delete' : 'Confirm')}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[70] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:pr-6" aria-live="polite">
        {toasts.map((t) => {
          const Icon = t.tone === 'success' ? CheckCircle2 : t.tone === 'error' ? AlertTriangle : Info;
          return (
            <div
              key={t.id}
              role={t.tone === 'error' ? 'alert' : 'status'}
              className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-card border border-line bg-white px-4 py-3 text-sm shadow-raised"
            >
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${t.tone === 'success' ? 'text-brand-600' : t.tone === 'error' ? 'text-red-600' : 'text-sky-600'}`} aria-hidden="true" />
              <p className="min-w-0 flex-1 font-medium text-ink">{t.message}</p>
              <button type="button" onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))} aria-label="Dismiss" className="text-slate-400 hover:text-ink">
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </FeedbackContext.Provider>
  );
}
