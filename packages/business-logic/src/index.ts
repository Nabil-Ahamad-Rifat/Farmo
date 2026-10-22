// Pure, platform-independent business logic shared between apps/web and
// apps/mobile — no DOM/React Native APIs, no network calls.
//
// Extracted from apps/web/src/components/*Manager.tsx, where several of
// these were duplicated verbatim across files (daysAgo in ExpenseManager/
// OtherIncomeManager/SalesManager; the currency formatter in
// OtherIncomeManager/RevenuePortal).

/** Start of a UTC day `days` days ago — days=1 means "today", days=7 means "the last 7 days including today". */
export function daysAgo(days: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - (days - 1));
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function formatCurrency(amount: number, symbol: string = '৳'): string {
  return symbol + amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function sumAmounts(items: { amount: number }[]): number {
  return items.reduce((sum, item) => sum + item.amount, 0);
}

/** qty × unitPrice, or null if either isn't a valid positive number (mirrors SalesManager's auto-calculated sale amount). */
export function calculateSaleAmount(quantity: unknown, unitPrice: unknown): number | null {
  const qty = parseFloat(String(quantity));
  const price = parseFloat(String(unitPrice));
  if (!isNaN(qty) && !isNaN(price) && qty > 0 && price > 0) {
    return qty * price;
  }
  return null;
}

export function isLowStock(feed: { quantity: number; remainingQuantity: number }): boolean {
  return feed.remainingQuantity < feed.quantity * 0.2;
}

export function stockPercentage(feed: { quantity: number; remainingQuantity: number }): number {
  return Math.round((feed.remainingQuantity / feed.quantity) * 100);
}

/** Sum of remainingQuantity × unitPrice — current value of unused stock. */
export function totalStockValue(feedBatches: { remainingQuantity: number; unitPrice: number }[]): number {
  return feedBatches.reduce((sum, f) => sum + f.remainingQuantity * f.unitPrice, 0);
}

/** Sum of quantity × unitPrice — total amount originally invested in these batches. */
export function totalBatchCost(feedBatches: { quantity: number; unitPrice: number }[]): number {
  return feedBatches.reduce((sum, f) => sum + f.quantity * f.unitPrice, 0);
}

export function totalActiveMonthlySalary(employees: { status?: string | null; salary: number }[]): number {
  return employees
    .filter((e) => (e.status || 'active') === 'active')
    .reduce((sum, e) => sum + (e.salary ?? 0), 0);
}

/** Proportional bar height in px for a simple two-series bar chart, with a small floor so positive values stay visible. */
export function barHeightPx(value: number, maxValue: number, maxPx: number): number {
  return Math.max((value / maxValue) * maxPx, value > 0 ? 2 : 0);
}

export type SalePaymentStatus = 'paid' | 'partial' | 'pending';

export interface AllocationResult {
  perSale: { id: string; paidAmount: number; status: SalePaymentStatus }[];
  totalSold: number;
  totalPaid: number;
  /** What the customer still owes (0 if they are in credit). */
  totalDue: number;
  /** Money paid beyond everything sold — credit that covers future sales. */
  advance: number;
}

const toPaisa = (taka: number) => Math.round(taka * 100);
const toTaka = (paisa: number) => paisa / 100;

/**
 * Apply a customer's payments to their sales, oldest sale first. Payments are
 * pooled (a lump sum settles several sales), so only their total matters.
 * Pure and deterministic — the server re-runs it from scratch after every
 * change to a customer's sales or payments instead of patching balances.
 * Works in whole paisa so repeated recomputes never drift.
 */
export function allocatePayments(
  sales: { id: string; amount: number; date: Date | string }[],
  payments: { amount: number }[],
): AllocationResult {
  const ordered = [...sales].sort((a, b) => {
    const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
    return diff !== 0 ? diff : a.id.localeCompare(b.id);
  });

  const paidPaisa = payments.reduce((sum, p) => sum + Math.max(0, toPaisa(p.amount)), 0);
  let pool = paidPaisa;
  let soldPaisa = 0;

  const perSale = ordered.map((sale) => {
    const amount = Math.max(0, toPaisa(sale.amount));
    soldPaisa += amount;
    const applied = Math.min(amount, pool);
    pool -= applied;
    const status: SalePaymentStatus = applied >= amount ? 'paid' : applied > 0 ? 'partial' : 'pending';
    return { id: sale.id, paidAmount: toTaka(applied), status };
  });

  return {
    perSale,
    totalSold: toTaka(soldPaisa),
    totalPaid: toTaka(paidPaisa),
    totalDue: toTaka(Math.max(0, soldPaisa - paidPaisa)),
    advance: toTaka(pool),
  };
}

// ---------------------------------------------------------------------------
// Feed purchases that last a set number of days.
//
// A scheduled purchase (coverDays set) is used up evenly: quantity ÷ days per
// day, and its cost counts as total ÷ days on each covered day. Days are UTC
// calendar days, the purchase day being day 1. Legacy batches (no coverDays)
// keep usage-based cost and are not handled here.
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;

/** Whole UTC days since the epoch — the calendar day a timestamp falls on. */
export function utcDayIndex(d: Date | string): number {
  const t = new Date(d);
  return Math.floor(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()) / DAY_MS);
}

