import { animalSchema } from '@farm/shared-validation';
import { db } from '@/lib/db';
import { withAuth, getIdFromParams } from '@/lib/middleware/withAuth';
import { animalData, checkMother, getAnimalDetail, tagTaken } from '@/lib/animals';

export const GET = withAuth(async (req, { tenantId }, routeContext) => {
  try {
    const id = await getIdFromParams(routeContext, req);
    if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });

    const detail = await getAnimalDetail(tenantId, id);
    if (!detail) return Response.json({ error: 'Animal not found' }, { status: 404 });
    return Response.json(detail);
  } catch (err: unknown) {
    console.error('Error loading animal:', err);
    return Response.json({ error: 'Failed to load animal' }, { status: 500 });
  }
});

// Edit the animal's details. Photos are managed with the /photos routes.
export const PUT = withAuth(async (req, { tenantId }, routeContext) => {
  try {
    const id = await getIdFromParams(routeContext, req);
    if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const parsed = animalSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? 'Invalid animal' }, { status: 400 });
    }
    const a = parsed.data;

    const existing = await db.cow.findFirst({ where: { id, tenantId } });
    if (!existing) return Response.json({ error: 'Animal not found' }, { status: 404 });
    if (await tagTaken(tenantId, a.tagNumber, id)) {
      return Response.json({ error: `Cow ID ${a.tagNumber} is already used by another animal` }, { status: 409 });
    }
    const motherError = await checkMother(tenantId, a.motherId, id);
    if (motherError) return Response.json({ error: motherError }, { status: 400 });

    // Older mobile builds send only tagNumber/name/breed/purchasePrice/status: keep the rest as it was.
    const data = animalData(a);
    const sent = (k: string) => !!body && Object.prototype.hasOwnProperty.call(body, k);
    const keep = ['gender', 'category', 'birthDate', 'color', 'source', 'purchaseDate', 'motherId', 'notes'] as const;
    for (const k of keep) {
      if (!sent(k)) delete (data as Partial<typeof data>)[k];
    }

    await db.cow.update({ where: { id }, data });
    return Response.json(await getAnimalDetail(tenantId, id));
  } catch (err: unknown) {
    console.error('Error updating animal:', err);
    return Response.json({ error: 'Failed to save animal' }, { status: 500 });
  }
});

export const DELETE = withAuth(async (req, { tenantId }, routeContext) => {
  try {
    const id = await getIdFromParams(routeContext, req);
    if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });

    const cow = await db.cow.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!cow) return Response.json({ success: true });

    // Deleting an animal that was sold would break those sale records.
    const sales = await db.sale.count({ where: { tenantId, cowId: id } });
    if (sales > 0) {
      return Response.json(
        { error: `This animal is linked to ${sales} sale(s). Mark it as sold instead of deleting it.` },
        { status: 409 },
      );
    }

    await db.$transaction(async (tx) => {
      // Calves stay, they just lose the link to their mother.
      await tx.cow.updateMany({ where: { tenantId, motherId: id }, data: { motherId: null } });
      await tx.animalEvent.updateMany({ where: { tenantId, calfId: id }, data: { calfId: null } });
      await tx.animalEvent.deleteMany({ where: { tenantId, cowId: id } });
      await tx.animalPhoto.deleteMany({ where: { tenantId, cowId: id } });
      await tx.cow.delete({ where: { id } });
    });
    return Response.json({ success: true });
  } catch (err: unknown) {
    console.error('Error deleting animal:', err);
    return Response.json({ error: 'Failed to delete animal' }, { status: 500 });
  }
});
