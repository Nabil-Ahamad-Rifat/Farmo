import { describe, it, expect } from 'vitest';
import {
  daysAgo,
  farmToday,
  farmMonth,
  daysInMonth,
  dayRate,
  workerEarned,
  workerAccount,
  workerMonths,
  labourBetween,
  type WorkerLike,
  financeBetween,
  inListPeriod,
  daysBetween,
  monthsBetween,
  type FinanceData,
  formatCurrency,
  sumAmounts,
  calculateSaleAmount,
  isLowStock,
  stockPercentage,
  totalStockValue,
  totalBatchCost,
  totalActiveMonthlySalary,
  barHeightPx,
  allocatePayments,
  feedSchedule,
  storedFeedRemaining,
  feedCostBetween,
  feedMonthSummary,
  nextAnimalId,
  expectedCalving,
  ageLabel,
  animalSummary,
  dueSoon,
  type AnimalEventLike,
  monthKey,
  monthBounds,
  shiftMonth,
  monthlyStatement,
  customerMonths,
  type StatementSale,
  type StatementPayment,
} from './index';

describe('daysAgo', () => {
  it('returns the start of today (UTC) for days=1', () => {
    const result = daysAgo(1);
    const now = new Date();
    expect(result.getUTCFullYear()).toBe(now.getUTCFullYear());
    expect(result.getUTCMonth()).toBe(now.getUTCMonth());
    expect(result.getUTCDate()).toBe(now.getUTCDate());
    expect(result.getUTCHours()).toBe(0);
    expect(result.getUTCMinutes()).toBe(0);
  });

  it('goes back further in time for larger day counts', () => {
    expect(daysAgo(7).getTime()).toBeLessThan(daysAgo(1).getTime());
    expect(daysAgo(30).getTime()).toBeLessThan(daysAgo(7).getTime());
  });
});

describe('formatCurrency', () => {
  it('defaults to the ৳ symbol with 2 decimal places', () => {
    expect(formatCurrency(1234.5)).toBe('৳1,234.50');
  });

  it('accepts a custom symbol', () => {
    expect(formatCurrency(10, '$')).toBe('$10.00');
  });

  it('handles zero', () => {
    expect(formatCurrency(0)).toBe('৳0.00');
  });
});

describe('sumAmounts', () => {
  it('sums the amount field across items', () => {
    expect(sumAmounts([{ amount: 10 }, { amount: 5.5 }, { amount: 0 }])).toBe(15.5);
  });

  it('returns 0 for an empty list', () => {
    expect(sumAmounts([])).toBe(0);
  });
});

describe('calculateSaleAmount', () => {
  it('multiplies quantity by unit price', () => {
    expect(calculateSaleAmount('10', '85.5')).toBe(855);
    expect(calculateSaleAmount(10, 85.5)).toBe(855);
  });

  it('returns null when either input is missing, zero, or non-numeric', () => {
    expect(calculateSaleAmount('', '85.5')).toBeNull();
    expect(calculateSaleAmount('10', '')).toBeNull();
    expect(calculateSaleAmount('0', '85.5')).toBeNull();
    expect(calculateSaleAmount('abc', '85.5')).toBeNull();
    expect(calculateSaleAmount('-5', '10')).toBeNull();
  });
});

describe('isLowStock / stockPercentage', () => {
  it('flags stock below 20% remaining as low', () => {
    expect(isLowStock({ quantity: 100, remainingQuantity: 19 })).toBe(true);
    expect(isLowStock({ quantity: 100, remainingQuantity: 20 })).toBe(false);
    expect(isLowStock({ quantity: 100, remainingQuantity: 50 })).toBe(false);
  });

  it('computes remaining percentage rounded to the nearest integer', () => {
    expect(stockPercentage({ quantity: 200, remainingQuantity: 50 })).toBe(25);
    expect(stockPercentage({ quantity: 3, remainingQuantity: 1 })).toBe(33);
  });
});

describe('totalStockValue / totalBatchCost', () => {
  const batches = [
    { quantity: 100, remainingQuantity: 40, unitPrice: 10 },
    { quantity: 50, remainingQuantity: 50, unitPrice: 20 },
  ];

  it('values remaining stock at unit price', () => {
    expect(totalStockValue(batches)).toBe(40 * 10 + 50 * 20);
  });

  it('values total invested cost at unit price', () => {
    expect(totalBatchCost(batches)).toBe(100 * 10 + 50 * 20);
  });
});

describe('totalActiveMonthlySalary', () => {
  it('sums salary only for active employees, treating missing status as active', () => {
    const employees = [
      { status: 'active', salary: 100 },
      { status: 'terminated', salary: 999 },
      { status: undefined, salary: 50 },
    ];
    expect(totalActiveMonthlySalary(employees)).toBe(150);
  });
});

