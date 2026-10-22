import { customerMonths, farmMonth, feedMonthSummary, monthBounds, monthlyStatement, type MonthLine } from '@farm/business-logic';
import { db } from '@/lib/db';
import { loadFinanceData, summaryFor } from '@/lib/finance';

/** "YYYY-MM" if valid, else the current month. */
export function parseMonth(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : farmMonth();
}

export interface ReportLine extends MonthLine {
  customer: { id: string; name: string; type: string; phone: string | null } | null;
}

/** The month's statement for the whole farm, with each line's customer attached. */
export async function getMonthlyReport(tenantId: string, month: string) {
  const { start, end } = monthBounds(month);
  const [sales, payments, customers, feedBatches, money] = await Promise.all([
    db.sale.findMany({
      where: { tenantId, createdAt: { lte: end } },
      select: { customerId: true, amount: true, createdAt: true, saleType: true, quantity: true, status: true },
    }),
    db.payment.findMany({
      where: { tenantId, paidAt: { lte: end } },
      select: { customerId: true, amount: true, paidAt: true },
    }),
    db.customer.findMany({ where: { tenantId }, select: { id: true, name: true, type: true, phone: true } }),
    db.feedBatch.findMany({
      where: { tenantId },
      select: { name: true, quantity: true, unitPrice: true, purchasedAt: true, createdAt: true, supplierId: true, paidAmount: true },
    }),
    // Profit and cash for the month, the same numbers as the Revenue Portal.
    loadFinanceData(tenantId).then((data) => summaryFor(data, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10))),
  ]);

  const statement = monthlyStatement(
    sales.map((s) => ({
      partyId: s.customerId ?? null,
      amount: s.amount,
      date: s.createdAt,
      saleType: s.saleType,
      quantity: s.quantity,
      status: s.status,
    })),
    payments.map((p) => ({ partyId: p.customerId, amount: p.amount, date: p.paidAt })),
    month,
  );

  const byId = new Map(customers.map((c) => [c.id, c]));
  const lines: ReportLine[] = statement.lines.map((l) => ({ ...l, customer: l.partyId ? byId.get(l.partyId) ?? null : null }));
  // Feed bought this month (cost, paid, owed), for the report's feed line.
  const feed = feedMonthSummary(feedBatches, month).totals;
  return { month, totals: statement.totals, lines, feed, money };
}

/** One customer's months with activity, newest first, for the grouped history on their page. */
export async function getCustomerMonths(tenantId: string, customerId: string) {
  const [sales, payments] = await Promise.all([
    db.sale.findMany({
      where: { tenantId, customerId },
      select: { amount: true, createdAt: true, saleType: true, quantity: true },
    }),
    db.payment.findMany({ where: { tenantId, customerId }, select: { amount: true, paidAt: true } }),
  ]);
  return customerMonths(
    sales.map((s) => ({ partyId: customerId, amount: s.amount, date: s.createdAt, saleType: s.saleType, quantity: s.quantity })),
    payments.map((p) => ({ partyId: customerId, amount: p.amount, date: p.paidAt })),
  );
}
