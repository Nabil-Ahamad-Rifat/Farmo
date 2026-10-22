import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { listCustomersWithBalances, saleInclude } from '@/lib/receivables';
import { getDefaultMilkPrice } from '@/lib/settings';
import SalesManager from '@/components/SalesManager';

export default async function SalesPage() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  const [sales, activeCows, customers, defaultMilkPrice] = await Promise.all([
    db.sale.findMany({
      where: { tenantId: session.tenantId },
      include: saleInclude,
      orderBy: { createdAt: 'desc' },
    }),
    db.cow.findMany({
      where: { tenantId: session.tenantId, status: 'active' },
      orderBy: { name: 'asc' },
    }),
    listCustomersWithBalances(session.tenantId),
    getDefaultMilkPrice(session.tenantId),
  ]);

  const totalDue = customers.reduce((sum, c) => sum + c.totalDue, 0);

  return (
    <SalesManager
      initialSales={sales}
      activeCows={activeCows}
      customers={customers.map((c) => ({ id: c.id, name: c.name, phone: c.phone, type: c.type, totalDue: c.totalDue, lastMilkPrice: c.lastMilkPrice }))}
      totalDue={totalDue}
      defaultMilkPrice={defaultMilkPrice}
    />
  );
}
