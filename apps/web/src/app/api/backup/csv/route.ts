import { withOwner } from '@/lib/middleware/withAuth';
import { rateLimitUser, tooManyRequests } from '@/lib/rate-limit';
import { buildCsvExport } from '@/lib/backup';

// A zip of CSV sheets (sales, customers, workers...) that open in Excel. Owner only.
export const maxDuration = 60;

export const GET = withOwner(async (_req, { tenantId, userId }) => {
  if (!(await rateLimitUser(userId, 'backup-csv', 30, 60 * 60 * 1000))) return tooManyRequests();
  try {
    const zip = await buildCsvExport(tenantId);
    const day = new Date(Date.now() + 6 * 3600 * 1000).toISOString().slice(0, 10);
    return new Response(Buffer.from(zip), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="Farm-sheets-${day}.zip"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('CSV export failed:', err);
    return Response.json({ error: 'Could not build the spreadsheets' }, { status: 500 });
  }
});
