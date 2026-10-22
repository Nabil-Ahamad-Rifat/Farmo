import { incomeSchema } from '@farm/shared-validation';
import { db } from '@/lib/db';
import { entryDay } from '@/lib/days';
import { withAuth } from '@/lib/middleware/withAuth';
import { withIdempotency } from '@/lib/idempotency';

// GET /api/income - list all other income records for the tenant
export const GET = withAuth(async (_req, { tenantId }) => {
  try {
    const incomes = await db.otherIncome.findMany({
      where: { tenantId },
      orderBy: { incomeDate: 'desc' },
    });
    return Response.json(incomes);
  } catch (err: unknown) {
    console.error('Error handling income request:', err);
    return Response.json({ error: 'Failed to process income record' }, { status: 500 });
  }
});

// POST /api/income - create a new other income record
export const POST = withAuth(async (req, { tenantId, userId }) => withIdempotency(req, tenantId, 'income:create', async () => {
  try {
    const parsed = incomeSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      const badAmount = parsed.error.issues.some((i) => i.path[0] === 'amount') && !parsed.error.issues.some((i) => i.path[0] === 'description');
      return Response.json({ error: badAmount ? 'Amount must be a positive number' : 'Description and amount are required' }, { status: 400 });
    }
    const { description, amount, category, incomeDate } = parsed.data;

    const day = entryDay(incomeDate);
    if ('error' in day) return Response.json({ error: day.error }, { status: 400 });

    const income = await db.otherIncome.create({
      data: { createdById: userId,
        description,
        amount,
        category: category || 'other',
        incomeDate: day.date,
        tenantId,
      },
    });

    return Response.json(income, { status: 201 });
  } catch (err: unknown) {
    console.error('Error handling income request:', err);
    return Response.json({ error: 'Failed to process income record' }, { status: 500 });
  }
}));
