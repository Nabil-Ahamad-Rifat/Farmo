import { withOwner } from '@/lib/middleware/withAuth';
import { getMonthlyReport, parseMonth } from '@/lib/monthly-report';

// GET /api/reports/monthly?month=YYYY-MM (defaults to the current month)
export const GET = withOwner(async (req, { tenantId }) => {
  try {
    const month = parseMonth(req.nextUrl.searchParams.get('month') ?? undefined);
    return Response.json(await getMonthlyReport(tenantId, month));
  } catch (err: unknown) {
    console.error('Error building monthly report:', err);
    return Response.json({ error: 'Failed to load report' }, { status: 500 });
  }
});
