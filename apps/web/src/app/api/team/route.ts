import { teamMemberSchema } from '@farm/shared-validation';
import { db } from '@/lib/db';
import { withOwner } from '@/lib/middleware/withAuth';
import { rateLimitUser, tooManyRequests } from '@/lib/rate-limit';
import { hashPassword } from '@/lib/auth/password';

const memberSelect = { id: true, name: true, email: true, role: true, createdAt: true } as const;

// The farm's people: the owner(s) first, then managers.
export const GET = withOwner(async (_req, { tenantId }) => {
  try {
    const users = await db.user.findMany({ where: { tenantId }, select: memberSelect, orderBy: { createdAt: 'asc' } });
    return Response.json(users.sort((a, b) => Number(a.role === 'manager') - Number(b.role === 'manager')));
  } catch (err: unknown) {
    console.error('Error listing team:', err);
    return Response.json({ error: 'Failed to load team' }, { status: 500 });
  }
});

// Add a manager with a login the owner hands over.
export const POST = withOwner(async (req, { tenantId, userId }) => {
  try {
    // Each new login is a password hash and a user row; 10 a day is plenty for a farm.
    if (!(await rateLimitUser(userId, 'team-create', 10, 24 * 60 * 60 * 1000))) {
      return tooManyRequests('Too many new logins today. Please try again tomorrow.');
    }
    const parsed = teamMemberSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? 'Invalid member' }, { status: 400 });
    }
    const m = parsed.data;
    if (await db.user.findUnique({ where: { email: m.email }, select: { id: true } })) {
      return Response.json({ error: 'This email already has an account. Use a different one for the manager.' }, { status: 409 });
    }
    const user = await db.user.create({
      data: { tenantId, name: m.name, email: m.email, password: await hashPassword(m.password), role: 'manager' },
      select: memberSelect,
    });
    return Response.json(user, { status: 201 });
  } catch (err: unknown) {
    console.error('Error adding team member:', err);
    return Response.json({ error: 'Failed to add manager' }, { status: 500 });
  }
});
