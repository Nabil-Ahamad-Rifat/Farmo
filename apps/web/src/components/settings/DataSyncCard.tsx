"use client";

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DatabaseBackup, Download, FileSpreadsheet, HardDrive, RefreshCw, Upload, AlertTriangle } from 'lucide-react';
import {
  backupCounts,
  backupFileName,
  collectBackup,
  decryptBackup,
  describeCounts,
  encryptBackup,
  uploadRestore,
  validateBackup,
  type BackupFile,
  type BackupProgress,
} from '@farm/business-logic';
import { webApiClient } from '@farm/api-client';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useConfirm, useToast } from '@/components/ui/Feedback';
import Modal, { FormError } from '@/components/sales/Modal';
import { inputCls, labelCls, fmtDate } from '@/components/sales/shared';

interface Storage {
  farmBytes: number;
  photoBytes: number;
  photoCount: number;
  recordCount: number;
  dbBytes: number | null;
  limitBytes: number;
}

const mb = (n: number) => `${(n / (1024 * 1024)).toLocaleString('en-IN', { maximumFractionDigits: n < 10 * 1024 * 1024 ? 1 : 0 })} MB`;

const get = <T,>(path: string) => webApiClient.get<T>(path, 'Could not read the farm data');
const post = <T,>(path: string, body: unknown) => webApiClient.post<T>(path, body, 'The restore could not be completed');

function saveFile(bytes: Uint8Array | Blob, name: string, type = 'application/octet-stream') {
  const blob = bytes instanceof Blob ? bytes : new Blob([bytes as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Build the encrypted backup of the whole farm and download it. */
async function downloadBackup(password: string, onProgress: (p: BackupProgress) => void) {
  const backup = await collectBackup(get, onProgress);
  onProgress({ fraction: 1, label: 'Locking the file with your password…' });
  const file = await encryptBackup(JSON.stringify(backup), password);
  saveFile(file, backupFileName());
  return backup;
}

/** Settings → Data & sync: storage meter, backup, spreadsheets and restore (owner only). */
export default function DataSyncCard() {
  const toast = useToast();
  const [storage, setStorage] = useState<Storage | null>(null);
  const [modal, setModal] = useState<'backup' | 'restore' | null>(null);
  const [csvBusy, setCsvBusy] = useState(false);

  async function loadStorage() {
    try {
      setStorage(await get<Storage>('/api/backup/storage'));
    } catch {
      setStorage(null);
    }
  }
  useEffect(() => {
    // State is only set once the request settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadStorage();
  }, []);

  async function downloadCsv() {
    setCsvBusy(true);
    try {
      const res = await fetch('/api/backup/csv');
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? 'Could not build the spreadsheets');
      saveFile(await res.blob(), `Farm-sheets-${backupFileName().slice(12, 22)}.zip`);
      toast('Spreadsheets downloaded');
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setCsvBusy(false);
    }
  }

  const used = storage ? storage.dbBytes ?? storage.farmBytes : 0;
  const pct = storage ? Math.min(100, (used / storage.limitBytes) * 100) : 0;
  const warn = pct >= 80;

  return (
    <Card>
      <CardHeader Icon={DatabaseBackup} title="Data & sync" subtitle="The web app and the phone app use the same online records, so they always match." />
      <div className="space-y-6 px-5 py-5 sm:px-6">
        {/* Storage */}
        <div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 font-semibold text-ink">
              <HardDrive className="h-4 w-4 text-slate-500" aria-hidden="true" /> Storage used
            </span>
            <span className="tabular-nums text-slate-600">
              {storage ? `${mb(used)} of ${mb(storage.limitBytes)}` : '…'}
            </span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-slate-100" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Storage used">
            <div className={`h-2 rounded-full ${warn ? 'bg-amber-500' : 'bg-brand-600'}`} style={{ width: `${Math.max(pct, storage ? 1 : 0)}%` }} />
          </div>
          {storage && (
            <p className="mt-1.5 text-xs text-slate-500">
              This farm: {storage.recordCount.toLocaleString('en-IN')} records and {storage.photoCount} photos ({mb(storage.photoBytes)}).
            </p>
          )}
          {warn && (
            <p className="mt-2 flex items-start gap-2 rounded-control border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              The free database is {Math.round(pct)}% full. Download a backup, then delete old photos you don&apos;t need.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="grid gap-3 sm:grid-cols-3">
          <Action Icon={Download} title="Download backup" text="Everything, with photos, locked with a password." onClick={() => setModal('backup')} />
          <Action Icon={FileSpreadsheet} title="Spreadsheets (CSV)" text="Sales, customers, workers and more for Excel." onClick={downloadCsv} busy={csvBusy} />
          <Action Icon={Upload} title="Restore from backup" text="Replace this farm's records with a backup file." onClick={() => setModal('restore')} danger />
        </div>
      </div>

      {modal === 'backup' && (
        <BackupModal
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            toast('Backup downloaded. Keep the file and its password safe.');
          }}
        />
      )}
      {modal === 'restore' && (
        <RestoreModal
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            loadStorage();
          }}
        />
      )}
    </Card>
  );
}

