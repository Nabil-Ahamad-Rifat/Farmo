import { gcm } from '@noble/ciphers/aes.js';
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { deflateSync, inflateSync, strFromU8, strToU8, zipSync } from 'fflate';

// The farm backup file, shared by the web app, the mobile app and the API.
//
// A backup is a JSON document (BackupFile) that is compressed and then
// encrypted with a password the owner types, so a lost phone or a shared
// download link doesn't expose the farm's records:
//
//   "FARMBK1" | salt (16 bytes) | nonce (12 bytes) | AES-256-GCM(deflate(JSON))
//
// The key is PBKDF2-SHA256 of the password (210,000 rounds) and the salt.
// Logins, passwords and tokens are never part of a backup.

export const BACKUP_FORMAT = 'farm-backup';
export const BACKUP_VERSION = 1;
const MAGIC = 'FARMBK1';
const SALT_BYTES = 16;
const NONCE_BYTES = 12;
const PBKDF2_ROUNDS = 210_000;

/** Tenant collections in a backup, in the order they are restored (parents first). */
export const BACKUP_COLLECTIONS = [
  'Customer',
  'Supplier',
  'Employee',
  'Cow',
  'AnimalEvent',
  'FeedBatch',
  'FeedUsage',
  'Sale',
  'Payment',
  'SupplierPayment',
  'PayRate',
  'EmployeeAbsence',
  'WorkEntry',
  'SalaryPayment',
  'OtherExpense',
  'OtherIncome',
] as const;
export type BackupCollection = (typeof BACKUP_COLLECTIONS)[number];

export type BackupRow = Record<string, unknown> & { id: string };

export interface BackupPhoto {
  id: string;
  cowId: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  caption: string | null;
  takenAt: string;
  /** Image bytes, base64 without a data: prefix. */
  data: string;
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  farm: { name: string; defaultMilkPrice: number | null };
  collections: Partial<Record<BackupCollection, BackupRow[]>>;
  photos: BackupPhoto[];
}

/** Random bytes from the platform's secure generator (the mobile app installs one via expo-crypto). */
function randomBytes(n: number): Uint8Array {
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  // Never fall back to Math.random: a backup must not be encrypted with guessable salts or nonces.
  if (!c?.getRandomValues) throw new Error('This device cannot encrypt backups (no secure random source).');
  return c.getRandomValues(new Uint8Array(n));
}

function deriveKey(password: string, salt: Uint8Array) {
  return pbkdf2Async(sha256, strToU8(password), salt, { c: PBKDF2_ROUNDS, dkLen: 32, asyncTick: 20 });
}

/** Compress and encrypt a backup's JSON with the owner's password. */
export async function encryptBackup(json: string, password: string): Promise<Uint8Array> {
  if (password.length < 8) throw new Error('The backup password must be at least 8 characters');
  const salt = randomBytes(SALT_BYTES);
  const nonce = randomBytes(NONCE_BYTES);
  const key = await deriveKey(password, salt);
  const sealed = gcm(key, nonce).encrypt(deflateSync(strToU8(json), { level: 6 }));
  const magic = strToU8(MAGIC);
  const out = new Uint8Array(magic.length + SALT_BYTES + NONCE_BYTES + sealed.length);
  out.set(magic, 0);
  out.set(salt, magic.length);
  out.set(nonce, magic.length + SALT_BYTES);
  out.set(sealed, magic.length + SALT_BYTES + NONCE_BYTES);
  return out;
}

/** Decrypt a backup file back to its JSON text. Throws a readable error for a wrong password or a damaged file. */
export async function decryptBackup(file: Uint8Array, password: string): Promise<string> {
  const magic = strToU8(MAGIC);
  const head = magic.length + SALT_BYTES + NONCE_BYTES;
  if (file.length <= head || strFromU8(file.subarray(0, magic.length)) !== MAGIC) {
    throw new Error('This is not a farm backup file');
  }
  const salt = file.subarray(magic.length, magic.length + SALT_BYTES);
  const nonce = file.subarray(magic.length + SALT_BYTES, head);
  const key = await deriveKey(password, salt);
  let plain: Uint8Array;
  try {
    plain = gcm(key, nonce).decrypt(file.subarray(head));
  } catch {
    throw new Error('Wrong password or damaged file');
  }
  return strFromU8(inflateSync(plain));
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Check a parsed backup's shape and version. Returns it typed, or throws with what is wrong. */
export function validateBackup(value: unknown): BackupFile {
  if (!isObj(value) || value.format !== BACKUP_FORMAT) throw new Error('This is not a farm backup');
  if (typeof value.version !== 'number' || value.version > BACKUP_VERSION) {
    throw new Error('This backup was made by a newer version of the app. Please update the app first.');
  }
  if (!isObj(value.farm) || typeof value.farm.name !== 'string') throw new Error('The backup is missing the farm details');
  if (!isObj(value.collections)) throw new Error('The backup has no records');
  for (const [name, rows] of Object.entries(value.collections)) {
    if (!(BACKUP_COLLECTIONS as readonly string[]).includes(name)) throw new Error(`Unknown record type in backup: ${name}`);
    if (!Array.isArray(rows) || rows.some((r) => !isObj(r) || typeof r.id !== 'string')) {
      throw new Error(`The ${name} records in the backup are damaged`);
    }
  }
  if (!Array.isArray(value.photos)) throw new Error('The backup photos are damaged');
  for (const p of value.photos) {
    if (!isObj(p) || typeof p.id !== 'string' || typeof p.cowId !== 'string' || typeof p.data !== 'string') {
      throw new Error('The backup photos are damaged');
    }
  }
  return value as unknown as BackupFile;
}

/** Count of records per collection plus photos, e.g. for "Restored 120 sales…". */
export function backupCounts(b: BackupFile): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const name of BACKUP_COLLECTIONS) counts[name] = b.collections[name]?.length ?? 0;
  counts.AnimalPhoto = b.photos.length;
  return counts;
}

