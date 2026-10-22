import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';

/**
 * Opt-in request de-duplication for mutating routes. If the caller sends an
 * `Idempotency-Key` header, a repeat of the same key (for the same tenant +
 * route) returns the original cached response instead of re-running `fn` —
 * this is what makes it safe for the mobile app's offline outbox to replay a
 * queued mutation after reconnecting without creating duplicate records.
 *
 * Callers that never send the header (the current web app) are completely
 * unaffected — `fn()` just runs directly.
 */
export async function withIdempotency(
  req: NextRequest,
  tenantId: string,
  route: string,
  fn: () => Promise<Response>
): Promise<Response> {
  const key = req.headers.get('idempotency-key');
  if (!key) return fn();
  // Keys are UUIDs (36 chars); anything much longer is not from our apps and
  // would only bloat the stored rows.
  if (key.length > 100) {
    return Response.json({ error: 'Idempotency-Key is too long' }, { status: 400 });
  }

  const existing = await db.idempotencyKey.findUnique({
    where: { tenantId_route_key: { tenantId, route, key } },
  });
  if (existing) {
    return new Response(existing.responseBody, {
      status: existing.statusCode,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const res = await fn();
  if (res.ok) {
    const body = await res.clone().text();
    await db.idempotencyKey
      .create({ data: { tenantId, route, key, responseBody: body, statusCode: res.status } })
      .catch(() => {
        // Lost a race with a concurrent identical request — harmless, the
        // other request's cached row will serve future replays.
      });
  }
  return res;
}
