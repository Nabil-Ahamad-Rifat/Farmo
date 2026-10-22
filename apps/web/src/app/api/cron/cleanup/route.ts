import { timingSafeEqual } from 'crypto';
import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { deleteTenantData } from '@/lib/tenant-data';

// Daily housekeeping, run by Vercel Cron (see vercel.json), which sends
// "Authorization: Bearer $CRON_SECRET". TTL indexes (scripts/db-indexes.mjs)
// do most of the work; this catches what they can't:
// - rows of the short-lived collections in case the TTL indexes are missing;
// - farms nobody can sign in to any more (left behind by "create a new
//   ranch", or by a removed owner), after a week's grace.

const DAY_MS = 24 * 60 * 60 * 1000;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const got = Buffer.from(req.headers.get('authorization') ?? '');
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const [idempotency, refresh, reset, rate, revoked, stages] = await Promise.all([
      db.idempotencyKey.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 7 * DAY_MS) } } }),
      db.refreshToken.deleteMany({ where: { expiresAt: { lt: now } } }),
      db.passwordResetToken.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - DAY_MS) } } }),
      db.rateLimit.deleteMany({ where: { expiresAt: { lt: now } } }),
      db.revokedSession.deleteMany({ where: { expiresAt: { lt: now } } }),
      db.importStage.deleteMany({ where: { expiresAt: { lt: now } } }),
    ]);

    // Farms with no users at all, created more than a week ago. A farm with
    // even one login (owner or manager) is never touched.
    const cutoff = new Date(now.getTime() - 7 * DAY_MS);
    const tenants = await db.tenant.findMany({ where: { createdAt: { lt: cutoff } }, select: { id: true } });
    const withUsers = new Set(
      (await db.user.findMany({ where: { tenantId: { in: tenants.map((t) => t.id) } }, select: { tenantId: true } })).map((u) => u.tenantId),
    );
    const orphans = tenants.filter((t) => !withUsers.has(t.id));
    let farmsDeleted = 0;
    for (const t of orphans.slice(0, 20)) {
      // Re-check inside the transaction in case someone was just added.
      await db.$transaction(async (tx) => {
        if ((await tx.user.count({ where: { tenantId: t.id } })) > 0) return;
        await deleteTenantData(tx, t.id);
        farmsDeleted += 1;
      }, { timeout: 30_000 });
    }

    return Response.json({
      deleted: {
        idempotencyKeys: idempotency.count,
        refreshTokens: refresh.count,
        resetTokens: reset.count,
        rateLimits: rate.count,
        revokedSessions: revoked.count,
        importStages: stages.count,
        farms: farmsDeleted,
      },
      farmsLeft: Math.max(0, orphans.length - farmsDeleted),
    });
  } catch (err: unknown) {
    console.error('Cleanup failed:', err);
    return Response.json({ error: 'Cleanup failed' }, { status: 500 });
  }
}