// ---- Spreadsheets -----------------------------------------------------------

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

function csvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\r\n]/.test(s) || /^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV text with a UTF-8 BOM so Excel shows ৳ and Bangla names correctly. */
export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines = [columns.map((c) => csvCell(c.header)).join(',')];
  for (const row of rows) lines.push(columns.map((c) => csvCell(c.value(row))).join(','));
  return '﻿' + lines.join('\r\n') + '\r\n';
}

/** Zip several CSV sheets into one file (name → CSV text). */
export function buildCsvZip(sheets: Record<string, string>): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  for (const [name, csv] of Object.entries(sheets)) files[name.endsWith('.csv') ? name : `${name}.csv`] = strToU8(csv);
  return zipSync(files, { level: 6 });
}

// ---- Client side: collect pages into one backup, upload a restore in parts ----

export interface BackupProgress {
  /** 0..1 */
  fraction: number;
  label: string;
}

interface ExportHeader {
  format: string;
  version: number;
  exportedAt: string;
  farm: BackupFile['farm'];
  collections: string[];
  counts: Record<string, number>;
}

/**
 * Fetch every page of the farm export (records, then photos) and join them
 * into one BackupFile. `get` is the app's authenticated JSON GET.
 */
export async function collectBackup(get: <T>(path: string) => Promise<T>, onProgress?: (p: BackupProgress) => void): Promise<BackupFile> {
  const head = await get<ExportHeader>('/api/backup/export?part=data');
  const total = Object.values(head.counts).reduce((s, n) => s + n, 0) || 1;
  let done = 0;
  const report = (label: string) => onProgress?.({ fraction: Math.min(1, done / total), label });
  const collections: BackupFile['collections'] = {};
  for (const name of BACKUP_COLLECTIONS) {
    const rows: BackupRow[] = [];
    let cursor: string | null = null;
    if (head.counts[name]) {
      do {
        const page: { rows: BackupRow[]; nextCursor: string | null } = await get(
          `/api/backup/export?part=rows&collection=${name}${cursor ? `&cursor=${cursor}` : ''}`
        );
        rows.push(...page.rows);
        done += page.rows.length;
        report(`Records: ${name}`);
        cursor = page.nextCursor;
      } while (cursor);
    }
    collections[name] = rows;
  }
  const photos: BackupPhoto[] = [];
  let cursor: string | null = null;
  if (head.counts.AnimalPhoto) {
    do {
      const page: { photos: BackupPhoto[]; nextCursor: string | null } = await get(`/api/backup/export?part=photos${cursor ? `&cursor=${cursor}` : ''}`);
      photos.push(...page.photos);
      done += page.photos.length;
      report(`Photos ${photos.length} of ${head.counts.AnimalPhoto}`);
      cursor = page.nextCursor;
    } while (cursor);
  }
  onProgress?.({ fraction: 1, label: 'Done' });
  return { format: BACKUP_FORMAT, version: head.version, exportedAt: head.exportedAt, farm: head.farm, collections, photos };
}

/** Upload size of one restore part (the server accepts up to 3.5 MB). */
export const RESTORE_PART_CHARS = 3_000_000;

/**
 * Upload a decrypted backup in parts and apply it. `post` is the app's
 * authenticated JSON POST. Resolves with what the server restored.
 */
export async function uploadRestore(
  post: <T>(path: string, body: unknown) => Promise<T>,
  json: string,
  onProgress?: (p: BackupProgress) => void
): Promise<{ counts: Record<string, number>; skipped: number }> {
  const { jobId } = await post<{ jobId: string }>('/api/backup/import', { action: 'start' });
  const parts = Math.max(1, Math.ceil(json.length / RESTORE_PART_CHARS));
  for (let i = 0; i < parts; i++) {
    await post('/api/backup/import', { action: 'part', jobId, part: i, data: json.slice(i * RESTORE_PART_CHARS, (i + 1) * RESTORE_PART_CHARS) });
    onProgress?.({ fraction: (i + 1) / (parts + 1), label: `Uploading ${i + 1} of ${parts}` });
  }
  onProgress?.({ fraction: parts / (parts + 1), label: 'Restoring records…' });
  const result = await post<{ counts: Record<string, number>; skipped: number }>('/api/backup/import', { action: 'commit', jobId, parts });
  onProgress?.({ fraction: 1, label: 'Done' });
  return result;
}

/** "Farm-backup-2026-10-20.farmbackup", dated on the farm's clock. */
export function backupFileName(now: Date = new Date()): string {
  return `Farm-backup-${new Date(now.getTime() + 6 * 3600 * 1000).toISOString().slice(0, 10)}.farmbackup`;
}

/** "120 sales, 30 customers, 4 animals…" for the restore toast. */
export function describeCounts(counts: Record<string, number>): string {
  const label: Record<string, string> = {
    Sale: 'sales', Customer: 'customers', Payment: 'payments', Supplier: 'suppliers', FeedBatch: 'feed purchases',
    Employee: 'workers', Cow: 'animals', AnimalEvent: 'animal records', AnimalPhoto: 'photos', OtherExpense: 'expenses', OtherIncome: 'income entries',
  };
  return Object.entries(label)
    .filter(([k]) => counts[k])
    .map(([k, l]) => `${counts[k]} ${l}`)
    .join(', ') || 'no records';
}
