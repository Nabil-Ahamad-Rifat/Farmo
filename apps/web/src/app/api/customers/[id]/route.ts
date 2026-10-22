import { customerSchema } from '@farm/shared-validation';
import { db } from '@/lib/db';
import { withAuth, getIdFromParams } from '@/lib/middleware/withAuth';
import { getCustomerDetail } from '@/lib/receivables';

export const GET = withAuth(async (req, { tenantId }, routeContext) => {
  try {
    const id = await getIdFromParams(routeContext, req);
    if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });

    const detail = await getCustomerDetail(tenantId, id);
    if (!detail) return Response.json({ error: 'Customer not found' }, { status: 404 });
    return Response.json(detail);
  } catch (err: unknown) {
    console.error('Error fetching customer:', err);
    return Response.json({ error: 'Failed to load customer' }, { status: 500 });
  }
});

export const PUT = withAuth(async (req, { tenantId }, routeContext) => {
  try {
    const id = await getIdFromParams(routeContext, req);
    if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });

    const parsed = customerSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? 'Invalid customer' }, { status: 400 });
    }

    const { name, phone, address, notes, type } = parsed.data;
    const result = await db.$transaction(async (tx) => {
      const updated = await tx.customer.updateMany({
        where: { id, tenantId },
        data: { name, type, phone: phone ?? null, address: address ?? null, notes: notes ?? null },
      });
      // Keep the denormalised name on sales in step so search and mobile show the new name.
      if (updated.count > 0) {
        await tx.sale.updateMany({ where: { tenantId, customerId: id }, data: { customerName: name } });
      }
      return updated.count;
    });
    if (result === 0) return Response.json({ error: 'Customer not found' }, { status: 404 });

    return Response.json(await db.customer.findFirst({ where: { id, tenantId } }));
  } catch (err: unknown) {
    console.error('Error updating customer:', err);
    return Response.json({ error: 'Failed to update customer' }, { status: 500 });
  }
});

export const DELETE = withAuth(async (req, { tenantId }, routeContext) => {
  try {
    const id = await getIdFromParams(routeContext, req);
    if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });

    // Deleting a customer with sales would silently erase sales history and dues.
    const salesCount = await db.sale.count({ where: { tenantId, customerId: id } });
    if (salesCount > 0) {
      return Response.json(
        { error: `This customer has ${salesCount} sale(s). Delete or move those sales first.` },
        { status: 409 },
      );
    }

    // Payments would be deleted with the customer and lower past "money received".
    const paymentsCount = await db.payment.count({ where: { tenantId, customerId: id } });
    if (paymentsCount > 0) {
      return Response.json(
        { error: `This customer has ${paymentsCount} payment(s) recorded. Delete those payments first so the money history stays correct.` },
        { status: 409 },
      );
    }

    const result = await db.customer.deleteMany({ where: { id, tenantId } });
    if (result.count === 0) return Response.json({ error: 'Customer not found' }, { status: 404 });
    return Response.json({ success: true });
  } catch (err: unknown) {
    console.error('Error deleting customer:', err);
    return Response.json({ error: 'Failed to delete customer' }, { status: 500 });
  }
});
