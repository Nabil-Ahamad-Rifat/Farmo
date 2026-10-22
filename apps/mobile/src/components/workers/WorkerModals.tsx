import { useState } from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '@/src/components/ui/Text';
import type { Employee, SalaryPayment, WorkerDetail } from '@farm/shared-types';
import { dayRate } from '@farm/business-logic';
import { mobileApiClient } from '@/src/lib/apiClient';
import { generateIdempotencyKey } from '@/src/lib/idempotency';
import { tk, toDay, todayStr } from '@/src/lib/format';
import { FormModal, FormFooter, FormError, TextField, ChipGroup, DateField } from '@/src/components/ui';
import { balanceInfo } from './shared';

// Mobile versions of the web app's components/workers/WorkerModals.tsx. Each
// one is rendered only while open (the parent mounts it), so its form state
// starts fresh every time and needs no reset effect.

const ErrorBox = FormError;

/** Error text, busy flag and a runner that calls onSaved with the result after success. */
function useSubmit<T = unknown>(onSaved: (result: T) => void) {
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  async function run(fn: () => Promise<T>) {
    setError('');
    setSaving(true);
    try {
      onSaved(await fn());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return { error, setError, saving, run };
}

/** Quick-pick chips above an amount field. */
function QuickChips({ chips, value, onPick }: { chips: { value: number; label: string }[]; value: number; onPick: (v: number) => void }) {
  return (
    <View className="mt-2 flex-row flex-wrap gap-2">
      {chips.map((c, i) => (
        <Pressable
          key={i}
          onPress={() => onPick(c.value)}
          className={`rounded-control px-3.5 py-2.5 ${value === c.value ? 'bg-ink' : 'border border-line bg-white'}`}
        >
          <Text className={`text-sm font-semibold ${value === c.value ? 'text-white' : 'text-slate-600'}`}>{c.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const PAY_TYPES = [
  { value: 'monthly', label: 'Monthly salary' },
  { value: 'daily', label: 'Daily labour' },
];

/** Add a worker, or edit one (a changed pay asks from which day it applies). */
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
  const [key] = useState(generateIdempotencyKey);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const { error, setError, saving, run } = useSubmit<WorkerDetail>(onSaved);

  const salary = parseFloat(form.salary);
  const rate = parseFloat(form.dailyRate);
  const rateChanged =
    editing &&
    (form.payType !== (worker!.payType ?? 'monthly') || (form.payType === 'daily' ? rate !== worker!.dailyRate : salary !== worker!.salary));

  function save() {
    if (!form.name.trim()) return setError('Enter the name.');
    if (form.payType === 'monthly' ? !(salary > 0) : !(rate > 0)) {
      return setError(form.payType === 'monthly' ? 'Enter the monthly salary.' : 'Enter the day rate.');
    }
    const body = { ...form, rateFrom: rateChanged ? form.rateFrom : undefined };
    run(() =>
      editing
        ? mobileApiClient.put<WorkerDetail>(`/api/employees/${worker!.id}`, body, 'Failed to save worker')
        : mobileApiClient.post<WorkerDetail>('/api/employees', body, 'Failed to save worker', { idempotencyKey: key }),
    );
  }

  return (
    <FormModal
      visible
      title={editing ? `Edit ${worker!.name}` : 'Add worker'}
      onClose={onClose}
      footer={<FormFooter onCancel={onClose} onSubmit={save} loading={saving} label={editing ? 'Save changes' : 'Add worker'} />}
    >
      <ErrorBox message={error} />
      <TextField label="Name *" placeholder="e.g. Karim" value={form.name} onChangeText={(v) => set({ name: v })} />
      <TextField label="Work" placeholder="e.g. Milker, Cleaner" value={form.role} onChangeText={(v) => set({ role: v })} />
      <ChipGroup label="How is this worker paid?" options={PAY_TYPES} value={form.payType} onChange={(v) => set({ payType: v as 'monthly' | 'daily' })} />
      {form.payType === 'monthly' ? (
        <View>
          <TextField label="Monthly salary (৳)" placeholder="e.g. 18000" keyboardType="decimal-pad" value={form.salary} onChangeText={(v) => set({ salary: v })} />
          {salary > 0 ? (
            <Text className="mt-1 text-xs text-slate-500">
              {tk(dayRate(salary))} per day (salary ÷ 30). A 31-day month pays {tk(dayRate(salary) * 31)}, February {tk(dayRate(salary) * 28)}.
            </Text>
          ) : null}
        </View>
      ) : (
        <View>
          <TextField label="Day rate (৳)" placeholder="e.g. 500" keyboardType="decimal-pad" value={form.dailyRate} onChangeText={(v) => set({ dailyRate: v })} />
          <Text className="mt-1 text-xs text-slate-500">You add the days worked; pay = days × rate.</Text>
        </View>
      )}
      {rateChanged ? (
        <View className="gap-1 rounded-control border border-amber-200 bg-amber-50 p-3">
          <DateField label="New pay applies from" value={form.rateFrom} onChange={(v) => set({ rateFrom: v })} maxDate={new Date()} />
          <Text className="text-xs text-amber-800">Days before this keep the old pay.</Text>
        </View>
      ) : null}
      <DateField label="Started on" value={form.joinDate} onChange={(v) => set({ joinDate: v })} maxDate={new Date()} />
      <TextField label="Phone" placeholder="01XXXXXXXXX" keyboardType="phone-pad" value={form.phone} onChangeText={(v) => set({ phone: v })} />
    </FormModal>
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
  const [key] = useState(generateIdempotencyKey);
  const { error, setError, saving, run } = useSubmit(onSaved);
  const owed = Math.max(0, worker.account.balance);
  const amount = parseFloat(form.amount) || 0;
  const after = worker.account.balance + (payment?.amount ?? 0) - amount;
  const chips = [500, 1000, 2000].map((v) => ({ value: v, label: tk(v) }));
  if (owed > 0) chips.push({ value: owed, label: `All due ${tk(owed)}` });

  function save() {
    if (!(amount > 0)) return setError('Enter the amount.');
    run(() =>
      editing
        ? mobileApiClient.put(`/api/salary-payments/${payment!.id}`, form, 'Failed to save payment')
        : mobileApiClient.post(`/api/employees/${worker.id}/payments`, form, 'Failed to save payment', { idempotencyKey: key }),
    );
  }

  return (
    <FormModal
      visible
      title={editing ? 'Edit payment' : `Pay ${worker.name}`}
      subtitle={editing ? undefined : balanceInfo(worker.account.balance).label}
      onClose={onClose}
      footer={<FormFooter onCancel={onClose} onSubmit={save} loading={saving} label={editing ? 'Save changes' : 'Save payment'} />}
    >
      <ErrorBox message={error} />
      <View>
        <TextField label="Amount (৳)" keyboardType="decimal-pad" value={form.amount} onChangeText={(v) => setForm({ ...form, amount: v })} />
        {!editing ? <QuickChips chips={chips} value={amount} onPick={(v) => setForm({ ...form, amount: String(v) })} /> : null}
        {amount > 0 ? (
          <Text className="mt-2 text-sm text-slate-600">
            After this: <Text className={`font-semibold ${balanceInfo(after).text}`}>{balanceInfo(after).label}</Text>
          </Text>
        ) : null}
      </View>
      <DateField label="Date" value={form.paidAt} onChange={(v) => setForm({ ...form, paidAt: v })} maxDate={new Date()} />
      <TextField label="Note (optional)" placeholder="e.g. Advance" value={form.note} onChangeText={(v) => setForm({ ...form, note: v })} />
    </FormModal>
  );
}

/** Mark one day or a range of days absent (unpaid). Monthly workers only. */
export function AbsenceModal({ worker, onClose, onSaved }: { worker: Pick<Employee, 'id' | 'name' | 'salary'>; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ from: todayStr(), to: '', note: '' });
  const { error, saving, run } = useSubmit(onSaved);
  const days = form.to && form.to >= form.from ? Math.round((Date.parse(form.to) - Date.parse(form.from)) / 86_400_000) + 1 : 1;
  return (
    <FormModal
      visible
      title={`${worker.name} was absent`}
      subtitle="Absent days are not paid"
      onClose={onClose}
      footer={<FormFooter onCancel={onClose} onSubmit={() => run(() => mobileApiClient.post(`/api/employees/${worker.id}/absences`, form, 'Failed to save'))} loading={saving} label="Mark absent" />}
    >
      <ErrorBox message={error} />
      <DateField label="Day" value={form.from} onChange={(v) => setForm({ ...form, from: v })} />
      <View>
        <DateField label="To (if more days)" value={form.to} onChange={(v) => setForm({ ...form, to: v })} />
        {form.to ? (
          <Pressable onPress={() => setForm({ ...form, to: '' })} className="mt-1 self-start px-1 py-1">
            <Text className="text-xs font-semibold text-slate-500">Just one day</Text>
          </Pressable>
        ) : null}
      </View>
      <TextField label="Reason (optional)" placeholder="e.g. Went home, sick" value={form.note} onChangeText={(v) => setForm({ ...form, note: v })} />
      <Text className="text-sm text-slate-600">
        {days} day{days === 1 ? '' : 's'} · {tk(dayRate(worker.salary) * days)} less pay
      </Text>
    </FormModal>
  );
}

const DAY_CHIPS = [0.5, 1, 2, 3, 7].map((d) => ({ value: d, label: d === 0.5 ? 'Half day' : `${d} day${d === 1 ? '' : 's'}` }));

/** Add (or fix) work done by a daily worker. */
export function WorkModal({
  worker,
  entry,
  onClose,
  onSaved,
}: {
  worker: Pick<Employee, 'id' | 'name' | 'dailyRate'>;
  entry?: WorkerDetail['work'][number] | null;
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
  const [key] = useState(generateIdempotencyKey);
  const { error, saving, run } = useSubmit(onSaved);
  const total = (parseFloat(form.days) || 0) * (parseFloat(form.rate) || 0);
  const save = () =>
    run(() =>
      editing
        ? mobileApiClient.put(`/api/work-entries/${entry!.id}`, form, 'Failed to save work')
        : mobileApiClient.post(`/api/employees/${worker.id}/work`, form, 'Failed to save work', { idempotencyKey: key }),
    );
  return (
    <FormModal
      visible
      title={editing ? 'Edit work' : `Add work for ${worker.name}`}
      onClose={onClose}
      footer={<FormFooter onCancel={onClose} onSubmit={save} loading={saving} label={editing ? 'Save changes' : 'Add work'} />}
    >
      <ErrorBox message={error} />
      <View>
        <TextField label="Days worked" keyboardType="decimal-pad" value={form.days} onChangeText={(v) => setForm({ ...form, days: v })} />
        <QuickChips chips={DAY_CHIPS} value={parseFloat(form.days)} onPick={(v) => setForm({ ...form, days: String(v) })} />
      </View>
      <DateField label="Date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} maxDate={new Date()} />
      <TextField label="Rate per day (৳)" keyboardType="decimal-pad" value={form.rate} onChangeText={(v) => setForm({ ...form, rate: v })} />
      <TextField label="Work done (optional)" placeholder="e.g. Grass cutting" value={form.note} onChangeText={(v) => setForm({ ...form, note: v })} />
      <Text className="text-sm font-semibold text-slate-700">Earned: {tk(total)}</Text>
    </FormModal>
  );
}

/** Record the day a worker left (pay stops after it). */
export function LeaveModal({ worker, onClose, onSaved }: { worker: Pick<Employee, 'id' | 'name'>; onClose: () => void; onSaved: () => void }) {
  const [leftDate, setLeftDate] = useState(todayStr());
  const { error, saving, run } = useSubmit(onSaved);
  return (
    <FormModal
      visible
      title={`${worker.name} left`}
      subtitle="Pay stops after the last day. You will see the final settlement."
      onClose={onClose}
      footer={<FormFooter onCancel={onClose} onSubmit={() => run(() => mobileApiClient.post(`/api/employees/${worker.id}/leave`, { leftDate }, 'Failed to save'))} loading={saving} label="Mark as left" />}
    >
      <ErrorBox message={error} />
      <DateField label="Last working day" value={leftDate} onChange={setLeftDate} maxDate={new Date()} />
    </FormModal>
  );
}
