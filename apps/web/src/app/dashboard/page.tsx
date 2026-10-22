import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession, isOwner } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { addDaysIso, daysBetween, farmToday } from '@farm/business-logic';
import { listCustomersWithBalances } from '@/lib/receivables';
import { listFeed, listSuppliersWithBalances } from '@/lib/payables';
import { loadFinanceData, summaryFor } from '@/lib/finance';
import { listWorkers } from '@/lib/payroll';
import { getDueSoon } from '@/lib/animals';
import DueSoonPanel from '@/components/animals/DueSoonPanel';
import { PaymentStatusPill, CustomerTypeBadge, tk, fmtDate } from '@/components/sales/shared';
import CollectButton from '@/components/sales/CollectButton';
import IncomeCostChart from '@/components/IncomeCostChart';
import { StatusBadge } from '@/components/animals/shared';
import { Card, CardHeader, PageHeader } from '@/components/ui/Card';
import { ButtonLink } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/Empty';
import { Users, Wheat, ArrowRight, TrendingUp, Banknote, HandCoins, Phone, Store, AlertTriangle, PawPrint, ShoppingCart } from 'lucide-react';

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  const { tenantId } = session;
  // Managers see the daily work and the dues, but not profit, cash or costs.
  const owner = isOwner(session.role);

  // Days and months on the farm's clock (Bangladesh), the same as every other screen.
  const now = new Date();
  const today = farmToday(now);
  const monthStart = today.slice(0, 8) + '01';
  const chartFrom = addDaysIso(today + 'T12:00:00Z', -29);

  const [
    workers,
    cowCount,
    activeCowsCount,
    feedBatches,
    recentSales,
    recentCows,
    customers,
    suppliers,
    animalsDue,
    money,
  ] = await Promise.all([
    listWorkers(tenantId, now),
    db.cow.count({ where: { tenantId } }),
    db.cow.count({ where: { tenantId, status: 'active' } }),
    // Stock left now: scheduled batches already have their daily use taken off
    listFeed(tenantId),
    db.sale.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    db.cow.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    listCustomersWithBalances(tenantId),
    listSuppliersWithBalances(tenantId),
    // Vaccines, calvings and pregnancy checks coming up
    getDueSoon(tenantId, now),
    owner ? loadFinanceData(tenantId) : null,
  ]);

  // This month so far: the same numbers as the Revenue Portal.
  const month = money && summaryFor(money, monthStart, today, now);
  const activeEmployeeCount = workers.filter((w) => w.status !== 'left').length;
  const totalRemainingFeed = feedBatches.reduce((acc, f) => acc + f.remainingQuantity, 0);
  const totalFeedValue = feedBatches.reduce((acc, f) => acc + f.remainingQuantity * f.unitPrice, 0);
  const owing = customers.filter((c) => c.totalDue > 0);
  const totalDue = owing.reduce((sum, c) => sum + c.totalDue, 0);
  const owedSuppliers = suppliers.filter((s) => s.totalDue > 0);
  const totalPayable = owedSuppliers.reduce((sum, s) => sum + s.totalDue, 0);
  const feedRunningOut = feedBatches.filter((b) => b.schedule && b.schedule.remaining > 0 && b.schedule.daysLeft <= 1);
  const signed = (n: number) => (n < 0 ? '− ' + tk(-n) : tk(n));

  // Money received per day over the last 30 days (customers + other income).
  const chartDays = money
    ? daysBetween(chartFrom, today).map((date) => {
        const s = summaryFor(money, date, date, now).profit;
        return { key: date, income: s.income, costs: s.costs, profit: s.profit };
      })
    : [];

  const greeting = (() => {
    const h = (now.getUTCHours() + 6) % 24;
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  })();
  const costRows = !month ? [] : [
    { label: 'Feed bought', value: month.profit.feed, href: '/dashboard/feed' },
    { label: "Workers' pay earned", value: month.profit.labour + month.profit.writtenOff, href: '/dashboard/employees' },
    { label: 'Animal care', value: month.profit.animalCare, href: '/dashboard/history?type=animal' },
    { label: 'Other expenses', value: month.profit.otherExpenses, href: '/dashboard/expenses' },
  ];
  const maxCost = Math.max(1, ...costRows.map((r) => r.value));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={greeting}
        title="Farm overview"
        subtitle={owner ? 'What needs attention today and how this month is going.' : 'What needs attention today.'}
        actions={
          <>
            {owner && (
              <ButtonLink href="/dashboard/revenue" variant="secondary">
                <TrendingUp className="h-4 w-4" aria-hidden="true" /> Revenue Portal
              </ButtonLink>
            )}
            <ButtonLink href="/dashboard/sales">
              <ShoppingCart className="h-4 w-4" aria-hidden="true" /> Record sale
            </ButtonLink>
          </>
        }
      />

      {/* This month */}
      <div className={`grid grid-cols-2 gap-3 sm:gap-4 ${month ? 'lg:grid-cols-4' : ''}`}>
        {month && (
          <>
            <StatCard
              label="Profit this month"
              value={signed(month.profit.profit)}
              Icon={TrendingUp}
              tone={month.profit.profit < 0 ? 'danger' : 'brand'}
              hint={`Sales ${tk(month.profit.salesMade)} · costs ${tk(month.profit.costs)}`}
              href="/dashboard/revenue"
            />
            <StatCard label="Received this month" value={tk(month.cash.moneyIn)} Icon={Banknote} tone="brand" hint={`Paid out ${tk(month.cash.moneyOut)}`} href="/dashboard/revenue" />
          </>
        )}
        <StatCard label="Customers owe you" value={tk(totalDue)} Icon={HandCoins} tone={totalDue > 0 ? 'danger' : 'neutral'} hint={`${owing.length} customer${owing.length === 1 ? '' : 's'}`} href="/dashboard/customers" />
        <StatCard label="You owe suppliers" value={tk(totalPayable)} Icon={Store} tone={totalPayable > 0 ? 'warning' : 'neutral'} hint={`${owedSuppliers.length} supplier${owedSuppliers.length === 1 ? '' : 's'}`} href="/dashboard/suppliers" />
      </div>

      {/* Farm at a glance */}
      <div className="grid grid-cols-3 divide-x divide-line rounded-card border border-line bg-white shadow-card">
        {[
          { label: 'Animals', value: String(cowCount), hint: `${activeCowsCount} in herd`, href: '/dashboard/cows', Icon: PawPrint },
          { label: 'Workers', value: String(activeEmployeeCount), hint: `${workers.length} in total`, href: '/dashboard/employees', Icon: Users },
          { label: 'Feed stock', value: `${totalRemainingFeed.toLocaleString('en-IN')} kg`, hint: `${tk(Math.round(totalFeedValue))} value`, href: '/dashboard/feed', Icon: Wheat },
        ].map((f) => (
          <Link key={f.label} href={f.href} className="group flex items-center gap-3 px-4 py-4 transition-colors first:rounded-l-card last:rounded-r-card hover:bg-slate-50 sm:px-5">
            <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-control bg-slate-100 text-slate-600 sm:flex">
              <f.Icon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">{f.label}</p>
              <p className="truncate text-lg font-bold tabular-nums text-ink">{f.value}</p>
              <p className="truncate text-xs text-slate-500">{f.hint}</p>
            </div>
          </Link>
        ))}
      </div>

      {feedRunningOut.length > 0 && (
        <Link
          href="/dashboard/feed"
          className="flex items-start gap-3 rounded-card border border-amber-200 bg-amber-50/70 px-4 py-3.5 text-sm text-amber-900 transition-colors hover:bg-amber-50"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
          <span>
            <span className="font-semibold">Feed running out:</span>{' '}
            {feedRunningOut.map((b) => `${b.name} (${b.schedule!.remaining.toLocaleString()} kg left)`).join(', ')}. Buy more soon →
          </span>
        </Link>
      )}

      {animalsDue.length > 0 && <DueSoonPanel items={animalsDue} />}

      {/* Dues */}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader
            Icon={HandCoins}
            title="Who owes me"
            subtitle={owing.length === 0 ? 'Nobody owes you right now.' : `${owing.length} customer${owing.length === 1 ? '' : 's'} with unpaid sales · ${tk(totalDue)}`}
            actions={<ButtonLink href="/dashboard/customers" variant="secondary" size="sm">All customers <ArrowRight className="h-3.5 w-3.5" /></ButtonLink>}
          />
          {owing.length > 0 && (
            <ul className="divide-y divide-slate-100">
              {owing.slice(0, 6).map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-slate-50/70 sm:px-6">
                  <Link href={`/dashboard/customers/${c.id}`} className="flex min-w-0 flex-1 items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-ink">{c.name}</p>
                        <CustomerTypeBadge type={c.type} />
                      </div>
                      <p className="flex items-center gap-1 truncate text-xs text-slate-500">
                        {c.phone ? <><Phone className="h-3 w-3" /> {c.phone} · </> : null}
                        Bought {tk(c.totalSold)} · paid {tk(c.totalPaid)}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-bold tabular-nums text-red-600">{tk(c.totalDue)}</p>
                  </Link>
                  <CollectButton party={{ id: c.id, name: c.name, totalDue: c.totalDue }} />
                </li>
              ))}
            </ul>
          )}
          {owing.length > 6 && (
            <Link href="/dashboard/customers" className="block border-t border-slate-100 py-3 text-center text-xs font-semibold text-slate-500 hover:text-ink">
              + {owing.length - 6} more
            </Link>
          )}
        </Card>

        <Card>
          <CardHeader
            Icon={Store}
            title="Who I owe"
            subtitle={owedSuppliers.length === 0 ? 'You owe no suppliers right now.' : `${owedSuppliers.length} supplier${owedSuppliers.length === 1 ? '' : 's'} with unpaid feed · ${tk(totalPayable)}`}
            actions={<ButtonLink href="/dashboard/suppliers" variant="secondary" size="sm">All suppliers <ArrowRight className="h-3.5 w-3.5" /></ButtonLink>}
          />
          {owedSuppliers.length > 0 && (
            <ul className="divide-y divide-slate-100">
              {owedSuppliers.slice(0, 6).map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-slate-50/70 sm:px-6">
                  <Link href={`/dashboard/suppliers/${s.id}`} className="flex min-w-0 flex-1 items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{s.name}</p>
                      <p className="flex items-center gap-1 truncate text-xs text-slate-500">
                        {s.phone ? <><Phone className="h-3 w-3" /> {s.phone} · </> : null}
                        Bought {tk(s.totalBought)} · paid {tk(s.totalPaid)}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-bold tabular-nums text-red-600">{tk(s.totalDue)}</p>
                  </Link>
                  <CollectButton mode="pay" party={{ id: s.id, name: s.name, totalDue: s.totalDue }} />
                </li>
              ))}
            </ul>
          )}
          {owedSuppliers.length > 6 && (
            <Link href="/dashboard/suppliers" className="block border-t border-slate-100 py-3 text-center text-xs font-semibold text-slate-500 hover:text-ink">
              + {owedSuppliers.length - 6} more
            </Link>
          )}
        </Card>
      </div>

      {month && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <IncomeCostChart
            chart={chartDays}
            title="Last 30 days"
            action={<ButtonLink href="/dashboard/revenue" variant="secondary" size="sm">Details <ArrowRight className="h-3.5 w-3.5" /></ButtonLink>}
          />

          {/* This month's costs */}
          <Card>
            <CardHeader title="This month's costs" subtitle={`${tk(month.profit.costs)} so far`} />
            <ul className="space-y-4 px-5 py-5 sm:px-6">
              {costRows.map((r) => (
                <li key={r.label}>
                  <Link href={r.href} className="group block">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="text-slate-600 group-hover:text-ink">{r.label}</span>
                      <span className="font-semibold tabular-nums text-ink">{tk(r.value)}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-slate-100">
                      <div className="h-1.5 rounded-full bg-slate-400 transition-colors group-hover:bg-ink" style={{ width: `${(r.value / maxCost) * 100}%` }} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {/* Recent */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Recent sales" subtitle="The last five sales recorded" actions={<Link href="/dashboard/sales" className="text-xs font-semibold text-brand-700 hover:underline">View all</Link>} />
          {recentSales.length === 0 ? (
            <EmptyState Icon={ShoppingCart} title="No sales yet" body="Record your first sale to see it here." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentSales.map((sale) => (
                <li key={sale.id} className="flex items-center justify-between gap-3 px-5 py-3 sm:px-6">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{sale.customerName}</p>
                    <p className="text-xs text-slate-500">{fmtDate(sale.createdAt)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <p className="text-sm font-semibold tabular-nums text-ink">{tk(sale.amount)}</p>
                    <PaymentStatusPill status={sale.customerId ? sale.status : sale.status === 'paid' ? 'paid' : 'pending'} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Recently added animals" subtitle="The last five animals registered" actions={<Link href="/dashboard/cows" className="text-xs font-semibold text-brand-700 hover:underline">View all</Link>} />
          {recentCows.length === 0 ? (
            <EmptyState Icon={PawPrint} title="No animals yet" body="Add your animals with a photo and Cow ID." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentCows.map((cow) => (
                <li key={cow.id}>
                  <Link href={`/dashboard/cows/${cow.id}`} className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-slate-50/70 sm:px-6">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">
                        {cow.name} <span className="text-xs font-normal text-slate-500">({cow.tagNumber})</span>
                      </p>
                      <p className="text-xs text-slate-500">{cow.breed || 'Breed not set'}</p>
                    </div>
                    <StatusBadge status={cow.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
