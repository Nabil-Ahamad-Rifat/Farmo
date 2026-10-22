import { withOwner } from '@/lib/middleware/withAuth';
import { getLedger, parseLedgerQuery } from '@/lib/ledger';

// Every money entry in a period: ?from&to (or ?month), ?type, ?q, ?limit, ?by (who added it).
export const GET = withOwner(async (req, { tenantId }) => {
  try {
    const p = new URL(req.url).searchParams;
    const query = parseLedgerQuery({ from: p.get('from'), to: p.get('to'), month: p.get('month'), type: p.get('type'), q: p.get('q'), limit: p.get('limit'), by: p.get('by') });
    return Response.json(await getLedger(tenantId, query));
  } catch (err: unknown) {
    console.error('Error loading history:', err);
    return Response.json({ error: 'Failed to load history' }, { status: 500 });
  }
});
