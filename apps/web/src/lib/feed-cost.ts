import { feedCostBetween as costOf } from '@farm/business-logic';
import { db } from '@/lib/db';

/**
 * Feed cost for profit in [from, to]: purchases with days set are spread per
 * day; purchases without days count in full on the day they were bought.
 * Usage records only move stock, so they add no cost here.
 */
export async function feedCostBetween(tenantId: string, from: Date, to: Date) {
  const batches = await db.feedBatch.findMany({
    where: { tenantId },
    select: { quantity: true, unitPrice: true, coverDays: true, purchasedAt: true, createdAt: true },
  });
  return costOf(batches, from, to);
}
