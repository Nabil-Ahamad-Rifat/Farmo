import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { signToken } from '@/lib/auth/jwt';
import { ranchSchema } from '@farm/shared-validation';
import { withOwner } from '@/lib/middleware/withAuth';
import { rateLimitUser, tooManyRequests } from '@/lib/rate-limit';
import { isMobileClient } from '@/lib/auth/clientType';
import { issueRefreshToken, MOBILE_ACCESS_TOKEN_TTL } from '@/lib/auth/refreshToken';

// Owner only: a manager moving themselves to a new farm would lose access to
// their own farm and could create farms without limit. Capped per owner too.
export const POST = withOwner(async (req: NextRequest, { userId }) => {
  if (!(await rateLimitUser(userId, 'ranch-create', 3, 24 * 60 * 60 * 1000))) {
    return tooManyRequests('Too many new ranches today. Please try again tomorrow.');
  }
  const parsed = ranchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? 'Ranch name is required' }, { status: 400 });
  }
  const { ranchName } = parsed.data;

  const tenant = await db.tenant.create({
    data: {
      name: ranchName,
    },
  });

  const updatedUser = await db.user.update({
    where: { id: userId },
    data: { tenantId: tenant.id },
  });

  const mobile = isMobileClient(req);
  const token = signToken(
    {
      userId: updatedUser.id,
      tenantId: tenant.id,
      role: updatedUser.role,
      email: updatedUser.email,
      name: updatedUser.name,
      tv: updatedUser.tokenVersion ?? 0,
    },
    mobile ? MOBILE_ACCESS_TOKEN_TTL : undefined
  );

  const responseBody: Record<string, unknown> = {
    user: {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
    },
    tenant,
  };

  if (mobile) {
    responseBody.accessToken = token;
    responseBody.refreshToken = await issueRefreshToken(updatedUser.id, req.headers.get('user-agent'));
  }

  const response = NextResponse.json(responseBody, { status: 201 });

  response.cookies.set('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
});
