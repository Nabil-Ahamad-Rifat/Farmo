import { db } from '@/lib/db';
import { withAuth, getIdFromParams } from '@/lib/middleware/withAuth';
import { isObjectId } from '@/lib/receivables';

// Undo an absence: the day is paid again.
export const DELETE = withAuth(async (req, { tenantId }, routeContext) => {
  try {
    const id = await getIdFromParams(routeContext, req);
    if (!id || !isObjectId(id)) return Response.json({ error: 'Absence not found' }, { status: 404 });
    const { count } = await db.employeeAbsence.deleteMany({ where: { id, tenantId } });
    if (!count) return Response.json({ error: 'Absence not found' }, { status: 404 });
    return Response.json({ success: true });
  } catch (err: unknown) {
    console.error('Error removing absence:', err);
    return Response.json({ error: 'Failed to remove absence' }, { status: 500 });
  }
});
