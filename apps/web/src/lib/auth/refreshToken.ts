import { randomBytes, createHash } from 'crypto';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';

// A new token has no revokedAt/replacedBy field at all, and on MongoDB
// Prisma's `field: null` only matches a stored null, not a missing field —
// so "not revoked" must match both. (A plain `revokedAt: null` filter matched
// nothing, which silently disabled every revocation.)
export const notRevoked = { OR: [{ revokedAt: null }, { revokedAt: { isSet: false } }] } satisfies Prisma.RefreshTokenWhereInput;
const notReplaced = { OR: [{ replacedBy: null }, { replacedBy: { isSet: false } }] } satisfies Prisma.RefreshTokenWhereInput;

const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const MOBILE_ACCESS_TOKEN_TTL = '15m';

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export async function issueRefreshToken(userId: string, deviceInfo?: string | null): Promise<string> {
  const raw = randomBytes(32).toString('hex');
  await db.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(raw),
      deviceInfo: deviceInfo || null,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });
  return raw;
}

async function revokeAllForUser(userId: string): Promise<void> {
  await db.refreshToken.updateMany({
    where: { userId, ...notRevoked },
    data: { revokedAt: new Date() },
  });
}

export interface RotateResult {
  userId: string;
  refreshToken: string;
}

/**
 * Verifies a refresh token, rotates it, and returns the new one.
 * Returns null if the token is unknown, expired, or already used — in the
 * "already used" case (reuse of a rotated-away token), the entire refresh
 * chain for that user is revoked, since presenting an already-rotated token
 * means it was stolen and replayed by someone else.
 */
export async function rotateRefreshToken(rawToken: string): Promise<RotateResult | null> {
  const tokenHash = hashToken(rawToken);
  const record = await db.refreshToken.findUnique({ where: { tokenHash } });
  if (!record) return null;

  if (record.revokedAt || record.replacedBy) {
    await revokeAllForUser(record.userId);
    return null;
  }

  if (record.expiresAt < new Date()) return null;

  // Issue the replacement first, then claim the old token atomically
  // (revoked + replacedBy in one update). If two requests use the same token
  // at once, only one claim succeeds; the loser treats it as a replay and
  // revokes every token of the user — including the winner's replacement,
  // which already exists by then — the same as reusing an old token.
  const newRaw = randomBytes(32).toString('hex');
  const newRecord = await db.refreshToken.create({
    data: {
      userId: record.userId,
      tokenHash: hashToken(newRaw),
      deviceInfo: record.deviceInfo,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });

  const claimed = await db.refreshToken.updateMany({
    where: { id: record.id, AND: [notRevoked, notReplaced] },
    data: { revokedAt: new Date(), replacedBy: newRecord.id },
  });
  if (claimed.count !== 1) {
    await revokeAllForUser(record.userId);
    return null;
  }

  return { userId: record.userId, refreshToken: newRaw };
}

export async function revokeRefreshToken(rawToken: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  await db.refreshToken.updateMany({
    where: { tokenHash, ...notRevoked },
    data: { revokedAt: new Date() },
  });
}
