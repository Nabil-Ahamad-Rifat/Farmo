import { BACKUP_COLLECTIONS, type BackupCollection } from '@farm/business-logic';
import { withOwner } from '@/lib/middleware/withAuth';
import { rateLimitUser, tooManyRequests } from '@/lib/rate-limit';
import { exportHeader, exportPhotos, exportRows } from '@/lib/backup';
import { isObjectId } from '@/lib/receivables';

// Paged farm export for the backup file (owner only). The app asks for:
//   ?part=data                                   farm details and record counts
//   ?part=rows&collection=Sale&cursor=<id>       one page of one record type
//   ?part=photos&cursor=<id>                     one page of animal photos
// Every response stays under Vercel's 4.5 MB limit; the app joins the pages.
export const maxDuration = 60;

export const GET = withOwner(async (req, { tenantId, userId }) => {
  if (!(await rateLimitUser(userId, 'backup-read', 600, 60 * 60 * 1000))) return tooManyRequests();
  const params = req.nextUrl.searchParams;
  const part = params.get('part') ?? 'data';
  const cursor = params.get('cursor');
  if (cursor && !isObjectId(cursor)) return Response.json({ error: 'Invalid cursor' }, { status: 400 });
  try {
    if (part === 'data') return Response.json(await exportHeader(tenantId));
    if (part === 'rows') {
      const collection = params.get('collection') as BackupCollection;
      if (!(BACKUP_COLLECTIONS as readonly string[]).includes(collection)) return Response.json({ error: 'Unknown record type' }, { status: 400 });
      return Response.json(await exportRows(tenantId, collection, cursor));
    }
    if (part === 'photos') return Response.json(await exportPhotos(tenantId, cursor));
    return Response.json({ error: 'Unknown part' }, { status: 400 });
  } catch (err) {
    console.error('Backup export failed:', err);
    return Response.json({ error: 'Could not export the farm data' }, { status: 500 });
  }
});
