import { db } from '@/lib/db';
import { withAuth } from '@/lib/middleware/withAuth';
import { isObjectId } from '@/lib/receivables';

type Ctx = { params: Promise<{ id: string; photoId: string }> };

// Make this the photo shown on the animal's card.
export const PUT = withAuth<Ctx>(async (_req, { tenantId }, routeContext) => {
  try {
    const { id: cowId, photoId } = await routeContext.params;
    if (!isObjectId(cowId) || !isObjectId(photoId)) return Response.json({ error: 'Photo not found' }, { status: 404 });
    const photo = await db.animalPhoto.findFirst({ where: { id: photoId, cowId, tenantId }, select: { id: true } });
    if (!photo) return Response.json({ error: 'Photo not found' }, { status: 404 });
    await db.cow.updateMany({ where: { id: cowId, tenantId }, data: { mainPhotoId: photoId } });
    return Response.json({ success: true });
  } catch (err: unknown) {
    console.error('Error setting main photo:', err);
    return Response.json({ error: 'Failed to update photo' }, { status: 500 });
  }
});
