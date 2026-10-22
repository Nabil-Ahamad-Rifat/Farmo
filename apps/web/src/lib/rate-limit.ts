import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';

// Fixed-window rate limiter backed by MongoDB (the RateLimit collection), so
// every server instance shares the same counts — an in-memory Map does not
// work on serverless hosting, where each instance would count separately.
// A TTL index on RateLimit.expiresAt (scripts/db-indexes.mjs) deletes old windows.

/** The row key for `key` in the window containing `now`, and when that window ends. */
export function windowFor(key: string, windowMs: number, now = Date.now()): { rowKey: string; expiresAt: Date } {
  const index = Math.floor(now / windowMs);
  return { rowKey: `${key}:${index}`, expiresAt: new Date((index + 1) * windowMs) };
}

/**
 * The caller's IP. On Vercel the platform sets x-vercel-forwarded-for /
 * x-real-ip (clients can't forge them there). Behind Cloudflare, Vercel only
 * sees Cloudflare's address, so cf-connecting-ip is used — but only when
 * TRUST_CLOUDFLARE=1, since without Cloudflare in front anyone could send it.
 */
export function getClientIp(req: NextRequest): string {
  if (process.env.TRUST_CLOUDFLARE === '1') {
    const cf = req.headers.get('cf-connecting-ip');
    if (cf) return cf.trim();
  }
  const vercel = req.headers.get('x-vercel-forwarded-for');
  if (vercel) return vercel.split(',')[0].trim();
  const real = req.headers.get('x-real-ip');
  if (real) return real.trim();
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return 'unknown';
}

/**
 * Counts one request for `key` and returns true while it is within `limit`
 * requests per `windowMs`, false once it should be rejected.
 * `key` combines the route and an identifier (IP, email, user...).
 */
export async function checkRateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const { rowKey, expiresAt } = windowFor(key, windowMs);
  try {
    let row;
    try {
      row = await db.rateLimit.upsert({
        where: { key: rowKey },
        create: { key: rowKey, count: 1, expiresAt },
        update: { count: { increment: 1 } },
      });
    } catch {
      // Two first requests raced to create the row: the other one won, so count on it.
      row = await db.rateLimit.update({ where: { key: rowKey }, data: { count: { increment: 1 } } });
    }
    return row.count <= limit;
  } catch (err) {
    // If the counter store is down, let the request through rather than lock
    // everyone out; the database call the route makes next will fail anyway.
    console.error('Rate limit check failed:', err);
    return true;
  }
}

/** Per-user cap, e.g. for writes, uploads, backups and imports. */
export function rateLimitUser(userId: string, bucket: string, limit: number, windowMs: number): Promise<boolean> {
  return checkRateLimit(`user:${bucket}:${userId}`, limit, windowMs);
}

/** The standard 429 response. */
export function tooManyRequests(message = 'Too many attempts. Please try again later.') {
  return Response.json({ error: message }, { status: 429 });
}
