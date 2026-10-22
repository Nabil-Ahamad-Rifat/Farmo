import { randomBytes } from 'crypto';
import { Prisma } from '@prisma/client';
import {
  BACKUP_COLLECTIONS,
  BACKUP_FORMAT,
  BACKUP_VERSION,
  backupCounts,
  buildCsvZip,
  toCsv,
  validateBackup,
  type BackupCollection,
  type BackupFile,
  type BackupPhoto,
  type BackupRow,
} from '@farm/business-logic';
import { db } from '@/lib/db';
import { recomputeCustomer } from '@/lib/receivables';
import { recomputeSupplier } from '@/lib/payables';

// Export and restore of one farm's records (Settings → Data & sync).
// Vercel limits a request or response to 4.5 MB, so exports are paged and a
// restore is uploaded in parts (ImportStage) and applied on commit.

/** Keep every response or uploaded part well under Vercel's 4.5 MB cap. */
export const MAX_PAGE_BYTES = 3 * 1024 * 1024;
export const MAX_PART_CHARS = 3_500_000;
const ROW_PAGE = 2000;

type Collection = BackupCollection | 'AnimalPhoto';

// Prisma delegates by model name, typed loosely: every model is used the same way here.
type Delegate = {
  findMany(args: unknown): Promise<Record<string, unknown>[]>;
  createMany(args: unknown): Promise<{ count: number }>;
  deleteMany(args: unknown): Promise<{ count: number }>;
};
const delegates: Record<Collection, Delegate> = {
  Customer: db.customer,
  Supplier: db.supplier,
  Employee: db.employee,
  Cow: db.cow,
  AnimalPhoto: db.animalPhoto,
  AnimalEvent: db.animalEvent,
  FeedBatch: db.feedBatch,
  FeedUsage: db.feedUsage,
  Sale: db.sale,
  Payment: db.payment,
  SupplierPayment: db.supplierPayment,
  PayRate: db.payRate,
  EmployeeAbsence: db.employeeAbsence,
  WorkEntry: db.workEntry,
  SalaryPayment: db.salaryPayment,
  OtherExpense: db.otherExpense,
  OtherIncome: db.otherIncome,
} as unknown as Record<Collection, Delegate>;

/** Which rows of a collection belong to the farm (two reach the farm only through a parent). */
function farmWhere(collection: Collection, tenantId: string): Record<string, unknown> {
  if (collection === 'FeedUsage') return { feedBatch: { tenantId } };
  // Older salary payments have no tenantId; they belong to the farm through the worker.
  if (collection === 'SalaryPayment') return { OR: [{ tenantId }, { employee: { tenantId } }] };
  return { tenantId };
}

/** Scalar fields of each model (from the Prisma schema), so a restore never writes unknown fields. */
const scalarFields: Record<string, Set<string>> = Object.fromEntries(
  Prisma.dmmf.datamodel.models.map((m) => [m.name, new Set(m.fields.filter((f) => f.kind === 'scalar' || f.kind === 'enum').map((f) => f.name))])
);
const requiredFields: Record<string, Set<string>> = Object.fromEntries(
  Prisma.dmmf.datamodel.models.map((m) => [m.name, new Set(m.fields.filter((f) => f.kind === 'scalar' && f.isRequired).map((f) => f.name))])
);

/** References between records: field → the collection it points to. A restore gives every record a new id. */
const REFS: Partial<Record<Collection, Record<string, Collection>>> = {
  Cow: { motherId: 'Cow', mainPhotoId: 'AnimalPhoto' },
  AnimalEvent: { cowId: 'Cow', calfId: 'Cow' },
  FeedBatch: { supplierId: 'Supplier' },
  FeedUsage: { feedBatchId: 'FeedBatch' },
  Sale: { customerId: 'Customer', cowId: 'Cow' },
  Payment: { customerId: 'Customer' },
  SupplierPayment: { supplierId: 'Supplier' },
  PayRate: { employeeId: 'Employee' },
  EmployeeAbsence: { employeeId: 'Employee' },
  WorkEntry: { employeeId: 'Employee' },
  SalaryPayment: { employeeId: 'Employee' },
};

