import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { listAnimalCosts } from '@/lib/animals';
import ExpenseManager from '@/components/ExpenseManager';

export default async function ExpensesPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const [expenses, animalCosts] = await Promise.all([
    db.otherExpense.findMany({
      where: { tenantId: session.tenantId },
      orderBy: { expenseDate: 'desc' },
    }),
    // Costs written on animal records show here too, so every cost is in one list.
    listAnimalCosts(session.tenantId),
  ]);

  return <ExpenseManager initialExpenses={expenses} animalCosts={animalCosts} />;
}
