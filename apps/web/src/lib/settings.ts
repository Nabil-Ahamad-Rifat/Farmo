import { db } from '@/lib/db';

/** Milk price per litre used when a farm hasn't set its own. */
export const DEFAULT_MILK_PRICE = 70;

export async function getDefaultMilkPrice(tenantId: string) {
  const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { defaultMilkPrice: true } });
  return tenant?.defaultMilkPrice ?? DEFAULT_MILK_PRICE;
}
