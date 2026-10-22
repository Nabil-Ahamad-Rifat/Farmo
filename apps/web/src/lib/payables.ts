// What we owe feed suppliers — the mirror image of receivables.ts. A feed
// batch with a supplier is a purchase of quantity × unitPrice on purchasedAt;
// supplier payments are pooled and applied to the oldest purchase first.
import type { FeedBatch, Prisma } from '@prisma/client';
import { allocatePayments, feedSchedule } from '@farm/business-logic';
import { db } from '@/lib/db';
import { isObjectId } from '@/lib/receivables';

type Tx = Prisma.TransactionClient;

const round2 = (n: number) => Math.round(n * 100) / 100;

export const purchaseTotal = (b: { quantity: number; unitPrice: number }) => round2(b.quantity * b.unitPrice);
export const purchaseDate = (b: { purchasedAt: Date | null; createdAt: Date }) => b.purchasedAt ?? b.createdAt;

export const feedInclude = { supplier: { select: { id: true, name: true } } } satisfies Prisma.FeedBatchInclude;

/**
 * What clients see for a batch: remainingQuantity is the stock left *now*
 * (daily use already taken off for scheduled batches), plus the schedule.
 */
export function presentFeed<T extends FeedBatch>(batch: T, now: Date = new Date()) {
  const schedule = feedSchedule(batch, now);
  return { ...batch, remainingQuantity: schedule ? schedule.remaining : batch.remainingQuantity, schedule };
}

/** Every feed batch for the feed page / GET /api/feed, newest purchase first. */
export async function listFeed(tenantId: string) {
  const batches = await db.feedBatch.findMany({ where: { tenantId }, include: feedInclude });
  const now = new Date();
  return batches
    .map((b) => presentFeed(b, now))
    .sort((a, b) => purchaseDate(b).getTime() - purchaseDate(a).getTime());
}

/**
 * Re-derive paidAmount/payStatus for every purchase from one supplier, from
 * scratch. Call inside the same transaction as any write to that supplier's
 * purchases or payments.
 */
export async function recomputeSupplier(tx: Tx, tenantId: string, supplierId: string) {
  const [purchases, payments] = await Promise.all([
    tx.feedBatch.findMany({
      where: { tenantId, supplierId },
      select: { id: true, quantity: true, unitPrice: true, purchasedAt: true, createdAt: true, paidAmount: true, payStatus: true },
    }),
    tx.supplierPayment.findMany({ where: { tenantId, supplierId }, select: { amount: true } }),
  ]);

  const result = allocatePayments(
    purchases.map((p) => ({ id: p.id, amount: purchaseTotal(p), date: purchaseDate(p) })),
    payments,
  );

  const current = new Map(purchases.map((p) => [p.id, p]));
  for (const next of result.perSale) {
    const prev = current.get(next.id);
    if (prev && (prev.paidAmount !== next.paidAmount || prev.payStatus !== next.status)) {
      await tx.feedBatch.update({ where: { id: next.id }, data: { paidAmount: next.paidAmount, payStatus: next.status } });
    }
  }
  return result;
}

/** Match an existing supplier by name (case-insensitive), or create one. */
export async function findOrCreateSupplierByName(tx: Tx, tenantId: string, rawName: string) {
  const name = rawName.trim().replace(/\s+/g, ' ');
  const existing = await tx.supplier.findFirst({
    where: { tenantId, name: { equals: name, mode: 'insensitive' } },
    orderBy: { createdAt: 'asc' },
  });
  return existing ?? tx.supplier.create({ data: { tenantId, name } });
}

export interface SupplierBalance {
  totalBought: number;
  totalPaid: number;
  totalDue: number;
  advance: number;
  purchasesCount: number;
  lastPurchaseAt: Date | null;
}

export const EMPTY_SUPPLIER_BALANCE: SupplierBalance = {
  totalBought: 0,
  totalPaid: 0,
  totalDue: 0,
  advance: 0,
  purchasesCount: 0,
  lastPurchaseAt: null,
};

