import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withAuth } from '@/lib/middleware/withAuth';
import { verifyPassword } from '@/lib/auth/password';
import { checkRateLimit, getClientIp, tooManyRequests } from '@/lib/rate-limit';
import { deleteTenantData } from '@/lib/tenant-data';

// Apple App Store Guideline 5.1.1(v) / Google Play's User Data policy: an app
// that supports in-app account creation must let the user delete that account
// from inside the app. One user = one tenant today (register and POST
// /api/ranches are the only places tenantId is ever assigned, each creating a
// fresh tenant), so deleting "my account" means deleting the whole tenant —
// guarded below in case that ever changes.
export const POST = withAuth(async (req: NextRequest, { userId, tenantId }) => {
  const ip = getClientIp(req);
  if (!(await checkRateLimit(`account-delete:${ip}`, 5, 60 * 60 * 1000))) {
    return tooManyRequests();
  }

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  // Google-only accounts have no password to confirm with — the session
  // token itself is the authentication (same exemption login/register use).
  if (user.password) {
    const body = await req.json().catch(() => null) as { password?: unknown } | null;
    const password = typeof body?.password === 'string' && body.password.length <= 200 ? body.password : '';
    const isValid = password ? await verifyPassword(password, user.password) : false;
    if (!isValid) {
      return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
    }
  }

  // A manager deleting their account only removes their login. When the only
  // owner deletes theirs, the farm goes with it, and so do its managers.
  const otherOwners = user.role === 'manager' ? 1 : await db.user.count({ where: { tenantId, id: { not: userId }, role: { not: 'manager' } } });
  const otherTenantMembers = otherOwners;

  await db.$transaction(async (tx) => {
    if (otherOwners === 0) {
      const managers = await tx.user.findMany({ where: { tenantId, role: 'manager' }, select: { id: true, email: true } });
      await tx.refreshToken.deleteMany({ where: { userId: { in: managers.map((m) => m.id) } } });
      await tx.passwordResetToken.deleteMany({ where: { email: { in: managers.map((m) => m.email) } } });
      await tx.user.deleteMany({ where: { tenantId, role: 'manager' } });
    }
    // The user goes first: User.tenant is a required relation, so Prisma
    // refuses to delete a Tenant while any User still points at it (P2014).
    // RefreshTokens cascade automatically via the User relation.
    await tx.user.delete({ where: { id: userId } });
    await tx.passwordResetToken.deleteMany({ where: { email: user.email } });

    if (otherTenantMembers === 0) {
      // Sole user on this tenant — delete every tenant-scoped record.
      await deleteTenantData(tx, tenantId);
    }
  });

  const response = NextResponse.json({ success: true });
  response.cookies.set('token', '', {
    httpOnly: true,
    expires: new Date(0),
    path: '/',
  });
  return response;
});