const dayIndexToIso = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10);
const round2 = (n: number) => Math.round(n * 100) / 100;

export interface ScheduledFeed {
  quantity: number;
  unitPrice: number;
  coverDays?: number | null;
  purchasedAt?: Date | string | null;
  createdAt?: Date | string | null;
}

export interface FeedSchedule {
  coverDays: number;
  perDayQty: number;
  perDayCost: number;
  /** First and last covered day, YYYY-MM-DD. */
  startsOn: string;
  endsOn: string;
  /** Covered days up to and including today (0 before it starts, coverDays once over). */
  daysUsed: number;
  /** Full days of feed left after today, limited by the stock actually left. */
  daysLeft: number;
  /** Stock left now, after the daily use so far and any extra recorded use. */
  remaining: number;
  /** Last day this batch is expected to last, YYYY-MM-DD. */
  runsOutOn: string;
}

const startDayOf = (b: ScheduledFeed) => utcDayIndex(b.purchasedAt ?? b.createdAt ?? new Date());

export function isScheduledFeed(b: ScheduledFeed): b is ScheduledFeed & { coverDays: number } {
  return typeof b.coverDays === 'number' && b.coverDays > 0;
}

function daysUsedAt(b: ScheduledFeed & { coverDays: number }, now: Date | string) {
  return Math.min(b.coverDays, Math.max(0, utcDayIndex(now) - startDayOf(b) + 1));
}

/**
 * Where a scheduled batch stands today. `remainingQuantity` is the value as
 * saved, which only goes down for extra (manual) use — the daily use is
 * worked out here from the date. Null for legacy batches.
 */
export function feedSchedule(
  b: ScheduledFeed & { remainingQuantity: number },
  now: Date | string = new Date(),
): FeedSchedule | null {
  if (!isScheduledFeed(b)) return null;
  const start = startDayOf(b);
  const end = start + b.coverDays - 1;
  const today = utcDayIndex(now);
  const perDayQty = b.quantity / b.coverDays;
  const daysUsed = daysUsedAt(b, now);
  const remaining = Math.max(0, round2(b.remainingQuantity - perDayQty * daysUsed));
  // Tiny epsilon so 200 kg at 100 kg/day is 2 days, not 1.9999.
  const daysByStock = perDayQty > 0 ? Math.floor(remaining / perDayQty + 1e-9) : 0;
  const daysLeft = Math.min(b.coverDays - daysUsed, daysByStock);
  const lastDay = daysUsed === 0 ? start + Math.min(b.coverDays, daysByStock) - 1 : today + daysLeft;

  return {
    coverDays: b.coverDays,
    perDayQty: round2(perDayQty),
    perDayCost: round2((b.quantity * b.unitPrice) / b.coverDays),
    startsOn: dayIndexToIso(start),
    endsOn: dayIndexToIso(end),
    daysUsed,
    daysLeft,
    remaining,
    runsOutOn: dayIndexToIso(Math.min(end, Math.max(start, lastDay))),
  };
}

/**
 * The value to save as remainingQuantity when a user sets the stock left
 * *now* to `currentRemaining` — the inverse of feedSchedule's `remaining`.
 * Legacy batches store it as is.
 */
export function storedFeedRemaining(
  b: ScheduledFeed,
  currentRemaining: number,
  now: Date | string = new Date(),
): number {
  if (!isScheduledFeed(b)) return currentRemaining;
  return round2(Math.min(b.quantity, currentRemaining + (b.quantity / b.coverDays) * daysUsedAt(b, now)));
}

// ---------------------------------------------------------------------------
// Monthly statements (customers / dues).
//
// Months are UTC calendar months; sales and payments are stored at noon UTC
// of their day, so a day never slips into the neighbouring month. Each
// party's balance is carried from month to month:
//   month end = carried in + sold this month − paid this month
// Negative means the party paid in advance. Legacy sales with no customer
// (partyId null) are one party; one marked paid counts as paid on its date.
// ---------------------------------------------------------------------------

/** "YYYY-MM" (UTC) of a date. */
export function monthKey(d: Date | string): string {
  return new Date(d).toISOString().slice(0, 7);
}

/** "YYYY-MM" moved by `delta` months. */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  return monthKey(new Date(Date.UTC(y, m - 1 + delta, 1)));
}

/** First and last instant of a "YYYY-MM" month, UTC. */
export function monthBounds(month: string): { start: Date; end: Date } {
  const [y, m] = month.split('-').map(Number);
  return { start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 1) - 1) };
}

export interface StatementSale {
  /** Customer id, or null for a legacy sale with no customer. */
  partyId: string | null;
  amount: number;
  date: Date | string;
  saleType: string;
  quantity?: number | null;
  /** Only read for legacy (partyId null) sales: "paid" means paid on the sale date. */
  status?: string | null;
}

export interface StatementPayment {
  partyId: string;
  amount: number;
  date: Date | string;
}

export interface MonthLine {
  partyId: string | null;
  milkLitres: number;
  sold: number;
  paid: number;
  /** Balance at the start of the month; negative is advance. */
  carriedIn: number;
  /** Balance at the end of the month; negative is advance. */
  closing: number;
  salesCount: number;
  paymentsCount: number;
}

