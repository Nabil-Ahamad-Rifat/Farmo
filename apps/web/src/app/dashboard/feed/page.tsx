import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { listFeed, listSuppliersWithBalances } from '@/lib/payables';
import { feedCostBetween } from '@/lib/feed-cost';
import { parseMonth } from '@/lib/monthly-report';
import FeedManager from '@/components/FeedManager';

export default async function FeedPage({ searchParams }: { searchParams: Promise<{ month?: string | string[] }> }) {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  const { tenantId } = session;
  const month = parseMonth((await searchParams).month);
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const [feed, suppliers, feedCostToday] = await Promise.all([
    listFeed(tenantId),
    listSuppliersWithBalances(tenantId),
    feedCostBetween(tenantId, todayStart, new Date()),
  ]);

  return (
    <FeedManager
      initialFeed={feed}
      suppliers={suppliers.map((s) => ({ id: s.id, name: s.name, phone: s.phone, totalDue: s.totalDue }))}
      feedCostToday={feedCostToday}
      totalPayable={suppliers.reduce((sum, s) => sum + s.totalDue, 0)}
      month={month}
    />
  );
}
