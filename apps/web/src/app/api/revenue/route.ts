import { addDaysIso, farmToday } from '@farm/business-logic';
import { withOwner } from '@/lib/middleware/withAuth';
import { getFinanceReport, resolveRange, summaryFor, loadFinanceData } from '@/lib/finance';

/** Day counts the older mobile screen shows side by side. */
const LEGACY_PERIODS = [1, 3, 5, 7, 15, 30];

/**
 * The farm's money for a period: `range=today|7d|30d|month|lastmonth`,
 * `month=YYYY-MM` or `from`/`to` days (see resolveRange). Returns `summary`
 * (profit and cash flow), `chart`, the last 12 `months` and current `dues`.
 *
 * Older mobile builds send `period=N` (the last N days) and read `periods`,
 * `dailyBreakdown`, `totalDue` and `totalPayable`; those keep working, now
 * on the profit basis (sales made, labour earned).
 */
export const GET = withOwner(async (req, { tenantId }) => {
  try {
    const url = new URL(req.url);
    const q = (k: string) => url.searchParams.get(k);
    const rawPeriod = q('period');
    const period = rawPeriod === null ? null : Number(rawPeriod);
    if (period !== null && !(Number.isInteger(period) && period >= 1 && period <= 366)) {
      return Response.json({ error: 'period must be a whole number of days from 1 to 366' }, { status: 400 });
    }

    const now = new Date();
    const today = farmToday(now);
    const lastDays = (n: number) => ({ from: addDaysIso(today + 'T12:00:00Z', -(n - 1)), to: today });
    const range = period !== null ? resolveRange(lastDays(period), now) : resolveRange({ range: q('range'), month: q('month'), from: q('from'), to: q('to') }, now);

    const data = await loadFinanceData(tenantId);
    const report = await getFinanceReport(tenantId, range, now, data);

    const periods = LEGACY_PERIODS.map((days) => {
      const r = lastDays(days);
      const s = summaryFor(data, r.from, r.to, now).profit;
      return {
        days,
        totalSales: s.salesMade,
        totalOtherIncome: s.otherIncome,
        totalRevenue: s.income,
        salesCount: s.salesCount,
        totalSalaryCost: s.labour + s.writtenOff,
        totalFeedCost: s.feed,
        // Older builds show one "other costs" line: animal care is part of it.
        totalOtherCost: s.otherExpenses + s.animalCare,
        totalCost: s.costs,
        netProfit: s.profit,
      };
    });

    return Response.json({
      ...report,
      periods,
      dailyBreakdown: report.chart.map((c) => ({ date: c.key, revenue: c.income, cost: c.costs, profit: c.profit })),
      totalDue: report.dues.customersOwe,
      totalPayable: report.dues.youOweSuppliers,
    });
  } catch (err: unknown) {
    console.error('Error building money report:', err);
    return Response.json({ error: 'Failed to load the money report' }, { status: 500 });
  }
});
