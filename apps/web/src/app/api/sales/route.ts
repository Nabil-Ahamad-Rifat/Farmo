import { saleSchema } from '@farm/shared-validation';
import { db } from '@/lib/db';
import { withAuth } from '@/lib/middleware/withAuth';
import { withIdempotency } from '@/lib/idempotency';
import { recomputeCustomer, findOrCreateCustomerByName, dayToDate, saleInclude } from '@/lib/receivables';

export const GET = withAuth(async (_req, { tenantId }) => {
  try {
    const sales = await db.sale.findMany({
      where: { tenantId },
      include: saleInclude,
      orderBy: { createdAt: 'desc' },
    });
    return Response.json(sales);
  } catch (err: unknown) {
    console.error('Error listing sales:', err);
    return Response.json({ error: 'Failed to load sales' }, { status: 500 });
  }
});

export const POST = withAuth(async (req, { tenantId, userId }) => withIdempotency(req, tenantId, 'sales:create', async () => {
  try {
    const parsed = saleSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? 'Invalid sale' }, { status: 400 });
    }
    const s = parsed.data;

    if (s.customerId) {
      const exists = await db.customer.findFirst({ where: { id: s.customerId, tenantId } });
      if (!exists) return Response.json({ error: 'Customer not found' }, { status: 404 });
    }
    // If linking to a cow, make sure it belongs to this tenant before writing anything.
    if (s.cowId) {
      const cow = await db.cow.findFirst({ where: { id: s.cowId, tenantId } });
      if (!cow) return Response.json({ error: 'Cow not found' }, { status: 404 });
    }

    // New clients send paidNow. Older mobile builds send status instead:
    // "paid" (or nothing, the old default) means fully paid, "pending" means nothing paid yet.
    const paidNow = s.paidNow ?? (s.status === 'pending' ? 0 : s.amount);
    const saleDate = dayToDate(s.saleDate);

    const sale = await db.$transaction(async (tx) => {
      const customer = s.customerId
        ? await tx.customer.findFirstOrThrow({ where: { id: s.customerId, tenantId } })
        : await findOrCreateCustomerByName(tx, tenantId, s.customerName!, s.customerType);

      const created = await tx.sale.create({
        data: { createdById: userId,
          tenantId,
          customerId: customer.id,
          customerName: customer.name,
          amount: s.amount,
          status: 'pending',
          paidAmount: 0,
          saleType: s.saleType,
          quantity: s.quantity ?? null,
          unitPrice: s.unitPrice ?? null,
          notes: s.notes ?? null,
          cowId: s.cowId ?? null,
          createdAt: saleDate,
        },
      });

      if (paidNow > 0) {
        await tx.payment.create({
          data: { createdById: userId,
            tenantId,
            customerId: customer.id,
            amount: paidNow,
            method: s.paymentMethod ?? 'cash',
            note: 'Paid at time of sale',
            paidAt: saleDate,
          },
        });
      }

      if (s.cowId) {
        await tx.cow.updateMany({ where: { id: s.cowId, tenantId }, data: { status: 'sold' } });
      }

      await recomputeCustomer(tx, tenantId, customer.id);
      return tx.sale.findUniqueOrThrow({ where: { id: created.id }, include: saleInclude });
    });

    return Response.json(sale, { status: 201 });
  } catch (err: unknown) {
    console.error('Error creating sale:', err);
    return Response.json({ error: 'Failed to create sale' }, { status: 500 });
  }
}));
