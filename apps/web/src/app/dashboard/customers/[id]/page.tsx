import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { getCustomerDetail } from '@/lib/receivables';
import { getDefaultMilkPrice } from '@/lib/settings';
import { getCustomerMonths } from '@/lib/monthly-report';
import CustomerDetailView from '@/components/CustomerDetailView';

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  const { id } = await params;
  const [customer, activeCows, defaultMilkPrice, months] = await Promise.all([
    getCustomerDetail(session.tenantId, id),
    db.cow.findMany({
      where: { tenantId: session.tenantId, status: 'active' },
      select: { id: true, name: true, tagNumber: true },
      orderBy: { name: 'asc' },
    }),
    getDefaultMilkPrice(session.tenantId),
    getCustomerMonths(session.tenantId, id),
  ]);
  if (!customer) notFound();

  return <CustomerDetailView customer={customer} activeCows={activeCows} defaultMilkPrice={defaultMilkPrice} months={months} />;
}
