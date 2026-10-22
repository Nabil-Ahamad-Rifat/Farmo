import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import OtherIncomeManager from '@/components/OtherIncomeManager';

export const metadata = {
  title: 'Other income',
  description: 'Track grants, subsidies, insurance payouts, donations, and other income sources.',
};

export default async function OtherIncomePage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const incomes = await db.otherIncome.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { incomeDate: 'desc' },
  });

  return <OtherIncomeManager initialIncomes={incomes} />;
}
