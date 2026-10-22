import { describe, it, expect } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  backupCounts,
  buildCsvZip,
  decryptBackup,
  encryptBackup,
  toCsv,
  validateBackup,
  type BackupFile,
} from './backup';

const sample: BackupFile = {
  format: BACKUP_FORMAT,
  version: BACKUP_VERSION,
  exportedAt: '2026-10-20T10:00:00.000Z',
  farm: { name: 'Green Valley Dairy', defaultMilkPrice: 70 },
  collections: {
    Customer: [{ id: 'c1', name: 'Rahim Dairy', type: 'regular' }],
    Sale: [{ id: 's1', customerId: 'c1', amount: 840, customerName: 'Rahim Dairy' }],
  },
  photos: [{ id: 'p1', cowId: 'cow1', mimeType: 'image/jpeg', width: 800, height: 600, caption: null, takenAt: '2026-10-20T10:00:00.000Z', data: 'AAAA' }],
};

describe('backup encryption', () => {
  it('round-trips the JSON with the right password', async () => {
    const json = JSON.stringify(sample);
    const file = await encryptBackup(json, 'correct horse');
    expect(strFromU8(file.subarray(0, 7))).toBe('FARMBK1');
    expect(await decryptBackup(file, 'correct horse')).toBe(json);
  });

  it('uses a fresh salt and nonce each time', async () => {
    const a = await encryptBackup('{}', 'password1');
    const b = await encryptBackup('{}', 'password1');
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
  });

  it('rejects a wrong password and a damaged file', async () => {
    const file = await encryptBackup(JSON.stringify(sample), 'correct horse');
    await expect(decryptBackup(file, 'wrong horse')).rejects.toThrow('Wrong password or damaged file');
    const damaged = file.slice();
    damaged[damaged.length - 1] ^= 0xff;
    await expect(decryptBackup(damaged, 'correct horse')).rejects.toThrow('Wrong password or damaged file');
    await expect(decryptBackup(new Uint8Array([1, 2, 3]), 'x')).rejects.toThrow('not a farm backup file');
  });

  it('refuses short passwords', async () => {
    await expect(encryptBackup('{}', 'short')).rejects.toThrow('at least 8');
  });
});

describe('validateBackup', () => {
  it('accepts a good backup and counts it', () => {
    const b = validateBackup(JSON.parse(JSON.stringify(sample)));
    expect(backupCounts(b)).toMatchObject({ Customer: 1, Sale: 1, Cow: 0, AnimalPhoto: 1 });
  });

  it('rejects other files, newer versions and damaged rows', () => {
    expect(() => validateBackup({ hello: 1 })).toThrow('not a farm backup');
    expect(() => validateBackup({ ...sample, version: BACKUP_VERSION + 1 })).toThrow('newer version');
    expect(() => validateBackup({ ...sample, collections: { Sale: [{ amount: 1 }] } })).toThrow('Sale records');
    expect(() => validateBackup({ ...sample, collections: { User: [] } })).toThrow('Unknown record type');
    expect(() => validateBackup({ ...sample, photos: [{ id: 'x' }] })).toThrow('photos are damaged');
  });
});

describe('CSV', () => {
  it('quotes commas, quotes and new lines, and starts with a BOM', () => {
    const csv = toCsv(
      [{ name: 'Rahim, "Dairy"', note: 'line1\nline2', amount: 840 }, { name: 'Karim', note: null, amount: 0 }],
      [
        { header: 'Name', value: (r) => r.name },
        { header: 'Note', value: (r) => r.note },
        { header: 'Amount (৳)', value: (r) => r.amount },
      ],
    );
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.slice(1)).toBe('Name,Note,Amount (৳)\r\n"Rahim, ""Dairy""","line1\nline2",840\r\nKarim,,0\r\n');
  });

  it('zips sheets that unzip back to the same text', () => {
    const zip = buildCsvZip({ sales: 'a,b\r\n', customers: 'c\r\n' });
    const files = unzipSync(zip);
    expect(Object.keys(files).sort()).toEqual(['customers.csv', 'sales.csv']);
    expect(strFromU8(files['sales.csv'])).toBe('a,b\r\n');
  });
});
