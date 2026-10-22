import type { NextRequest } from 'next/server';

// The Expo app sends this header on every auth request so login/register/etc.
// can return the raw JWT in the response body (mobile has no cookie jar to
// rely on). The browser web app never sends it, so its behavior — token
// only ever in the httpOnly cookie, never in JS-readable JSON — is unchanged.
export function isMobileClient(req: NextRequest): boolean {
  return req.headers.get('x-client-type') === 'mobile';
}