// ---- Export ------------------------------------------------------------------

export async function exportHeader(tenantId: string) {
  const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { name: true, defaultMilkPrice: true } });
  const counts: Record<string, number> = {};
  for (const c of BACKUP_COLLECTIONS) counts[c] = await (delegates[c] as unknown as { count(a: unknown): Promise<number> }).count({ where: farmWhere(c, tenantId) });
  counts.AnimalPhoto = await db.animalPhoto.count({ where: { tenantId } });
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    farm: { name: tenant?.name ?? 'Farm', defaultMilkPrice: tenant?.defaultMilkPrice ?? null },
    collections: BACKUP_COLLECTIONS,
    counts,
  };
}

/** One page of a collection's records, oldest id first. */
export async function exportRows(tenantId: string, collection: BackupCollection, cursor: string | null) {
  const rows = await delegates[collection].findMany({
    where: { AND: [farmWhere(collection, tenantId), cursor ? { id: { gt: cursor } } : {}] },
    orderBy: { id: 'asc' },
    take: ROW_PAGE,
  });
  // Stop a page early if it is getting big (long notes); the next page carries on.
  let bytes = 0;
  let end = rows.length;
  for (let i = 0; i < rows.length; i++) {
    bytes += JSON.stringify(rows[i]).length;
    if (bytes > MAX_PAGE_BYTES && i > 0) {
      end = i;
      break;
    }
  }
  const page = rows.slice(0, end);
  const more = end < rows.length || rows.length === ROW_PAGE;
  return { rows: page, nextCursor: more && page.length ? String(page[page.length - 1].id) : null };
}

/** One page of photos (with image data), each page about 3 MB of base64 at most. */
export async function exportPhotos(tenantId: string, cursor: string | null) {
  const metas = await db.animalPhoto.findMany({
    where: { tenantId, ...(cursor ? { id: { gt: cursor } } : {}) },
    orderBy: { id: 'asc' },
    take: 200,
    select: { id: true, size: true },
  });
  const ids: string[] = [];
  let bytes = 0;
  for (const m of metas) {
    const b64 = Math.ceil(m.size / 3) * 4;
    if (ids.length > 0 && bytes + b64 > MAX_PAGE_BYTES) break;
    ids.push(m.id);
    bytes += b64;
  }
  const rows = ids.length
    ? await db.animalPhoto.findMany({ where: { id: { in: ids } }, orderBy: { id: 'asc' } })
    : [];
  const photos: BackupPhoto[] = rows.map((p) => ({
    id: p.id,
    cowId: p.cowId,
    mimeType: p.mimeType,
    width: p.width,
    height: p.height,
    caption: p.caption,
    takenAt: p.takenAt.toISOString(),
    data: Buffer.from(p.data).toString('base64'),
  }));
  const more = metas.length > ids.length || metas.length === 200;
  return { photos, nextCursor: more && photos.length ? photos[photos.length - 1].id : null };
}

// ---- Storage -----------------------------------------------------------------

/** About 512 MB on the free MongoDB Atlas cluster. */
export const STORAGE_LIMIT_BYTES = 512 * 1024 * 1024;

const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'object' && v !== null ? Number(Object.values(v)[0]) : 0);

export async function storageInfo(tenantId: string) {
  const photos = await db.animalPhoto.aggregate({ where: { tenantId }, _sum: { size: true }, _count: true });
  let records = 0;
  for (const c of BACKUP_COLLECTIONS) records += await (delegates[c] as unknown as { count(a: unknown): Promise<number> }).count({ where: farmWhere(c, tenantId) });
  let dbBytes: number | null = null;
  try {
    // dbStats has no "$type" keys, which Prisma's raw-command parser can't read.
    const stats = (await db.$runCommandRaw({ dbStats: 1, scale: 1 })) as Record<string, unknown>;
    dbBytes = num(stats.dataSize) + num(stats.indexSize);
  } catch (err) {
    console.error('dbStats failed:', err);
  }
  const photoBytes = photos._sum.size ?? 0;
  return {
    // Records average a few hundred bytes each; photos are counted exactly.
    farmBytes: photoBytes + records * 400,
    photoBytes,
    photoCount: photos._count,
    recordCount: records,
    dbBytes,
    limitBytes: STORAGE_LIMIT_BYTES,
  };
}

