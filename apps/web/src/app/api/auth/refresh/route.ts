import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { signToken } from '@/lib/auth/jwt';
import { rotateRefreshToken, MOBILE_ACCESS_TOKEN_TTL } from '@/lib/auth/refreshToken';
import { checkRateLimit, getClientIp, tooManyRequests } from '@/lib/rate-limit';

const refreshSchema = z.object({
  refreshToken: z.string().min(1).max(200),
});

// Mobile-only endpoint: exchanges a refresh token for a new short-lived
// access token + a rotated refresh token. See src/lib/auth/refreshToken.ts
// for the rotation/reuse-detection mechanics.
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!(await checkRateLimit(`refresh:${ip}`, 30, 15 * 60 * 1000))) {
    return tooManyRequests();
  }

  const parsed = refreshSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'A refresh token is required' }, { status: 400 });
  }

  const rotated = await rotateRefreshToken(parsed.data.refreshToken);
  if (!rotated) {
    return NextResponse.json({ error: 'Invalid or expired refresh token' }, { status: 401 });
  }

  const user = await db.user.findUnique({ where: { id: rotated.userId } });
  if (!user) {
    return NextResponse.json({ error: 'Invalid or expired refresh token' }, { status: 401 });
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

  return NextResponse.json({ accessToken, refreshToken: rotated.refreshToken });
}