describe('barHeightPx', () => {
  it('scales proportionally to maxValue', () => {
    expect(barHeightPx(50, 100, 200)).toBe(100);
  });

  it('floors positive-but-tiny values to a visible minimum', () => {
    expect(barHeightPx(0.001, 1000, 200)).toBe(2);
  });

  it('renders zero as zero height', () => {
    expect(barHeightPx(0, 100, 200)).toBe(0);
  });
});

describe('allocatePayments', () => {
  const sales = [
    { id: 'b', amount: 500, date: '2026-09-02' },
    { id: 'a', amount: 1000, date: '2026-09-01' },
  ];

  it('marks everything pending when nothing is paid', () => {
    const r = allocatePayments(sales, []);
    expect(r.perSale.map((s) => s.status)).toEqual(['pending', 'pending']);
    expect(r.totalDue).toBe(1500);
    expect(r.advance).toBe(0);
  });

  it('fills the oldest sale first on a partial payment', () => {
    const r = allocatePayments(sales, [{ amount: 400 }]);
    expect(r.perSale).toEqual([
      { id: 'a', paidAmount: 400, status: 'partial' },
      { id: 'b', paidAmount: 0, status: 'pending' },
    ]);
    expect(r.totalDue).toBe(1100);
  });

  it('pools several payments across sales', () => {
    const r = allocatePayments(sales, [{ amount: 600 }, { amount: 600 }]);
    expect(r.perSale).toEqual([
      { id: 'a', paidAmount: 1000, status: 'paid' },
      { id: 'b', paidAmount: 200, status: 'partial' },
    ]);
    expect(r.totalDue).toBe(300);
  });

  it('settles exactly with no advance', () => {
    const r = allocatePayments(sales, [{ amount: 1500 }]);
    expect(r.perSale.every((s) => s.status === 'paid')).toBe(true);
    expect(r.totalDue).toBe(0);
    expect(r.advance).toBe(0);
  });

  it('keeps an overpayment as advance that covers a later sale', () => {
    const before = allocatePayments(sales, [{ amount: 1900 }]);
    expect(before.advance).toBe(400);
    const after = allocatePayments([...sales, { id: 'c', amount: 300, date: '2026-09-03' }], [{ amount: 1900 }]);
    expect(after.perSale.find((s) => s.id === 'c')).toEqual({ id: 'c', paidAmount: 300, status: 'paid' });
    expect(after.advance).toBe(100);
    expect(after.totalDue).toBe(0);
  });

  it('avoids floating point drift', () => {
    const r = allocatePayments([{ id: 'x', amount: 0.3, date: '2026-09-01' }], [{ amount: 0.1 }, { amount: 0.2 }]);
    expect(r.perSale[0].status).toBe('paid');
    expect(r.totalDue).toBe(0);
  });
});

describe('feedSchedule', () => {
  const batch = {
    quantity: 300,
    unitPrice: 10,
    coverDays: 3,
    purchasedAt: '2026-10-01T12:00:00Z',
    remainingQuantity: 300,
  };

  it('returns null for a legacy batch with no days set', () => {
    expect(feedSchedule({ ...batch, coverDays: null })).toBeNull();
  });

  it('splits quantity and cost evenly per day', () => {
    const s = feedSchedule(batch, '2026-10-01T18:00:00Z')!;
    expect(s.perDayQty).toBe(100);
    expect(s.perDayCost).toBe(1000);
    expect(s.startsOn).toBe('2026-10-01');
    expect(s.endsOn).toBe('2026-10-03');
  });

  it('counts the share for today as used', () => {
    const s = feedSchedule(batch, '2026-10-01T06:00:00Z')!;
    expect(s.daysUsed).toBe(1);
    expect(s.remaining).toBe(200);
    expect(s.daysLeft).toBe(2);
    expect(s.runsOutOn).toBe('2026-10-03');
  });

  it('shows the full stock before the purchase date', () => {
    const s = feedSchedule(batch, '2026-09-30T12:00:00Z')!;
    expect(s.daysUsed).toBe(0);
    expect(s.remaining).toBe(300);
    expect(s.daysLeft).toBe(3);
    expect(s.runsOutOn).toBe('2026-10-03');
  });

  it('is empty once all days have passed', () => {
    const s = feedSchedule(batch, '2026-10-09T12:00:00Z')!;
    expect(s.daysUsed).toBe(3);
    expect(s.remaining).toBe(0);
    expect(s.daysLeft).toBe(0);
    expect(s.runsOutOn).toBe('2026-10-03');
  });

  it('runs out sooner after extra recorded use', () => {
    // 120 kg used by hand on top of the schedule: 180 stored, 80 left after day 1.
    const s = feedSchedule({ ...batch, remainingQuantity: 180 }, '2026-10-01T12:00:00Z')!;
    expect(s.remaining).toBe(80);
    expect(s.daysLeft).toBe(0);
    expect(s.runsOutOn).toBe('2026-10-01');
  });

  it('handles a 1-day batch', () => {
    const s = feedSchedule({ ...batch, coverDays: 1 }, '2026-10-01T12:00:00Z')!;
    expect(s.perDayQty).toBe(300);
    expect(s.remaining).toBe(0);
    expect(s.endsOn).toBe('2026-10-01');
  });
});