function Action({
  Icon,
  title,
  text,
  onClick,
  busy,
  danger,
}: {
  Icon: typeof Download;
  title: string;
  text: string;
  onClick: () => void;
  busy?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`flex flex-col items-start gap-1 rounded-control border p-4 text-left transition-colors disabled:opacity-60 ${
        danger ? 'border-red-200 hover:bg-red-50' : 'border-line hover:bg-slate-50'
      }`}
    >
      <span className={`flex items-center gap-2 text-sm font-semibold ${danger ? 'text-red-700' : 'text-ink'}`}>
        {busy ? <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Icon className="h-4 w-4" aria-hidden="true" />}
        {title}
      </span>
      <span className="text-xs text-slate-500">{text}</span>
    </button>
  );
}

function ProgressBar({ progress }: { progress: BackupProgress | null }) {
  if (!progress) return null;
  return (
    <div className="mt-4" aria-live="polite">
      <div className="h-2 rounded-full bg-slate-100">
        <div className="h-2 rounded-full bg-brand-600 transition-all" style={{ width: `${Math.round(progress.fraction * 100)}%` }} />
      </div>
      <p className="mt-1.5 text-xs text-slate-500">{progress.label}</p>
    </div>
  );
}

function BackupModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<BackupProgress | null>(null);
  const busy = progress !== null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) return setError('Use a password of at least 8 characters');
    if (password !== again) return setError('The two passwords are different');
    setProgress({ fraction: 0, label: 'Starting…' });
    try {
      await downloadBackup(password, setProgress);
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setProgress(null);
    }
  }

  return (
    <Modal title="Download backup" subtitle="A copy of every record and photo, locked with a password." onClose={busy ? () => {} : onClose}>
      <FormError message={error} />
      <form onSubmit={submit} className="mt-4 space-y-4">
        <p className="rounded-control border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900">
          Without this password the backup can&apos;t be opened, not even by us. Write it down somewhere safe.
        </p>
        <div>
          <label htmlFor="bk-pass" className={labelCls}>Backup password</label>
          <input id="bk-pass" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label htmlFor="bk-pass2" className={labelCls}>Type it again</label>
          <input id="bk-pass2" type="password" autoComplete="new-password" required value={again} onChange={(e) => setAgain(e.target.value)} className={inputCls} />
        </div>
        <ProgressBar progress={progress} />
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" loading={busy}>Download backup</Button>
        </div>
      </form>
    </Modal>
  );
}

function RestoreModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [backup, setBackup] = useState<{ data: BackupFile; json: string } | null>(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<BackupProgress | null>(null);
  const busy = progress !== null;

  async function open(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!file) return setError('Choose the backup file');
    setProgress({ fraction: 0, label: 'Opening the backup…' });
    try {
      const json = await decryptBackup(new Uint8Array(await file.arrayBuffer()), password);
      const data = validateBackup(JSON.parse(json));
      setBackup({ data, json });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setProgress(null);
    }
  }

  async function restore() {
    if (!backup) return;
    const ok = await confirm({
      title: 'Replace all farm records with this backup?',
      body: 'Every sale, payment, animal, worker and feed record on this farm is replaced by the backup. Logins and your team stay. A backup of the farm as it is now downloads first, locked with the same password.',
      confirmLabel: 'Replace records',
      tone: 'danger',
    });
    if (!ok) return;
    setError('');
    try {
      setProgress({ fraction: 0, label: 'Saving a backup of the farm as it is now…' });
      await downloadBackup(password, (p) => setProgress({ fraction: p.fraction * 0.4, label: `Backup of the current farm: ${p.label}` }));
      const result = await uploadRestore(post, backup.json, (p) => setProgress({ fraction: 0.4 + p.fraction * 0.6, label: p.label }));
      toast(`Restored ${describeCounts(result.counts)}${result.skipped ? ` (${result.skipped} broken entries skipped)` : ''}`);
      router.refresh();
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setProgress(null);
    }
  }

  const counts = backup ? backupCounts(backup.data) : null;
  return (
    <Modal title="Restore from backup" subtitle="Replaces this farm's records. Logins and the team stay." onClose={busy ? () => {} : onClose}>
      <FormError message={error} />
      {!backup ? (
        <form onSubmit={open} className="mt-4 space-y-4">
          <div>
            <label htmlFor="rs-file" className={labelCls}>Backup file (.farmbackup)</label>
            <input
              ref={fileRef}
              id="rs-file"
              type="file"
              accept=".farmbackup,application/octet-stream"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className={`${inputCls} file:mr-3 file:rounded-control file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold`}
            />
          </div>
          <div>
            <label htmlFor="rs-pass" className={labelCls}>Backup password</label>
            <input id="rs-pass" type="password" autoComplete="off" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
          </div>
          <ProgressBar progress={progress} />
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button type="submit" loading={busy}>Open backup</Button>
          </div>
        </form>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="rounded-control border border-line bg-slate-50 px-4 py-3 text-sm">
            <p className="font-semibold text-ink">{backup.data.farm.name}</p>
            <p className="text-slate-500">Made {fmtDate(backup.data.exportedAt)}</p>
            <p className="mt-1 text-slate-700">{counts ? describeCounts(counts) : ''}</p>
          </div>
          <ProgressBar progress={progress} />
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button variant="danger" onClick={restore} loading={busy}>Restore this backup</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
