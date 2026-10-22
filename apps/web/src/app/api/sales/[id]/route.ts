import { saleSchema } from '@farm/shared-validation';
import { db } from '@/lib/db';
import { withAuth, getIdFromParams } from '@/lib/middleware/withAuth';
import { recomputeCustomer, findOrCreateCustomerByName, dayToDate, saleInclude } from '@/lib/receivables';

export const GET = withAuth(async (req, { tenantId }, routeContext) => {
  try {
    const id = await getIdFromParams(routeContext, req);
    if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });

    const sale = await db.sale.findFirst({
      where: { id, tenantId },
      include: saleInclude,
    });
    if (!sale) return Response.json({ error: 'Sale not found' }, { status: 404 });

    return Response.json(sale);
  } catch (err: unknown) {
    console.error('Error fetching sale:', err);
    return Response.json({ error: 'Failed to load sale' }, { status: 500 });
  }
});

export const PUT = withAuth(async (req, { tenantId, userId }, routeContext) => {
  try {
    const id = await getIdFromParams(routeContext, req);
    if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });

    const parsed = saleSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? 'Invalid sale' }, { status: 400 });
    }
    const s = parsed.data;

    const existing = await db.sale.findFirst({ where: { id, tenantId }, include: { customer: true } });
    if (!existing) return Response.json({ error: 'Sale not found' }, { status: 404 });

    if (s.customerId && s.customerId !== existing.customerId) {
      const exists = await db.customer.findFirst({ where: { id: s.customerId, tenantId } });
      if (!exists) return Response.json({ error: 'Customer not found' }, { status: 404 });
    }
    // If linking to a (new) cow, make sure it belongs to this tenant.
    if (s.cowId && s.cowId !== existing.cowId) {
      const cow = await db.cow.findFirst({ where: { id: s.cowId, tenantId } });
      if (!cow) return Response.json({ error: 'Cow not found' }, { status: 404 });
    }

    const updated = await db.$transaction(async (tx) => {
      // Work out which customer the sale belongs to after the edit.
      let customerId = existing.customerId;
      if (s.customerId) {
        customerId = s.customerId;
      } else if (existing.customer && s.customerName) {
        // Name-only edit (older mobile builds): keep the link unless the name really changed.
        const same = existing.customer.name.trim().toLowerCase() === s.customerName.trim().toLowerCase();
        if (!same) customerId = (await findOrCreateCustomerByName(tx, tenantId, s.customerName)).id;
      }
      const customer = customerId ? await tx.customer.findUnique({ where: { id: customerId } }) : null;

      // Linking a legacy sale that was already marked paid: record that money as a payment
      // so it doesn't suddenly show up as owed.
      if (!existing.customerId && customerId && existing.status === 'paid') {
        await tx.payment.create({
          data: { createdById: userId,
            tenantId,
            customerId,
            amount: existing.amount,
            note: 'Paid before customer tracking',
            paidAt: existing.createdAt,
          },
        });
      }

      // If old cow was unlinked, revert its status
      if (existing.cowId && existing.cowId !== s.cowId) {
        await tx.cow.updateMany({ where: { id: existing.cowId, tenantId }, data: { status: 'active' } });
      }
      if (s.cowId) {
        await tx.cow.updateMany({ where: { id: s.cowId, tenantId }, data: { status: 'sold' } });
      }

      await tx.sale.update({
        where: { id },
        data: {
          customerId,
          customerName: customer?.name ?? s.customerName ?? existing.customerName,
          amount: s.amount,
          saleType: s.saleType,
          quantity: s.quantity ?? null,
          unitPrice: s.unitPrice ?? null,
          notes: s.notes ?? null,
          cowId: s.cowId ?? null,
          createdAt: dayToDate(s.saleDate, existing.createdAt),
          // Status is derived from payments for customer sales; only legacy unlinked sales keep a hand-set one.
          ...(customerId ? {} : { status: s.status === 'pending' ? 'pending' : 'paid' }),
        },
      });

      if (customerId) await recomputeCustomer(tx, tenantId, customerId);
      if (existing.customerId && existing.customerId !== customerId) {
        await recomputeCustomer(tx, tenantId, existing.customerId);
      }
      return tx.sale.findUniqueOrThrow({ where: { id }, include: saleInclude });
    });

    return Response.json(updated);
  } catch (err: unknown) {
    console.error('Error updating sale:', err);
    return Response.json({ error: 'Failed to update sale' }, { status: 500 });
  }
});

export const DELETE = withAuth(async (req, { tenantId }, routeContext) => {
  try {
    const id = await getIdFromParams(routeContext, req);
    if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });

    const sale = await db.sale.findFirst({ where: { id, tenantId } });
    if (!sale) return Response.json({ success: true });

    await db.$transaction(async (tx) => {
      if (sale.cowId) {
        await tx.cow.updateMany({ where: { id: sale.cowId, tenantId }, data: { status: 'active' } });
      }
      await tx.sale.delete({ where: { id } });
      // Payments stay on the customer; what they covered now rolls onto other sales (or becomes advance).
      if (sale.customerId) await recomputeCustomer(tx, tenantId, sale.customerId);
    });

    return Response.json({ success: true });
  } catch (err: unknown) {
    console.error('Error deleting sale:', err);
    return Response.json({ error: 'Failed to delete sale' }, { status: 500 });
  }
});
