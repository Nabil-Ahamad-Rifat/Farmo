// Every money entry of the farm in one list (the History page and /api/ledger):
// sales, money received, other income and expenses, feed bought, supplier
// payments, worker payments and written-off advances.
import { farmToday, monthBounds } from '@farm/business-logic';
import { db } from '@/lib/db';

export const LEDGER_TYPES = ['sale', 'payment', 'income', 'expense', 'animal', 'feed', 'supplier', 'salary', 'writeoff'] as const;
export type LedgerType = (typeof LEDGER_TYPES)[number];

/**
 * How an entry moves money: `in`/`out` is cash that came in or went out;
 * `sale` and `purchase` are earned or owed but not necessarily paid yet;
 * `loss` is an advance given up.
 */
export type LedgerFlow = 'in' | 'out' | 'sale' | 'purchase' | 'loss';

export interface LedgerEntry {
  id: string;
  type: LedgerType;
  flow: LedgerFlow;
  date: Date;
  title: string;
  detail: string | null;
  amount: number;
  href: string;
  /** Who entered it (null for records from before "added by"). */
  byId: string | null;
}

export interface LedgerQuery {
  from: string;
  to: string;
  type: LedgerType | null;
  q: string | null;
  limit: number;
  /** Only entries added by this user. */
  by: string | null;
}

const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

/** Filters from the URL; defaults to this month (farm calendar) and all types. */
export function parseLedgerQuery(p: { from?: string | null; to?: string | null; month?: string | null; type?: string | null; q?: string | null; limit?: string | null; by?: string | null }): LedgerQuery {
  const today = farmToday();
  let from: string;
  let to: string;
  if (isDay(p.from) && isDay(p.to) && p.from <= p.to) {
    from = p.from;
    to = p.to;
  } else {
    const month = p.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(p.month) ? p.month : today.slice(0, 7);
    const { start, end } = monthBounds(month);
    from = start.toISOString().slice(0, 10);
    to = end.toISOString().slice(0, 10);
  }
  const type = (LEDGER_TYPES as readonly string[]).includes(p.type ?? '') ? (p.type as LedgerType) : null;
  const limit = Math.min(1000, Math.max(50, parseInt(p.limit ?? '') || 100));
  return { from, to, type, q: p.q?.trim().slice(0, 100) || null, limit, by: p.by && /^[a-f0-9]{24}$/i.test(p.by) ? p.by : null };
}

/** Record types as the animal page names them. */
export const ANIMAL_RECORD_LABELS: Record<string, string> = {
  vaccine: 'Vaccine',
  insemination: 'Semen / AI',
  pregnancy_check: 'Pregnancy check',
  calving: 'Calving',
  treatment: 'Treatment',
  deworming: 'Deworming',
  weight: 'Weight',
  other: 'Animal care',
};

const tkPlain = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 2 });

