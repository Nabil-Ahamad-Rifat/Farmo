import { withAuth } from '@/lib/middleware/withAuth';
import { getDueSoon } from '@/lib/animals';

// GET /api/animals/due-soon: vaccines/deworming due within 7 days or overdue,
// calvings expected within 30 days, and pregnancy checks due, soonest first.
export const GET = withAuth(async (_req, { tenantId }) => {
  try {
    return Response.json(await getDueSoon(tenantId));
  } catch (err: unknown) {
    console.error('Error loading due-soon list:', err);
    return Response.json({ error: 'Failed to load reminders' }, { status: 500 });
  }
});
