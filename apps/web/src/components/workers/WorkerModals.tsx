"use client";

import { useState } from 'react';
import type { Employee, SalaryPayment, WorkerDetail } from '@farm/shared-types';
import { dayRate } from '@farm/business-logic';
import { webApiClient } from '@farm/api-client';
import Modal, { FormError, FormFooter } from '@/components/sales/Modal';
import { inputCls, labelCls, tk, toDay, todayStr } from '@/components/sales/shared';
import { ChoiceChips } from '@/components/animals/shared';
import { balanceInfo } from './shared';

/** Shared submit plumbing: error text, busy flag, and onSaved with the response after success. */
function useSubmit<T = unknown>(onSaved: (result: T) => void) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function run(e: React.FormEvent, fn: () => Promise<T>) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      onSaved(await fn());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }
  return { error, loading, run };
}

const PAY_TYPES = [
  { value: 'monthly', label: 'Monthly salary' },
  { value: 'daily', label: 'Daily labour' },
] as const;

/** Add a worker, or edit one (a changed salary asks from which day it applies). */
export function WorkerFormModal({ worker, onClose, onSaved }: { worker?: Employee | null; onClose: () => void; onSaved: (w: WorkerDetail) => void }) {
  const editing = !!worker;
  const [form, setForm] = useState({
    name: worker?.name ?? '',
    role: worker?.role ?? '',
    phone: worker?.phone ?? '',
    payType: (worker?.payType ?? 'monthly') as 'monthly' | 'daily',
    salary: worker && worker.payType !== 'daily' ? String(worker.salary) : '',
    dailyRate: worker?.dailyRate != null ? String(worker.dailyRate) : '',
    joinDate: worker?.joinDate ? toDay(worker.joinDate) : todayStr(),
    rateFrom: todayStr(),
  });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const { error, loading, run } = useSubmit<WorkerDetail>(onSaved);

  const salary = parseFloat(form.salary);
  const rateChanged =
    editing &&
    (form.payType !== (worker!.payType ?? 'monthly') ||
      (form.payType === 'daily' ? parseFloat(form.dailyRate) !== worker!.dailyRate : salary !== worker!.salary));

  return (
    <Modal title={editing ? `Edit ${worker!.name}` : 'Add worker'} onClose={onClose}>
      <FormError message={error} />
      <form
        className="mt-4 space-y-4"
        onSubmit={(e) =>
          run(e, () => {
            const body = { ...form, rateFrom: rateChanged ? form.rateFrom : undefined };
            return editing
              ? webApiClient.put<WorkerDetail>(`/api/employees/${worker!.id}`, body, 'Failed to save worker')
              : webApiClient.post<WorkerDetail>('/api/employees', body, 'Failed to save worker');
          })
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="w-name" className={labelCls}>Name <span className="text-red-600">*</span></label>
            <input id="w-name" required autoFocus maxLength={100} value={form.name} onChange={(e) => set({ name: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label htmlFor="w-role" className={labelCls}>Work</label>
            <input id="w-role" placeholder="e.g. Milker, Cleaner" maxLength={100} value={form.role} onChange={(e) => set({ role: e.target.value })} className={inputCls} />
          </div>
        </div>

        <div>
          <span className={labelCls}>How is this worker paid?</span>
          <ChoiceChips label="Pay type" options={PAY_TYPES} value={form.payType} onChange={(v) => set({ payType: v })} />
        </div>

        {form.payType === 'monthly' ? (
          <div>
            <label htmlFor="w-salary" className={labelCls}>Monthly salary (৳) <span className="text-red-600">*</span></label>
            <input id="w-salary" type="number" required min="1" step="any" inputMode="decimal" placeholder="e.g. 18000" value={form.salary} onChange={(e) => set({ salary: e.target.value })} className={inputCls} />
            {salary > 0 && (
              <p className="mt-1 text-xs text-slate-500">
                {tk(dayRate(salary))} per day (salary ÷ 30). A 31-day month pays {tk(dayRate(salary) * 31)}, February {tk(dayRate(salary) * 28)}.
              </p>
            )}
          </div>
        ) : (
          <div>
            <label htmlFor="w-rate" className={labelCls}>Day rate (৳) <span className="text-red-600">*</span></label>
            <input id="w-rate" type="number" required min="1" step="any" inputMode="decimal" placeholder="e.g. 500" value={form.dailyRate} onChange={(e) => set({ dailyRate: e.target.value })} className={inputCls} />
            <p className="mt-1 text-xs text-slate-500">You add the days he works; pay = days × rate.</p>
          </div>
        )}

        {rateChanged && (
          <div className="rounded-control border border-amber-200 bg-amber-50 p-3">
            <label htmlFor="w-ratefrom" className={labelCls}>New pay applies from</label>
            <input id="w-ratefrom" type="date" required max={todayStr()} min={form.joinDate} value={form.rateFrom} onChange={(e) => set({ rateFrom: e.target.value })} className={inputCls} />
            <p className="mt-1 text-xs text-amber-800">Days before this keep the old pay.</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="w-join" className={labelCls}>Started on <span className="text-red-600">*</span></label>
            <input id="w-join" type="date" required max={todayStr()} value={form.joinDate} onChange={(e) => set({ joinDate: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label htmlFor="w-phone" className={labelCls}>Phone</label>
            <input id="w-phone" type="tel" inputMode="tel" placeholder="01XXXXXXXXX" value={form.phone} onChange={(e) => set({ phone: e.target.value })} className={inputCls} />
          </div>
        </div>

        <FormFooter onCancel={onClose} loading={loading} label={editing ? 'Save changes' : 'Add worker'} />
      </form>
    </Modal>
  );
}

/** Give money (any amount, any day), or fix a payment already given. */
export function WorkerPaymentModal({
  worker,
  payment,
  onClose,
  onSaved,
}: {
  worker: Pick<Employee, 'id' | 'name'> & { account: { balance: number } };
  payment?: SalaryPayment | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = !!payment;
  const [form, setForm] = useState({
    amount: payment ? String(payment.amount) : '',
    paidAt: payment ? toDay(payment.paidAt) : todayStr(),
    note: payment?.note ?? '',
  });
  const { error, loading, run } = useSubmit(onSaved);
  const owed = Math.max(0, worker.account.balance);
  const amount = parseFloat(form.amount) || 0;
  const after = worker.account.balance + (payment?.amount ?? 0) - amount;
  const chips = [500, 1000, 2000, ...(owed > 0 ? [owed] : [])];

  return (
    <Modal title={editing ? 'Edit payment' : `Pay ${worker.name}`} subtitle={editing ? undefined : balanceInfo(worker.account.balance).label} onClose={onClose}>
      <FormError message={error} />
      <form
        className="mt-4 space-y-4"
        onSubmit={(e) =>
          run(e, () =>
            editing
              ? webApiClient.put(`/api/salary-payments/${payment!.id}`, form, 'Failed to save payment')
              : webApiClient.post(`/api/employees/${worker.id}/payments`, form, 'Failed to save payment'),
          )
        }
      >
        <div>
          <label htmlFor="pay-amount" className={labelCls}>Amount (৳)</label>
          {!editing && (
            <div className="mb-2 flex flex-wrap gap-2">
              {chips.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setForm({ ...form, amount: String(c) })}
                  className={`rounded-control border px-3 py-1.5 text-xs font-semibold transition ${
                    amount === c ? 'border-slate-900 bg-ink text-white' : 'border-line bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {i === chips.length - 1 && owed > 0 ? `All due ${tk(c)}` : tk(c)}
                </button>
              ))}
            </div>
          )}
          <input id="pay-amount" type="number" required min="1" step="any" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={inputCls} />
          {amount > 0 && (
            <p className="mt-1 text-xs font-semibold text-slate-600" aria-live="polite">After this: {balanceInfo(after).label}</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="pay-date" className={labelCls}>Date</label>
            <input id="pay-date" type="date" required max={todayStr()} value={form.paidAt} onChange={(e) => setForm({ ...form, paidAt: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label htmlFor="pay-note" className={labelCls}>Note</label>
            <input id="pay-note" placeholder="e.g. Advance" maxLength={300} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className={inputCls} />
          </div>
        </div>
        <FormFooter onCancel={onClose} loading={loading} label={editing ? 'Save changes' : 'Save payment'} />
      </form>
    </Modal>
  );
}

/** Mark one day or a range of days absent (unpaid). */
export function AbsenceModal({ worker, onClose, onSaved }: { worker: Pick<Employee, 'id' | 'name' | 'salary'>; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ from: todayStr(), to: '', note: '' });
  const { error, loading, run } = useSubmit(onSaved);
  const days = form.to && form.to >= form.from ? Math.round((Date.parse(form.to) - Date.parse(form.from)) / 86_400_000) + 1 : 1;
  return (
    <Modal title={`${worker.name} was absent`} subtitle="Absent days are not paid" onClose={onClose}>
      <FormError message={error} />
      <form className="mt-4 space-y-4" onSubmit={(e) => run(e, () => webApiClient.post(`/api/employees/${worker.id}/absences`, form, 'Failed to save'))}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="abs-from" className={labelCls}>Day</label>
            <input id="abs-from" type="date" required value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label htmlFor="abs-to" className={labelCls}>To (if more days)</label>
            <input id="abs-to" type="date" min={form.from} value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} className={inputCls} />
          </div>
        </div>
        <div>
          <label htmlFor="abs-note" className={labelCls}>Reason</label>
          <input id="abs-note" placeholder="e.g. Went home, sick" maxLength={200} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className={inputCls} />
        </div>
        <p className="text-sm text-slate-600" aria-live="polite">
          {days} day{days === 1 ? '' : 's'} · {tk(dayRate(worker.salary) * days)} less pay
        </p>
        <FormFooter onCancel={onClose} loading={loading} label="Mark absent" />
      </form>
    </Modal>
  );
}

const DAY_CHIPS = [0.5, 1, 2, 3, 7];

/** Add (or fix) work done by a daily worker. */
export function WorkModal({
  worker,
  entry,
  onClose,
  onSaved,
}: {
  worker: Pick<Employee, 'id' | 'name' | 'dailyRate'>;
  entry?: { id: string; date: string | Date; days: number; rate: number; note: string | null } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = !!entry;
  const [form, setForm] = useState({
    date: entry ? toDay(entry.date) : todayStr(),
    days: entry ? String(entry.days) : '1',
    rate: String(entry?.rate ?? worker.dailyRate ?? ''),
    note: entry?.note ?? '',
  });
  const { error, loading, run } = useSubmit(onSaved);
  const total = (parseFloat(form.days) || 0) * (parseFloat(form.rate) || 0);
  return (
    <Modal title={editing ? 'Edit work' : `Add work for ${worker.name}`} onClose={onClose}>
      <FormError message={error} />
      <form
        className="mt-4 space-y-4"
        onSubmit={(e) =>
          run(e, () =>
            editing
              ? webApiClient.put(`/api/work-entries/${entry!.id}`, form, 'Failed to save work')
              : webApiClient.post(`/api/employees/${worker.id}/work`, form, 'Failed to save work'),
          )
        }
      >
        <div>
          <label htmlFor="work-days" className={labelCls}>Days worked</label>
          <div className="mb-2 flex flex-wrap gap-2">
            {DAY_CHIPS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setForm({ ...form, days: String(d) })}
                className={`rounded-control border px-3 py-1.5 text-xs font-semibold transition ${
                  parseFloat(form.days) === d ? 'border-slate-900 bg-ink text-white' : 'border-line bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {d === 0.5 ? 'Half day' : `${d} day${d === 1 ? '' : 's'}`}
              </button>
            ))}
          </div>
          <input id="work-days" type="number" required min="0.5" max="31" step="0.5" inputMode="decimal" value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="work-date" className={labelCls}>Date</label>
            <input id="work-date" type="date" required max={todayStr()} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label htmlFor="work-rate" className={labelCls}>Rate per day (৳)</label>
            <input id="work-rate" type="number" required min="1" step="any" inputMode="decimal" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} className={inputCls} />
          </div>
        </div>
        <div>
          <label htmlFor="work-note" className={labelCls}>Work done</label>
          <input id="work-note" placeholder="e.g. Grass cutting" maxLength={200} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className={inputCls} />
        </div>
        <p className="text-sm font-semibold text-slate-700" aria-live="polite">Earned: {tk(total)}</p>
        <FormFooter onCancel={onClose} loading={loading} label={editing ? 'Save changes' : 'Add work'} />
      </form>
    </Modal>
  );
}

/** Record the day a worker left (pay stops after it). */
export function LeaveModal({ worker, onClose, onSaved }: { worker: Pick<Employee, 'id' | 'name' | 'joinDate'>; onClose: () => void; onSaved: () => void }) {
  const [leftDate, setLeftDate] = useState(todayStr());
  const { error, loading, run } = useSubmit(onSaved);
  return (
    <Modal title={`${worker.name} left`} subtitle="Pay stops after the last day. You will see the final settlement." onClose={onClose}>
      <FormError message={error} />
      <form className="mt-4 space-y-4" onSubmit={(e) => run(e, () => webApiClient.post(`/api/employees/${worker.id}/leave`, { leftDate }, 'Failed to save'))}>
        <div>
          <label htmlFor="left-date" className={labelCls}>Last working day</label>
          <input
            id="left-date"
            type="date"
            required
            max={todayStr()}
            min={worker.joinDate ? toDay(worker.joinDate) : undefined}
            value={leftDate}
            onChange={(e) => setLeftDate(e.target.value)}
            className={inputCls}
          />
        </div>
        <FormFooter onCancel={onClose} loading={loading} label="Mark as left" />
      </form>
    </Modal>
  );
}
