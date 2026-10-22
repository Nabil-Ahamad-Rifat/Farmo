"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Wallet, CalendarX, Hammer, Edit3, LogOut, Undo2, Trash2, Phone, CalendarDays, Banknote, Ban, TrendingUp,
} from 'lucide-react';
import type { SalaryPayment, WorkerDetail } from '@farm/shared-types';
import { dayRate } from '@farm/business-logic';
import { webApiClient } from '@farm/api-client';
import { fmtDate, monthLabel, tk } from '@/components/sales/shared';
import { AbsenceModal, LeaveModal, WorkModal, WorkerFormModal, WorkerPaymentModal } from '@/components/workers/WorkerModals';
import { WorkerStatusBadge, balanceInfo, payLabel } from '@/components/workers/shared';
import { useConfirm, useToast } from '@/components/ui/Feedback';

type WorkRow = WorkerDetail['work'][number];
type ModalState =
  | { kind: 'pay'; payment: SalaryPayment | null }
  | { kind: 'absent' }
  | { kind: 'work'; entry: WorkRow | null }
  | { kind: 'edit' }
  | { kind: 'leave' }
  | null;

/** One line in the history: payments, write-offs, absences, work and pay changes, newest first. */
type HistoryRow = {
  key: string;
  date: string | Date;
  Icon: typeof Wallet;
  tone: string;
  title: string;
  detail?: string | null;
  amount?: { text: string; cls: string };
  onEdit?: () => void;
  onDelete?: () => void;
};

