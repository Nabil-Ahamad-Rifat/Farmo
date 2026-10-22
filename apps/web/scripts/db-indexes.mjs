// Creates the TTL indexes that keep short-lived rows from piling up in the
// database (Prisma's schema can't declare TTL indexes). Safe to run again.
//
//   DATABASE_URL="mongodb+srv://..." node apps/web/scripts/db-indexes.mjs
//
// Without DATABASE_URL it reads apps/web/.env, like migrate-customers.mjs.
//
// Note for $runCommandRaw: never send or read back an object with a string
// "$type" key (Prisma treats it as a tagged value) — and $regex filters don't
// work through it. Nothing here needs either.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(here, '..', 'package.json'));
const { PrismaClient } = require('@prisma/client');

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const env = readFileSync(join(here, '..', '.env'), 'utf8');
    const line = env.split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL='));
    if (line) return line.slice('DATABASE_URL='.length).replace(/^["']|["']$/g, '');
  } catch {
    // fall through
  }
  throw new Error('Set DATABASE_URL (or add it to apps/web/.env)');
}

const DAY = 24 * 60 * 60;

// collection, field, seconds after that field's time the row is deleted.
const TTL = [
  ['IdempotencyKey', 'createdAt', 7 * DAY], // replays of offline entries happen within days
  ['RefreshToken', 'expiresAt', 0],
  ['PasswordResetToken', 'createdAt', DAY], // links last 30 minutes
  ['RateLimit', 'expiresAt', 0],
  ['RevokedSession', 'expiresAt', 0],
  ['ImportStage', 'expiresAt', 0],
];

const db = new PrismaClient({ datasourceUrl: databaseUrl() });

async function existingIndexes(collection) {
  try {
    const r = await db.$runCommandRaw({ listIndexes: collection });
    return r.cursor.firstBatch;
  } catch {
    return []; // collection doesn't exist yet
  }
}

try {
  for (const [collection, field, seconds] of TTL) {
    const name = `${collection}_${field}_ttl`;
    const indexes = await existingIndexes(collection);
    const same = indexes.find((i) => i.name === name);
    if (same && Number(same.expireAfterSeconds) === seconds) {
      console.log(`ok       ${name} (${seconds}s)`);
      continue;
    }
    if (same) await db.$runCommandRaw({ dropIndexes: collection, index: name });
    // A plain (non-TTL) index on the same field would block creation.
    const plain = indexes.find((i) => i.name !== name && i.name !== '_id_' && Object.keys(i.key ?? {}).join() === field && i.expireAfterSeconds === undefined);
    if (plain) await db.$runCommandRaw({ dropIndexes: collection, index: plain.name });
    await db.$runCommandRaw({
      createIndexes: collection,
      indexes: [{ key: { [field]: 1 }, name, expireAfterSeconds: seconds }],
    });
    console.log(`created  ${name} (${seconds}s)`);
  }

  // `prisma db push` makes User.googleId a plain unique index, so a second
  // user without Google sign-in fails (both have no googleId). Make it a
  // partial index over string values only. $type 2 = BSON string (the word
  // form can't pass through $runCommandRaw, see above).
  const userIndexes = await existingIndexes('User');
  const googleIdx = userIndexes.find((i) => i.name === 'User_googleId_key');
  if (googleIdx && googleIdx.partialFilterExpression) {
    console.log('ok       User_googleId_key (partial)');
  } else {
    if (googleIdx) await db.$runCommandRaw({ dropIndexes: 'User', index: 'User_googleId_key' });
    await db.$runCommandRaw({
      createIndexes: 'User',
      indexes: [{ key: { googleId: 1 }, name: 'User_googleId_key', unique: true, partialFilterExpression: { googleId: { $type: 2 } } }],
    });
    console.log('created  User_googleId_key (partial, unique)');
  }
} finally {
  await db.$disconnect();
}
