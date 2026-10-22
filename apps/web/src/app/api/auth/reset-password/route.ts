import { NextRequest, NextResponse } from 'next/server';
import { notRevoked } from '@/lib/auth/refreshToken';
import { resetPasswordSchema } from '@farm/shared-validation';
import { consumeResetToken } from '@/lib/auth/reset-token';
import { hashPassword } from '@/lib/auth/password';
import { db } from '@/lib/db';
import { checkRateLimit, getClientIp, tooManyRequests } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    if (!(await checkRateLimit(`reset-password:${ip}`, 10, 15 * 60 * 1000))) {
      return tooManyRequests();
    }

    const parsed = resetPasswordSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      const short = parsed.error.issues.some((i) => i.path[0] === 'newPassword' && i.code === 'too_small');
      return NextResponse.json({ error: short ? 'Password must be at least 8 characters' : 'Token and new password are required' }, { status: 400 });
    }
    const { token, newPassword } = parsed.data;

    // Used up atomically: the same link can't reset the password twice.
    const email = await consumeResetToken(token);
    if (!email) {
      return NextResponse.json({ error: 'Invalid or expired reset link. Please request a new one.' }, { status: 400 });
    }

    const hashed = await hashPassword(newPassword);

    // A new password logs out every old session (web and phone).
    const user = await db.user.findUnique({ where: { email }, select: { id: true, tokenVersion: true } });
    if (user) {
      await db.user.update({ where: { id: user.id }, data: { password: hashed, tokenVersion: (user.tokenVersion ?? 0) + 1 } });
      await db.refreshToken.updateMany({ where: { userId: user.id, ...notRevoked }, data: { revokedAt: new Date() } });
    }

    return NextResponse.json({ message: 'Password reset successfully. You can now sign in.' });
  } catch (err: unknown) {
    console.error('Reset password error:', err);
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 });
  }
}
