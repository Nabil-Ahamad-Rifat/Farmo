import { cache } from 'react';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyToken, JwtPayload } from '@/lib/auth/jwt';
import { db } from '@/lib/db';

/**
 * The signed-in user for a token, checked against the database on every
 * request: a removed member, a reset password (tokenVersion) or a changed
 * role takes effect at once instead of when the token expires. The role and
 * name come from the database, not the token.
 */
export async function currentUser(payload: JwtPayload | null): Promise<JwtPayload | null> {
  if (!payload) return null;
  const [user, revoked] = await Promise.all([
    db.user.findUnique({
      where: { id: payload.userId },
      select: { tenantId: true, role: true, name: true, email: true, tokenVersion: true },
    }),
    // A signed-out session (see /api/auth/logout) stays dead until its token expires.
    payload.jti ? db.revokedSession.findUnique({ where: { jti: payload.jti }, select: { id: true } }) : null,
  ]);
  if (revoked) return null;
  if (!user || user.tenantId !== payload.tenantId || (user.tokenVersion ?? 0) !== (payload.tv ?? 0)) return null;
  return { ...payload, role: user.role, name: user.name, email: user.email };
}

/** Sign out one token (web cookie or mobile access token) until it would have expired anyway. */
export async function revokeSession(payload: JwtPayload | null): Promise<void> {
  if (!payload?.jti) return;
  const expiresAt = new Date((payload.exp ?? Math.floor(Date.now() / 1000) + 7 * 24 * 3600) * 1000);
  await db.revokedSession.upsert({
    where: { jti: payload.jti },
    create: { jti: payload.jti, expiresAt },
    update: {},
  });
}

/** Owners see everything; managers do the daily work but not the money reports or settings. */
export const isOwner = (role: string) => role !== 'manager';

// Cached per request: the layout and the page both ask.
export const getSession = cache(async (): Promise<JwtPayload | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  return currentUser(verifyToken(token));
});

/** For owner-only pages: the session, or a redirect (to login, or to the dashboard for managers). */
export async function requireOwnerPage(): Promise<JwtPayload> {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!isOwner(session.role)) redirect('/dashboard');
  return session;
}