describe('storedFeedRemaining', () => {
  const batch = { quantity: 300, unitPrice: 10, coverDays: 3, purchasedAt: '2026-10-01T12:00:00Z' };

  it('adds back the scheduled use so far, capped at the quantity bought', () => {
    expect(storedFeedRemaining(batch, 50, '2026-10-02T12:00:00Z')).toBe(250);
    expect(storedFeedRemaining(batch, 150, '2026-10-02T12:00:00Z')).toBe(300);
  });

  it('round-trips with feedSchedule', () => {
    const now = '2026-10-02T12:00:00Z';
    const stored = storedFeedRemaining(batch, 70, now);
    expect(feedSchedule({ ...batch, remainingQuantity: stored }, now)!.remaining).toBe(70);
  });

  it('stores legacy batches as given', () => {
    expect(storedFeedRemaining({ ...batch, coverDays: null }, 42)).toBe(42);
  });
});

describe('feedCostBetween', () => {
  const b = { quantity: 300, unitPrice: 10, coverDays: 3, purchasedAt: '2026-10-01T12:00:00Z' };

  it('counts one day of a 3-day batch as a third of the cost', () => {
    expect(feedCostBetween([b], '2026-10-02T00:00:00Z', '2026-10-02T23:59:59Z')).toBe(1000);
  });

  it('counts only the days that overlap the period', () => {
    expect(feedCostBetween([b], '2026-10-03T00:00:00Z', '2026-10-10T00:00:00Z')).toBe(1000);
    expect(feedCostBetween([b], '2026-09-25T00:00:00Z', '2026-10-02T00:00:00Z')).toBe(2000);
  });

  it('counts the whole cost for a period covering the batch', () => {
    expect(feedCostBetween([b], '2026-09-01T00:00:00Z', '2026-10-31T00:00:00Z')).toBe(3000);
  });

  it('counts nothing for a batch that ended before the period', () => {
    expect(feedCostBetween([b], '2026-10-04T00:00:00Z', '2026-10-05T00:00:00Z')).toBe(0);
  });

  it('handles a 1-day batch', () => {
    expect(feedCostBetween([{ ...b, coverDays: 1 }], '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z')).toBe(3000);
  });

  it('counts a batch with no days in full on its purchase day only', () => {
    const unknown = { ...b, coverDays: null };
    expect(feedCostBetween([unknown], '2026-10-01T00:00:00Z', '2026-10-01T23:59:59Z')).toBe(3000);
    expect(feedCostBetween([unknown], '2026-10-02T00:00:00Z', '2026-10-31T00:00:00Z')).toBe(0);
    expect(feedCostBetween([unknown], '2026-09-01T00:00:00Z', '2026-10-31T00:00:00Z')).toBe(3000);
  });

  it('uses createdAt when an old batch has no purchase date', () => {
    const old = { quantity: 10, unitPrice: 20, coverDays: null, purchasedAt: null, createdAt: '2026-09-05T08:00:00Z' };
    expect(feedCostBetween([old], '2026-09-01T00:00:00Z', '2026-09-30T00:00:00Z')).toBe(200);
  });

  it('rounds uneven splits to paisa', () => {
    const uneven = { quantity: 1, unitPrice: 1000, coverDays: 3, purchasedAt: '2026-10-01T12:00:00Z' };
    expect(feedCostBetween([uneven], '2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z')).toBe(333.33);
    expect(feedCostBetween([uneven], '2026-10-01T00:00:00Z', '2026-10-03T00:00:00Z')).toBe(1000);
  });
});

describe('month helpers', () => {
  it('monthKey uses UTC', () => {
    expect(monthKey('2026-10-31T23:30:00Z')).toBe('2026-10');
    expect(monthKey('2026-11-01T00:00:00Z')).toBe('2026-11');
  });

  it('shiftMonth crosses year boundaries', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });

  it('monthBounds covers the whole month', () => {
    const { start, end } = monthBounds('2026-02');
    expect(start.toISOString()).toBe('2026-02-01T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-02-28T23:59:59.999Z');
  });
});

