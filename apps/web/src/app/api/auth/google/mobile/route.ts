import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { OAuth2Client } from 'google-auth-library';
import { signToken } from '@/lib/auth/jwt';
import { findOrCreateGoogleUser, GooglePasswordAccountError } from '@/lib/auth/googleUser';
import { issueRefreshToken, MOBILE_ACCESS_TOKEN_TTL } from '@/lib/auth/refreshToken';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

// Native Google Sign-In (Expo/@react-native-google-signin), distinct from the
// web redirect flow in ../callback — a native app has no cookie jar or
// browser redirect to carry a `state` CSRF token, so instead it obtains a
// Google ID token on-device and this endpoint verifies it server-side.
const bodySchema = z.object({ idToken: z.string().min(1) });

const googleClient = new OAuth2Client();

function getAllowedAudiences(): string[] {
  return [
    process.env.GOOGLE_IOS_CLIENT_ID,
    process.env.GOOGLE_ANDROID_CLIENT_ID,
    process.env.GOOGLE_CLIENT_ID,
  ].filter((value): value is string => Boolean(value));
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!(await checkRateLimit(`google-mobile:${ip}`, 20, 15 * 60 * 1000))) {
    return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'A Google idToken is required' }, { status: 400 });
  }

  const audiences = getAllowedAudiences();
  if (audiences.length === 0) {
    return NextResponse.json({ error: 'Google sign-in is not configured.' }, { status: 503 });
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: parsed.data.idToken, audience: audiences });
    payload = ticket.getPayload();
  } catch (err) {
    console.error('Google mobile idToken verification failed:', err instanceof Error ? err.message : 'unknown error');
    return NextResponse.json({ error: 'Invalid Google credential' }, { status: 401 });
  }

  if (!payload?.email || !payload.email_verified || !payload.sub) {
    return NextResponse.json({ error: 'Could not verify a Google account email' }, { status: 401 });
  }

  let user;
  try {
    user = await findOrCreateGoogleUser({ sub: payload.sub, email: payload.email, name: payload.name });
  } catch (err) {
    if (err instanceof GooglePasswordAccountError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }

  const accessToken = signToken(
    {
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
      name: user.name,
      tv: user.tokenVersion ?? 0,
    },
    MOBILE_ACCESS_TOKEN_TTL
  );
  const refreshToken = await issueRefreshToken(user.id, req.headers.get('user-agent'));

  return NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    accessToken,
    refreshToken,
  });
}