export interface MonthStatement {
  month: string;
  lines: MonthLine[];
  totals: {
    milkLitres: number;
    sold: number;
    collected: number;
    /** Dues carried in (advances not netted off). */
    carriedIn: number;
    /** What is owed at month end: sum of positive closing balances. */
    dueAtEnd: number;
    advanceAtEnd: number;
  };
}

export interface MonthSummary {
  month: string;
  milkLitres: number;
  sold: number;
  paid: number;
  closing: number;
}

type Entry = { partyId: string | null; date: Date | string; amount: number; kind: 'sale' | 'payment'; litres: number };

/** Sales and payments as one list; legacy paid sales also become a payment on the same day. */
function toEntries(sales: StatementSale[], payments: StatementPayment[]): Entry[] {
  const entries: Entry[] = [];
  for (const s of sales) {
    const litres = s.saleType === 'milk' ? s.quantity ?? 0 : 0;
    entries.push({ partyId: s.partyId, date: s.date, amount: s.amount, kind: 'sale', litres });
    if (s.partyId === null && s.status === 'paid') {
      entries.push({ partyId: null, date: s.date, amount: s.amount, kind: 'payment', litres: 0 });
    }
  }
  for (const p of payments) entries.push({ partyId: p.partyId, date: p.date, amount: p.amount, kind: 'payment', litres: 0 });
  return entries;
}

/** One month's statement for every party that bought, paid, or carried a balance into it. */
export function monthlyStatement(sales: StatementSale[], payments: StatementPayment[], month: string): MonthStatement {
  type Acc = { carried: number; sold: number; paid: number; litres: number; salesCount: number; paymentsCount: number };
  const byParty = new Map<string | null, Acc>();
  const acc = (id: string | null) => {
    let a = byParty.get(id);
    if (!a) byParty.set(id, (a = { carried: 0, sold: 0, paid: 0, litres: 0, salesCount: 0, paymentsCount: 0 }));
    return a;
  };

  for (const e of toEntries(sales, payments)) {
    const key = monthKey(e.date);
    if (key > month) continue;
    const a = acc(e.partyId);
    const paisa = toPaisa(e.amount);
    if (key < month) {
      a.carried += e.kind === 'sale' ? paisa : -paisa;
    } else if (e.kind === 'sale') {
      a.sold += paisa;
      a.litres += e.litres;
      a.salesCount += 1;
    } else {
      a.paid += paisa;
      a.paymentsCount += 1;
    }
  }

  const lines: MonthLine[] = [];
  for (const [partyId, a] of byParty) {
    if (a.salesCount === 0 && a.paymentsCount === 0 && a.carried === 0) continue;
    lines.push({
      partyId,
      milkLitres: round2(a.litres),
      sold: toTaka(a.sold),
      paid: toTaka(a.paid),
      carriedIn: toTaka(a.carried),
      closing: toTaka(a.carried + a.sold - a.paid),
      salesCount: a.salesCount,
      paymentsCount: a.paymentsCount,
    });
  }
  lines.sort((x, y) => y.closing - x.closing);

  const sum = (f: (l: MonthLine) => number) => round2(lines.reduce((s, l) => s + f(l), 0));
  return {
    month,
    lines,
    totals: {
      milkLitres: sum((l) => l.milkLitres),
      sold: sum((l) => l.sold),
      collected: sum((l) => l.paid),
      carriedIn: sum((l) => Math.max(0, l.carriedIn)),
      dueAtEnd: sum((l) => Math.max(0, l.closing)),
      advanceAtEnd: sum((l) => Math.max(0, -l.closing)),
    },
  };
}

/** One party's months that had a sale or payment, newest first, each with its running month-end balance. */
export function customerMonths(sales: StatementSale[], payments: StatementPayment[]): MonthSummary[] {
  const months = new Map<string, { litres: number; sold: number; paid: number }>();
  for (const e of toEntries(sales, payments)) {
    const key = monthKey(e.date);
    const m = months.get(key) ?? { litres: 0, sold: 0, paid: 0 };
    if (e.kind === 'sale') {
      m.sold += toPaisa(e.amount);
      m.litres += e.litres;
    } else {
      m.paid += toPaisa(e.amount);
    }
    months.set(key, m);
  }

  let balance = 0;
  const ascending = [...months.keys()].sort().map((month) => {
    const m = months.get(month)!;
    balance += m.sold - m.paid;
    return { month, milkLitres: round2(m.litres), sold: toTaka(m.sold), paid: toTaka(m.paid), closing: toTaka(balance) };
  });
  return ascending.reverse();
}

/**
 * Feed cost for profit in [from, to] (whole UTC days, both ends included):
 * - a batch with days set adds total ÷ days for every covered day in the range;
 * - a batch without days (the owner usually doesn't know how long it lasts)
 *   adds its full total on its purchase day.
 * Usage records never add cost; they only move stock.
 */
export function feedCostBetween(batches: ScheduledFeed[], from: Date | string, to: Date | string): number {
  const first = utcDayIndex(from);
  const last = utcDayIndex(to);
  let total = 0;
  for (const b of batches) {
    const start = startDayOf(b);
    if (!isScheduledFeed(b)) {
      if (start >= first && start <= last) total += b.quantity * b.unitPrice;
      continue;
    }
    const end = start + b.coverDays - 1;
    const overlap = Math.min(end, last) - Math.max(start, first) + 1;
    if (overlap > 0) total += ((b.quantity * b.unitPrice) / b.coverDays) * overlap;
  }
  return round2(total);
}

