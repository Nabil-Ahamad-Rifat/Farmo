import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

function readDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return { url: process.env.DATABASE_URL, source: 'process environment' };
  }

  for (const file of ['.env.local', '.env']) {
    try {
      const contents = readFileSync(resolve(file), 'utf8');
      const line = contents.split(/\r?\n/).find((entry) => /^\s*DATABASE_URL\s*=/.test(entry));
      if (!line) continue;

      const value = line.replace(/^\s*DATABASE_URL\s*=\s*/, '').trim();
      const url = value.startsWith('"') && value.endsWith('"')
        ? value.slice(1, -1)
        : value.startsWith("'") && value.endsWith("'")
          ? value.slice(1, -1)
          : value.split(/\s+#/, 1)[0];

      if (url) return { url, source: file };
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  throw new Error('DATABASE_URL is missing. Set it in apps/web/.env.local or apps/web/.env.');
}

const { url, source } = readDatabaseUrl();
const database = new PrismaClient({ datasourceUrl: url });
const target = url.startsWith('mongodb+srv://') ? 'MongoDB Atlas' : 'MongoDB';

console.log(`Checking ${target} connection using ${source}...`);

try {
  await database.$runCommandRaw({ ping: 1 });
  await database.$transaction(async (transaction) => {
    await transaction.user.findFirst({ select: { id: true } });
  });
  console.log(`${target} connected successfully (ping and Prisma read transaction succeeded).`);
} catch (error) {
  console.error(`${target} connection check failed.`);
  console.error(`Error type: ${error.name || 'Unknown'}${error.code ? ` (${error.code})` : ''}`);
  const details = error.meta?.message || error.message;
  if (details) {
    const safeDetails = String(details).replace(/mongodb(?:\+srv)?:\/\/[^\s"'<>]+/gi, '<redacted MongoDB URL>');
    console.error(`Details: ${safeDetails.slice(0, 700)}`);
  }
  console.error('Check the database URL, network access/IP allowlist, and database user credentials.');
  process.exitCode = 1;
} finally {
  await database.$disconnect();
}