describe('monthlyStatement', () => {
  const sale = (partyId: string | null, amount: number, date: string, extra: Partial<StatementSale> = {}): StatementSale => ({ partyId, amount, date, saleType: 'milk', quantity: amount / 70, ...extra });
  const pay = (partyId: string, amount: number, date: string): StatementPayment => ({ partyId, amount, date });

  const sales = [
    sale('karim', 1000, '2026-09-10T12:00:00Z', { quantity: 10 }),
    sale('karim', 500, '2026-10-05T12:00:00Z', { quantity: 5 }),
    sale('rahim', 200, '2026-10-06T12:00:00Z', { saleType: 'other', quantity: 1 }),
  ];
  const payments = [
    pay('karim', 400, '2026-09-10T12:00:00Z'),
    pay('karim', 300, '2026-10-20T12:00:00Z'),
    pay('selim', 100, '2026-08-01T12:00:00Z'),
  ];

  it('carries the due from earlier months', () => {
    const st = monthlyStatement(sales, payments, '2026-10');
    const karim = st.lines.find((l) => l.partyId === 'karim');
    expect(karim).toMatchObject({ carriedIn: 600, sold: 500, paid: 300, closing: 800, milkLitres: 5, salesCount: 1, paymentsCount: 1 });
  });

  it('counts the earlier month on its own', () => {
    const karim = monthlyStatement(sales, payments, '2026-09').lines.find((l) => l.partyId === 'karim');
    expect(karim).toMatchObject({ carriedIn: 0, sold: 1000, paid: 400, closing: 600, milkLitres: 10 });
  });

  it('counts milk litres only for milk sales', () => {
    const st = monthlyStatement(sales, payments, '2026-10');
    expect(st.lines.find((l) => l.partyId === 'rahim')!.milkLitres).toBe(0);
    expect(st.totals.milkLitres).toBe(5);
  });

  it('keeps an advance as a negative balance that does not offset other dues', () => {
    const st = monthlyStatement(sales, payments, '2026-10');
    const selim = st.lines.find((l) => l.partyId === 'selim');
    expect(selim).toMatchObject({ carriedIn: -100, closing: -100, sold: 0, paid: 0 });
    expect(st.totals).toMatchObject({ sold: 700, collected: 300, carriedIn: 600, dueAtEnd: 1000, advanceAtEnd: 100 });
  });

  it('drops parties with no activity and a zero balance', () => {
    const st = monthlyStatement([sale('old', 100, '2026-01-01T12:00:00Z')], [pay('old', 100, '2026-01-02T12:00:00Z')], '2026-10');
    expect(st.lines).toHaveLength(0);
  });

  it('a payment in a later month clears the due then', () => {
    const s = [sale('k', 900, '2026-09-30T12:00:00Z')];
    const p = [pay('k', 900, '2026-10-01T12:00:00Z')];
    expect(monthlyStatement(s, p, '2026-09').lines[0].closing).toBe(900);
    expect(monthlyStatement(s, p, '2026-10').lines[0]).toMatchObject({ carriedIn: 900, paid: 900, closing: 0 });
  });

  it('treats legacy customer-less sales marked paid as paid on the sale date', () => {
    const s = [
      sale(null, 300, '2026-10-02T12:00:00Z', { status: 'paid' }),
      sale(null, 200, '2026-10-03T12:00:00Z', { status: 'pending' }),
      sale(null, 50, '2026-09-03T12:00:00Z', { status: 'pending' }),
    ];
    const none = monthlyStatement(s, [], '2026-10').lines.find((l) => l.partyId === null);
    expect(none).toMatchObject({ carriedIn: 50, sold: 500, paid: 300, closing: 250 });
  });

  it('sorts lines with the most owed first', () => {
    const st = monthlyStatement(sales, payments, '2026-10');
    expect(st.lines.map((l) => l.partyId)).toEqual(['karim', 'rahim', 'selim']);
  });
});

describe('customerMonths', () => {
  it('lists months with activity newest first, with a running closing balance', () => {
    const months = customerMonths(
      [
        { partyId: 'k', amount: 1000, date: '2026-08-10T12:00:00Z', saleType: 'milk', quantity: 10 },
        { partyId: 'k', amount: 500, date: '2026-10-05T12:00:00Z', saleType: 'milk', quantity: 5 },
      ],
      [{ partyId: 'k', amount: 400, date: '2026-08-11T12:00:00Z' }],
    );
    expect(months).toEqual([
      { month: '2026-10', milkLitres: 5, sold: 500, paid: 0, closing: 1100 },
      { month: '2026-08', milkLitres: 10, sold: 1000, paid: 400, closing: 600 },
    ]);
  });
});

