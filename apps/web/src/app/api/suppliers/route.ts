import { supplierSchema } from '@farm/shared-validation';
import { db } from '@/lib/db';
import { withAuth } from '@/lib/middleware/withAuth';
import { withIdempotency } from '@/lib/idempotency';
import { listSuppliersWithBalances, EMPTY_SUPPLIER_BALANCE } from '@/lib/payables';

export const GET = withAuth(async (req, { tenantId }) => {
  try {
    const rows = await listSuppliersWithBalances(tenantId, { q: req.nextUrl.searchParams.get('q') });
    return Response.json(rows);
  } catch (err: unknown) {
    console.error('Error listing suppliers:', err);
    return Response.json({ error: 'Failed to load suppliers' }, { status: 500 });
  }
});

export const POST = withAuth(async (req, { tenantId }) => withIdempotency(req, tenantId, 'suppliers:create', async () => {
  try {
    const parsed = supplierSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? 'Invalid supplier' }, { status: 400 });
    }
    const supplier = await db.supplier.create({ data: { ...parsed.data, tenantId } });
    return Response.json({ ...supplier, ...EMPTY_SUPPLIER_BALANCE }, { status: 201 });
  } catch (err: unknown) {
    console.error('Error creating supplier:', err);
    return Response.json({ error: 'Failed to create supplier' }, { status: 500 });
  }
}));