export interface FeedMonthBatch extends ScheduledFeed {
  name: string;
  supplierId?: string | null;
  paidAmount?: number | null;
}

/**
 * Feed bought in one "YYYY-MM" month (by purchase date): totals, a subtotal
 * per feed name (largest spend first) and the purchases, newest first.
 * Paid/owed follow the supplier payment matching; a purchase with no
 * supplier was paid in full.
 */
export function feedMonthSummary<T extends FeedMonthBatch>(batches: T[], month: string) {
  const dayOf = (b: T) => utcDayIndex(b.purchasedAt ?? b.createdAt ?? new Date());
  const purchases = batches
    .filter((b) => monthKey(b.purchasedAt ?? b.createdAt ?? new Date()) === month)
    .sort((a, b) => dayOf(b) - dayOf(a));

  // Oldest first, so a feed type keeps the spelling it was first bought under.
  const byName = new Map<string, { name: string; kg: number; spent: number; count: number }>();
  let kg = 0;
  let spent = 0;
  let paid = 0;
  for (const b of [...purchases].reverse()) {
    const cost = toPaisa(b.quantity * b.unitPrice);
    const paidPaisa = b.supplierId ? Math.min(cost, toPaisa(b.paidAmount ?? 0)) : cost;
    kg += b.quantity;
    spent += cost;
    paid += paidPaisa;
    const key = b.name.trim().toLowerCase();
    const row = byName.get(key) ?? { name: b.name.trim(), kg: 0, spent: 0, count: 0 };
    row.kg += b.quantity;
    row.spent += cost;
    row.count += 1;
    byName.set(key, row);
  }

  return {
    month,
    totals: { kg: round2(kg), spent: toTaka(spent), paid: toTaka(paid), owed: toTaka(spent - paid), count: purchases.length },
    byFeed: [...byName.values()]
      .map((r) => ({ ...r, kg: round2(r.kg), spent: toTaka(r.spent) }))
      .sort((a, b) => b.spent - a.spent),
    purchases,
  };
}

// ---------------------------------------------------------------------------
// Animal records: IDs, breeding and health status, and what is due soon.
// Dates are compared as UTC calendar days, like the rest of this file.
// ---------------------------------------------------------------------------

export const ANIMAL_EVENT_TYPES = [
  'vaccine',
  'insemination',
  'pregnancy_check',
  'calving',
  'treatment',
  'deworming',
  'weight',
  'other',
] as const;
export type AnimalEventType = (typeof ANIMAL_EVENT_TYPES)[number];

/** Average cow gestation: insemination to calving. */
export const GESTATION_DAYS = 283;
/** When a pregnancy check is worth doing after insemination. */
export const PREGNANCY_CHECK_AFTER_DAYS = 60;

