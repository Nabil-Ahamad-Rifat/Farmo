import { animalSchema } from '@farm/shared-validation';
import { db } from '@/lib/db';
import { withAuth } from '@/lib/middleware/withAuth';
import { withIdempotency } from '@/lib/idempotency';
import { animalData, checkMother, decodePhoto, getAnimalDetail, listAnimals, photoUploadAllowed, savePhoto, tagTaken } from '@/lib/animals';
import { tooManyRequests } from '@/lib/rate-limit';

export const GET = withAuth(async (_req, { tenantId }) => {
  try {
    return Response.json(await listAnimals(tenantId));
  } catch (err: unknown) {
    console.error('Error listing animals:', err);
    return Response.json({ error: 'Failed to load animals' }, { status: 500 });
  }
});

// Add an animal. A photo is required so every animal can be recognised.
export const POST = withAuth(async (req, { tenantId, userId }) => withIdempotency(req, tenantId, 'cows:create', async () => {
  try {
    const parsed = animalSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? 'Invalid animal' }, { status: 400 });
    }
    const a = parsed.data;
    if (!a.photo) return Response.json({ error: 'Please add a photo of the animal' }, { status: 400 });
    if (!(await photoUploadAllowed(userId))) return tooManyRequests('Too many photos uploaded. Please try again later.');

    const decoded = decodePhoto(a.photo);
    if ('error' in decoded) return Response.json({ error: decoded.error }, { status: 400 });
    if (await tagTaken(tenantId, a.tagNumber)) {
      return Response.json({ error: `Cow ID ${a.tagNumber} is already used by another animal` }, { status: 409 });
    }
    const motherError = await checkMother(tenantId, a.motherId);
    if (motherError) return Response.json({ error: motherError }, { status: 400 });

    const id = await db.$transaction(async (tx) => {
      const cow = await tx.cow.create({ data: { createdById: userId, ...animalData(a), tenantId } });
      const photoId = await savePhoto(tx, tenantId, cow.id, decoded.bytes, a.photo!);
      await tx.cow.update({ where: { id: cow.id }, data: { mainPhotoId: photoId } });
      return cow.id;
    });

    return Response.json(await getAnimalDetail(tenantId, id), { status: 201 });
  } catch (err: unknown) {
    console.error('Error creating animal:', err);
    return Response.json({ error: 'Failed to save animal' }, { status: 500 });
  }
}));
