import type { Prisma } from '@prisma/client';
import { allocatePayments } from '@farm/business-logic';
import { db } from '@/lib/db';

type Tx = Prisma.TransactionClient;

export const isObjectId = (id: string) => /^[a-f0-9]{24}$/i.test(id);

/** What every sales response includes, so clients can show the cow and the customer. */
export const saleInclude = {
  cow: true,
  customer: { select: { id: true, name: true, type: true } },
} satisfies Prisma.SaleInclude;

/**
 * Re-derive paidAmount/status for every sale of one customer from scratch
 * (oldest sale first, payments pooled). Call inside the same transaction as
 * any write to that customer's sales or payments.
 */
export async function recomputeCustomer(tx: Tx, tenantId: string, customerId: string) {
  const [sales, payments] = await Promise.all([
    tx.sale.findMany({
      where: { tenantId, customerId },
      select: { id: true, amount: true, createdAt: true, paidAmount: true, status: true },
    }),
    tx.payment.findMany({ where: { tenantId, customerId }, select: { amount: true } }),
  ]);

  const result = allocatePayments(
    sales.map((s) => ({ id: s.id, amount: s.amount, date: s.createdAt })),
    payments,
  );

  const current = new Map(sales.map((s) => [s.id, s]));
  for (const next of result.perSale) {
    const prev = current.get(next.id);
    if (prev && (prev.paidAmount !== next.paidAmount || prev.status !== next.status)) {
      await tx.sale.update({ where: { id: next.id }, data: { paidAmount: next.paidAmount, status: next.status } });
    }
  }
  return result;
}

/** Match an existing customer by name (case-insensitive), or create one. Used for name-only (mobile/legacy) sales. */
export async function findOrCreateCustomerByName(tx: Tx, tenantId: string, rawName: string, type: string = 'new') {
  const name = rawName.trim().replace(/\s+/g, ' ');
  const existing = await tx.customer.findFirst({
    where: { tenantId, name: { equals: name, mode: 'insensitive' } },
    orderBy: { createdAt: 'asc' },
  });
  return existing ?? tx.customer.create({ data: { tenantId, name, type } });
}

