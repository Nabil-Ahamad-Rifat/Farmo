import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { listCustomersWithBalances } from '@/lib/receivables';
import CustomerManager from '@/components/CustomerManager';

export default async function CustomersPage() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  const customers = await listCustomersWithBalances(session.tenantId);
  return <CustomerManager customers={customers} />;
}