// ---- Spreadsheets ------------------------------------------------------------

const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : '');

/** A zip of readable CSV sheets (no photos), for Excel or the accountant. */
export async function buildCsvExport(tenantId: string): Promise<Uint8Array> {
  const where = { tenantId };
  const [customers, sales, payments, suppliers, feed, supplierPayments, workers, workerPayments, expenses, income, cows, events] = await Promise.all([
    db.customer.findMany({ where, orderBy: { name: 'asc' } }),
    db.sale.findMany({ where, orderBy: { createdAt: 'asc' } }),
    db.payment.findMany({ where, orderBy: { paidAt: 'asc' }, include: { customer: { select: { name: true } } } }),
    db.supplier.findMany({ where, orderBy: { name: 'asc' } }),
    db.feedBatch.findMany({ where, orderBy: { createdAt: 'asc' }, include: { supplier: { select: { name: true } } } }),
    db.supplierPayment.findMany({ where, orderBy: { paidAt: 'asc' }, include: { supplier: { select: { name: true } } } }),
    db.employee.findMany({ where, orderBy: { name: 'asc' } }),
    db.salaryPayment.findMany({ where: farmWhere('SalaryPayment', tenantId), orderBy: { paidAt: 'asc' }, include: { employee: { select: { name: true } } } }),
    db.otherExpense.findMany({ where, orderBy: { expenseDate: 'asc' } }),
    db.otherIncome.findMany({ where, orderBy: { incomeDate: 'asc' } }),
    db.cow.findMany({ where, orderBy: { tagNumber: 'asc' } }),
    db.animalEvent.findMany({ where, orderBy: { date: 'asc' }, include: { cow: { select: { tagNumber: true, name: true } } } }),
  ]);
  const customerName = new Map(customers.map((c) => [c.id, c.name]));

  return buildCsvZip({
    customers: toCsv(customers, [
      { header: 'Name', value: (r) => r.name },
      { header: 'Type', value: (r) => (r.type === 'regular' ? 'Regular' : 'New') },
      { header: 'Phone', value: (r) => r.phone },
      { header: 'Address', value: (r) => r.address },
      { header: 'Notes', value: (r) => r.notes },
    ]),
    sales: toCsv(sales, [
      { header: 'Date', value: (r) => day(r.createdAt) },
      { header: 'Customer', value: (r) => (r.customerId ? customerName.get(r.customerId) : null) ?? r.customerName },
      { header: 'Product', value: (r) => (r.saleType === 'milk' ? 'Milk' : r.saleType === 'cow_sale' ? 'Cow' : 'Other') },
      { header: 'Quantity', value: (r) => r.quantity },
      { header: 'Price per unit (Tk)', value: (r) => r.unitPrice },
      { header: 'Amount (Tk)', value: (r) => r.amount },
      { header: 'Paid (Tk)', value: (r) => (r.customerId ? r.paidAmount ?? 0 : r.status === 'paid' ? r.amount : 0) },
      { header: 'Status', value: (r) => r.status },
      { header: 'Notes', value: (r) => r.notes },
    ]),
    payments: toCsv(payments, [
      { header: 'Date', value: (r) => day(r.paidAt) },
      { header: 'Customer', value: (r) => r.customer.name },
      { header: 'Amount (Tk)', value: (r) => r.amount },
      { header: 'Method', value: (r) => r.method },
      { header: 'Note', value: (r) => r.note },
    ]),
    suppliers: toCsv(suppliers, [
      { header: 'Name', value: (r) => r.name },
      { header: 'Phone', value: (r) => r.phone },
      { header: 'Address', value: (r) => r.address },
      { header: 'Notes', value: (r) => r.notes },
    ]),
    feed: toCsv(feed, [
      { header: 'Bought on', value: (r) => day(r.purchasedAt ?? r.createdAt) },
      { header: 'Feed', value: (r) => r.name },
      { header: 'Supplier', value: (r) => r.supplier?.name },
      { header: 'Quantity (kg)', value: (r) => r.quantity },
      { header: 'Price per kg (Tk)', value: (r) => r.unitPrice },
      { header: 'Total (Tk)', value: (r) => Math.round(r.quantity * r.unitPrice * 100) / 100 },
      { header: 'Paid (Tk)', value: (r) => r.paidAmount },
      { header: 'Days it lasts', value: (r) => r.coverDays },
    ]),
    'supplier-payments': toCsv(supplierPayments, [
      { header: 'Date', value: (r) => day(r.paidAt) },
      { header: 'Supplier', value: (r) => r.supplier.name },
      { header: 'Amount (Tk)', value: (r) => r.amount },
      { header: 'Method', value: (r) => r.method },
      { header: 'Note', value: (r) => r.note },
    ]),
    workers: toCsv(workers, [
      { header: 'Name', value: (r) => r.name },
      { header: 'Work', value: (r) => r.role },
      { header: 'Pay type', value: (r) => (r.payType === 'daily' ? 'Daily' : 'Monthly') },
      { header: 'Monthly salary (Tk)', value: (r) => (r.payType === 'daily' ? null : r.salary) },
      { header: 'Day rate (Tk)', value: (r) => r.dailyRate },
      { header: 'Started', value: (r) => day(r.joinDate) },
      { header: 'Left', value: (r) => day(r.leftDate) },
      { header: 'Phone', value: (r) => r.phone },
    ]),
    'worker-payments': toCsv(workerPayments, [
      { header: 'Date', value: (r) => day(r.paidAt) },
      { header: 'Worker', value: (r) => r.employee.name },
      { header: 'Kind', value: (r) => (r.kind === 'writeoff' ? 'Written off' : 'Payment') },
      { header: 'Amount (Tk)', value: (r) => r.amount },
      { header: 'Note', value: (r) => r.note },
    ]),
    expenses: toCsv(expenses, [
      { header: 'Date', value: (r) => day(r.expenseDate) },
      { header: 'Description', value: (r) => r.description },
      { header: 'Category', value: (r) => r.category },
      { header: 'Amount (Tk)', value: (r) => r.amount },
    ]),
    income: toCsv(income, [
      { header: 'Date', value: (r) => day(r.incomeDate) },
      { header: 'Description', value: (r) => r.description },
      { header: 'Category', value: (r) => r.category },
      { header: 'Amount (Tk)', value: (r) => r.amount },
    ]),
    animals: toCsv(cows, [
      { header: 'Cow ID', value: (r) => r.tagNumber },
      { header: 'Name', value: (r) => r.name },
      { header: 'Status', value: (r) => r.status },
      { header: 'Gender', value: (r) => r.gender },
      { header: 'Type', value: (r) => r.category },
      { header: 'Breed', value: (r) => r.breed },
      { header: 'Colour', value: (r) => r.color },
      { header: 'Born', value: (r) => day(r.birthDate) },
      { header: 'From', value: (r) => r.source },
      { header: 'Bought on', value: (r) => day(r.purchaseDate) },
      { header: 'Price (Tk)', value: (r) => r.purchasePrice },
      { header: 'Notes', value: (r) => r.notes },
    ]),
    'animal-records': toCsv(events, [
      { header: 'Date', value: (r) => day(r.date) },
      { header: 'Cow ID', value: (r) => r.cow.tagNumber },
      { header: 'Animal', value: (r) => r.cow.name },
      { header: 'Record', value: (r) => r.type },
      { header: 'Title', value: (r) => r.title },
      { header: 'Result', value: (r) => r.result },
      { header: 'Weight (kg)', value: (r) => (r.type === 'weight' ? r.value : null) },
      { header: 'Cost (Tk)', value: (r) => r.cost },
      { header: 'Next due', value: (r) => day(r.nextDueDate) },
      { header: 'Notes', value: (r) => r.notes },
    ]),
  });
}

