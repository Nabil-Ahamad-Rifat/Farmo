import { db } from '@/lib/db';
import { createHash, randomBytes } from 'crypto';

const EXPIRY_MINUTES = 30;

// Only a SHA-256 hash of the token is stored, so a database leak doesn't hand
// out working reset links. The raw token exists only in the emailed link.
const hashToken = (raw: string) => createHash('sha256').update(raw).digest('hex');

/** A new reset token for `email` (earlier unused ones stop working). Returns the raw token for the link. */
export async function generateResetToken(email: string): Promise<string> {
  await db.passwordResetToken.updateMany({
    where: { email, used: false },
    data: { used: true },
  });

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + EXPIRY_MINUTES * 60 * 1000);

  await db.passwordResetToken.create({
    data: { token: hashToken(token), email, expiresAt },
  });

  return token;
}

/**
 * Uses up a reset token: returns the email it belongs to, or null when it is
 * unknown, used or expired. Atomic, so the same link can't reset twice even
 * when clicked twice at the same moment.
 */
export async function consumeResetToken(token: string): Promise<string | null> {
  const hashed = hashToken(token);
  const claimed = await db.passwordResetToken.updateMany({
    where: { token: hashed, used: false, expiresAt: { gt: new Date() } },
    data: { used: true },
  });
  if (claimed.count !== 1) return null;
  const record = await db.passwordResetToken.findUnique({ where: { token: hashed }, select: { email: true } });
  return record?.email ?? null;
}
