import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';

// Defense in depth: every /dashboard page already checks the session
// server-side, but this catches any page that forgets to. Proxy runs on the
// Node.js runtime by default, so jsonwebtoken (Node crypto) works here.
export const config = {
  matcher: ['/dashboard/:path*'],
};

export function proxy(req: NextRequest) {
  const token = req.cookies.get('token')?.value;
  const session = token ? verifyToken(token) : null;

  if (!session) {
    const loginUrl = new URL('/login', req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}
