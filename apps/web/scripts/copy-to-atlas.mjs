// Copy the farm data from one MongoDB to another (e.g. the local DB on this
// PC → MongoDB Atlas) when going live. Ids are kept, so every link between
// records stays exactly as it was. Logins (users) are copied; sessions,
// tokens and other short-lived rows are not — everyone signs in again.
//
//   node scripts/copy-to-atlas.mjs                       dry run: shows what would be copied
//   node scripts/copy-to-atlas.mjs --apply               copy, then verify
//   node scripts/copy-to-atlas.mjs --verify              only compare source and target
//
// Env: SOURCE_DATABASE_URL (default: the local DB) and TARGET_DATABASE_URL (required).
// Safety: refuses to copy into a target that already has farms (Tenant rows)
// unless --allow-nonempty is given. Run `node scripts/db-indexes.mjs` against
// the target afterwards, and back up the source first.
//
// Uses Prisma raw commands (no MongoDB driver in this repo). Gotchas: never
// send/receive objects with a string "$type" key, and $regex filters don't work.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');

const args = new Set(process.argv.slice(2));
const APPLY = args.has('--apply');
const VERIFY_ONLY = args.has('--verify');
const ALLOW_NONEMPTY = args.has('--allow-nonempty');
const SOURCE = process.env.SOURCE_DATABASE_URL || 'mongodb://127.0.0.1:27018/farm-local?replicaSet=rs0';
const TARGET = process.env.TARGET_DATABASE_URL;

// Long-term data, in an order where parents come before children.
const COLLECTIONS = [
  'Tenant', 'User',
  'Customer', 'Supplier', 'Employee', 'Cow',
  'Sale', 'Payment',
  'FeedBatch', 'FeedUsage', 'SupplierPayment',
  'PayRate', 'EmployeeAbsence', 'WorkEntry', 'SalaryPayment',
  'AnimalPhoto', 'AnimalEvent',
  'OtherExpense', 'OtherIncome',
];
// Money fields summed per collection to prove nothing changed in transit.
const MONEY = {
  Sale: ['amount', 'paidAmount'],
  Payment: ['amount'],
  FeedBatch: ['quantity', 'unitPrice', 'paidAmount'],
  SupplierPayment: ['amount'],
  SalaryPayment: ['amount'],
  OtherExpense: ['amount'],
  OtherIncome: ['amount'],
  Employee: ['salary', 'dailyRate'],
  AnimalPhoto: ['size'],
  AnimalEvent: ['cost'],
};
const BATCH = 200;

if (!TARGET) {
  console.error('Set TARGET_DATABASE_URL to the Atlas connection string (it is never printed).');
  process.exit(1);
}
const hostOf = (url) => url.replace(/^mongodb(\+srv)?:\/\/[^@]*@/, '').split('/')[0];
if (hostOf(SOURCE) === hostOf(TARGET) && SOURCE.split('?')[0] === TARGET.split('?')[0]) {
  console.error('Source and target are the same database.');
  process.exit(1);
}

const src = new PrismaClient({ datasourceUrl: SOURCE });
const dst = new PrismaClient({ datasourceUrl: TARGET });

async function findAll(db, coll) {
  const out = [];
  let r = await db.$runCommandRaw({ find: coll, filter: {}, batchSize: BATCH });
  out.push(...r.cursor.firstBatch);
  let id = r.cursor.id;
  const idNum = (v) => (typeof v === 'object' && v !== null ? Number(v.$numberLong ?? 0) : Number(v));
  while (idNum(id) !== 0) {
    r = await db.$runCommandRaw({ getMore: id, collection: coll, batchSize: BATCH });
    out.push(...r.cursor.nextBatch);
    id = r.cursor.id;
  }
  return out;
}

const count = async (db, coll) => Number((await db.$runCommandRaw({ count: coll })).n ?? 0);
const num = (v) => (v == null ? 0 : typeof v === 'object' ? Number(v.$numberDouble ?? v.$numberInt ?? v.$numberLong ?? v.$numberDecimal ?? 0) : Number(v));

async function summary(db) {
  const s = {};
  for (const coll of COLLECTIONS) {
    const n = await count(db, coll);
    const fields = MONEY[coll];
    const sums = {};
    if (fields && n > 0) {
      const rows = await findAll(db, coll);
      for (const f of fields) sums[f] = Math.round(rows.reduce((t, r) => t + num(r[f]), 0) * 100) / 100;
    }
    s[coll] = { n, ...sums };
  }
  return s;
}

function compare(a, b) {
  const diffs = [];
  for (const coll of COLLECTIONS) {
    if (JSON.stringify(a[coll]) !== JSON.stringify(b[coll])) diffs.push(`${coll}: source ${JSON.stringify(a[coll])} vs target ${JSON.stringify(b[coll])}`);
  }
  return diffs;
}

async function main() {
  console.log('Source:', hostOf(SOURCE), '→ Target:', hostOf(TARGET));
  const before = await summary(src);
  console.table(Object.fromEntries(Object.entries(before).map(([k, v]) => [k, v])));

  if (VERIFY_ONLY) {
    const diffs = compare(before, await summary(dst));
    console.log(diffs.length ? 'DIFFERENT:\n' + diffs.join('\n') : 'VERIFIED: target matches source.');
    process.exitCode = diffs.length ? 2 : 0;
    return;
  }

  const targetFarms = await count(dst, 'Tenant');
  if (targetFarms > 0 && !ALLOW_NONEMPTY) {
    console.error(`Target already has ${targetFarms} farm(s). Refusing to copy (use --allow-nonempty only if you are sure).`);
    process.exitCode = 1;
    return;
  }
  if (!APPLY) {
    console.log('Dry run only. Re-run with --apply to copy.');
    return;
  }

  for (const coll of COLLECTIONS) {
    const rows = await findAll(src, coll);
    for (let i = 0; i < rows.length; i += BATCH) {
      // ordered:false so a re-run after a partial copy skips rows already there (duplicate _id) and carries on.
      const r = await dst.$runCommandRaw({ insert: coll, documents: rows.slice(i, i + BATCH), ordered: false }).catch((e) => {
        if (!String(e.message).includes('E11000')) throw e;
        return { n: 'some (duplicates skipped)' };
      });
      process.stdout.write(`${coll}: ${Math.min(i + BATCH, rows.length)}/${rows.length} (${r.n})\r`);
    }
    console.log(`${coll}: ${rows.length} copied`.padEnd(60));
  }

  const diffs = compare(before, await summary(dst));
  console.log(diffs.length ? 'COPIED BUT DIFFERENT:\n' + diffs.join('\n') : 'COPIED AND VERIFIED: every count and money total matches.');
  process.exitCode = diffs.length ? 2 : 0;
}

main()
  .catch((e) => {
    console.error(e.message ?? e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await src.$disconnect();
    await dst.$disconnect();
  });
