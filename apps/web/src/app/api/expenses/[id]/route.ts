import { expenseUpdateSchema } from '@farm/shared-validation';
import { db } from '@/lib/db';
import { entryDay } from '@/lib/days';
import { withAuth, getIdFromParams, isObjectId } from '@/lib/middleware/withAuth';

const notFound = () => Response.json({ error: 'Expense not found' }, { status: 404 });

export const GET = withAuth(async (req, { tenantId }, routeContext) => {
  try {
    const id = await getIdFromParams(routeContext, req);
    if (!id || !isObjectId(id)) return notFound();

    const expense = await db.otherExpense.findFirst({ where: { id, tenantId } });
    if (!expense) return notFound();

    return Response.json(expense);
  } catch (err: unknown) {
    console.error('Error loading expense:', err);
    return Response.json({ error: 'Failed to load expense' }, { status: 500 });
  }
});

export const PUT = withAuth(async (req, { tenantId }, routeContext) => {
  try {
    const id = await getIdFromParams(routeContext, req);
    if (!id || !isObjectId(id)) return notFound();

    const parsed = expenseUpdateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.path[0] === 'amount' ? 'Amount must be a positive number' : 'Invalid expense details' }, { status: 400 });
    }
    const body = parsed.data;

    let expenseDate: Date | undefined;
    if (body.expenseDate) {
      const day = entryDay(body.expenseDate);
      if ('error' in day) return Response.json({ error: day.error }, { status: 400 });
      expenseDate = day.date;
    }

    const result = await db.otherExpense.updateMany({
      where: { id, tenantId },
      data: {
        description: body.description,
        amount: body.amount,
        category: body.category || undefined,
        expenseDate,
      },
    });

    if (result.count === 0) return notFound();

    const updated = await db.otherExpense.findFirst({ where: { id, tenantId } });
    return Response.json(updated);
  } catch (err: unknown) {
    console.error('Error saving expense:', err);
    return Response.json({ error: 'Failed to save expense' }, { status: 500 });
  }
});

export const DELETE = withAuth(async (req, { tenantId }, routeContext) => {
  try {
    const id = await getIdFromParams(routeContext, req);
    if (!id || !isObjectId(id)) return notFound();

    const { count } = await db.otherExpense.deleteMany({ where: { id, tenantId } });
    if (!count) return notFound();
    return Response.json({ success: true });
  } catch (err: unknown) {
    console.error('Error deleting expense:', err);
    return Response.json({ error: 'Failed to delete expense' }, { status: 500 });
  }
});
