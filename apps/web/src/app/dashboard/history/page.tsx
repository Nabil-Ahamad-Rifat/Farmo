import Link from 'next/link';
import { ArrowDownLeft, ArrowUpRight, ShoppingBag, PackagePlus, Ban, Search } from 'lucide-react';
import { db } from '@/lib/db';
import { requireOwnerPage } from '@/lib/auth/session';
import { getLedger, parseLedgerQuery, type LedgerFlow, type LedgerType } from '@/lib/ledger';
import { fmtDate, tk } from '@/components/sales/shared';

type Search = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;

const TYPES: { value: LedgerType | null; label: string }[] = [
  { value: null, label: 'All' },
  { value: 'sale', label: 'Sales' },
  { value: 'payment', label: 'Received' },
  { value: 'income', label: 'Other income' },
  { value: 'feed', label: 'Feed bought' },
  { value: 'supplier', label: 'Paid suppliers' },
  { value: 'salary', label: 'Paid workers' },
  { value: 'expense', label: 'Expenses' },
  { value: 'animal', label: 'Animal care' },
  { value: 'writeoff', label: 'Written off' },
];

const FLOW: Record<LedgerFlow, { Icon: typeof ArrowDownLeft; tone: string; sign: string; amount: string; note: string }> = {
  in: { Icon: ArrowDownLeft, tone: 'border-brand-200 bg-brand-50 text-brand-700', sign: '+ ', amount: 'text-brand-700', note: 'Money in' },
  out: { Icon: ArrowUpRight, tone: 'border-red-200 bg-red-50 text-red-700', sign: '− ', amount: 'text-red-600', note: 'Money out' },
  sale: { Icon: ShoppingBag, tone: 'border-sky-200 bg-sky-50 text-sky-700', sign: '', amount: 'text-ink', note: 'Sale' },
  purchase: { Icon: PackagePlus, tone: 'border-amber-200 bg-amber-50 text-amber-800', sign: '', amount: 'text-ink', note: 'Bought on credit' },
  loss: { Icon: Ban, tone: 'border-line bg-slate-100 text-slate-600', sign: '', amount: 'text-slate-600', note: 'Loss' },
};

