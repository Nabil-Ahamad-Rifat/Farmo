import { db } from '@/lib/db';
import { withAuth } from '@/lib/middleware/withAuth';
import { isObjectId } from '@/lib/receivables';

type Ctx = { params: Promise<{ id: string; photoId: string }> };

async function ids(routeContext: Ctx) {
  const { id, photoId } = await routeContext.params;
  return isObjectId(id) && isObjectId(photoId) ? { cowId: id, photoId } : null;
}

// The photo itself. Works with the web cookie and the mobile Bearer token.
export const GET = withAuth<Ctx>(async (_req, { tenantId }, routeContext) => {
  const p = await ids(routeContext);
  if (!p) return new Response('Not found', { status: 404 });
  const photo = await db.animalPhoto.findFirst({
    where: { id: p.photoId, cowId: p.cowId, tenantId },
    select: { data: true, mimeType: true },
  });
  if (!photo) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(photo.data), {
    headers: {
      'Content-Type': photo.mimeType,
      // A photo never changes once saved (new pictures get new ids).
      'Cache-Control': 'private, max-age=31536000, immutable',
    },
  });
});

// Remove a photo. The last photo can't be removed: every animal keeps one.
export const DELETE = withAuth<Ctx>(async (_req, { tenantId }, routeContext) => {
  try {
    const p = await ids(routeContext);
    if (!p) return Response.json({ error: 'Photo not found' }, { status: 404 });
    const cow = await db.cow.findFirst({ where: { id: p.cowId, tenantId }, select: { mainPhotoId: true } });
    const photo = await db.animalPhoto.findFirst({ where: { id: p.photoId, cowId: p.cowId, tenantId }, select: { id: true } });
    if (!cow || !photo) return Response.json({ error: 'Photo not found' }, { status: 404 });

    const count = await db.animalPhoto.count({ where: { cowId: p.cowId, tenantId } });
    if (count <= 1) return Response.json({ error: 'An animal needs at least one photo. Add another photo first.' }, { status: 409 });

    await db.$transaction(async (tx) => {
      await tx.animalPhoto.delete({ where: { id: p.photoId } });
      if (cow.mainPhotoId === p.photoId) {
        const next = await tx.animalPhoto.findFirst({ where: { cowId: p.cowId, tenantId }, orderBy: { takenAt: 'desc' }, select: { id: true } });
        await tx.cow.update({ where: { id: p.cowId }, data: { mainPhotoId: next?.id ?? null } });
      }
    });
    return Response.json({ success: true });
  } catch (err: unknown) {
    console.error('Error deleting photo:', err);
    return Response.json({ error: 'Failed to delete photo' }, { status: 500 });
  }
});
