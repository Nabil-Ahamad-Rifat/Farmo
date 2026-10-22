import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getSupplierDetail } from '@/lib/payables';
import SupplierDetailView from '@/components/SupplierDetailView';

export default async function SupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  const { id } = await params;
  const supplier = await getSupplierDetail(session.tenantId, id);
  if (!supplier) notFound();

  return <SupplierDetailView supplier={supplier} />;
}
