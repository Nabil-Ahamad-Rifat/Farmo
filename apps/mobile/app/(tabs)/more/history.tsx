import { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { ArrowDownLeft, ArrowUpRight, ShoppingBag, PackagePlus, Ban, ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react-native';
import { farmMonth, shiftMonth } from '@farm/business-logic';
import { Text } from '@/src/components/ui/Text';
import { mobileApiClient } from '@/src/lib/apiClient';
import { fmtDate, monthLabel, tk } from '@/src/lib/format';
import { Card, Chips, EmptyState, FormError, PageHeader, SearchInput, StatCard, StatGrid } from '@/src/components/ui';
import { moneyError } from '@/src/components/money/MoneyRow';
import { colors } from '@/src/theme';
import { useOwnerOnly } from '@/src/hooks/useOwnerOnly';

// Mobile version of the web History page (GET /api/ledger): every sale,
// payment, purchase and expense in a month (or a from–to range opened from
// the Revenue Portal), with who added it. Owner only.

type Flow = 'in' | 'out' | 'sale' | 'purchase' | 'loss';

interface LedgerEntry {
  id: string;
  type: string;
  flow: Flow;
  date: string;
  title: string;
  detail: string;
  amount: number;
  href: string;
  byId: string | null;
}

interface Ledger {
  total: number;
  entries: LedgerEntry[];
  totals: { moneyIn: number; moneyOut: number; salesMade: number; boughtOnCredit: number; writtenOff: number };
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
}

const TYPES = [
  { value: 'all', label: 'All' },
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

const FLOW: Record<Flow, { Icon: LucideIcon; color: string; box: string; sign: string; amount: string }> = {
  in: { Icon: ArrowDownLeft, color: colors.brand600, box: 'border-brand-200 bg-brand-50', sign: '+ ', amount: 'text-brand-700' },
  out: { Icon: ArrowUpRight, color: colors.red600, box: 'border-red-200 bg-red-50', sign: '− ', amount: 'text-red-600' },
  sale: { Icon: ShoppingBag, color: colors.sky700, box: 'border-sky-200 bg-sky-50', sign: '', amount: 'text-ink' },
  purchase: { Icon: PackagePlus, color: '#92400e', box: 'border-amber-200 bg-amber-50', sign: '', amount: 'text-ink' },
  loss: { Icon: Ban, color: colors.slate600, box: 'border-line bg-slate-100', sign: '', amount: 'text-slate-600' },
};

/** The web link of an entry, as a mobile screen (null when mobile has no page for it). */
function mobileHref(href: string): Href | null {
  const m = href.match(/^\/dashboard\/(customers|suppliers|employees|cows)\/([^/?]+)$/);
  if (m) {
    const [, kind, id] = m;
    if (kind === 'customers') return `/customer/${id}`;
    if (kind === 'suppliers') return `/supplier/${id}`;
    if (kind === 'employees') return `/worker/${id}`;
    return `/animal/${id}`;
  }
  const pages: Record<string, Href> = {
    '/dashboard/sales': '/sales',
    '/dashboard/feed': '/more/feed',
    '/dashboard/income': '/more/income',
    '/dashboard/expenses': '/more/expenses',
  };
  return pages[href] ?? null;
}

const PAGE = 100;
const isDay = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isType = (v?: string) => !!v && TYPES.some((t) => t.value === v);

export default function HistoryScreen() {
  const allowed = useOwnerOnly();
  return allowed ? <HistoryScreenContent /> : null;
}

function HistoryScreenContent() {
  // type, month or from/to come from the Revenue Portal's rows.
  const params = useLocalSearchParams<{ type?: string; month?: string; from?: string; to?: string }>();
  const thisMonth = farmMonth();
  const [month, setMonth] = useState(params.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : thisMonth);
  const [range, setRange] = useState<{ from: string; to: string } | null>(
    isDay(params.from) && isDay(params.to) ? { from: params.from!, to: params.to! } : null
  );
  const [type, setType] = useState(isType(params.type) ? params.type! : 'all');
  const [by, setBy] = useState('all');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const query = new URLSearchParams(range ? { from: range.from, to: range.to } : { month });
    query.set('limit', String(limit));
    if (type !== 'all') query.set('type', type);
    if (by !== 'all') query.set('by', by);
    if (q) query.set('q', q);
    try {
      setLedger(await mobileApiClient.get<Ledger>(`/api/ledger?${query}`, 'Failed to load history'));
      setError('');
    } catch (err) {
      setError(moneyError(err));
    }
  }, [month, range, type, by, q, limit]);

  useEffect(() => {
    // State is only set once the request settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load().finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    mobileApiClient.get<TeamMember[]>('/api/team').then(setTeam).catch(() => setTeam([]));
  }, []);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  // Any filter change starts from the first page again.
  function change(apply: () => void) {
    apply();
    setLimit(PAGE);
  }

  // The arrows step whole months; a from–to range turns back into its month.
  function stepMonth(delta: number) {
    const base = range ? range.from.slice(0, 7) : month;
    const next = shiftMonth(base, delta);
    if (next > thisMonth) return;
    change(() => {
      setRange(null);
      setMonth(next);
    });
  }

  const nameOf = new Map(team.map((u) => [u.id, u.name]));
  const days = new Map<string, LedgerEntry[]>();
  for (const e of ledger?.entries ?? []) {
    const key = e.date.slice(0, 10);
    days.set(key, [...(days.get(key) ?? []), e]);
  }
  const t = ledger?.totals;
  const periodLabel = range ? (range.from === range.to ? fmtDate(range.from) : `${fmtDate(range.from)} – ${fmtDate(range.to)}`) : monthLabel(month);
  const canNext = (range ? range.from.slice(0, 7) : month) < thisMonth;

  return (
    <ScrollView
      className="flex-1 bg-surface"
      contentContainerClassName="gap-5 p-4 pb-10"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      keyboardShouldPersistTaps="handled"
    >
      <PageHeader title="History" subtitle="Every sale, payment, purchase and expense in one list." />

      <Card className="gap-3">
        <View className="flex-row items-center justify-between rounded-control border border-line p-1">
          <Pressable onPress={() => stepMonth(-1)} className="rounded-lg p-2" accessibilityLabel="Previous month">
            <ChevronLeft size={18} color={colors.slate600} />
          </Pressable>
          <Text className="text-sm font-bold text-ink">{periodLabel}</Text>
          <Pressable onPress={() => stepMonth(1)} disabled={!canNext} className={`rounded-lg p-2 ${canNext ? '' : 'opacity-30'}`} accessibilityLabel="Next month">
            <ChevronRight size={18} color={colors.slate600} />
          </Pressable>
        </View>
        <SearchInput
          value={search}
          onChangeText={(v) => {
            setSearch(v);
            // Clearing the box shows everything again straight away.
            if (!v && q) change(() => setQ(''));
          }}
          onSubmit={() => change(() => setQ(search.trim()))}
          placeholder="Name, feed, note..."
        />
        <Chips options={TYPES} value={type} onChange={(v) => change(() => setType(v))} />
        {team.length > 1 ? (
          <View className="gap-2 border-t border-slate-100 pt-3">
            <Text className="text-xs font-semibold text-slate-500">Added by</Text>
            <Chips options={[{ value: 'all', label: 'Everyone' }, ...team.map((u) => ({ value: u.id, label: u.name }))]} value={by} onChange={(v) => change(() => setBy(v))} />
          </View>
        ) : null}
      </Card>

      <FormError message={error} />

      {t ? (
        <StatGrid>
          <StatCard label="Money in" value={tk(t.moneyIn)} tone="brand" />
          <StatCard label="Money out" value={tk(t.moneyOut)} tone="danger" />
          <StatCard label="Sales made" value={tk(t.salesMade)} />
          <StatCard label="Bought on credit" value={tk(t.boughtOnCredit)} />
        </StatGrid>
      ) : null}

      <Card padded={false}>
        {loading && !ledger ? (
          <View className="py-12">
            <ActivityIndicator />
          </View>
        ) : !ledger ? null : (
          <>
            <Text className="border-b border-slate-100 px-4 py-3 text-xs text-slate-500">
              {periodLabel} · {ledger.total} entr{ledger.total === 1 ? 'y' : 'ies'}
              {ledger.totals.writtenOff > 0 ? ` · ${tk(ledger.totals.writtenOff)} written off` : ''}
            </Text>
            {ledger.total === 0 ? <EmptyState message="Nothing in this period." /> : null}
            {[...days.entries()].map(([day, rows]) => (
              <View key={day}>
                <Text className="bg-slate-50 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">{fmtDate(day)}</Text>
                {rows.map((e, i) => {
                  const f = FLOW[e.flow] ?? FLOW.loss;
                  const target = mobileHref(e.href);
                  const who = e.byId && team.length > 1 ? nameOf.get(e.byId) : undefined;
                  return (
                    <Pressable
                      key={e.id}
                      disabled={!target}
                      onPress={() => target && router.push(target)}
                      className={`flex-row items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-slate-100' : ''}`}
                    >
                      <View className={`h-9 w-9 items-center justify-center rounded-control border ${f.box}`}>
                        <f.Icon size={16} color={f.color} />
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-semibold text-ink" numberOfLines={1}>
                          {e.title}
                        </Text>
                        <Text className="text-xs text-slate-500" numberOfLines={2}>
                          {e.detail}
                          {who ? ` · by ${who}` : ''}
                        </Text>
                      </View>
                      <Text className={`text-sm font-bold ${f.amount}`}>
                        {f.sign}
                        {tk(e.amount)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
            {ledger.total > ledger.entries.length ? (
              <Pressable onPress={() => setLimit(limit + PAGE)} className="items-center border-t border-slate-100 p-4" accessibilityRole="button">
                <Text className="text-sm font-semibold text-slate-700">Show more ({ledger.total - ledger.entries.length} left)</Text>
              </Pressable>
            ) : null}
          </>
        )}
      </Card>
    </ScrollView>
  );
}