/** Running balance per supplier for a tenant (optionally limited to some suppliers). */
export async function getSupplierBalances(tenantId: string, supplierIds?: string[]): Promise<Map<string, SupplierBalance>> {
  const [purchases, paymentGroups] = await Promise.all([
    // Totals are quantity × price, which groupBy can't sum, so add them up here.
    db.feedBatch.findMany({
      where: { tenantId, supplierId: supplierIds ? { in: supplierIds } : { not: null } },
      select: { supplierId: true, quantity: true, unitPrice: true, purchasedAt: true, createdAt: true },
    }),
    db.supplierPayment.groupBy({
      by: ['supplierId'],
      where: { tenantId, ...(supplierIds ? { supplierId: { in: supplierIds } } : {}) },
      _sum: { amount: true },
    }),
  ]);

  const bought = new Map<string, { total: number; count: number; last: Date | null }>();
  for (const p of purchases) {
    if (!p.supplierId) continue;
    const entry = bought.get(p.supplierId) ?? { total: 0, count: 0, last: null };
    const date = purchaseDate(p);
    entry.total += purchaseTotal(p);
    entry.count += 1;
    if (!entry.last || date > entry.last) entry.last = date;
    bought.set(p.supplierId, entry);
  }
  const paid = new Map(paymentGroups.map((g) => [g.supplierId, g._sum.amount ?? 0]));

  const balances = new Map<string, SupplierBalance>();
  for (const id of new Set([...bought.keys(), ...paid.keys()])) {
    const b = bought.get(id);
    const totalBought = round2(b?.total ?? 0);
    const totalPaid = round2(paid.get(id) ?? 0);
    balances.set(id, {
      totalBought,
      totalPaid,
      totalDue: round2(Math.max(0, totalBought - totalPaid)),
      advance: round2(Math.max(0, totalPaid - totalBought)),
      purchasesCount: b?.count ?? 0,
      lastPurchaseAt: b?.last ?? null,
    });
  }
  return balances;
}

/** Everything we owe suppliers right now (an advance with one supplier doesn't offset another). */
export async function totalPayable(tenantId: string) {
  let due = 0;
  for (const b of (await getSupplierBalances(tenantId)).values()) due += b.totalDue;
  return round2(due);
}

/** Suppliers with their running balance, most owed first. */
export async function listSuppliersWithBalances(tenantId: string, filter: { q?: string | null } = {}) {
  const q = filter.q?.trim();
  const suppliers = await db.supplier.findMany({
    where: {
      tenantId,
      ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }] } : {}),
    },
    orderBy: { name: 'asc' },
  });
  const balances = await getSupplierBalances(tenantId, suppliers.map((s) => s.id));
  return suppliers
    .map((s) => ({ ...s, ...(balances.get(s.id) ?? EMPTY_SUPPLIER_BALANCE) }))
    .sort((a, b) => b.totalDue - a.totalDue || a.name.localeCompare(b.name));
}

/** One supplier with balance, purchases, payments and a newest-first combined history. Null if not in this tenant. */
export async function getSupplierDetail(tenantId: string, id: string) {
  if (!isObjectId(id)) return null;
  const supplier = await db.supplier.findFirst({ where: { id, tenantId } });
  if (!supplier) return null;

  const [batches, payments, balances] = await Promise.all([
    db.feedBatch.findMany({ where: { tenantId, supplierId: id }, include: feedInclude }),
    db.supplierPayment.findMany({ where: { tenantId, supplierId: id }, orderBy: { paidAt: 'desc' } }),
    getSupplierBalances(tenantId, [id]),
  ]);

  const purchases = batches
    .map((b) => presentFeed(b))
    .sort((a, b) => purchaseDate(b).getTime() - purchaseDate(a).getTime());

  const history = [
    ...purchases.map((purchase) => ({ kind: 'purchase' as const, date: purchaseDate(purchase), purchase })),
    ...payments.map((payment) => ({ kind: 'payment' as const, date: payment.paidAt, payment })),
  ].sort((a, b) => {
    // Same-day entries share a noon timestamp: list payments above the purchase they pay
    // for, and otherwise the most recently recorded first.
    const byDate = b.date.getTime() - a.date.getTime();
    if (byDate !== 0) return byDate;
    if (a.kind !== b.kind) return a.kind === 'payment' ? -1 : 1;
    const created = (e: typeof a) => (e.kind === 'payment' ? e.payment.createdAt : e.purchase.createdAt).getTime();
    return created(b) - created(a);
  });

  return { ...supplier, ...(balances.get(id) ?? EMPTY_SUPPLIER_BALANCE), purchases, payments, history };
}
