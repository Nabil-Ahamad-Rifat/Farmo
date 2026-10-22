import { PrismaClient } from '@prisma/client';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Add it to your .env file (see .env.example).');
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Reuse a single client across hot reloads / lambda invocations to avoid
// exhausting MongoDB Atlas connection pool limits.
export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}