export default async function HistoryPage({ searchParams }: { searchParams: Search }) {
  // Money reports are for the owner only.
  const session = await requireOwnerPage();

  const sp = await searchParams;
  const query = parseLedgerQuery({ from: one(sp.from), to: one(sp.to), month: one(sp.month), type: one(sp.type), q: one(sp.q), limit: one(sp.limit), by: one(sp.by) });
  const [ledger, team] = await Promise.all([
    getLedger(session.tenantId, query),
    db.user.findMany({ where: { tenantId: session.tenantId }, select: { id: true, name: true, role: true }, orderBy: { createdAt: 'asc' } }),
  ]);
  const nameOf = new Map(team.map((u) => [u.id, u.name]));
  const t = ledger.totals;

  const link = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams({ from: query.from, to: query.to, ...(query.type ? { type: query.type } : {}), ...(query.q ? { q: query.q } : {}), ...(query.by ? { by: query.by } : {}) });
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) params.delete(k);
      else params.set(k, v);
    }
    return `/dashboard/history?${params}`;
  };

  // Group by day for easier reading.
  const days = new Map<string, typeof ledger.entries>();
  for (const e of ledger.entries) {
    const key = e.date.toISOString().slice(0, 10);
    days.set(key, [...(days.get(key) ?? []), e]);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[28px]">History</h1>
        <p className="mt-1 text-sm text-slate-500 sm:text-base">Every sale, payment, purchase and expense in one list.</p>
      </div>

      {/* Filters: a plain form, so every view has its own link. */}
      <form method="get" className="space-y-3 rounded-card border border-line bg-white p-4 shadow-sm">
        {query.type && <input type="hidden" name="type" value={query.type} />}
        {query.by && <input type="hidden" name="by" value={query.by} />}
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_2fr_auto] sm:items-end">
          <div>
            <label htmlFor="h-from" className="mb-1 block text-xs font-semibold uppercase text-slate-600">From</label>
            <input id="h-from" name="from" type="date" required defaultValue={query.from} className="w-full rounded-control border border-line px-3 py-2.5 text-base sm:text-sm" />
          </div>
          <div>
            <label htmlFor="h-to" className="mb-1 block text-xs font-semibold uppercase text-slate-600">To</label>
            <input id="h-to" name="to" type="date" required defaultValue={query.to} className="w-full rounded-control border border-line px-3 py-2.5 text-base sm:text-sm" />
          </div>
          <div className="relative">
            <label htmlFor="h-q" className="mb-1 block text-xs font-semibold uppercase text-slate-600">Search</label>
            <Search className="absolute bottom-3.5 left-3 h-4 w-4 text-slate-400" aria-hidden="true" />
            <input id="h-q" name="q" type="search" placeholder="Name, feed, note..." defaultValue={query.q ?? ''} className="w-full rounded-control border border-line py-2.5 pl-9 pr-3 text-base sm:text-sm" />
          </div>
          <button type="submit" className="h-11 rounded-control bg-ink px-5 text-sm font-semibold text-white hover:bg-navy-700">Show</button>
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 sm:pb-0">
          {TYPES.map((ty) => {
            const active = query.type === ty.value;
            return (
              <Link
                key={ty.label}
                href={link({ type: ty.value, limit: null })}
                aria-current={active ? 'page' : undefined}
                className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-semibold transition sm:py-2 sm:text-xs ${
                  active ? 'bg-ink text-white shadow-card' : 'border border-line bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {ty.label}
              </Link>
            );
          })}
        </div>
        {team.length > 1 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
            <span className="text-xs font-semibold text-slate-500">Added by</span>
            {[{ id: null as string | null, name: 'Everyone' }, ...team].map((u) => {
              const active = query.by === u.id;
              return (
                <Link
                  key={u.id ?? 'all'}
                  href={link({ by: u.id, limit: null })}
                  aria-current={active ? 'page' : undefined}
                  className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                    active ? 'bg-ink text-white shadow-card' : 'border border-line bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {u.name}
                </Link>
              );
            })}
          </div>
        )}
      </form>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Total label="Money in" value={tk(t.moneyIn)} cls="text-brand-700" />
        <Total label="Money out" value={tk(t.moneyOut)} cls="text-red-600" />
        <Total label="Sales made" value={tk(t.salesMade)} cls="text-ink" />
        <Total label="Bought on credit" value={tk(t.boughtOnCredit)} cls="text-ink" />
      </div>

      <section className="rounded-card border border-line bg-white shadow-card" aria-label="Entries">
        <p className="border-b border-slate-100 px-5 py-3 text-xs text-slate-500">
          {fmtDate(query.from)} – {fmtDate(query.to)} · {ledger.total} entr{ledger.total === 1 ? 'y' : 'ies'}
          {t.writtenOff > 0 ? ` · ${tk(t.writtenOff)} written off` : ''}
        </p>
        {ledger.total === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-slate-500">Nothing in this period.</p>
        ) : (
          <div>
            {[...days.entries()].map(([day, rows]) => (
              <div key={day}>
                <p className="sticky top-14 z-10 bg-slate-50/95 px-5 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 backdrop-blur lg:top-0">{fmtDate(day)}</p>
                <ul className="divide-y divide-slate-100">
                  {rows.map((e) => {
                    const f = FLOW[e.flow];
                    return (
                      <li key={e.id}>
                        <Link href={e.href} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-control border ${f.tone}`} title={f.note}>
                            <f.Icon className="h-4 w-4" aria-hidden="true" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-ink">{e.title}</p>
                            <p className="truncate text-xs text-slate-500">
                              <span className="sr-only">{f.note}. </span>
                              {e.detail}
                              {e.byId && nameOf.has(e.byId) && team.length > 1 ? ` · by ${nameOf.get(e.byId)}` : ''}
                            </p>
                          </div>
                          <p className={`shrink-0 text-sm font-bold ${f.amount}`}>
                            {f.sign}
                            {tk(e.amount)}
                          </p>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
        {ledger.total > ledger.entries.length && (
          <div className="border-t border-slate-100 p-4 text-center">
            <Link href={link({ limit: String(query.limit + 100) })} className="inline-flex h-11 items-center rounded-control border border-line px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Show more ({ledger.total - ledger.entries.length} left)
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

function Total({ label, value, cls }: { label: string; value: string; cls: string }) {
  return (
    <div className="rounded-card border border-line bg-white p-4 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-extrabold ${cls}`}>{value}</p>
    </div>
  );
}