// ---- Restore -----------------------------------------------------------------

/** A new MongoDB ObjectId (4-byte time + 8 random bytes), so references can be remapped before inserting. */
function newObjectId(): string {
  const time = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
  return time + randomBytes(8).toString('hex');
}

export function newJobId() {
  return randomBytes(12).toString('hex');
}

export async function stagePart(tenantId: string, jobId: string, part: number, data: string) {
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await db.importStage.upsert({
    where: { jobId_part: { jobId, part } },
    create: { tenantId, jobId, part, data, expiresAt },
    update: { data, expiresAt, tenantId },
  });
}

export async function clearStage(tenantId: string, jobId?: string) {
  await db.importStage.deleteMany({ where: jobId ? { tenantId, jobId } : { tenantId } });
}

/** Read the uploaded parts back into one backup, checking none are missing. */
export async function loadStaged(tenantId: string, jobId: string, parts: number): Promise<BackupFile> {
  const rows = await db.importStage.findMany({ where: { tenantId, jobId }, orderBy: { part: 'asc' }, select: { part: true, data: true } });
  if (rows.length !== parts || rows.some((r, i) => r.part !== i)) {
    throw new RestoreError('Some parts of the backup did not arrive. Please try the restore again.');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rows.map((r) => r.data).join(''));
  } catch {
    throw new RestoreError('The backup could not be read. Please try the restore again.');
  }
  try {
    return validateBackup(parsed);
  } catch (err) {
    throw new RestoreError((err as Error).message);
  }
}

