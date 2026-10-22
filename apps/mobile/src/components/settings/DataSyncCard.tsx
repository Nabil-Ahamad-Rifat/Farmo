import { useCallback, useEffect, useState } from 'react';
import { View, Pressable, ActivityIndicator } from 'react-native';
import { DatabaseBackup, Download, FileSpreadsheet, Upload, HardDrive, AlertTriangle, RefreshCw, Wifi, WifiOff, type LucideIcon } from 'lucide-react-native';
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
import { Text } from '@/src/components/ui/Text';
import { Button, Card, CardHeader, FormError, FormFooter, FormModal, TextField, useConfirm, useToast } from '@/src/components/ui';
import { useSyncStatus } from '@/src/lib/sync';
import { fmtDate } from '@/src/lib/format';
import { colors } from '@/src/theme';
import { backupBytes, backupGet, backupPost, pickBackupFile, shareFile } from './backupClient';

interface Storage {
  farmBytes: number;
  photoBytes: number;
  photoCount: number;
  recordCount: number;
  dbBytes: number | null;
  limitBytes: number;
}

const mb = (n: number) => `${(n / (1024 * 1024)).toLocaleString('en-IN', { maximumFractionDigits: n < 10 * 1024 * 1024 ? 1 : 0 })} MB`;

/** "2 min ago", "10:42", "20 Oct". */
function ago(iso: string | null) {
  if (!iso) return 'Not yet';
  const ms = Date.now() - Date.parse(iso);
  if (ms < 60_000) return 'Just now';
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)} min ago`;
  if (ms < 86_400_000) return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return fmtDate(iso);
}

async function makeBackupFile(password: string, onProgress: (p: BackupProgress) => void) {
  const backup = await collectBackup(backupGet, onProgress);
  onProgress({ fraction: 1, label: 'Locking the file with your password… (this can take a little while)' });
  const file = await encryptBackup(JSON.stringify(backup), password);
  await shareFile(file, backupFileName(), 'application/octet-stream');
}

/** Settings → Data & sync on the phone: sync status, storage, backup, spreadsheets, restore. Owner only. */
export function DataSyncCard() {
  const toast = useToast();
  const sync = useSyncStatus();
  const [storage, setStorage] = useState<Storage | null>(null);
  const [modal, setModal] = useState<'backup' | 'restore' | null>(null);
  const [csvBusy, setCsvBusy] = useState(false);

  const loadStorage = useCallback(async () => {
    try {
      setStorage(await backupGet<Storage>('/api/backup/storage'));
    } catch {
      setStorage(null);
    }
  }, []);
  useEffect(() => {
    // State is only set once the request settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadStorage();
  }, [loadStorage]);

  async function downloadCsv() {
    setCsvBusy(true);
    try {
      await shareFile(await backupBytes('/api/backup/csv'), `Farm-sheets-${backupFileName().slice(12, 22)}.zip`, 'application/zip');
      toast('Spreadsheets ready');
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
    <Card padded={false}>
      <CardHeader icon={DatabaseBackup} title="Data & sync" subtitle="The web app and this phone use the same online records, so they always match." />
      <View className="gap-5 p-4">
        {/* Sync */}
        <View className="gap-2">
          <View className="flex-row items-center justify-between gap-3">
            <View className="flex-row items-center gap-2">
              {sync.online ? <Wifi size={16} color={colors.brand600} /> : <WifiOff size={16} color={colors.amber700} />}
              <Text className={`text-sm font-semibold ${sync.online ? 'text-ink' : 'text-amber-800'}`}>{sync.online ? 'Online' : 'Offline'}</Text>
            </View>
            <Text className="text-xs text-slate-500">Last updated: {ago(sync.lastSyncedAt)}</Text>
          </View>
          <Text className="text-xs text-slate-500">
            {sync.pending > 0
              ? `${sync.pending} new entr${sync.pending === 1 ? 'y' : 'ies'} saved on this phone, waiting to upload.`
              : 'Nothing waiting to upload.'}
          </Text>
          <Button
            label={sync.syncing ? 'Syncing…' : 'Sync now'}
            icon={RefreshCw}
            variant="secondary"
            size="sm"
            loading={sync.syncing}
            onPress={() => sync.syncNow().then(() => toast(sync.online ? 'Up to date' : 'Still offline — will upload when back online', sync.online ? 'success' : 'info'))}
          />
          {sync.failed.map((f) => (
            <View key={f.id} className="gap-2 rounded-control border border-red-200 bg-red-50 p-3">
              <Text className="text-sm font-semibold text-red-800">{f.label}</Text>
              <Text className="text-xs text-red-700">{f.error}</Text>
              <View className="flex-row gap-2">
                <Button label="Retry" size="sm" variant="secondary" onPress={() => sync.retry(f.id)} />
                <Button label="Discard" size="sm" variant="dangerSoft" onPress={() => sync.discard(f.id)} />
              </View>
            </View>
          ))}
        </View>

        {/* Storage */}
        <View className="gap-1.5 border-t border-slate-100 pt-4">
          <View className="flex-row items-center justify-between gap-3">
            <View className="flex-row items-center gap-2">
              <HardDrive size={16} color={colors.slate500} />
              <Text className="text-sm font-semibold text-ink">Storage used</Text>
            </View>
            <Text className="text-xs text-slate-600">{storage ? `${mb(used)} of ${mb(storage.limitBytes)}` : '…'}</Text>
          </View>
          <View className="h-2 rounded-full bg-slate-100">
            <View className={`h-2 rounded-full ${warn ? 'bg-amber-500' : 'bg-brand-600'}`} style={{ width: `${Math.max(pct, storage ? 1 : 0)}%` }} />
          </View>
          {storage ? (
            <Text className="text-xs text-slate-500">
              This farm: {storage.recordCount.toLocaleString('en-IN')} records and {storage.photoCount} photos ({mb(storage.photoBytes)}).
            </Text>
          ) : null}
          {warn ? (
            <View className="flex-row items-start gap-2 rounded-control border border-amber-200 bg-amber-50 px-3 py-2">
              <AlertTriangle size={14} color={colors.amber700} />
              <Text className="flex-1 text-xs text-amber-900">
                The free database is {Math.round(pct)}% full. Download a backup, then delete old photos you don&apos;t need.
              </Text>
            </View>
          ) : null}
        </View>

        {/* Actions */}
        <View className="gap-2 border-t border-slate-100 pt-4">
          <Action icon={Download} title="Download backup" text="Everything, with photos, locked with a password." onPress={() => setModal('backup')} />
          <Action icon={FileSpreadsheet} title="Spreadsheets (CSV)" text="Sales, customers, workers and more for Excel." onPress={downloadCsv} busy={csvBusy} />
          <Action icon={Upload} title="Restore from backup" text="Replace this farm's records with a backup file." onPress={() => setModal('restore')} danger />
        </View>
      </View>

      {modal === 'backup' ? (
        <BackupModal
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            toast('Backup ready. Keep the file and its password safe.');
          }}
        />
      ) : null}
      {modal === 'restore' ? (
        <RestoreModal
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            loadStorage();
            sync.syncNow();
          }}
        />
      ) : null}
    </Card>
  );
}

function Action({ icon: Icon, title, text, onPress, busy, danger }: { icon: LucideIcon; title: string; text: string; onPress: () => void; busy?: boolean; danger?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      className={`gap-1 rounded-control border p-3.5 ${danger ? 'border-red-200' : 'border-line'} ${busy ? 'opacity-60' : ''}`}
    >
      <View className="flex-row items-center gap-2">
        {busy ? <ActivityIndicator size="small" /> : <Icon size={16} color={danger ? colors.red600 : colors.ink} />}
        <Text className={`text-sm font-semibold ${danger ? 'text-red-700' : 'text-ink'}`}>{title}</Text>
      </View>
      <Text className="text-xs text-slate-500">{text}</Text>
    </Pressable>
  );
}

function ProgressBar({ progress }: { progress: BackupProgress | null }) {
  if (!progress) return null;
  return (
    <View className="gap-1.5">
      <View className="h-2 rounded-full bg-slate-100">
        <View className="h-2 rounded-full bg-brand-600" style={{ width: `${Math.round(progress.fraction * 100)}%` }} />
      </View>
      <Text className="text-xs text-slate-500">{progress.label}</Text>
    </View>
  );
}

function BackupModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<BackupProgress | null>(null);
  const busy = progress !== null;

  async function submit() {
    setError('');
    if (password.length < 8) return setError('Use a password of at least 8 characters');
    if (password !== again) return setError('The two passwords are different');
    setProgress({ fraction: 0, label: 'Starting…' });
    try {
      await makeBackupFile(password, setProgress);
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setProgress(null);
    }
  }

  return (
    <FormModal
      visible
      title="Download backup"
      subtitle="A copy of every record and photo, locked with a password."
      onClose={busy ? () => {} : onClose}
      footer={<FormFooter onCancel={onClose} onSubmit={submit} loading={busy} label="Download backup" />}
    >
      <FormError message={error} />
      <View className="rounded-control border border-amber-200 bg-amber-50 px-3.5 py-2.5">
        <Text className="text-sm text-amber-900">Without this password the backup can&apos;t be opened, not even by us. Write it down somewhere safe.</Text>
      </View>
      <TextField label="Backup password" secureTextEntry autoCapitalize="none" value={password} onChangeText={setPassword} />
      <TextField label="Type it again" secureTextEntry autoCapitalize="none" value={again} onChangeText={setAgain} />
      <ProgressBar progress={progress} />
    </FormModal>
  );
}

function RestoreModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const confirm = useConfirm();
  const toast = useToast();
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array } | null>(null);
  const [password, setPassword] = useState('');
  const [backup, setBackup] = useState<{ data: BackupFile; json: string } | null>(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<BackupProgress | null>(null);
  const busy = progress !== null;

  async function choose() {
    setError('');
    try {
      const picked = await pickBackupFile();
      if (picked) setFile(picked);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function open() {
    setError('');
    if (!file) return setError('Choose the backup file');
    setProgress({ fraction: 0, label: 'Opening the backup…' });
    try {
      const json = await decryptBackup(file.bytes, password);
      setBackup({ data: validateBackup(JSON.parse(json)), json });
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
      message:
        'Every sale, payment, animal, worker and feed record on this farm is replaced by the backup. Logins and your team stay. A backup of the farm as it is now is made first, locked with the same password.',
      confirmLabel: 'Replace records',
      tone: 'danger',
    });
    if (!ok) return;
    setError('');
    try {
      setProgress({ fraction: 0, label: 'Saving a backup of the farm as it is now…' });
      await makeBackupFile(password, (p) => setProgress({ fraction: p.fraction * 0.4, label: `Backup of the current farm: ${p.label}` }));
      const result = await uploadRestore(backupPost, backup.json, (p) => setProgress({ fraction: 0.4 + p.fraction * 0.6, label: p.label }));
      toast(`Restored ${describeCounts(result.counts)}${result.skipped ? ` (${result.skipped} broken entries skipped)` : ''}`);
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setProgress(null);
    }
  }

  const counts = backup ? backupCounts(backup.data) : null;
  return (
    <FormModal
      visible
      title="Restore from backup"
      subtitle="Replaces this farm's records. Logins and the team stay."
      onClose={busy ? () => {} : onClose}
      footer={
        backup ? (
          <View className="flex-row gap-2">
            <Button label="Cancel" variant="secondary" size="lg" className="flex-1" onPress={onClose} disabled={busy} />
            <Button label="Restore this backup" variant="danger" size="lg" className="flex-[2]" loading={busy} onPress={restore} />
          </View>
        ) : (
          <FormFooter onCancel={onClose} onSubmit={open} loading={busy} label="Open backup" />
        )
      }
    >
      <FormError message={error} />
      {!backup ? (
        <>
          <View className="gap-2">
            <Text className="text-[13px] font-medium text-slate-700">Backup file (.farmbackup)</Text>
            <Button label={file ? file.name : 'Choose file'} icon={Upload} variant="secondary" onPress={choose} />
          </View>
          <TextField label="Backup password" secureTextEntry autoCapitalize="none" value={password} onChangeText={setPassword} />
        </>
      ) : (
        <View className="gap-1 rounded-control border border-line bg-slate-50 px-4 py-3">
          <Text className="text-sm font-semibold text-ink">{backup.data.farm.name}</Text>
          <Text className="text-xs text-slate-500">Made {fmtDate(backup.data.exportedAt)}</Text>
          <Text className="mt-1 text-sm text-slate-700">{counts ? describeCounts(counts) : ''}</Text>
        </View>
      )}
      <ProgressBar progress={progress} />
    </FormModal>
  );
}
