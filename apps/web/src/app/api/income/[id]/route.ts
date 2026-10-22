import { incomeUpdateSchema } from '@farm/shared-validation';
import { db } from '@/lib/db';
import { entryDay } from '@/lib/days';
import { withAuth, getIdFromParams, isObjectId } from '@/lib/middleware/withAuth';

// PUT /api/income/[id] - update an income record
export const PUT = withAuth(async (req, { tenantId }, routeContext) => {
  try {
    const id = await getIdFromParams(routeContext, req);
    if (!id || !isObjectId(id)) return Response.json({ error: 'Income record not found' }, { status: 404 });

    const parsed = incomeUpdateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.path[0] === 'amount' ? 'Amount must be a positive number' : 'Invalid income details' }, { status: 400 });
    }
    const { description, amount, category, incomeDate } = parsed.data;

    const existing = await db.otherIncome.findFirst({ where: { id, tenantId } });
    if (!existing) return Response.json({ error: 'Income record not found' }, { status: 404 });

    // The amount is optional on edit: leaving it out keeps the old one.
    const day = entryDay(incomeDate, existing.incomeDate);
    if ('error' in day) return Response.json({ error: day.error }, { status: 400 });

    const updated = await db.otherIncome.update({
      where: { id },
      data: {
        description: description || existing.description,
        amount: amount ?? existing.amount,
        category: category || existing.category,
        incomeDate: day.date,
      },
    });

    return Response.json(updated);
  } catch (err: unknown) {
    console.error('Error handling income record:', err);
    return Response.json({ error: 'Failed to process income record' }, { status: 500 });
  }
});

// DELETE /api/income/[id] - delete an income record
export const DELETE = withAuth(async (req, { tenantId }, routeContext) => {
  try {
    const id = await getIdFromParams(routeContext, req);
    if (!id || !isObjectId(id)) return Response.json({ error: 'Income record not found' }, { status: 404 });

    const existing = await db.otherIncome.findFirst({ where: { id, tenantId } });
    if (!existing) return Response.json({ error: 'Income record not found' }, { status: 404 });

    await db.otherIncome.delete({ where: { id } });
    return Response.json({ success: true });
  } catch (err: unknown) {
    console.error('Error handling income record:', err);
    return Response.json({ error: 'Failed to process income record' }, { status: 500 });
  }
});
