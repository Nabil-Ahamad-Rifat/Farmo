import { customerSchema } from '@farm/shared-validation';
import { db } from '@/lib/db';
import { withAuth } from '@/lib/middleware/withAuth';
import { withIdempotency } from '@/lib/idempotency';
import { listCustomersWithBalances, EMPTY_BALANCE } from '@/lib/receivables';

export const GET = withAuth(async (req, { tenantId }) => {
  try {
    const rows = await listCustomersWithBalances(tenantId, {
      type: req.nextUrl.searchParams.get('type'),
      q: req.nextUrl.searchParams.get('q'),
    });
    return Response.json(rows);
  } catch (err: unknown) {
    console.error('Error listing customers:', err);
    return Response.json({ error: 'Failed to load customers' }, { status: 500 });
  }
});

export const POST = withAuth(async (req, { tenantId }) => withIdempotency(req, tenantId, 'customers:create', async () => {
  try {
    const parsed = customerSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? 'Invalid customer' }, { status: 400 });
    }
    const customer = await db.customer.create({ data: { ...parsed.data, tenantId } });
    return Response.json({ ...customer, ...EMPTY_BALANCE }, { status: 201 });
  } catch (err: unknown) {
    console.error('Error creating customer:', err);
    return Response.json({ error: 'Failed to create customer' }, { status: 500 });
  }
}));
