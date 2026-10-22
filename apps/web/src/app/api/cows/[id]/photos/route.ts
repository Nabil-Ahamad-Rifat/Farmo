import { animalPhotoSchema } from '@farm/shared-validation';
import { db } from '@/lib/db';
import { withAuth, getIdFromParams } from '@/lib/middleware/withAuth';
import { withIdempotency } from '@/lib/idempotency';
import { decodePhoto, MAX_PHOTOS_PER_ANIMAL, photoUploadAllowed, photoUrl, savePhoto } from '@/lib/animals';
import { tooManyRequests } from '@/lib/rate-limit';

// Add another photo of an animal (e.g. after calving or an illness).
export const POST = withAuth(async (req, { tenantId, userId }, routeContext) => withIdempotency(req, tenantId, 'cows:photo', async () => {
  try {
    if (!(await photoUploadAllowed(userId))) return tooManyRequests('Too many photos uploaded. Please try again later.');
    const cowId = await getIdFromParams(routeContext, req);
    if (!cowId) return Response.json({ error: 'Missing id' }, { status: 400 });

    const parsed = animalPhotoSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? 'Invalid photo' }, { status: 400 });
    }
    const cow = await db.cow.findFirst({ where: { id: cowId, tenantId }, select: { id: true, mainPhotoId: true } });
    if (!cow) return Response.json({ error: 'Animal not found' }, { status: 404 });
    const count = await db.animalPhoto.count({ where: { tenantId, cowId } });
    if (count >= MAX_PHOTOS_PER_ANIMAL) {
      return Response.json({ error: `An animal can have at most ${MAX_PHOTOS_PER_ANIMAL} photos` }, { status: 409 });
    }

    const decoded = decodePhoto(parsed.data);
    if ('error' in decoded) return Response.json({ error: decoded.error }, { status: 400 });

    const photoId = await db.$transaction(async (tx) => {
      const id = await savePhoto(tx, tenantId, cowId, decoded.bytes, parsed.data);
      // Animals added before photos existed get their first photo as the main one.
      if (!cow.mainPhotoId) await tx.cow.update({ where: { id: cowId }, data: { mainPhotoId: id } });
      return id;
    });
    return Response.json({ id: photoId, url: photoUrl(cowId, photoId) }, { status: 201 });
  } catch (err: unknown) {
    console.error('Error adding photo:', err);
    return Response.json({ error: 'Failed to save photo' }, { status: 500 });
  }
}));
