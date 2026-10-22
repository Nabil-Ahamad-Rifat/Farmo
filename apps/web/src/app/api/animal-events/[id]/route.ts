import { animalEventSchema } from '@farm/shared-validation';
import { db } from '@/lib/db';
import { withAuth, getIdFromParams } from '@/lib/middleware/withAuth';
import { eventData } from '@/lib/animals';

export const PUT = withAuth(async (req, { tenantId }, routeContext) => {
  try {
    const id = await getIdFromParams(routeContext, req);
    if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });

    const parsed = animalEventSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? 'Invalid record' }, { status: 400 });
    }
    const existing = await db.animalEvent.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!existing) return Response.json({ error: 'Record not found' }, { status: 404 });

    // A calf is only added with a new calving record, never on edit.
    const event = await db.animalEvent.update({ where: { id }, data: eventData(parsed.data) });
    return Response.json(event);
  } catch (err: unknown) {
    console.error('Error updating animal record:', err);
    return Response.json({ error: 'Failed to save record' }, { status: 500 });
  }
});

// Deleting a calving record keeps the calf; it is an animal in its own right.
export const DELETE = withAuth(async (req, { tenantId }, routeContext) => {
  try {
    const id = await getIdFromParams(routeContext, req);
    if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });
    await db.animalEvent.deleteMany({ where: { id, tenantId } });
    return Response.json({ success: true });
  } catch (err: unknown) {
    console.error('Error deleting animal record:', err);
    return Response.json({ error: 'Failed to delete record' }, { status: 500 });
  }
});
