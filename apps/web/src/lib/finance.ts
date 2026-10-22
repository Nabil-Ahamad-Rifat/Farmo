// One place that works out the farm's money for any period, used by the
// Revenue Portal, the dashboard, the monthly report and the mobile app, so
// every screen shows the same numbers. Each source is loaded once and the
// pure maths in @farm/business-logic does the rest.
import {
  addDaysIso, daysBetween, farmToday, financeBetween, monthBounds, monthsBetween, shiftMonth, type FinanceData,
} from '@farm/business-logic';
import { db } from '@/lib/db';
import { farmWorkers, listWorkers } from '@/lib/payroll';
import { totalReceivable } from '@/lib/receivables';
import { totalPayable } from '@/lib/payables';

/** Everything the money maths needs, for the whole farm. */
export async function loadFinanceData(tenantId: string): Promise<FinanceData> {
  const [sales, customerPayments, otherIncome, otherExpenses, feed, supplierPayments, workers, animalCosts] = await Promise.all([
    db.sale.findMany({ where: { tenantId }, select: { amount: true, createdAt: true, customerId: true, status: true } }),
    db.payment.findMany({ where: { tenantId }, select: { amount: true, paidAt: true } }),
    db.otherIncome.findMany({ where: { tenantId }, select: { amount: true, incomeDate: true } }),
    db.otherExpense.findMany({ where: { tenantId }, select: { amount: true, expenseDate: true } }),
    db.feedBatch.findMany({
      where: { tenantId },
      select: { quantity: true, unitPrice: true, coverDays: true, purchasedAt: true, createdAt: true, supplierId: true },
    }),
    db.supplierPayment.findMany({ where: { tenantId }, select: { amount: true, paidAt: true } }),
    farmWorkers(tenantId),
    db.animalEvent.findMany({ where: { tenantId, cost: { gt: 0 } }, select: { cost: true, date: true } }),
  ]);
  return {
    sales: sales.map((s) => ({ amount: s.amount, date: s.createdAt, customerId: s.customerId, status: s.status })),
    customerPayments: customerPayments.map((p) => ({ amount: p.amount, date: p.paidAt })),
    otherIncome: otherIncome.map((i) => ({ amount: i.amount, date: i.incomeDate })),
    otherExpenses: otherExpenses.map((e) => ({ amount: e.amount, date: e.expenseDate })),
    feed,
    supplierPayments: supplierPayments.map((p) => ({ amount: p.amount, date: p.paidAt })),
    workers,
    animalCosts: animalCosts.map((e) => ({ amount: e.cost ?? 0, date: e.date })),
  };
}

const noon = (day: string) => new Date(day + 'T12:00:00Z');
const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const isMonth = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);

export const RANGE_PRESETS = ['today', '7d', '30d', 'month', 'lastmonth'] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number] | 'pick' | 'custom';

export interface FinanceRange {
  preset: RangePreset;
  from: string;
  to: string;
  /** "YYYY-MM" when the range is one whole month. */
  month: string | null;
}

/** Longest custom range (a bit over two years). */
const MAX_DAYS = 800;

/**
 * The period asked for in the URL, on the farm's calendar:
 * `range=today|7d|30d|month|lastmonth`, `month=YYYY-MM`, or `from`/`to`
 * days. Anything missing or invalid falls back to this month.
 */
export function resolveRange(params: { range?: string | null; month?: string | null; from?: string | null; to?: string | null }, now = new Date()): FinanceRange {
  const today = farmToday(now);
  const thisMonth = today.slice(0, 7);
  const whole = (month: string, preset: RangePreset): FinanceRange => {
    const { start, end } = monthBounds(month);
    const last = end.toISOString().slice(0, 10);
    return { preset, from: start.toISOString().slice(0, 10), to: last > today ? today : last, month };
  };

  if (isDay(params.from) && isDay(params.to) && params.from <= params.to) {
    const to = params.to > today ? today : params.to;
    const from = daysBetween(params.from, to).length > MAX_DAYS ? addDaysIso(noon(to), -(MAX_DAYS - 1)) : params.from;
    return { preset: 'custom', from: from > to ? to : from, to, month: null };
  }
  if (isMonth(params.month) && params.month <= thisMonth) return whole(params.month, params.month === thisMonth ? 'month' : 'pick');
  switch (params.range) {
    case 'today':
      return { preset: 'today', from: today, to: today, month: null };
    case '7d':
      return { preset: '7d', from: addDaysIso(noon(today), -6), to: today, month: null };
    case '30d':
      return { preset: '30d', from: addDaysIso(noon(today), -29), to: today, month: null };
    case 'lastmonth':
      return whole(shiftMonth(thisMonth, -1), 'lastmonth');
    default:
      return whole(thisMonth, 'month');
  }
}

/** Profit and cash flow for one period. */
export function summaryFor(data: FinanceData, from: string, to: string, now = new Date()) {
  return financeBetween(data, noon(from), noon(to), now);
}

/**
 * The full money report for a period: totals, a chart (per day for up to two
 * months, otherwise per month), the last 12 months, and what is owed now.
 */
export async function getFinanceReport(tenantId: string, range: FinanceRange, now = new Date(), preloaded?: FinanceData) {
  const [data, customersOwe, youOweSuppliers, workers] = await Promise.all([
    preloaded ?? loadFinanceData(tenantId),
    totalReceivable(tenantId),
    totalPayable(tenantId),
    listWorkers(tenantId, now),
  ]);
  const days = daysBetween(range.from, range.to);
  const chart =
    days.length <= 62
      ? days.map((d) => ({ key: d, ...bar(summaryFor(data, d, d, now)) }))
      : monthsBetween(range.from, range.to).map((m) => {
          const { start, end } = monthBounds(m);
          const from = start.toISOString().slice(0, 10) < range.from ? range.from : start.toISOString().slice(0, 10);
          const to = end.toISOString().slice(0, 10) > range.to ? range.to : end.toISOString().slice(0, 10);
          return { key: m, ...bar(summaryFor(data, from, to, now)) };
        });

  const thisMonth = farmToday(now).slice(0, 7);
  const months = Array.from({ length: 12 }, (_, i) => shiftMonth(thisMonth, -i)).map((m) => {
    const { start, end } = monthBounds(m);
    const s = summaryFor(data, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10), now);
    return { month: m, income: s.profit.income, costs: s.profit.costs, profit: s.profit.profit, moneyIn: s.cash.moneyIn, moneyOut: s.cash.moneyOut };
  });
  // Drop the empty months from before the farm started recording (keep this month).
  const isEmpty = (m: (typeof months)[number]) => !m.income && !m.costs && !m.moneyIn && !m.moneyOut;
  while (months.length > 1 && isEmpty(months[months.length - 1])) months.pop();

  return {
    range: { ...range, days: days.length },
    summary: summaryFor(data, range.from, range.to, now),
    chart,
    months,
    dues: {
      customersOwe,
      youOweSuppliers,
      youOweWorkers: workers.reduce((s, w) => s + Math.max(0, w.account.balance), 0),
      workerAdvances: workers.reduce((s, w) => s + Math.max(0, -w.account.balance), 0),
    },
  };
}

const bar = (s: ReturnType<typeof financeBetween>) => ({ income: s.profit.income, costs: s.profit.costs, profit: s.profit.profit });

export type FinanceReport = Awaited<ReturnType<typeof getFinanceReport>>;