/** An error whose message is safe to show the owner. */
export class RestoreError extends Error {}

type IdMaps = Record<Collection, Map<string, string>>;

/** Turn backup rows into rows for this farm: new ids, remapped references, only known fields. */
function prepareRows(collection: BackupCollection, rows: BackupRow[], maps: IdMaps, tenantId: string, userId: string, jobTag: string) {
  const allowed = scalarFields[collection];
  const required = requiredFields[collection];
  const refs = REFS[collection] ?? {};
  const out: Record<string, unknown>[] = [];
  let skipped = 0;
  for (const row of rows) {
    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) if (allowed.has(k) && k !== 'id') data[k] = v;
    data.id = maps[collection].get(row.id);
    if (allowed.has('tenantId')) data.tenantId = tenantId;
    if (allowed.has('createdById')) data.createdById = userId;
    let ok = true;
    for (const [field, target] of Object.entries(refs)) {
      const old = row[field];
      if (old === null || old === undefined || old === '') {
        data[field] = null;
        continue;
      }
      const mapped = maps[target].get(String(old));
      if (mapped) data[field] = mapped;
      else if (required.has(field)) ok = false;
      else data[field] = null;
    }
    // Cow IDs are unique per farm and the old animals still exist until the
    // new copy is in, so new animals get a temporary tag until the swap.
    if (collection === 'Cow') data.tagNumber = `${String(row.tagNumber ?? '')}~${jobTag}`;
    if (ok) out.push(data);
    else skipped++;
  }
  return { rows: out, skipped };
}

async function insertBatches(collection: Collection, rows: Record<string, unknown>[], batchBytes = 4 * 1024 * 1024) {
  let batch: Record<string, unknown>[] = [];
  let bytes = 0;
  for (const row of rows) {
    const size = collection === 'AnimalPhoto' ? ((row.data as Buffer)?.length ?? 0) : 400;
    if (batch.length && (batch.length >= 500 || bytes + size > batchBytes)) {
      await delegates[collection].createMany({ data: batch });
      batch = [];
      bytes = 0;
    }
    batch.push(row);
    bytes += size;
  }
  if (batch.length) await delegates[collection].createMany({ data: batch });
}

/** Records removed before the new copy goes in (children first, like account deletion). */
const DELETE_ORDER: Collection[] = [
  'Sale', 'Payment', 'Customer',
  'SalaryPayment', 'PayRate', 'EmployeeAbsence', 'WorkEntry', 'Employee',
  'AnimalEvent', 'AnimalPhoto', 'Cow',
  'FeedUsage', 'FeedBatch', 'SupplierPayment', 'Supplier',
  'OtherExpense', 'OtherIncome',
];

async function idsOf(collection: Collection, tenantId: string): Promise<string[]> {
  const rows = await delegates[collection].findMany({ where: farmWhere(collection, tenantId), select: { id: true } });
  return rows.map((r) => String(r.id));
}

