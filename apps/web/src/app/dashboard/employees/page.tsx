import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { listWorkers } from '@/lib/payroll';
import EmployeeManager from '@/components/EmployeeManager';

export default async function EmployeesPage() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  return <EmployeeManager workers={await listWorkers(session.tenantId)} />;
}
