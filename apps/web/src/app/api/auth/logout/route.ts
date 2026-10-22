import { NextRequest, NextResponse } from 'next/server';
import { logoutSchema } from '@farm/shared-validation';
import { revokeRefreshToken } from '@/lib/auth/refreshToken';
import { verifyToken } from '@/lib/auth/jwt';
import { revokeSession } from '@/lib/auth/session';

export async function POST(req: NextRequest) {
  // Mobile clients pass their refresh token so it's revoked server-side,
  // not just discarded on-device.
  const parsed = logoutSchema.safeParse((await req.json().catch(() => null)) ?? {});
  if (parsed.success && parsed.data.refreshToken) {
    await revokeRefreshToken(parsed.data.refreshToken);
  }

  // The token itself (web cookie, or the phone's access token) stops working
  // now instead of when it expires: a copied cookie can't be reused after sign-out.
  const authHeader = req.headers.get('authorization');
  const token = (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null) || req.cookies.get('token')?.value;
  if (token) {
    await revokeSession(verifyToken(token)).catch((err) => console.error('Sign-out revoke failed:', err));
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set('token', '', {
    httpOnly: true,
    expires: new Date(0),
    path: '/',
  });
  return response;
}
