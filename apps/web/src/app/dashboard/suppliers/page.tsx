import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { listSuppliersWithBalances } from '@/lib/payables';
import SupplierManager from '@/components/SupplierManager';

export default async function SuppliersPage() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  const suppliers = await listSuppliersWithBalances(session.tenantId);
  return <SupplierManager suppliers={suppliers} />;
}
