import { supplierSchema } from '@farm/shared-validation';
import { db } from '@/lib/db';
import { withAuth, getIdFromParams } from '@/lib/middleware/withAuth';
import { getSupplierDetail } from '@/lib/payables';

export const GET = withAuth(async (req, { tenantId }, routeContext) => {
  try {
    const id = await getIdFromParams(routeContext, req);
    if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });

    const detail = await getSupplierDetail(tenantId, id);
    if (!detail) return Response.json({ error: 'Supplier not found' }, { status: 404 });
    return Response.json(detail);
  } catch (err: unknown) {
    console.error('Error fetching supplier:', err);
    return Response.json({ error: 'Failed to load supplier' }, { status: 500 });
  }
});

export const PUT = withAuth(async (req, { tenantId }, routeContext) => {
  try {
    const id = await getIdFromParams(routeContext, req);
    if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });

    const parsed = supplierSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? 'Invalid supplier' }, { status: 400 });
    }

    const { name, phone, address, notes } = parsed.data;
    const result = await db.supplier.updateMany({
      where: { id, tenantId },
      data: { name, phone: phone ?? null, address: address ?? null, notes: notes ?? null },
    });
    if (result.count === 0) return Response.json({ error: 'Supplier not found' }, { status: 404 });

    return Response.json(await db.supplier.findFirst({ where: { id, tenantId } }));
  } catch (err: unknown) {
    console.error('Error updating supplier:', err);
    return Response.json({ error: 'Failed to update supplier' }, { status: 500 });
  }
});

export const DELETE = withAuth(async (req, { tenantId }, routeContext) => {
  try {
    const id = await getIdFromParams(routeContext, req);
    if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });

    // Deleting a supplier with purchases would silently erase what we owe them.
    const purchases = await db.feedBatch.count({ where: { tenantId, supplierId: id } });
    if (purchases > 0) {
      return Response.json(
        { error: `This supplier has ${purchases} purchase(s). Delete or move those purchases first.` },
        { status: 409 },
      );
    }

    // Payments cascade with the supplier.
    const result = await db.supplier.deleteMany({ where: { id, tenantId } });
    if (result.count === 0) return Response.json({ error: 'Supplier not found' }, { status: 404 });
    return Response.json({ success: true });
  } catch (err: unknown) {
    console.error('Error deleting supplier:', err);
    return Response.json({ error: 'Failed to delete supplier' }, { status: 500 });
  }
});