describe('feedMonthSummary', () => {
  const batches = [
    { id: 'a', name: 'Bushi', quantity: 500, unitPrice: 35, purchasedAt: '2026-10-02T12:00:00Z', supplierId: 's1', paidAmount: 10000 },
    { id: 'b', name: 'bushi ', quantity: 100, unitPrice: 35, purchasedAt: '2026-10-20T12:00:00Z', supplierId: null, paidAmount: null },
    { id: 'c', name: 'Gom', quantity: 200, unitPrice: 40, purchasedAt: '2026-10-05T12:00:00Z', supplierId: 's1', paidAmount: 0 },
    { id: 'd', name: 'Gom', quantity: 50, unitPrice: 40, purchasedAt: '2026-09-28T12:00:00Z', supplierId: null, paidAmount: null },
  ];

  it('totals only the purchases of that month', () => {
    const m = feedMonthSummary(batches, '2026-10');
    expect(m.totals).toEqual({ kg: 800, spent: 29000, paid: 13500, owed: 15500, count: 3 });
  });

  it('subtotals per feed name, ignoring case and spaces, largest spend first', () => {
    const m = feedMonthSummary(batches, '2026-10');
    expect(m.byFeed).toEqual([
      { name: 'Bushi', kg: 600, spent: 21000, count: 2 },
      { name: 'Gom', kg: 200, spent: 8000, count: 1 },
    ]);
  });

  it('lists purchases newest first', () => {
    expect(feedMonthSummary(batches, '2026-10').purchases.map((p) => p.id)).toEqual(['b', 'c', 'a']);
  });

  it('is empty for a month with no purchases', () => {
    expect(feedMonthSummary(batches, '2026-08')).toMatchObject({ totals: { kg: 0, spent: 0, paid: 0, owed: 0, count: 0 }, byFeed: [], purchases: [] });
  });
});

describe('nextAnimalId', () => {
  it('starts at C-001', () => {
    expect(nextAnimalId([])).toBe('C-001');
  });

  it('continues after the highest C- number and ignores other formats', () => {
    expect(nextAnimalId(['C-001', 'c-007', 'EAR-55', 'C-3'])).toBe('C-008');
  });

  it('never repeats an ID that is already taken', () => {
    expect(nextAnimalId(['C-002', 'C-001'])).toBe('C-003');
  });
});

describe('expectedCalving and ageLabel', () => {
  it('adds 283 days to the insemination date', () => {
    expect(expectedCalving('2026-01-10T12:00:00Z')).toBe('2026-10-20');
  });

  it('shows age in days, months, or years and months', () => {
    expect(ageLabel('2026-10-01T12:00:00Z', '2026-10-13T12:00:00Z')).toBe('12 d');
    expect(ageLabel('2026-05-06T12:00:00Z', '2026-10-06T12:00:00Z')).toBe('5 m');
    expect(ageLabel('2024-07-06T12:00:00Z', '2026-10-06T12:00:00Z')).toBe('2 y 3 m');
    expect(ageLabel('2024-10-06T12:00:00Z', '2026-10-06T12:00:00Z')).toBe('2 y');
  });
});

describe('animalSummary', () => {
  it('is empty for an animal with no records', () => {
    expect(animalSummary([])).toMatchObject({ pregnancy: 'unknown', expectedCalving: null, dueDoses: [], careCost: 0 });
  });

  it('marks an animal inseminated with expected calving and a pregnancy check due', () => {
    const s = animalSummary([{ type: 'insemination', date: '2026-01-10T12:00:00Z', title: 'Sahiwal straw 12', cost: 500 }]);
    expect(s.pregnancy).toBe('inseminated');
    expect(s.expectedCalving).toBe('2026-10-20');
    expect(s.pregnancyCheckDue).toBe('2026-03-11');
    expect(s.lastInsemination).toEqual({ title: 'Sahiwal straw 12', date: '2026-01-10' });
    expect(s.careCost).toBe(500);
  });

  it('a positive check makes it pregnant and clears the check reminder', () => {
    const s = animalSummary([
      { type: 'insemination', date: '2026-01-10T12:00:00Z' },
      { type: 'pregnancy_check', date: '2026-03-15T12:00:00Z', result: 'positive' },
    ]);
    expect(s.pregnancy).toBe('pregnant');
    expect(s.expectedCalving).toBe('2026-10-20');
    expect(s.pregnancyCheckDue).toBeNull();
  });

  it('a negative check or a calving makes it open again', () => {
    const neg = animalSummary([
      { type: 'insemination', date: '2026-01-10T12:00:00Z' },
      { type: 'pregnancy_check', date: '2026-03-15T12:00:00Z', result: 'negative' },
    ]);
    expect(neg).toMatchObject({ pregnancy: 'open', expectedCalving: null });
    const calved = animalSummary([
      { type: 'insemination', date: '2025-01-10T12:00:00Z' },
      { type: 'calving', date: '2025-10-18T12:00:00Z' },
    ]);
    expect(calved).toMatchObject({ pregnancy: 'open', expectedCalving: null, lastCalving: '2025-10-18' });
  });

  it('works from the records in date order, whatever order they come in', () => {
    const s = animalSummary([
      { type: 'pregnancy_check', date: '2026-03-15T12:00:00Z', result: 'positive' },
      { type: 'insemination', date: '2026-01-10T12:00:00Z' },
    ]);
    expect(s.pregnancy).toBe('pregnant');
  });

  it('keeps only the latest dose of each vaccine for the next due date', () => {
    const s = animalSummary([
      { type: 'vaccine', date: '2026-01-01T12:00:00Z', title: 'FMD', nextDueDate: '2026-07-01T12:00:00Z' },
      { type: 'vaccine', date: '2026-07-02T12:00:00Z', title: 'fmd', nextDueDate: '2027-01-02T12:00:00Z' },
      { type: 'deworming', date: '2026-08-01T12:00:00Z', nextDueDate: '2026-11-01T12:00:00Z' },
      { type: 'vaccine', date: '2026-08-05T12:00:00Z', title: 'Anthrax' },
    ]);
    expect(s.dueDoses).toEqual([
      { type: 'deworming', title: 'Deworming', dueDate: '2026-11-01' },
      { type: 'vaccine', title: 'fmd', dueDate: '2027-01-02' },
    ]);
    expect(s.lastVaccine).toEqual({ title: 'Anthrax', date: '2026-08-05' });
  });

  it('tracks the latest weight', () => {
    const s = animalSummary([
      { type: 'weight', date: '2026-01-01T12:00:00Z', value: 300 },
      { type: 'weight', date: '2026-06-01T12:00:00Z', value: 340 },
    ]);
    expect(s.latestWeight).toEqual({ value: 340, date: '2026-06-01' });
  });
});