export interface Balance {
  totalSold: number;
  totalPaid: number;
  totalDue: number;
  advance: number;
  salesCount: number;
  lastPurchaseAt: Date | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Running balance per customer for a tenant (optionally limited to some customers). */
export async function getBalances(tenantId: string, customerIds?: string[]): Promise<Map<string, Balance>> {
  const scope = customerIds ? { in: customerIds } : { not: null };
  const [saleGroups, paymentGroups] = await Promise.all([
    db.sale.groupBy({
      by: ['customerId'],
      where: { tenantId, customerId: scope },
      _sum: { amount: true },
      _count: { _all: true },
      _max: { createdAt: true },
    }),
    db.payment.groupBy({
      by: ['customerId'],
      where: { tenantId, ...(customerIds ? { customerId: { in: customerIds } } : {}) },
      _sum: { amount: true },
    }),
  ]);

  const paid = new Map(paymentGroups.map((g) => [g.customerId, g._sum.amount ?? 0]));
  const balances = new Map<string, Balance>();
  const ids = new Set<string>([...saleGroups.map((g) => g.customerId!).filter(Boolean), ...paid.keys()]);

  for (const id of ids) {
    const sale = saleGroups.find((g) => g.customerId === id);
    const totalSold = round2(sale?._sum.amount ?? 0);
    const totalPaid = round2(paid.get(id) ?? 0);
    balances.set(id, {
      totalSold,
      totalPaid,
      totalDue: round2(Math.max(0, totalSold - totalPaid)),
      advance: round2(Math.max(0, totalPaid - totalSold)),
      salesCount: sale?._count._all ?? 0,
      lastPurchaseAt: sale?._max.createdAt ?? null,
    });
  }
  return balances;
}

export const EMPTY_BALANCE: Balance = {
  totalSold: 0,
  totalPaid: 0,
  totalDue: 0,
  advance: 0,
  salesCount: 0,
  lastPurchaseAt: null,
};

/** "YYYY-MM-DD" from a form -> noon UTC that day (same convention as the sales routes). */
export function dayToDate(day: string | undefined, fallback: Date = new Date()) {
  return day ? new Date(day + 'T12:00:00Z') : fallback;
}

/** Sales with no customer (created before customer tracking). Old documents may lack the field entirely. */
export const legacySaleFilter = { OR: [{ customerId: null }, { customerId: { isSet: false } }] } satisfies Prisma.SaleWhereInput;

/**
 * Money actually received in [from, to]: customer payments by payment date,
 * plus legacy customer-less sales marked paid, by sale date.
 */
export async function collectedBetween(tenantId: string, from: Date, to: Date) {
  const [payments, legacy] = await Promise.all([
    db.payment.aggregate({ where: { tenantId, paidAt: { gte: from, lte: to } }, _sum: { amount: true } }),
    db.sale.aggregate({
      where: { tenantId, status: 'paid', createdAt: { gte: from, lte: to }, ...legacySaleFilter },
      _sum: { amount: true },
    }),
  ]);
  return (payments._sum.amount ?? 0) + (legacy._sum.amount ?? 0);
}

/** Everything customers owe right now (sum of each customer's due; advances don't offset other customers). */
export async function totalReceivable(tenantId: string) {
  const balances = await getBalances(tenantId);
  let due = 0;
  for (const b of balances.values()) due += b.totalDue;
  return round2(due);
}

/** Each customer's most recent milk price per litre (by sale date), for prefilling the sale form. */
export async function lastMilkPrices(tenantId: string, customerIds: string[]) {
  const sales = await db.sale.findMany({
    where: { tenantId, customerId: { in: customerIds }, saleType: 'milk', unitPrice: { gt: 0 } },
    select: { customerId: true, unitPrice: true },
    orderBy: { createdAt: 'desc' },
  });
  const prices = new Map<string, number>();
  for (const s of sales) {
    if (s.customerId && s.unitPrice != null && !prices.has(s.customerId)) prices.set(s.customerId, s.unitPrice);
  }
  return prices;
}

/** Customers with their running balance, most owed first. */
export async function listCustomersWithBalances(
  tenantId: string,
  filter: { type?: string | null; q?: string | null } = {},
) {
  const q = filter.q?.trim();
  const customers = await db.customer.findMany({
    where: {
      tenantId,
      ...(filter.type === 'regular' || filter.type === 'new' ? { type: filter.type } : {}),
      ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }] } : {}),
    },
    orderBy: { name: 'asc' },
  });
  const ids = customers.map((c) => c.id);
  const [balances, prices] = await Promise.all([getBalances(tenantId, ids), lastMilkPrices(tenantId, ids)]);
  return customers
    .map((c) => ({ ...c, ...(balances.get(c.id) ?? EMPTY_BALANCE), lastMilkPrice: prices.get(c.id) ?? null }))
    .sort((a, b) => b.totalDue - a.totalDue || a.name.localeCompare(b.name));
}

/** One customer with balance, sales, payments and a newest-first combined history. Null if not in this tenant. */
export async function getCustomerDetail(tenantId: string, id: string) {
  if (!isObjectId(id)) return null;
  const customer = await db.customer.findFirst({ where: { id, tenantId } });
  if (!customer) return null;

  const [sales, payments, balances, prices] = await Promise.all([
    db.sale.findMany({ where: { tenantId, customerId: id }, include: saleInclude, orderBy: { createdAt: 'desc' } }),
    db.payment.findMany({ where: { tenantId, customerId: id }, orderBy: { paidAt: 'desc' } }),
    getBalances(tenantId, [id]),
    lastMilkPrices(tenantId, [id]),
  ]);

  const history = [
    ...sales.map((sale) => ({ kind: 'sale' as const, date: sale.createdAt, sale })),
    ...payments.map((payment) => ({ kind: 'payment' as const, date: payment.paidAt, payment })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  return {
    ...customer,
    ...(balances.get(id) ?? EMPTY_BALANCE),
    lastMilkPrice: prices.get(id) ?? null,
    sales,
    payments,
    history,
  };
}
