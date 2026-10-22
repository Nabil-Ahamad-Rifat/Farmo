import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (!clientId) {
    return NextResponse.json({ error: 'Google OAuth is not configured.' }, { status: 503 });
  }

  const redirectUri = `${appUrl}/api/auth/google/callback`;

  // CSRF protection for the OAuth flow: bind this request to a short-lived
  // cookie and require the callback to echo it back via the `state` param.
  const state = randomBytes(32).toString('hex');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
    state,
  });

  const response = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  response.cookies.set('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 10 * 60, // 10 minutes
  });

  return response;
}