async function deleteIds(collection: Collection, ids: string[]) {
  for (let i = 0; i < ids.length; i += 1000) {
    await delegates[collection].deleteMany({ where: { id: { in: ids.slice(i, i + 1000) } } });
  }
}

/**
 * Replace this farm's records with the backup's. Logins and the team stay.
 *
 * Safe order: the new copy is inserted next to the old records (all with new
 * ids); if anything fails, the inserted rows are removed again and the farm is
 * unchanged. Only when the whole copy is in are the old records deleted.
 */
export async function restoreBackup(tenantId: string, userId: string, backup: BackupFile) {
  const jobTag = `restore-${randomBytes(3).toString('hex')}`;
  const all: Collection[] = [...BACKUP_COLLECTIONS, 'AnimalPhoto'];
  const maps = Object.fromEntries(all.map((c) => [c, new Map<string, string>()])) as IdMaps;
  for (const c of BACKUP_COLLECTIONS) for (const row of backup.collections[c] ?? []) maps[c].set(row.id, newObjectId());
  for (const p of backup.photos) maps.AnimalPhoto.set(p.id, newObjectId());

  // Old records, so they can be removed once the new copy is in.
  const oldIds = Object.fromEntries(await Promise.all(all.map(async (c) => [c, await idsOf(c, tenantId)] as const))) as Record<Collection, string[]>;

  const inserted: Partial<Record<Collection, string[]>> = {};
  let skipped = 0;
  try {
    for (const c of BACKUP_COLLECTIONS) {
      const prepared = prepareRows(c, backup.collections[c] ?? [], maps, tenantId, userId, jobTag);
      skipped += prepared.skipped;
      await insertBatches(c, prepared.rows);
      inserted[c] = prepared.rows.map((r) => String(r.id));
      if (c === 'Cow') {
        // Photos right after their animals.
        const photos = backup.photos
          .filter((p) => maps.Cow.has(p.cowId))
          .map((p) => {
            const data = Buffer.from(p.data, 'base64');
            return {
              id: maps.AnimalPhoto.get(p.id),
              cowId: maps.Cow.get(p.cowId),
              tenantId,
              data,
              size: data.length,
              mimeType: p.mimeType || 'image/jpeg',
              width: p.width ?? null,
              height: p.height ?? null,
              caption: p.caption ?? null,
              takenAt: p.takenAt,
            };
          });
        skipped += backup.photos.length - photos.length;
        await insertBatches('AnimalPhoto', photos);
        inserted.AnimalPhoto = photos.map((p) => String(p.id));
      }
    }
  } catch (err) {
    console.error('Restore failed while inserting; removing the partial copy:', err);
    for (const c of [...DELETE_ORDER]) if (inserted[c]?.length) await deleteIds(c, inserted[c]!).catch(() => {});
    throw new RestoreError('The restore could not be completed. Nothing was changed; please try again.');
  }

  // The new copy is complete: remove the old records.
  await db.cow.updateMany({ where: { id: { in: oldIds.Cow } }, data: { motherId: null } });
  for (const c of DELETE_ORDER) await deleteIds(c, oldIds[c]);
  await db.idempotencyKey.deleteMany({ where: { tenantId } });

  // Give the animals their real Cow IDs back.
  for (const row of backup.collections.Cow ?? []) {
    const id = maps.Cow.get(row.id);
    if (id && inserted.Cow?.includes(id)) await db.cow.update({ where: { id }, data: { tagNumber: String(row.tagNumber ?? '') } });
  }

  await db.tenant.update({
    where: { id: tenantId },
    data: { name: backup.farm.name || undefined, defaultMilkPrice: backup.farm.defaultMilkPrice ?? null },
  });

  // Paid amounts and statuses are worked out again from the payments, never trusted from the file.
  for (const id of inserted.Customer ?? []) await recomputeCustomer(db, tenantId, id);
  for (const id of inserted.Supplier ?? []) await recomputeSupplier(db, tenantId, id);

  return { counts: backupCounts(backup), skipped };
}
