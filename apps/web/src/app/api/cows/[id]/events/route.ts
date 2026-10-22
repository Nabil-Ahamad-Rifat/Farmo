import { animalEventSchema } from '@farm/shared-validation';
import { db } from '@/lib/db';
import { withAuth, getIdFromParams } from '@/lib/middleware/withAuth';
import { withIdempotency } from '@/lib/idempotency';
import { dayOrNull, decodePhoto, eventData, photoUploadAllowed, savePhoto, tagTaken } from '@/lib/animals';
import { tooManyRequests } from '@/lib/rate-limit';

// Add a history record (vaccine, AI, pregnancy check, calving...). A calving
// can add the calf as its own animal, linked to this one as its mother.
export const POST = withAuth(async (req, { tenantId, userId }, routeContext) => withIdempotency(req, tenantId, 'cows:event', async () => {
  try {
    const cowId = await getIdFromParams(routeContext, req);
    if (!cowId) return Response.json({ error: 'Missing id' }, { status: 400 });

    const parsed = animalEventSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? 'Invalid record' }, { status: 400 });
    }
    const e = parsed.data;

    const cow = await db.cow.findFirst({ where: { id: cowId, tenantId }, select: { id: true, gender: true, breed: true } });
    if (!cow) return Response.json({ error: 'Animal not found' }, { status: 404 });
    if (cow.gender === 'male' && ['insemination', 'pregnancy_check', 'calving'].includes(e.type)) {
      return Response.json({ error: 'Breeding records are only for female animals' }, { status: 400 });
    }

    let calfPhoto: Buffer | null = null;
    if (e.createCalf) {
      if (!(await photoUploadAllowed(userId))) return tooManyRequests('Too many photos uploaded. Please try again later.');
      if (await tagTaken(tenantId, e.createCalf.tagNumber)) {
        return Response.json({ error: `Cow ID ${e.createCalf.tagNumber} is already used by another animal` }, { status: 409 });
      }
      const decoded = decodePhoto(e.createCalf.photo);
      if ('error' in decoded) return Response.json({ error: decoded.error }, { status: 400 });
      calfPhoto = decoded.bytes;
    }

    const result = await db.$transaction(async (tx) => {
      let calfId: string | null = null;
      if (e.createCalf && calfPhoto) {
        const c = e.createCalf;
        const calf = await tx.cow.create({
          data: { createdById: userId,
            tenantId,
            tagNumber: c.tagNumber,
            name: c.name ?? c.tagNumber,
            gender: c.gender,
            category: 'calf',
            breed: cow.breed,
            source: 'born',
            birthDate: dayOrNull(e.date),
            motherId: cowId,
            status: 'active',
          },
        });
        const photoId = await savePhoto(tx, tenantId, calf.id, calfPhoto, c.photo);
        await tx.cow.update({ where: { id: calf.id }, data: { mainPhotoId: photoId } });
        calfId = calf.id;
      }
      const event = await tx.animalEvent.create({ data: { createdById: userId, ...eventData(e), tenantId, cowId, calfId } });
      return { event, calfId };
    });

    return Response.json(result, { status: 201 });
  } catch (err: unknown) {
    console.error('Error adding animal record:', err);
    return Response.json({ error: 'Failed to save record' }, { status: 500 });
  }
}));