export default function WorkerDetailView({ worker }: { worker: WorkerDetail }) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [modal, setModal] = useState<ModalState>(null);
  const [busy, setBusy] = useState(false);
  const done = () => {
    setModal(null);
    router.refresh();
  };
  const daily = worker.payType === 'daily';
  const left = worker.status === 'left';
  const a = worker.account;
  const bal = balanceInfo(a.balance);

  /** Run an action after an optional confirm; `label` names the confirm button (deletes default to red "Delete"). */
  async function act(fn: () => Promise<unknown>, confirmText?: string, label?: string) {
    if (confirmText && !(await confirm({ title: confirmText, tone: label ? 'default' : 'danger', confirmLabel: label }))) return;
    setBusy(true);
    try {
      await fn();
      router.refresh();
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  const deleteWorker = () =>
    act(async () => {
      await webApiClient.delete(`/api/employees/${worker.id}`, 'Failed to delete worker');
      router.push('/dashboard/employees');
    }, `Delete ${worker.name}? This cannot be undone.`);

  const history: HistoryRow[] = [
    ...worker.payments.map((p): HistoryRow =>
      p.kind === 'writeoff'
        ? {
            key: 'p' + p.id,
            date: p.paidAt,
            Icon: Ban,
            tone: 'bg-slate-100 text-slate-600 border-line',
            title: 'Advance written off',
            detail: p.note === 'Advance written off' ? null : p.note,
            amount: { text: tk(p.amount), cls: 'text-slate-600' },
            onDelete: () => act(() => webApiClient.delete(`/api/salary-payments/${p.id}`), 'Undo this write-off? The advance will show as owed again.', 'Undo write-off'),
          }
        : {
            key: 'p' + p.id,
            date: p.paidAt,
            Icon: Wallet,
            tone: 'bg-brand-50 text-brand-700 border-brand-200',
            title: 'Paid',
            detail: p.note,
            amount: { text: '− ' + tk(p.amount), cls: 'text-brand-700' },
            onEdit: () => setModal({ kind: 'pay', payment: p }),
            onDelete: () => act(() => webApiClient.delete(`/api/salary-payments/${p.id}`), `Delete the ${tk(p.amount)} payment from ${fmtDate(p.paidAt)}?`),
          },
    ),
    ...worker.absences.map((x): HistoryRow => ({
      key: 'a' + x.id,
      date: x.date,
      Icon: CalendarX,
      tone: 'bg-red-50 text-red-700 border-red-200',
      title: 'Absent (unpaid)',
      detail: x.note,
      amount: { text: '− ' + tk(dayRate(worker.salary)), cls: 'text-red-600' },
      onDelete: () => act(() => webApiClient.delete(`/api/employee-absences/${x.id}`), `Remove the absence on ${fmtDate(x.date)}? That day will be paid.`, 'Remove absence'),
    })),
    ...worker.work.map((w): HistoryRow => ({
      key: 'w' + w.id,
      date: w.date,
      Icon: Hammer,
      tone: 'bg-sky-50 text-sky-700 border-sky-200',
      title: `Worked ${w.days === 0.5 ? 'half a day' : `${w.days} day${w.days === 1 ? '' : 's'}`} × ${tk(w.rate)}`,
      detail: w.note,
      amount: { text: '+ ' + tk(w.days * w.rate), cls: 'text-ink' },
      onEdit: () => setModal({ kind: 'work', entry: w }),
      onDelete: () => act(() => webApiClient.delete(`/api/work-entries/${w.id}`), `Delete this work from ${fmtDate(w.date)}?`),
    })),
    ...worker.rates.map((r, i): HistoryRow => ({
      key: 'r' + r.id,
      date: r.from,
      Icon: i === worker.rates.length - 1 ? CalendarDays : TrendingUp,
      tone: 'bg-violet-50 text-violet-700 border-violet-200',
      title: i === worker.rates.length - 1 ? 'Started work' : 'Pay changed',
      detail: r.monthlySalary != null ? `Monthly ${tk(r.monthlySalary)} (${tk(dayRate(r.monthlySalary))}/day)` : `Day rate ${tk(r.dailyRate ?? 0)}`,
    })),
    ...(worker.leftDate
      ? [{ key: 'left', date: worker.leftDate, Icon: LogOut, tone: 'bg-slate-100 text-slate-600 border-line', title: 'Left work' } as HistoryRow]
      : []),
  ].sort((x, y) => new Date(y.date).getTime() - new Date(x.date).getTime());

  const btn = 'inline-flex h-11 items-center justify-center gap-1.5 rounded-control px-4 text-sm font-semibold transition disabled:opacity-50';

  return (
    <div className="space-y-6">
      <Link href="/dashboard/employees" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> All workers
      </Link>

      {/* Who and what */}
      <div className="space-y-4 rounded-card border border-line bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card bg-ink text-lg font-bold text-white">
            {worker.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-ink">{worker.name}</h1>
              <WorkerStatusBadge status={worker.status} />
            </div>
            <p className="text-sm text-slate-500">{worker.role} · {payLabel(worker)}</p>
            <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
              <span>Started {worker.joinDate ? fmtDate(worker.joinDate) : '—'}</span>
              {worker.leftDate && <span>Left {fmtDate(worker.leftDate)}</span>}
              {worker.phone && (
                <a href={`tel:${worker.phone}`} className="inline-flex items-center gap-1 hover:text-ink"><Phone className="h-3.5 w-3.5" /> {worker.phone}</a>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setModal({ kind: 'pay', payment: null })} className={`${btn} flex-1 bg-brand-600 text-white hover:bg-brand-700 sm:flex-none`}>
            <Wallet className="h-4 w-4" /> Pay money
          </button>
          {!left &&
            (daily ? (
              <button onClick={() => setModal({ kind: 'work', entry: null })} className={`${btn} flex-1 bg-ink text-white hover:bg-navy-700 sm:flex-none`}>
                <Hammer className="h-4 w-4" /> Add work
              </button>
            ) : (
              <button onClick={() => setModal({ kind: 'absent' })} className={`${btn} flex-1 border border-line text-slate-700 hover:bg-slate-50 sm:flex-none`}>
                <CalendarX className="h-4 w-4" /> Mark absent
              </button>
            ))}
          <button onClick={() => setModal({ kind: 'edit' })} className={`${btn} border border-line text-slate-700 hover:bg-slate-50`}>
            <Edit3 className="h-4 w-4" /> Edit
          </button>
          {left ? (
            <button
              disabled={busy}
              onClick={() => act(() => webApiClient.post(`/api/employees/${worker.id}/leave`, { leftDate: '' }), `Mark ${worker.name} as working again? The days since they left will be paid too; mark them absent if they did not work.`, 'Yes, working again')}
              className={`${btn} border border-line text-slate-700 hover:bg-slate-50`}
            >
              <Undo2 className="h-4 w-4" /> Came back
            </button>
          ) : (
            <button onClick={() => setModal({ kind: 'leave' })} className={`${btn} border border-line text-slate-700 hover:bg-slate-50`}>
              <LogOut className="h-4 w-4" /> Left work
            </button>
          )}
          {worker.payments.length === 0 && worker.work.length === 0 && (
            <button onClick={deleteWorker} disabled={busy} aria-label="Delete worker" className={`${btn} w-11 border border-red-200 px-0 text-red-600 hover:bg-red-50`}>
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Balance */}
      <div className={`rounded-card border bg-white p-5 shadow-sm sm:p-6 ${a.balance > 0.004 ? 'border-red-200' : a.balance < -0.004 ? 'border-amber-200' : 'border-brand-200'}`}>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Balance now</p>
        <p className={`mt-1 text-3xl font-extrabold ${a.balance > 0.004 ? 'text-red-600' : a.balance < -0.004 ? 'text-amber-700' : 'text-brand-700'}`}>{bal.label}</p>
        <p className="mt-1 text-sm text-slate-600">
          {a.balance > 0.004
            ? `${worker.name} has earned ${tk(a.balance)} more than you paid.`
            : a.balance < -0.004
              ? `You paid ${tk(-a.balance)} more than ${worker.name} has earned so far.`
              : 'Everything earned has been paid.'}
        </p>
        <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-slate-100 pt-4 text-sm">
          <div>
            <dt className="text-xs text-slate-500">Earned</dt>
            <dd className="font-bold text-ink">{tk(a.earned)}</dd>
            <dd className="text-xs text-slate-500">
              {a.daysWorked} day{a.daysWorked === 1 ? '' : 's'}
              {a.daysAbsent ? ` · ${a.daysAbsent} absent` : ''}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Paid</dt>
            <dd className="font-bold text-ink">{tk(a.paid)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Written off</dt>
            <dd className="font-bold text-ink">{tk(a.writtenOff)}</dd>
          </div>
        </dl>
        {left && a.balance < -0.004 && (
          <div className="mt-4 flex flex-col gap-3 rounded-control border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-amber-900">
              {worker.name} left owing {tk(-a.balance)}. If it will not be paid back, write it off: it counts as a loss.
            </p>
            <button
              disabled={busy}
              onClick={() => act(() => webApiClient.post(`/api/employees/${worker.id}/writeoff`, {}), `Write off ${tk(-a.balance)} as a loss?`, 'Write off')}
              className={`${btn} shrink-0 bg-amber-600 text-white hover:bg-amber-700`}
            >
              <Ban className="h-4 w-4" /> Write off {tk(-a.balance)}
            </button>
          </div>
        )}
        {left && a.balance > 0.004 && (
          <div className="mt-4 rounded-control border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            Final settlement: pay {worker.name} {tk(a.balance)} to close the account.
          </div>
        )}
      </div>

      {/* Month by month */}
      <div className="rounded-card border border-line bg-white shadow-card">
        <div className="border-b border-slate-100 p-5 sm:p-6">
          <h2 className="text-base font-bold text-ink">Month by month</h2>
          <p className="text-xs text-slate-500">{daily ? 'Days worked × rate.' : `Every day counts at ${tk(dayRate(worker.salary))} except absent days.`}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3">Month</th>
                <th className="px-3 py-3 text-right">Days</th>
                {!daily && <th className="px-3 py-3 text-right">Absent</th>}
                <th className="px-3 py-3 text-right">Earned</th>
                <th className="px-3 py-3 text-right">Paid</th>
                <th className="px-5 py-3 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {worker.months.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-500">Nothing yet.</td></tr>
              ) : (
                worker.months.map((m) => (
                  <tr key={m.month}>
                    <td className="whitespace-nowrap px-5 py-3 font-semibold text-ink">{monthLabel(m.month)}</td>
                    <td className="px-3 py-3 text-right text-slate-700">{m.daysWorked}</td>
                    {!daily && <td className={`px-3 py-3 text-right ${m.daysAbsent ? 'font-semibold text-red-600' : 'text-slate-400'}`}>{m.daysAbsent}</td>}
                    <td className="whitespace-nowrap px-3 py-3 text-right text-ink">{tk(m.earned)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right text-slate-700">
                      {tk(m.paid)}
                      {m.writtenOff > 0 && <span className="block text-xs text-slate-500">+ {tk(m.writtenOff)} written off</span>}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-right">
                      <span className={`font-semibold ${balanceInfo(m.closing).text}`}>{balanceInfo(m.closing).label}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* History */}
      <div className="rounded-card border border-line bg-white p-5 shadow-sm sm:p-6">
        <h2 className="border-b border-slate-100 pb-4 text-base font-bold text-ink">History</h2>
        <ol className="mt-2 space-y-1">
          {history.map((h) => (
            <li key={h.key} className="flex items-center gap-3 rounded-control px-2 py-2.5 hover:bg-slate-50">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-control border ${h.tone}`}>
                <h.Icon className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">
                  {h.title} <span className="ml-1 text-xs font-normal text-slate-500">{fmtDate(h.date)}</span>
                </p>
                {h.detail && <p className="truncate text-xs text-slate-500">{h.detail}</p>}
              </div>
              {h.amount && <p className={`shrink-0 text-sm font-bold ${h.amount.cls}`}>{h.amount.text}</p>}
              <div className="flex shrink-0">
                {h.onEdit && (
                  <button onClick={h.onEdit} aria-label="Edit" className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-ink">
                    <Edit3 className="h-4 w-4" />
                  </button>
                )}
                {h.onDelete && (
                  <button onClick={h.onDelete} disabled={busy} aria-label="Delete" className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
          <Banknote className="h-3.5 w-3.5" /> Money given on any day lowers the balance; you do not have to pay by month.
        </p>
      </div>

      {modal?.kind === 'pay' && <WorkerPaymentModal worker={worker} payment={modal.payment} onClose={() => setModal(null)} onSaved={done} />}
      {modal?.kind === 'absent' && <AbsenceModal worker={worker} onClose={() => setModal(null)} onSaved={done} />}
      {modal?.kind === 'work' && <WorkModal worker={worker} entry={modal.entry} onClose={() => setModal(null)} onSaved={done} />}
      {modal?.kind === 'edit' && <WorkerFormModal worker={worker} onClose={() => setModal(null)} onSaved={done} />}
      {modal?.kind === 'leave' && <LeaveModal worker={worker} onClose={() => setModal(null)} onSaved={done} />}
    </div>
  );
}
