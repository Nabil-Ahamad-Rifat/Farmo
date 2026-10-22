import Link from 'next/link';
import { ArrowRight, HandCoins, Users, PawPrint, Wheat, TrendingUp, ShieldCheck, Smartphone, CheckCircle2 } from 'lucide-react';
import { BrandLockup } from '@/components/ui/Brand';
import { ButtonLink } from '@/components/ui/Button';

const FEATURES = [
  { Icon: HandCoins, title: 'Sales and dues', body: 'Record milk and other sales in seconds. See who owes you, collect part payments, and print a monthly statement per customer.' },
  { Icon: Users, title: "Workers' pay", body: 'Monthly salary worked out per day, absences, advances and daily labour. Always know who you owe and who owes the farm.' },
  { Icon: PawPrint, title: 'Animals', body: 'Every animal with its photo and Cow ID: vaccines, AI, pregnancy checks, calvings and treatments, with reminders before they are due.' },
  { Icon: Wheat, title: 'Feed and suppliers', body: 'Feed bought each month, from whom, what it cost, what is still owed, and a warning before stock runs out.' },
  { Icon: TrendingUp, title: 'Profit and cash', body: 'Profit for any month or date range, money in and out, and every entry behind each number in one history.' },
  { Icon: Smartphone, title: 'Works on your phone', body: 'Built for the farm: big buttons, fast forms, and the same numbers on the phone app and the website.' },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white font-sans text-ink">
      <header className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <BrandLockup />
          <nav className="flex items-center gap-2" aria-label="Account">
            <ButtonLink href="/login" variant="ghost">Sign in</ButtonLink>
            <ButtonLink href="/register">Create account</ButtonLink>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 sm:py-24 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-700">Dairy farm management</p>
            <h1 className="mt-4 text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">Run your dairy farm with clear numbers.</h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
              Sales, dues, workers&apos; pay, animals and feed in one place, with profit and cash you can trust for every month.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/register" size="lg">
                Create your farm account <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </ButtonLink>
              <ButtonLink href="/login" variant="secondary" size="lg">Sign in</ButtonLink>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
              {['Free to start', 'Bangladesh time and taka', 'Phone and computer'].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-brand-600" aria-hidden="true" /> {t}
                </li>
              ))}
            </ul>
          </div>

          {/* A quiet preview of the numbers the owner sees */}
          <div className="rounded-card border border-line bg-white p-5 shadow-raised sm:p-6" aria-hidden="true">
            <div className="flex items-center justify-between border-b border-line pb-4">
              <p className="text-sm font-semibold">This month</p>
              <p className="text-xs text-slate-500">October</p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-4">
              {[
                ['Profit', '৳42,350', 'text-brand-700'],
                ['Received', '৳1,18,900', 'text-ink'],
                ['Customers owe', '৳14,700', 'text-red-600'],
                ['Milk sold', '2,184 L', 'text-ink'],
              ].map(([label, value, cls]) => (
                <div key={label} className="rounded-control border border-line p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">{label}</p>
                  <p className={`mt-1 text-xl font-bold tabular-nums ${cls}`}>{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2">
              {[
                ['Feed bought', 62],
                ["Workers' pay", 48],
                ['Animal care', 14],
              ].map(([label, w]) => (
                <div key={label as string}>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>{label}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                    <div className="h-1.5 rounded-full bg-slate-400" style={{ width: `${w}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight">Everything the farm runs on</h2>
          <p className="mt-3 text-slate-600">One record for the whole farm, so the numbers on every screen agree.</p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ Icon, title, body }) => (
            <div key={title} className="rounded-card border border-line bg-white p-6 shadow-card">
              <div className="flex h-10 w-10 items-center justify-center rounded-control bg-brand-50 text-brand-700">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-base font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Closing call to action */}
      <section className="bg-navy-900">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-14 text-white sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Start with today&apos;s milk.</h2>
            <p className="mt-2 flex items-center gap-2 text-slate-300">
              <ShieldCheck className="h-4 w-4 text-brand-400" aria-hidden="true" /> Your farm&apos;s data is private to your account.
            </p>
          </div>
          <ButtonLink href="/register" variant="brand" size="lg">
            Create your farm account <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </ButtonLink>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-sm text-slate-500">
          <p>© {new Date().getFullYear()} Farm Manager</p>
          <Link href="/privacy" className="hover:text-ink">Privacy</Link>
        </div>
      </footer>
    </main>
  );
}
