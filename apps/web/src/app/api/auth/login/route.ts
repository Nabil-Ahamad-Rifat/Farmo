import { NextRequest, NextResponse } from 'next/server';
import { loginSchema } from '@farm/shared-validation';
import { db } from '@/lib/db';
import { burnPasswordCheck, verifyPassword } from '@/lib/auth/password';
import { signToken } from '@/lib/auth/jwt';
import { checkRateLimit, getClientIp, tooManyRequests } from '@/lib/rate-limit';
import { isMobileClient } from '@/lib/auth/clientType';
import { issueRefreshToken, MOBILE_ACCESS_TOKEN_TTL } from '@/lib/auth/refreshToken';

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!(await checkRateLimit(`login:${ip}`, 20, 15 * 60 * 1000))) {
    return tooManyRequests();
  }

  const parsed = loginSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'A valid email and password are required' }, { status: 400 });
  }
  const { email, password } = parsed.data;

  if (!(await checkRateLimit(`login-email:${email}`, 8, 15 * 60 * 1000))) {
    return tooManyRequests('Too many attempts for this account. Please try again later.');
  }

  // One answer, and the same time taken, whether the email is unknown, has no
  // password (Google-only) or the password is wrong — so nobody can probe
  // which emails have accounts.
  const user = await db.user.findUnique({ where: { email } });
  if (!user?.password) {
    await burnPasswordCheck(password);
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const isValid = await verifyPassword(password, user.password);
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const mobile = isMobileClient(req);
  const token = signToken(
    {
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
      name: user.name,
      tv: user.tokenVersion ?? 0,
    },
    mobile ? MOBILE_ACCESS_TOKEN_TTL : undefined
  );

  const responseBody: Record<string, unknown> = {
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  };

  if (mobile) {
    responseBody.accessToken = token;
    responseBody.refreshToken = await issueRefreshToken(user.id, req.headers.get('user-agent'));
  }

  const response = NextResponse.json(responseBody);

  response.cookies.set('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  return response;
}