/** The entries in the period (newest first) with totals, before paging. */
export async function getLedger(tenantId: string, query: LedgerQuery) {
  // Whole calendar days: entries are stored at noon UTC, older ones at any time of day.
  const range = { gte: new Date(query.from + 'T00:00:00Z'), lte: new Date(query.to + 'T23:59:59.999Z') };
  const want = (t: LedgerType) => !query.type || query.type === t;
  const none = Promise.resolve([] as never[]);

  const [sales, payments, income, expenses, feed, supplierPays, salaryPays, animalCosts] = await Promise.all([
    want('sale') ? db.sale.findMany({ where: { tenantId, createdAt: range }, select: { id: true, createdById: true, amount: true, createdAt: true, customerName: true, customerId: true, saleType: true, quantity: true, status: true } }) : none,
    want('payment') ? db.payment.findMany({ where: { tenantId, paidAt: range }, select: { id: true, createdById: true, amount: true, paidAt: true, method: true, note: true, customerId: true, customer: { select: { name: true } } } }) : none,
    want('income') ? db.otherIncome.findMany({ where: { tenantId, incomeDate: range }, select: { id: true, createdById: true, amount: true, incomeDate: true, description: true, category: true } }) : none,
    want('expense') ? db.otherExpense.findMany({ where: { tenantId, expenseDate: range }, select: { id: true, createdById: true, amount: true, expenseDate: true, description: true, category: true } }) : none,
    want('feed')
      ? db.feedBatch.findMany({
          where: { tenantId, OR: [{ purchasedAt: range }, { purchasedAt: null, createdAt: range }, { purchasedAt: { isSet: false }, createdAt: range }] },
          select: { id: true, createdById: true, name: true, quantity: true, unitPrice: true, purchasedAt: true, createdAt: true, supplierId: true, supplier: { select: { name: true } } },
        })
      : none,
    want('supplier') ? db.supplierPayment.findMany({ where: { tenantId, paidAt: range }, select: { id: true, createdById: true, amount: true, paidAt: true, method: true, note: true, supplierId: true, supplier: { select: { name: true } } } }) : none,
    want('salary') || want('writeoff')
      ? db.salaryPayment.findMany({ where: { employee: { tenantId }, paidAt: range }, select: { id: true, createdById: true, amount: true, paidAt: true, kind: true, note: true, employeeId: true, employee: { select: { name: true } } } })
      : none,
    want('animal')
      ? db.animalEvent.findMany({ where: { tenantId, cost: { gt: 0 }, date: range }, select: { id: true, createdById: true, cowId: true, type: true, title: true, cost: true, date: true, cow: { select: { tagNumber: true, name: true } } } })
      : none,
  ]);

  const entries: LedgerEntry[] = [
    ...sales.map((s): LedgerEntry => ({
      id: 's' + s.id,
      type: 'sale',
      flow: 'sale',
      date: s.createdAt,
      title: `Sale to ${s.customerName}`,
      detail: [s.saleType === 'milk' && s.quantity ? `${tkPlain(s.quantity)} L milk` : s.saleType === 'cow_sale' ? 'Cow' : null, s.status === 'paid' ? 'paid' : s.status === 'partial' ? 'part paid' : 'not paid yet'].filter(Boolean).join(' · '),
      amount: s.amount,
      href: s.customerId ? `/dashboard/customers/${s.customerId}` : '/dashboard/sales',
      byId: s.createdById ?? null,
    })),
    ...payments.map((p): LedgerEntry => ({
      id: 'p' + p.id,
      type: 'payment',
      flow: 'in',
      date: p.paidAt,
      title: `Received from ${p.customer?.name ?? 'customer'}`,
      detail: [p.method !== 'cash' ? p.method : null, p.note].filter(Boolean).join(' · ') || null,
      amount: p.amount,
      href: `/dashboard/customers/${p.customerId}`,
      byId: p.createdById ?? null,
    })),
    ...income.map((i): LedgerEntry => ({ id: 'i' + i.id, type: 'income', flow: 'in', date: i.incomeDate, title: i.description, detail: `Other income · ${i.category}`, amount: i.amount, href: '/dashboard/income', byId: i.createdById ?? null })),
    ...expenses.map((e): LedgerEntry => ({ id: 'e' + e.id, type: 'expense', flow: 'out', date: e.expenseDate, title: e.description, detail: `Expense · ${e.category}`, amount: e.amount, href: '/dashboard/expenses', byId: e.createdById ?? null })),
    ...animalCosts.map((a): LedgerEntry => ({
      id: 'a' + a.id,
      type: 'animal',
      flow: 'out',
      date: a.date,
      title: `${ANIMAL_RECORD_LABELS[a.type] ?? 'Animal care'}${a.title ? `: ${a.title}` : ''}`,
      detail: `Animal care · ${a.cow.tagNumber}${a.cow.name !== a.cow.tagNumber ? ` ${a.cow.name}` : ''}`,
      amount: a.cost ?? 0,
      href: `/dashboard/cows/${a.cowId}`,
      byId: a.createdById ?? null,
    })),
    ...feed.map((f): LedgerEntry => ({
      id: 'f' + f.id,
      type: 'feed',
      // Bought without a supplier means paid there and then.
      flow: f.supplierId ? 'purchase' : 'out',
      date: f.purchasedAt ?? f.createdAt,
      title: `Feed bought: ${f.name}`,
      detail: `${tkPlain(f.quantity)} kg × ৳${tkPlain(f.unitPrice)}${f.supplier ? ` · from ${f.supplier.name}` : ' · paid on the spot'}`,
      amount: Math.round(f.quantity * f.unitPrice * 100) / 100,
      href: f.supplierId ? `/dashboard/suppliers/${f.supplierId}` : '/dashboard/feed',
      byId: f.createdById ?? null,
    })),
    ...supplierPays.map((p): LedgerEntry => ({
      id: 'sp' + p.id,
      type: 'supplier',
      flow: 'out',
      date: p.paidAt,
      title: `Paid to ${p.supplier?.name ?? 'supplier'}`,
      detail: [p.method !== 'cash' ? p.method : null, p.note].filter(Boolean).join(' · ') || null,
      amount: p.amount,
      href: `/dashboard/suppliers/${p.supplierId}`,
      byId: p.createdById ?? null,
    })),
    ...salaryPays
      .filter((p) => (p.kind === 'writeoff' ? want('writeoff') : want('salary')))
      .map((p): LedgerEntry => ({
        id: 'w' + p.id,
        type: p.kind === 'writeoff' ? 'writeoff' : 'salary',
        flow: p.kind === 'writeoff' ? 'loss' : 'out',
        date: p.paidAt,
        title: p.kind === 'writeoff' ? `Advance written off: ${p.employee.name}` : `Paid to ${p.employee.name}`,
        detail: p.note,
        amount: p.amount,
        href: `/dashboard/employees/${p.employeeId}`,
        byId: p.createdById ?? null,
      })),
  ];

  const q = query.q?.toLowerCase();
  const people = query.by ? entries.filter((e) => e.byId === query.by) : entries;
  const matched = (q ? people.filter((e) => e.title.toLowerCase().includes(q) || (e.detail ?? '').toLowerCase().includes(q)) : people).sort(
    (a, b) => b.date.getTime() - a.date.getTime() || a.id.localeCompare(b.id),
  );

  const sum = (flow: LedgerFlow) => Math.round(matched.filter((e) => e.flow === flow).reduce((s, e) => s + e.amount * 100, 0)) / 100;
  return {
    query,
    total: matched.length,
    entries: matched.slice(0, query.limit),
    totals: { moneyIn: sum('in'), moneyOut: sum('out'), salesMade: sum('sale'), boughtOnCredit: sum('purchase'), writtenOff: sum('loss') },
  };
}

export type Ledger = Awaited<ReturnType<typeof getLedger>>;