describe('dueSoon', () => {
  const now = '2026-10-06T09:00:00Z';
  const animal = (id: string, events: AnimalEventLike[]) => ({ id, tagNumber: id.toUpperCase(), name: id, events });

  it('lists doses overdue or due within 7 days, soonest first', () => {
    const items = dueSoon(
      [
        animal('a', [{ type: 'vaccine', date: '2026-04-01T12:00:00Z', title: 'FMD', nextDueDate: '2026-10-09T12:00:00Z' }]),
        animal('b', [{ type: 'deworming', date: '2026-07-01T12:00:00Z', nextDueDate: '2026-10-01T12:00:00Z' }]),
        animal('c', [{ type: 'vaccine', date: '2026-04-01T12:00:00Z', title: 'LSD', nextDueDate: '2026-12-01T12:00:00Z' }]),
      ],
      now,
    );
    expect(items.map((i) => [i.cowId, i.kind, i.daysLeft])).toEqual([
      ['b', 'deworming', -5],
      ['a', 'vaccine', 3],
    ]);
  });

  it('lists calvings expected within 30 days and pregnancy checks due', () => {
    const items = dueSoon(
      [
        animal('cow', [
          { type: 'insemination', date: '2026-01-10T12:00:00Z' },
          { type: 'pregnancy_check', date: '2026-03-15T12:00:00Z', result: 'positive' },
        ]),
        animal('heifer', [{ type: 'insemination', date: '2026-08-05T12:00:00Z' }]),
        animal('far', [{ type: 'insemination', date: '2026-06-01T12:00:00Z' }, { type: 'pregnancy_check', date: '2026-08-01T12:00:00Z', result: 'positive' }]),
      ],
      now,
    );
    expect(items).toEqual([
      { cowId: 'heifer', tagNumber: 'HEIFER', name: 'heifer', kind: 'pregnancy_check', title: 'Pregnancy check', dueDate: '2026-10-04', daysLeft: -2 },
      { cowId: 'cow', tagNumber: 'COW', name: 'cow', kind: 'calving', title: 'Expected calving', dueDate: '2026-10-20', daysLeft: 14 },
    ]);
  });
});

describe('farm calendar', () => {
  it('uses Bangladesh time: 01:00 BD is still the previous UTC day', () => {
    // 2026-10-07 19:30 UTC is 2026-10-08 01:30 in Bangladesh.
    expect(farmToday('2026-10-07T19:30:00Z')).toBe('2026-10-08');
    expect(farmToday('2026-10-07T17:59:00Z')).toBe('2026-10-07');
    expect(farmMonth('2026-10-31T18:30:00Z')).toBe('2026-11');
  });
  it('knows month lengths', () => {
    expect(daysInMonth('2026-02')).toBe(28);
    expect(daysInMonth('2028-02')).toBe(29);
    expect(daysInMonth('2026-10')).toBe(31);
  });
});

