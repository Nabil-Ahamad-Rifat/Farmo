// One-time, idempotent: link sales recorded before customer tracking to Customer records.
//
//   node scripts/migrate-customers.mjs            # dry run: prints what would change
//   node scripts/migrate-customers.mjs --apply    # writes
//
// Uses DATABASE_URL from the environment (or apps/web/.env). For every sale with
// no customerId it groups by trimmed, case-insensitive customer name, finds or
// creates a Customer (type "regular" when that name has 2+ sales, else "new"),
// records a Payment for each sale that was marked "paid" (so nothing already
// collected turns into a due), links the sales, then recomputes paidAmount/status
// oldest-sale-first — the same rule as allocatePayments in @farm/business-logic.
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

if (!process.env.DATABASE_URL) {
  try {
    const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
    const m = env.match(/^DATABASE_URL\s*=\s*"?([^"\n]+)"?/m);
    if (m) process.env.DATABASE_URL = m[1];
  } catch {}
}

const apply = process.argv.includes('--apply');
const db = new PrismaClient();
const norm = (n) => n.trim().replace(/\s+/g, ' ');
const paisa = (t) => Math.round(t * 100);

async function recompute(tenantId, customerId) {
  const sales = await db.sale.findMany({ where: { tenantId, customerId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
  const payments = await db.payment.findMany({ where: { tenantId, customerId } });
  let pool = payments.reduce((s, p) => s + Math.max(0, paisa(p.amount)), 0);
  for (const sale of sales) {
    const amount = Math.max(0, paisa(sale.amount));
    const applied = Math.min(amount, pool);
    pool -= applied;
    const status = applied >= amount ? 'paid' : applied > 0 ? 'partial' : 'pending';
    await db.sale.update({ where: { id: sale.id }, data: { paidAmount: applied / 100, status } });
  }
}

async function main() {
  const legacy = await db.sale.findMany({
    where: { OR: [{ customerId: null }, { customerId: { isSet: false } }] },
    orderBy: { createdAt: 'asc' },
  });
  console.log(`${legacy.length} sale(s) without a customer${apply ? '' : ' (dry run, pass --apply to write)'}`);

  const groups = new Map();
  for (const sale of legacy) {
    const name = norm(sale.customerName || 'Unknown customer');
    const key = `${sale.tenantId}::${name.toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, { tenantId: sale.tenantId, name, sales: [] });
    groups.get(key).sales.push(sale);
  }

  for (const { tenantId, name, sales } of groups.values()) {
    const paidSales = sales.filter((s) => s.status === 'paid');
    const type = sales.length >= 2 ? 'regular' : 'new';
    console.log(`- ${name}: ${sales.length} sale(s), ${paidSales.length} paid -> ${type}`);
    if (!apply) continue;

    const customer =
      (await db.customer.findFirst({ where: { tenantId, name: { equals: name, mode: 'insensitive' } } })) ??
      (await db.customer.create({ data: { tenantId, name, type } }));

    for (const sale of sales) {
      // Link first, then record the payment, so a re-run after a crash never double-pays.
      const linked = await db.sale.updateMany({
        where: { id: sale.id, OR: [{ customerId: null }, { customerId: { isSet: false } }] },
        data: { customerId: customer.id, customerName: customer.name },
      });
      if (linked.count === 1 && sale.status === 'paid') {
        await db.payment.create({
          data: { tenantId, customerId: customer.id, amount: sale.amount, note: 'Migrated: sale was marked paid', paidAt: sale.createdAt },
        });
      }
    }
    await recompute(tenantId, customer.id);
  }
  console.log(apply ? 'Done.' : 'Dry run complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
