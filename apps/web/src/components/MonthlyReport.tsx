import Link from 'next/link';
import { ChevronLeft, ChevronRight, Milk, ShoppingBag, Wallet, History, AlertCircle, Wheat, ArrowRight, TrendingUp } from 'lucide-react';
import { farmMonth, shiftMonth, type FinanceSummary, type MonthStatement } from '@farm/business-logic';
import type { ReportLine } from '@/lib/monthly-report';
import CollectButton from '@/components/sales/CollectButton';
import { SummaryCard, CustomerTypeBadge, tk, monthLabel, litres } from '@/components/sales/shared';


/** A balance: due in red, advance in green, or "Clear". */
function Balance({ value, strong }: { value: number; strong?: boolean }) {
  if (value > 0) return <span className={`${strong ? 'font-bold' : 'font-semibold'} text-red-600`}>{tk(value)}</span>;
  if (value < 0) return <span className="font-semibold text-brand-700">Advance {tk(-value)}</span>;
  return <span className="font-semibold text-slate-400">Clear</span>;
}

export default function MonthlyReport({
  month,
  totals,
  lines,
  feed,
  money,
}: {
  month: string;
  totals: MonthStatement['totals'];
  lines: ReportLine[];
  /** Feed bought this month. */
  feed: { kg: number; spent: number; paid: number; owed: number; count: number };
  /** Profit and cash flow for the month. */
  money: FinanceSummary;
}) {
  const current = farmMonth();
  const p = money.profit;
  const signed = (n: number) => (n < 0 ? '− ' + tk(-n) : tk(n));
  const navBtn = 'inline-flex h-10 w-10 items-center justify-center rounded-control border border-line bg-white text-slate-600 transition hover:bg-slate-50';
  const owing = lines.filter((l) => l.closing > 0).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[28px]">Monthly Report</h1>
          <p className="mt-1 text-slate-500">Milk sold, money received and what is still due, month by month.</p>
        </div>
        <nav aria-label="Choose month" className="flex items-center gap-2">
          <Link href={`/dashboard/reports?month=${shiftMonth(month, -1)}`} className={navBtn} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <p className="min-w-40 text-center text-lg font-bold text-ink" aria-live="polite">{monthLabel(month)}</p>
          {month < current ? (
            <Link href={`/dashboard/reports?month=${shiftMonth(month, 1)}`} className={navBtn} aria-label="Next month">
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <span className={`${navBtn} cursor-not-allowed opacity-40`} aria-hidden="true">
              <ChevronRight className="h-4 w-4" />
            </span>
          )}
          {month !== current && (
            <Link href="/dashboard/reports" className="ml-1 rounded-control px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100">
              This month
            </Link>
          )}
        </nav>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
        <SummaryCard label="Milk sold" value={litres(totals.milkLitres)} Icon={Milk} tone="slate" />
        <SummaryCard label="Total sales" value={tk(totals.sold)} Icon={ShoppingBag} tone="slate" hint="All products" />
        <SummaryCard label="Money received" value={tk(totals.collected)} Icon={Wallet} tone="emerald" />
        <SummaryCard label="Due from before" value={tk(totals.carriedIn)} Icon={History} tone="slate" hint="Carried into this month" />
        <SummaryCard
          label="Due at month end"
          value={tk(totals.dueAtEnd)}
          Icon={AlertCircle}
          tone="red"
          hint={owing ? `${owing} customer${owing === 1 ? '' : 's'} still owe` : 'Nothing owed'}
        />
      </div>

      <Link
        href={`/dashboard/feed?month=${month}`}
        className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-amber-100 bg-white p-4 shadow-sm transition hover:bg-amber-50/40"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-control bg-amber-100 text-amber-700">
            <Wheat className="h-4 w-4" />
          </span>
          <span>
            <span className="block text-sm font-bold text-ink">Feed bought: {tk(feed.spent)}</span>
            <span className="block text-xs text-slate-500">
              {feed.kg.toLocaleString('en-IN')} kg in {feed.count} purchase{feed.count === 1 ? '' : 's'} · paid {tk(feed.paid)}
              {feed.owed > 0 ? ` · still owed ${tk(feed.owed)}` : ''}
            </span>
          </span>
        </span>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
          Feed details <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </Link>

      <section className="rounded-card border border-line bg-white p-5 shadow-sm" aria-labelledby="costs-h">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="costs-h" className="flex items-center gap-2 text-base font-bold text-ink">
              <TrendingUp className="h-4 w-4 text-slate-400" aria-hidden="true" /> Costs and profit
            </h2>
            <p className="text-xs text-slate-500">Earned and spent this month, whether paid yet or not.</p>
          </div>
          <p className={`text-2xl font-extrabold ${p.profit < 0 ? 'text-red-600' : 'text-brand-700'}`}>{signed(p.profit)}</p>
        </div>
        <dl className="mt-3 grid gap-x-8 gap-y-1.5 text-sm sm:grid-cols-2">
          {[
            ['Sales made', tk(p.salesMade)],
            ['Other income', tk(p.otherIncome)],
            ['Feed bought', '− ' + tk(p.feed)],
            ["Workers' pay earned", '− ' + tk(p.labour + p.writtenOff)],
            ['Animal care', '− ' + tk(p.animalCare)],
            ['Other expenses', '− ' + tk(p.otherExpenses)],
            ['Cash in / out', `${tk(money.cash.moneyIn)} / ${tk(money.cash.moneyOut)}`],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-b border-slate-50 py-1">
              <dt className="text-slate-600">{k}</dt>
              <dd className="font-semibold text-ink">{v}</dd>
            </div>
          ))}
        </dl>
        <Link href={`/dashboard/revenue?month=${month}`} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:underline">
          Full breakdown in the Revenue Portal <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </section>

      <div className="overflow-x-auto rounded-card border border-line bg-white shadow-card">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              {['Customer', 'Milk', 'Sold', 'Paid', 'Due from before', 'Due at month end'].map((h) => (
                <th key={h} className="whitespace-nowrap px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">{h}</th>
              ))}
              <th className="px-5 py-3.5"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-sm text-slate-500">No sales, payments or dues in {monthLabel(month)}.</td>
              </tr>
            ) : (
              lines.map((l) => (
                <tr key={l.partyId ?? 'none'} className={l.closing > 0 ? 'bg-red-50/40' : ''}>
                  <td className="whitespace-nowrap px-5 py-4">
                    {l.customer ? (
                      <Link href={`/dashboard/customers/${l.customer.id}#m-${month}`} className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-ink hover:underline">{l.customer.name}</span>
                        <CustomerTypeBadge type={l.customer.type} />
                      </Link>
                    ) : (
                      <span className="text-sm font-semibold text-slate-500">No customer (older sales)</span>
                    )}
                    <p className="text-[11px] text-slate-400">
                      {l.salesCount} sale{l.salesCount === 1 ? '' : 's'} · {l.paymentsCount} payment{l.paymentsCount === 1 ? '' : 's'}
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-700">{l.milkLitres ? litres(l.milkLitres) : '—'}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-sm font-medium text-ink">{tk(l.sold)}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-sm font-medium text-brand-700">{tk(l.paid)}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-sm"><Balance value={l.carriedIn} /></td>
                  <td className="whitespace-nowrap px-5 py-4 text-sm"><Balance value={l.closing} strong /></td>
                  <td className="whitespace-nowrap px-5 py-4 text-right">
                    {l.customer && l.closing > 0 && month === current && (
                      <CollectButton party={{ id: l.customer.id, name: l.customer.name, totalDue: l.closing }} />
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {lines.length > 0 && (
            <tfoot className="bg-slate-50">
              <tr className="text-sm font-bold text-ink">
                <td className="px-5 py-3.5">Total</td>
                <td className="whitespace-nowrap px-5 py-3.5">{litres(totals.milkLitres)}</td>
                <td className="whitespace-nowrap px-5 py-3.5">{tk(totals.sold)}</td>
                <td className="whitespace-nowrap px-5 py-3.5 text-brand-700">{tk(totals.collected)}</td>
                <td className="whitespace-nowrap px-5 py-3.5">{tk(totals.carriedIn)}</td>
                <td className="whitespace-nowrap px-5 py-3.5 text-red-600">{tk(totals.dueAtEnd)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="text-xs text-slate-500">
        Due at month end = due from before + sold − paid. &ldquo;Paid&rdquo; is money received during the month, whichever sale it was for.
      </p>
    </div>
  );
}