describe('worker pay', () => {
  const noon = (d: string) => d + 'T12:00:00Z';
  const monthly = (extra: Partial<WorkerLike> = {}): WorkerLike => ({
    payType: 'monthly',
    joinDate: noon('2026-10-01'),
    salary: 18000,
    rates: [{ from: noon('2026-10-01'), monthlySalary: 18000 }],
    ...extra,
  });
  const endOf = (month: string) => noon(month + '-' + String(daysInMonth(month)).padStart(2, '0'));

  it('pays salary / 30 per day: a 31-day month is 18,600', () => {
    expect(dayRate(18000)).toBe(600);
    expect(workerEarned(monthly(), noon('2026-10-01'), noon('2026-10-31'), endOf('2026-10'))).toEqual({ earned: 18600, daysWorked: 31, daysAbsent: 0 });
  });

  it('February (28 days) is 16,800', () => {
    const w = monthly({ joinDate: noon('2026-02-01'), rates: [{ from: noon('2026-02-01'), monthlySalary: 18000 }] });
    expect(workerEarned(w, noon('2026-02-01'), noon('2026-02-28'), noon('2026-03-15')).earned).toBe(16800);
  });

  it('does not pay absent days: 2 absences in October is 17,400', () => {
    const w = monthly({ absences: [noon('2026-10-05'), noon('2026-10-06')] });
    expect(workerEarned(w, null, null, endOf('2026-10'))).toEqual({ earned: 17400, daysWorked: 29, daysAbsent: 2 });
  });

  it('counts only up to today', () => {
    // Started on the 1st, today is the 3rd: 3 days.
    expect(workerEarned(monthly(), null, null, noon('2026-10-03')).earned).toBe(1800);
  });

  it('stops on the leaving day', () => {
    const w = monthly({ leftDate: noon('2026-10-10') });
    expect(workerEarned(w, null, null, noon('2026-12-01')).earned).toBe(6000);
  });

  it('applies a salary change from its day', () => {
    const w = monthly({ rates: [{ from: noon('2026-10-01'), monthlySalary: 18000 }, { from: noon('2026-10-21'), monthlySalary: 21000 }] });
    // 20 days at 600 + 11 days at 700
    expect(workerEarned(w, null, null, endOf('2026-10')).earned).toBe(12000 + 7700);
  });

  it('has no rounding drift on odd salaries', () => {
    const w = monthly({ salary: 1600, rates: [{ from: noon('2026-10-01'), monthlySalary: 1600 }] });
    expect(workerEarned(w, noon('2026-10-01'), noon('2026-10-30'), endOf('2026-10')).earned).toBe(1600);
  });

  it('pays daily workers days x rate', () => {
    const w: WorkerLike = {
      payType: 'daily',
      work: [
        { date: noon('2026-10-02'), days: 3, rate: 500 },
        { date: noon('2026-10-09'), days: 0.5, rate: 500 },
        { date: noon('2026-11-01'), days: 1, rate: 550 },
      ],
    };
    expect(workerEarned(w, noon('2026-10-01'), noon('2026-10-31'))).toEqual({ earned: 1750, daysWorked: 3.5, daysAbsent: 0 });
  });

  it('keeps an account: advances lower what is owed, negative means the worker owes', () => {
    const w = monthly({ payments: [{ amount: 500, date: noon('2026-10-03') }, { amount: 1000, date: noon('2026-10-04') }] });
    expect(workerAccount(w, noon('2026-10-04'))).toMatchObject({ earned: 2400, paid: 1500, balance: 900, daysWorked: 4 });

    // Left on the 2nd after taking 1,500: he owes 300, then it is written off.
    const left = monthly({ leftDate: noon('2026-10-02'), payments: [{ amount: 1500, date: noon('2026-10-02') }] });
    expect(workerAccount(left, noon('2026-10-20')).balance).toBe(-300);
    const off = { ...left, payments: [...left.payments!, { amount: 300, date: noon('2026-10-20'), kind: 'writeoff' }] };
    expect(workerAccount(off, noon('2026-10-20'))).toMatchObject({ balance: 0, writtenOff: 300 });
  });

  it('gives a month-by-month statement with running balance, newest first', () => {
    const w = monthly({
      joinDate: noon('2026-09-16'),
      rates: [{ from: noon('2026-09-16'), monthlySalary: 18000 }],
      absences: [noon('2026-10-05')],
      payments: [{ amount: 9000, date: noon('2026-10-01') }, { amount: 5000, date: noon('2026-10-15') }],
    });
    const months = workerMonths(w, noon('2026-10-15'));
    expect(months.map((m) => m.month)).toEqual(['2026-10', '2026-09']);
    expect(months[1]).toMatchObject({ daysWorked: 15, earned: 9000, paid: 0, closing: 9000 });
    expect(months[0]).toMatchObject({ daysWorked: 14, daysAbsent: 1, earned: 8400, paid: 14000, closing: 3400 });
  });

  it('splits labour into earned, paid and written off for a range', () => {
    const a = monthly({ payments: [{ amount: 2000, date: noon('2026-10-05') }, { amount: 100, date: noon('2026-10-06'), kind: 'writeoff' }] });
    const b: WorkerLike = { payType: 'daily', work: [{ date: noon('2026-10-05'), days: 2, rate: 500 }], payments: [{ amount: 1000, date: noon('2026-10-05') }] };
    expect(labourBetween([a, b], noon('2026-10-01'), noon('2026-10-10'), noon('2026-10-31'))).toEqual({ earned: 6000 + 1000, paid: 3000, writtenOff: 100 });
  });
});

