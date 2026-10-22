import { teamMemberUpdateSchema } from '@farm/shared-validation';
import { notRevoked } from '@/lib/auth/refreshToken';
import { db } from '@/lib/db';
import { withOwner, getIdFromParams } from '@/lib/middleware/withAuth';
import { hashPassword } from '@/lib/auth/password';
import { isObjectId } from '@/lib/receivables';

/** A manager of this farm (never the owner), or null. */
async function findManager(tenantId: string, id: string | null) {
  if (!id || !isObjectId(id)) return null;
  return db.user.findFirst({ where: { id, tenantId, role: 'manager' }, select: { id: true, tokenVersion: true } });
}

/** End every session of a member: web cookies (tokenVersion) and phone refresh tokens. */
async function signOutEverywhere(userId: string, tokenVersion: number | null) {
  await db.user.update({ where: { id: userId }, data: { tokenVersion: (tokenVersion ?? 0) + 1 } });
  await db.refreshToken.updateMany({ where: { userId, ...notRevoked }, data: { revokedAt: new Date() } });
}

// Rename a manager or give them a new password (which logs them out everywhere).
export const PUT = withOwner(async (req, { tenantId }, routeContext) => {
  try {
    const member = await findManager(tenantId, await getIdFromParams(routeContext, req));
    if (!member) return Response.json({ error: 'Manager not found' }, { status: 404 });

    const parsed = teamMemberUpdateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? 'Invalid change' }, { status: 400 });
    }
    const { name, password } = parsed.data;
    if (name) await db.user.update({ where: { id: member.id }, data: { name } });
    if (password) {
      await db.user.update({ where: { id: member.id }, data: { password: await hashPassword(password) } });
      await signOutEverywhere(member.id, member.tokenVersion);
    }
    return Response.json(await db.user.findUnique({ where: { id: member.id }, select: { id: true, name: true, email: true, role: true, createdAt: true } }));
  } catch (err: unknown) {
    console.error('Error updating team member:', err);
    return Response.json({ error: 'Failed to save' }, { status: 500 });
  }
});

// Remove a manager: their login stops working at once. Records they added stay.
export const DELETE = withOwner(async (req, { tenantId }, routeContext) => {
  try {
    const member = await findManager(tenantId, await getIdFromParams(routeContext, req));
    if (!member) return Response.json({ error: 'Manager not found' }, { status: 404 });
    await db.$transaction([
      db.refreshToken.deleteMany({ where: { userId: member.id } }),
      db.user.delete({ where: { id: member.id } }),
    ]);
    return Response.json({ success: true });
  } catch (err: unknown) {
    console.error('Error removing team member:', err);
    return Response.json({ error: 'Failed to remove manager' }, { status: 500 });
  }
});