/** The next free "C-001"-style ID. IDs in other formats are left alone (and never repeated). */
export function nextAnimalId(tags: string[], prefix = 'C'): string {
  const taken = new Set(tags.map((t) => t.trim().toUpperCase()));
  const pattern = new RegExp(`^${prefix}-(\\d+)$`, 'i');
  let n = tags.reduce((max, t) => {
    const m = t.trim().match(pattern);
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);
  let id: string;
  do {
    n += 1;
    id = `${prefix}-${String(n).padStart(3, '0')}`;
  } while (taken.has(id));
  return id;
}

const isoDay = (d: Date | string) => dayIndexToIso(utcDayIndex(d));

/** `d` plus `days` calendar days, as "YYYY-MM-DD". */
export function addDaysIso(d: Date | string, days: number): string {
  return dayIndexToIso(utcDayIndex(d) + days);
}

/** Expected calving day ("YYYY-MM-DD") for an insemination on `inseminationDate`. */
export function expectedCalving(inseminationDate: Date | string): string {
  return addDaysIso(inseminationDate, GESTATION_DAYS);
}

/** Age as "2 y 3 m", "5 m" or "12 d". */
export function ageLabel(birthDate: Date | string, now: Date | string = new Date()): string {
  const b = new Date(birthDate);
  const n = new Date(now);
  let months = (n.getUTCFullYear() - b.getUTCFullYear()) * 12 + (n.getUTCMonth() - b.getUTCMonth());
  if (n.getUTCDate() < b.getUTCDate()) months -= 1;
  if (months <= 0) return `${Math.max(0, utcDayIndex(n) - utcDayIndex(b))} d`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return `${rest} m`;
  return rest ? `${years} y ${rest} m` : `${years} y`;
}

export interface AnimalEventLike {
  type: string;
  date: Date | string;
  title?: string | null;
  nextDueDate?: Date | string | null;
  result?: string | null;
  value?: number | null;
  cost?: number | null;
}

export type PregnancyStatus = 'pregnant' | 'inseminated' | 'open' | 'unknown';

export interface AnimalSummary {
  lastVaccine: { title: string; date: string } | null;
  /** Each vaccine/deworming whose latest dose has a next due date, soonest first. */
  dueDoses: { type: string; title: string; dueDate: string }[];
  lastInsemination: { title: string | null; date: string } | null;
  pregnancy: PregnancyStatus;
  /** Set while inseminated or pregnant after a known insemination. */
  expectedCalving: string | null;
  /** Insemination + 60 days, while no check has been recorded since. */
  pregnancyCheckDue: string | null;
  lastCalving: string | null;
  latestWeight: { value: number; date: string } | null;
  /** Sum of the cost of every record (vet, medicine, semen...). */
  careCost: number;
}

/** Breeding and health status worked out from an animal's records. */
export function animalSummary(events: AnimalEventLike[]): AnimalSummary {
  const ordered = [...events].sort((a, b) => utcDayIndex(a.date) - utcDayIndex(b.date));
  let pregnancy: PregnancyStatus = 'unknown';
  let aiDate: string | null = null;
  let lastInsemination: AnimalSummary['lastInsemination'] = null;
  let lastVaccine: AnimalSummary['lastVaccine'] = null;
  let lastCalving: string | null = null;
  let latestWeight: AnimalSummary['latestWeight'] = null;
  let careCost = 0;
  // Latest dose per vaccine/deworming name: a newer dose replaces the older due date.
  const doses = new Map<string, { type: string; title: string; dueDate: string | null }>();

  for (const e of ordered) {
    careCost += toPaisa(e.cost ?? 0);
    const day = isoDay(e.date);
    switch (e.type) {
      case 'vaccine':
      case 'deworming': {
        const title = e.title?.trim() || (e.type === 'vaccine' ? 'Vaccine' : 'Deworming');
        if (e.type === 'vaccine') lastVaccine = { title, date: day };
        doses.set(`${e.type}:${title.toLowerCase()}`, { type: e.type, title, dueDate: e.nextDueDate ? isoDay(e.nextDueDate) : null });
        break;
      }
      case 'insemination':
        pregnancy = 'inseminated';
        aiDate = day;
        lastInsemination = { title: e.title?.trim() || null, date: day };
        break;
      case 'pregnancy_check':
        if (e.result === 'positive') pregnancy = 'pregnant';
        else if (e.result === 'negative') {
          pregnancy = 'open';
          aiDate = null;
        }
        break;
      case 'calving':
        pregnancy = 'open';
        aiDate = null;
        lastCalving = day;
        break;
      case 'weight':
        if (typeof e.value === 'number') latestWeight = { value: e.value, date: day };
        break;
    }
  }

  // A check is due only if nothing was checked on or after the last insemination.
  const ai = aiDate;
  const checkedSinceAi = ai !== null && ordered.some((e) => e.type === 'pregnancy_check' && isoDay(e.date) >= ai);
  const dueDoses = [...doses.values()]
    .filter((d): d is { type: string; title: string; dueDate: string } => d.dueDate !== null)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return {
    lastVaccine,
    dueDoses,
    lastInsemination,
    pregnancy,
    expectedCalving: ai && (pregnancy === 'pregnant' || pregnancy === 'inseminated') ? expectedCalving(ai) : null,
    pregnancyCheckDue: ai && pregnancy === 'inseminated' && !checkedSinceAi ? addDaysIso(ai, PREGNANCY_CHECK_AFTER_DAYS) : null,
    lastCalving,
    latestWeight,
    careCost: toTaka(careCost),
  };
}

export interface DueItem {
  cowId: string;
  tagNumber: string;
  name: string;
  kind: 'vaccine' | 'deworming' | 'calving' | 'pregnancy_check';
  title: string;
  dueDate: string;
  /** Negative when overdue. */
  daysLeft: number;
}

/**
 * What needs attention soon across animals, soonest first: vaccine and
 * deworming doses overdue or due within `doseDays`, calvings expected within
 * `calvingDays` (or up to `calvingDays` late), and pregnancy checks due
 * within `doseDays`.
 */
export function dueSoon(
  animals: { id: string; tagNumber: string; name: string; events: AnimalEventLike[] }[],
  now: Date | string = new Date(),
  { doseDays = 7, calvingDays = 30 }: { doseDays?: number; calvingDays?: number } = {},
): DueItem[] {
  const today = utcDayIndex(now);
  const daysTo = (iso: string) => utcDayIndex(iso + 'T12:00:00Z') - today;
  const items: DueItem[] = [];
  for (const a of animals) {
    const s = animalSummary(a.events);
    const base = { cowId: a.id, tagNumber: a.tagNumber, name: a.name };
    for (const d of s.dueDoses) {
      const left = daysTo(d.dueDate);
      if (left <= doseDays) {
        items.push({ ...base, kind: d.type === 'deworming' ? 'deworming' : 'vaccine', title: d.title, dueDate: d.dueDate, daysLeft: left });
      }
    }
    if (s.expectedCalving) {
      const left = daysTo(s.expectedCalving);
      if (left <= calvingDays && left >= -calvingDays) {
        items.push({ ...base, kind: 'calving', title: 'Expected calving', dueDate: s.expectedCalving, daysLeft: left });
      }
    }
    if (s.pregnancyCheckDue) {
      const left = daysTo(s.pregnancyCheckDue);
      if (left <= doseDays) {
        items.push({ ...base, kind: 'pregnancy_check', title: 'Pregnancy check', dueDate: s.pregnancyCheckDue, daysLeft: left });
      }
    }
  }
  return items.sort((x, y) => x.daysLeft - y.daysLeft);
}

// ---------------------------------------------------------------------------
// The farm's calendar. The farm is in Bangladesh (UTC+6, no daylight saving),
// so "today" and "this month" change at local midnight, not UTC midnight.
// Stored days stay at noon UTC of their calendar day (see dayToDate on web).
// ---------------------------------------------------------------------------

export const FARM_UTC_OFFSET_HOURS = 6;

/** Calendar-day number of `d` on the farm's clock (comparable with utcDayIndex of stored noon-UTC days). */
export function farmDayIndex(d: Date | string = new Date()): number {
  return utcDayIndex(new Date(new Date(d).getTime() + FARM_UTC_OFFSET_HOURS * 3_600_000));
}

/** Today on the farm's clock, as "YYYY-MM-DD". */
export function farmToday(now: Date | string = new Date()): string {
  return dayIndexToIso(farmDayIndex(now));
}

/** This month on the farm's clock, as "YYYY-MM". */
export function farmMonth(now: Date | string = new Date()): string {
  return farmToday(now).slice(0, 7);
}

/** Number of days in a "YYYY-MM" month. */
export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

// ---------------------------------------------------------------------------
// Worker pay accounts. A monthly worker earns monthly salary / 30 for every
// day from their start day to their leaving day (or today), except days marked
// absent: an 18,000 taka worker earns 600 a day, 18,600 in a 31-day month.
// A daily worker earns days x rate for each work entry. Money given at any
// time is subtracted; what is left is owed to the worker (or, if negative, an
// advance the worker owes the farm, which can be written off as a loss).
// ---------------------------------------------------------------------------

/** Every monthly salary is paid as salary / 30 per day, whatever the month length. */
export const PAY_DAYS_PER_MONTH = 30;

export function dayRate(monthlySalary: number): number {
  return round2(monthlySalary / PAY_DAYS_PER_MONTH);
}

export interface PayRateLike {
  from: Date | string;
  monthlySalary?: number | null;
  dailyRate?: number | null;
}

export interface WorkerPaymentLike {
  amount: number;
  date: Date | string;
  /** "writeoff" closes an advance as a loss; anything else is money given. */
  kind?: string | null;
}

export interface WorkerLike {
  payType?: string | null;
  /** Start day. */
  joinDate?: Date | string | null;
  createdAt?: Date | string | null;
  leftDate?: Date | string | null;
  /** Current monthly salary, used when no PayRate covers a day. */
  salary?: number | null;
  rates?: PayRateLike[];
  absences?: (Date | string)[];
  work?: { date: Date | string; days: number; rate: number }[];
  payments?: WorkerPaymentLike[];
}

export const isDailyWorker = (w: Pick<WorkerLike, 'payType'>) => w.payType === 'daily';

/** First and last day the worker can earn, or null if they never started. */
function workerSpan(w: WorkerLike, now: Date | string) {
  const start = w.joinDate ?? w.createdAt;
  if (!start) return null;
  const first = utcDayIndex(start);
  const today = farmDayIndex(now);
  const last = w.leftDate ? Math.min(utcDayIndex(w.leftDate), today) : today;
  return last < first ? null : { first, last };
}

/**
 * What a worker earned in [from, to] (calendar days, both included; omitted
 * ends mean "since starting" / "up to today").
 */
export function workerEarned(
  w: WorkerLike,
  from?: Date | string | null,
  to?: Date | string | null,
  now: Date | string = new Date(),
): { earned: number; daysWorked: number; daysAbsent: number } {
  const lo = from ? utcDayIndex(from) : -Infinity;
  const hi = to ? utcDayIndex(to) : Infinity;

  if (isDailyWorker(w)) {
    let paisa = 0;
    let days = 0;
    for (const e of w.work ?? []) {
      const d = utcDayIndex(e.date);
      if (d < lo || d > hi) continue;
      paisa += toPaisa(e.days * e.rate);
      days += e.days;
    }
    return { earned: toTaka(paisa), daysWorked: round2(days), daysAbsent: 0 };
  }

  const span = workerSpan(w, now);
  if (!span) return { earned: 0, daysWorked: 0, daysAbsent: 0 };
  const first = Math.max(span.first, lo);
  const last = Math.min(span.last, hi);
  if (last < first) return { earned: 0, daysWorked: 0, daysAbsent: 0 };

  const absent = new Set((w.absences ?? []).map((d) => utcDayIndex(d)));
  // Rates newest first, so the first one on or before a day applies to it.
  const rates = (w.rates ?? [])
    .filter((r) => r.monthlySalary != null)
    .map((r) => ({ from: utcDayIndex(r.from), salary: r.monthlySalary! }))
    .sort((a, b) => b.from - a.from);
  const salaryOn = (day: number) => rates.find((r) => r.from <= day)?.salary ?? rates[rates.length - 1]?.salary ?? w.salary ?? 0;

  // Sum the monthly salary of every worked day, then divide once, so a 1,600
  // salary over 30 days comes to exactly 1,600 with no rounding drift.
  let salaryPaisaDays = 0;
  let worked = 0;
  let missed = 0;
  for (let day = first; day <= last; day++) {
    if (absent.has(day)) {
      missed++;
      continue;
    }
    worked++;
    salaryPaisaDays += toPaisa(salaryOn(day));
  }
  return { earned: toTaka(Math.round(salaryPaisaDays / PAY_DAYS_PER_MONTH)), daysWorked: worked, daysAbsent: missed };
}

export interface WorkerAccount {
  earned: number;
  paid: number;
  writtenOff: number;
  /** Positive: the farm owes the worker. Negative: an advance the worker owes the farm. */
  balance: number;
  daysWorked: number;
  daysAbsent: number;
}

/** A worker's account from their first day up to today. */
export function workerAccount(w: WorkerLike, now: Date | string = new Date()): WorkerAccount {
  const e = workerEarned(w, null, null, now);
  let paid = 0;
  let off = 0;
  for (const p of w.payments ?? []) {
    if (p.kind === 'writeoff') off += toPaisa(p.amount);
    else paid += toPaisa(p.amount);
  }
  return {
    earned: e.earned,
    paid: toTaka(paid),
    writtenOff: toTaka(off),
    balance: toTaka(toPaisa(e.earned) - paid + off),
    daysWorked: e.daysWorked,
    daysAbsent: e.daysAbsent,
  };
}

export interface WorkerMonth {
  month: string;
  daysWorked: number;
  daysAbsent: number;
  earned: number;
  paid: number;
  writtenOff: number;
  /** Balance at the end of the month (positive: owed to the worker). */
  closing: number;
}

/** Month by month from the first activity up to now, newest first. */
export function workerMonths(w: WorkerLike, now: Date | string = new Date()): WorkerMonth[] {
  const keys = new Set<string>();
  const span = isDailyWorker(w) ? null : workerSpan(w, now);
  if (span) {
    const lastMonth = dayIndexToIso(span.last).slice(0, 7);
    for (let m = dayIndexToIso(span.first).slice(0, 7); m <= lastMonth; m = shiftMonth(m, 1)) keys.add(m);
  }
  for (const e of w.work ?? []) keys.add(monthKey(e.date));
  for (const p of w.payments ?? []) keys.add(monthKey(p.date));

  let balance = 0;
  const ascending = [...keys].sort().map((month) => {
    const { start, end } = monthBounds(month);
    const e = workerEarned(w, start, end, now);
    let paid = 0;
    let off = 0;
    for (const p of w.payments ?? []) {
      if (monthKey(p.date) !== month) continue;
      if (p.kind === 'writeoff') off += toPaisa(p.amount);
      else paid += toPaisa(p.amount);
    }
    balance += toPaisa(e.earned) - paid + off;
    return { month, daysWorked: e.daysWorked, daysAbsent: e.daysAbsent, earned: e.earned, paid: toTaka(paid), writtenOff: toTaka(off), closing: toTaka(balance) };
  });
  return ascending.reverse();
}

/**
 * Labour for the money reports in [from, to]: `earned` (pay earned in the
 * range, the profit view), `paid` (money given in the range, the cash view)
 * and `writtenOff` (advances given up in the range, a loss).
 */
export function labourBetween(workers: WorkerLike[], from: Date | string, to: Date | string, now: Date | string = new Date()) {
  const lo = utcDayIndex(from);
  const hi = utcDayIndex(to);
  let earned = 0;
  let paid = 0;
  let off = 0;
  for (const w of workers) {
    earned += toPaisa(workerEarned(w, from, to, now).earned);
    for (const p of w.payments ?? []) {
      const d = utcDayIndex(p.date);
      if (d < lo || d > hi) continue;
      if (p.kind === 'writeoff') off += toPaisa(p.amount);
      else paid += toPaisa(p.amount);
    }
  }
  return { earned: toTaka(earned), paid: toTaka(paid), writtenOff: toTaka(off) };
}

// ---------------------------------------------------------------------------
// Farm money for any date range, two ways:
// - Profit (what the farm earned and spent, paid or not): sales made + other
//   income − feed bought (spread over its days when set) − labour earned
//   (and advances written off) − animal care − other expenses.
// - Cash flow (money that actually moved): money received from customers +
//   other income − paid to suppliers − feed paid on the spot (no supplier) −
//   paid to workers − other expenses.
// ---------------------------------------------------------------------------

export interface FinanceData {
  /** Every sale. Legacy sales (no customer) marked paid also count as cash on their day. */
  sales: { amount: number; date: Date | string; customerId?: string | null; status?: string | null }[];
  /** Money received from customers. */
  customerPayments: { amount: number; date: Date | string }[];
  otherIncome: { amount: number; date: Date | string }[];
  otherExpenses: { amount: number; date: Date | string }[];
  /** Feed purchases; those without a supplier were paid in full when bought. */
  feed: (ScheduledFeed & { supplierId?: string | null })[];
  supplierPayments: { amount: number; date: Date | string }[];
  workers: WorkerLike[];
  /** Costs written on animal records (vet, medicine, vaccine, semen...), paid on the record's day. */
  animalCosts?: { amount: number; date: Date | string }[];
}

export interface FinanceSummary {
  profit: {
    salesMade: number;
    salesCount: number;
    otherIncome: number;
    income: number;
    feed: number;
    /** Pay earned by workers in the range. */
    labour: number;
    /** Worker advances given up in the range (a loss). */
    writtenOff: number;
    /** Costs from animal records. */
    animalCare: number;
    otherExpenses: number;
    costs: number;
    profit: number;
  };
  cash: {
    fromCustomers: number;
    otherIncome: number;
    moneyIn: number;
    toSuppliers: number;
    feedPaidOnSpot: number;
    toWorkers: number;
    animalCare: number;
    otherExpenses: number;
    moneyOut: number;
    net: number;
  };
}

const isLegacySale = (s: { customerId?: string | null }) => !s.customerId;

/** Profit and cash flow for [from, to] (calendar days, both ends included). */
export function financeBetween(d: FinanceData, from: Date | string, to: Date | string, now: Date | string = new Date()): FinanceSummary {
  const lo = utcDayIndex(from);
  const hi = utcDayIndex(to);
  const inRange = (date: Date | string) => {
    const day = utcDayIndex(date);
    return day >= lo && day <= hi;
  };
  const sumIn = (rows: { amount: number; date: Date | string }[]) => rows.reduce((s, r) => (inRange(r.date) ? s + toPaisa(r.amount) : s), 0);

  let salesMade = 0;
  let salesCount = 0;
  let legacyPaid = 0;
  for (const s of d.sales) {
    if (!inRange(s.date)) continue;
    salesMade += toPaisa(s.amount);
    salesCount++;
    if (isLegacySale(s) && s.status === 'paid') legacyPaid += toPaisa(s.amount);
  }
  const otherIncome = sumIn(d.otherIncome);
  const otherExpenses = sumIn(d.otherExpenses);
  const animalCare = sumIn(d.animalCosts ?? []);
  const feed = toPaisa(feedCostBetween(d.feed, from, to));
  const labour = labourBetween(d.workers, from, to, now);
  const labourEarned = toPaisa(labour.earned);
  const writtenOff = toPaisa(labour.writtenOff);

  let feedPaidOnSpot = 0;
  for (const b of d.feed) {
    if (b.supplierId) continue;
    const day = b.purchasedAt ?? b.createdAt;
    if (day && inRange(day)) feedPaidOnSpot += toPaisa(b.quantity * b.unitPrice);
  }
  const fromCustomers = sumIn(d.customerPayments) + legacyPaid;
  const toSuppliers = sumIn(d.supplierPayments);
  const toWorkers = toPaisa(labour.paid);

  const income = salesMade + otherIncome;
  const costs = feed + labourEarned + writtenOff + animalCare + otherExpenses;
  const moneyIn = fromCustomers + otherIncome;
  const moneyOut = toSuppliers + feedPaidOnSpot + toWorkers + animalCare + otherExpenses;
  return {
    profit: {
      salesMade: toTaka(salesMade),
      salesCount,
      otherIncome: toTaka(otherIncome),
      income: toTaka(income),
      feed: toTaka(feed),
      labour: toTaka(labourEarned),
      writtenOff: toTaka(writtenOff),
      animalCare: toTaka(animalCare),
      otherExpenses: toTaka(otherExpenses),
      costs: toTaka(costs),
      profit: toTaka(income - costs),
    },
    cash: {
      fromCustomers: toTaka(fromCustomers),
      otherIncome: toTaka(otherIncome),
      moneyIn: toTaka(moneyIn),
      toSuppliers: toTaka(toSuppliers),
      feedPaidOnSpot: toTaka(feedPaidOnSpot),
      toWorkers: toTaka(toWorkers),
      animalCare: toTaka(animalCare),
      otherExpenses: toTaka(otherExpenses),
      moneyOut: toTaka(moneyOut),
      net: toTaka(moneyIn - moneyOut),
    },
  };
}

/** "YYYY-MM-DD" days from `from` to `to`, both included. */
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let day = utcDayIndex(from + 'T12:00:00Z'); day <= utcDayIndex(to + 'T12:00:00Z'); day++) out.push(dayIndexToIso(day));
  return out;
}

/** "YYYY-MM" months touching [from, to], oldest first. */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let m = from.slice(0, 7); m <= to.slice(0, 7); m = shiftMonth(m, 1)) out.push(m);
  return out;
}

/** The period chips on the Sales, Other Income and Other Expenses lists (farm calendar). */
export const LIST_PERIODS = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 days' },
  { value: 'month', label: 'This month' },
  { value: 'lastmonth', label: 'Last month' },
  { value: 'all', label: 'All' },
] as const;
export type ListPeriod = (typeof LIST_PERIODS)[number]['value'];

/** Whether a stored day falls in a list period, counted on the farm's clock. */
export function inListPeriod(date: Date | string, period: ListPeriod, now: Date | string = new Date()): boolean {
  if (period === 'all') return true;
  const day = utcDayIndex(date);
  const today = farmDayIndex(now);
  if (period === 'today') return day === today;
  if (period === '7d') return day > today - 7 && day <= today;
  const month = period === 'month' ? farmMonth(now) : shiftMonth(farmMonth(now), -1);
  return monthKey(date) === month;
}

export * from './backup';
