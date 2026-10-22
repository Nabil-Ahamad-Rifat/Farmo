import { withOwner } from '@/lib/middleware/withAuth';
import { storageInfo } from '@/lib/backup';

// How much of the free database this farm and the whole database use (Settings meter). Owner only.
export const GET = withOwner(async (_req, { tenantId }) => {
  try {
    return Response.json(await storageInfo(tenantId));
  } catch (err) {
    console.error('Storage info failed:', err);
    return Response.json({ error: 'Could not read storage use' }, { status: 500 });
  }
});