describe('financeBetween', () => {
  const noon = (d: string) => d + 'T12:00:00Z';
  const data: FinanceData = {
    sales: [
      { amount: 1000, date: noon('2026-10-02'), customerId: 'c1', status: 'partial' },
      { amount: 500, date: noon('2026-10-03'), customerId: 'c2', status: 'pending' },
      // legacy paid sale counts as cash too
      { amount: 300, date: noon('2026-10-04'), customerId: null, status: 'paid' },
      { amount: 999, date: noon('2026-09-30'), customerId: 'c1', status: 'paid' },
    ],
    customerPayments: [
      { amount: 600, date: noon('2026-10-02') },
      // paying an old September sale in October: cash in October, not a sale in October
      { amount: 999, date: noon('2026-10-05') },
    ],
    otherIncome: [{ amount: 200, date: noon('2026-10-06') }],
    otherExpenses: [{ amount: 150, date: noon('2026-10-06') }, { amount: 50, date: noon('2026-11-01') }],
    feed: [
      // bought on credit from a supplier: cost now, cash only when paid
      { quantity: 100, unitPrice: 20, purchasedAt: noon('2026-10-01'), supplierId: 's1' },
      // bought for cash, no supplier
      { quantity: 10, unitPrice: 30, purchasedAt: noon('2026-10-03') },
      // spread over 10 days from Oct 28: 4 days in October
      { quantity: 50, unitPrice: 20, coverDays: 10, purchasedAt: noon('2026-10-28'), supplierId: 's1' },
    ],
    supplierPayments: [{ amount: 700, date: noon('2026-10-04') }],
    workers: [
      {
        payType: 'monthly',
        joinDate: noon('2026-10-01'),
        rates: [{ from: noon('2026-10-01'), monthlySalary: 18000 }],
        payments: [{ amount: 5000, date: noon('2026-10-15') }, { amount: 100, date: noon('2026-10-20'), kind: 'writeoff' }],
      },
    ],
    // a treatment in October and a vaccine in November
    animalCosts: [{ amount: 450, date: noon('2026-10-09') }, { amount: 99, date: noon('2026-11-02') }],
  };

  it('works out profit (earned basis) and cash flow for October', () => {
    const r = financeBetween(data, noon('2026-10-01'), noon('2026-10-31'), noon('2026-11-15'));
    expect(r.profit).toEqual({
      salesMade: 1800,
      salesCount: 3,
      otherIncome: 200,
      income: 2000,
      feed: 2000 + 300 + 400,
      labour: 18600,
      writtenOff: 100,
      animalCare: 450,
      otherExpenses: 150,
      costs: 2700 + 18600 + 100 + 450 + 150,
      profit: 2000 - 22000,
    });
    expect(r.cash).toEqual({
      fromCustomers: 600 + 999 + 300,
      otherIncome: 200,
      moneyIn: 2099,
      toSuppliers: 700,
      feedPaidOnSpot: 300,
      toWorkers: 5000,
      animalCare: 450,
      otherExpenses: 150,
      moneyOut: 6600,
      net: 2099 - 6600,
    });
  });

  it('a single day only counts that day', () => {
    const r = financeBetween(data, noon('2026-10-03'), noon('2026-10-03'), noon('2026-11-15'));
    expect(r.profit.salesMade).toBe(500);
    expect(r.profit.feed).toBe(300);
    expect(r.profit.labour).toBe(600);
    expect(r.cash.feedPaidOnSpot).toBe(300);
    expect(r.cash.fromCustomers).toBe(0);
  });

  it('lists days and months of a range', () => {
    expect(daysBetween('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
    expect(monthsBetween('2026-11-15', '2027-01-02')).toEqual(['2026-11', '2026-12', '2027-01']);
  });
});

describe('inListPeriod', () => {
  const now = '2026-10-07T19:30:00Z'; // 8 Oct 01:30 in Bangladesh
  it('uses the farm day and month', () => {
    expect(inListPeriod('2026-10-08T12:00:00Z', 'today', now)).toBe(true);
    expect(inListPeriod('2026-10-07T12:00:00Z', 'today', now)).toBe(false);
    expect(inListPeriod('2026-10-02T12:00:00Z', '7d', now)).toBe(true);
    expect(inListPeriod('2026-10-01T12:00:00Z', '7d', now)).toBe(false);
    expect(inListPeriod('2026-10-01T12:00:00Z', 'month', now)).toBe(true);
    expect(inListPeriod('2026-09-30T12:00:00Z', 'lastmonth', now)).toBe(true);
    expect(inListPeriod('2020-01-01T12:00:00Z', 'all', now)).toBe(true);
  });
});
