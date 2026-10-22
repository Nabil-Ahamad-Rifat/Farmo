import { workEntrySchema } from '@farm/shared-validation';
import { farmToday } from '@farm/business-logic';
import { db } from '@/lib/db';
import { withAuth, getIdFromParams } from '@/lib/middleware/withAuth';
import { isObjectId } from '@/lib/receivables';
import { payDay } from '@/lib/payroll';

async function findEntry(tenantId: string, id: string | null) {
  if (!id || !isObjectId(id)) return null;
  return db.workEntry.findFirst({ where: { id, tenantId } });
}

export const PUT = withAuth(async (req, { tenantId }, routeContext) => {
  try {
    const existing = await findEntry(tenantId, await getIdFromParams(routeContext, req));
    if (!existing) return Response.json({ error: 'Work entry not found' }, { status: 404 });

    const parsed = workEntrySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? 'Invalid work entry' }, { status: 400 });
    }
    const w = parsed.data;
    if (w.date > farmToday()) return Response.json({ error: 'The work date cannot be in the future' }, { status: 400 });

    const entry = await db.workEntry.update({
      where: { id: existing.id },
      data: { date: payDay(w.date), days: w.days, rate: w.rate ?? existing.rate, note: w.note ?? null },
    });
    return Response.json(entry);
  } catch (err: unknown) {
    console.error('Error updating work entry:', err);
    return Response.json({ error: 'Failed to save work' }, { status: 500 });
  }
});

export const DELETE = withAuth(async (req, { tenantId }, routeContext) => {
  try {
    const existing = await findEntry(tenantId, await getIdFromParams(routeContext, req));
    if (!existing) return Response.json({ error: 'Work entry not found' }, { status: 404 });
    await db.workEntry.delete({ where: { id: existing.id } });
    return Response.json({ success: true });
  } catch (err: unknown) {
    console.error('Error deleting work entry:', err);
    return Response.json({ error: 'Failed to delete work' }, { status: 500 });
  }
});
