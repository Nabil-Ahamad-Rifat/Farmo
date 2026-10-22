import { expenseSchema } from '@farm/shared-validation';
import { db } from '@/lib/db';
import { entryDay } from '@/lib/days';
import { withAuth } from '@/lib/middleware/withAuth';
import { withIdempotency } from '@/lib/idempotency';

export const GET = withAuth(async (_req, { tenantId }) => {
  try {
    const expenses = await db.otherExpense.findMany({
      where: { tenantId },
      orderBy: { expenseDate: 'desc' },
    });
    return Response.json(expenses);
  } catch (err: unknown) {
    console.error('Error loading expenses:', err);
    return Response.json({ error: 'Failed to load expenses' }, { status: 500 });
  }
});

export const POST = withAuth(async (req, { tenantId, userId }) => withIdempotency(req, tenantId, 'expenses:create', async () => {
  try {
    const parsed = expenseSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ error: 'Description and a valid positive amount are required' }, { status: 400 });
    }
    const { description, amount, category, expenseDate } = parsed.data;

    const day = entryDay(expenseDate);
    if ('error' in day) return Response.json({ error: day.error }, { status: 400 });

    const expense = await db.otherExpense.create({
      data: { createdById: userId,
        description,
        amount,
        category: category || 'other',
        expenseDate: day.date,
        tenantId,
      },
    });

    return Response.json(expense, { status: 201 });
  } catch (err: unknown) {
    console.error('Error saving expense:', err);
    return Response.json({ error: 'Failed to save expense' }, { status: 500 });
  }
}));
