"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home, Users, PawPrint, Wheat, DollarSign, TrendingUp, PackageOpen, Coins, Settings, HandCoins, Store, CalendarRange, History, Menu, X,
  CalendarDays, UserCog, type LucideIcon,
} from 'lucide-react';
import { farmToday } from '@farm/business-logic';
import LogoutButton from '@/components/LogoutButton';
import { BrandMark } from '@/components/ui/Brand';
import { FeedbackProvider } from '@/components/ui/Feedback';
import AutoRefresh from '@/components/AutoRefresh';

/** `owner`: hidden from managers (money reports, settings, team). */
type NavLink = { href: string; label: string; icon: LucideIcon; owner?: boolean };

const GROUPS: { title: string; links: NavLink[] }[] = [
  {
    title: 'Farm',
    links: [
      { href: '/dashboard', label: 'Overview', icon: Home },
      { href: '/dashboard/cows', label: 'Animals', icon: PawPrint },
      { href: '/dashboard/feed', label: 'Feed', icon: Wheat },
      { href: '/dashboard/employees', label: 'Workers', icon: Users },
    ],
  },
  {
    title: 'Selling',
    links: [
      { href: '/dashboard/sales', label: 'Sales', icon: DollarSign },
      { href: '/dashboard/customers', label: 'Customers & Dues', icon: HandCoins },
      { href: '/dashboard/income', label: 'Other Income', icon: Coins },
    ],
  },
  {
    title: 'Spending',
    links: [
      { href: '/dashboard/suppliers', label: 'Suppliers & Payables', icon: Store },
      { href: '/dashboard/expenses', label: 'Other Expenses', icon: PackageOpen },
    ],
  },
  {
    title: 'Reports',
    links: [
      { href: '/dashboard/revenue', label: 'Revenue Portal', icon: TrendingUp, owner: true },
      { href: '/dashboard/history', label: 'History', icon: History, owner: true },
      { href: '/dashboard/reports', label: 'Monthly Report', icon: CalendarRange, owner: true },
      { href: '/dashboard/settings/team', label: 'Team', icon: UserCog, owner: true },
      { href: '/dashboard/settings', label: 'Settings', icon: Settings, owner: true },
    ],
  },
];

/** The phone bottom bar: the four things used every day, plus the full menu. */
const TABS: NavLink[] = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/dashboard/cows', label: 'Animals', icon: PawPrint },
  { href: '/dashboard/sales', label: 'Sales', icon: DollarSign },
  { href: '/dashboard/customers', label: 'Dues', icon: HandCoins },
];

const matches = (pathname: string, href: string) =>
  href === '/dashboard' ? pathname === '/dashboard' : pathname === href || pathname.startsWith(href + '/');

/** The most specific link for the page (Team beats Settings on /dashboard/settings/team). */
const activeHref = (pathname: string) =>
  GROUPS.flatMap((g) => g.links)
    .filter((l) => matches(pathname, l.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

// Every bottom tab is also a menu link, so one rule serves both.
const isActive = (pathname: string, href: string) => activeHref(pathname) === href;

/** Where the user is, for the desktop top bar: "Selling / Sales". */
function locate(pathname: string) {
  for (const g of GROUPS) {
    const link = g.links.find((l) => isActive(pathname, l.href));
    if (link) return { group: g.title, label: link.label };
  }
  return { group: 'Farm', label: 'Overview' };
}

function NavList({ pathname, owner, onNavigate }: { pathname: string; owner: boolean; onNavigate?: () => void }) {
  const groups = GROUPS.map((g) => ({ ...g, links: g.links.filter((l) => owner || !l.owner) })).filter((g) => g.links.length > 0);
  return (
    <nav className="space-y-6" aria-label="Main">
      {groups.map((g) => (
        <div key={g.title}>
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">{g.title}</p>
          <div className="space-y-0.5">
            {g.links.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={`group flex items-center gap-3 rounded-control px-3 py-2 text-sm transition-colors duration-200 ${
                    active ? 'bg-brand-600 font-semibold text-white shadow-sm' : 'font-medium text-slate-300 hover:bg-white/[0.06] hover:text-white'
                  }`}
                >
                  <Icon className={`h-[18px] w-[18px] ${active ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`} aria-hidden="true" />
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function FarmBadge({ tenantName }: { tenantName: string }) {
  return (
    <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
      <BrandMark />
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold leading-tight text-white">{tenantName}</span>
        <span className="block text-[11px] font-medium text-slate-400">Farm Manager</span>
      </span>
    </Link>
  );
}

function UserBox({ userName, userEmail }: { userName: string; userEmail: string }) {
  return (
    <div className="space-y-1 border-t border-white/10 pt-4">
      <div className="flex items-center gap-3 px-2 pb-1">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">
          {userName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{userName}</p>
          <p className="truncate text-xs text-slate-400">{userEmail}</p>
        </div>
      </div>
      <LogoutButton dark />
    </div>
  );
}

/**
 * App frame: a dark navy sidebar and a light top bar on large screens; on
 * phones and tablets a navy top bar, a bottom tab bar for daily tasks and a
 * slide-out menu with everything else.
 */
export default function DashboardShell({
  tenantName,
  userName,
  userEmail,
  role = 'owner',
  children,
}: {
  tenantName: string;
  userName: string;
  userEmail: string;
  /** "manager" hides the money reports, settings and team. */
  role?: string;
  children: React.ReactNode;
}) {
  const owner = role !== 'manager';
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const where = locate(pathname);
  const today = new Date(farmToday() + 'T00:00:00Z').toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

  // Close the menu with Escape, and stop the page behind it from scrolling.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  return (
    <FeedbackProvider>
      <div className="min-h-screen bg-surface font-sans text-ink">
        {/* Large screens: navy sidebar */}
        <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col justify-between overflow-y-auto bg-navy-900 px-4 py-5 lg:flex">
          <div className="space-y-8">
            <div className="px-1">
              <FarmBadge tenantName={tenantName} />
            </div>
            <NavList pathname={pathname} owner={owner} />
          </div>
          <UserBox userName={userName} userEmail={userEmail} />
        </aside>

        {/* Large screens: top bar */}
        <header className="sticky top-0 z-30 hidden h-14 items-center justify-between border-b border-line bg-white/85 px-8 backdrop-blur lg:ml-64 lg:flex">
          <p className="text-sm text-slate-500">
            {where.group} <span className="px-1.5 text-slate-300">/</span>
            <span className="font-semibold text-ink">{where.label}</span>
          </p>
          <p className="flex items-center gap-2 text-sm font-medium text-slate-500" suppressHydrationWarning>
            <CalendarDays className="h-4 w-4" aria-hidden="true" /> {today}
          </p>
        </header>

        {/* Phones and tablets: navy top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 bg-navy-900 px-4 lg:hidden">
          <FarmBadge tenantName={tenantName} />
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-slate-200 hover:bg-white/10"
          >
            <Menu className="h-6 w-6" />
          </button>
        </header>

        {/* Slide-out menu */}
        {menuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
            <button type="button" aria-label="Close menu" onClick={() => setMenuOpen(false)} className="absolute inset-0 bg-navy-950/50 backdrop-blur-[2px]" />
            <div className="absolute inset-y-0 right-0 flex w-[85%] max-w-xs flex-col justify-between overflow-y-auto bg-navy-900 p-5 shadow-pop">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <p className="text-base font-semibold text-white">Menu</p>
                  <button type="button" onClick={() => setMenuOpen(false)} aria-label="Close menu" className="flex h-11 w-11 items-center justify-center rounded-control text-slate-300 hover:bg-white/10">
                    <X className="h-6 w-6" />
                  </button>
                </div>
                <NavList pathname={pathname} owner={owner} onNavigate={() => setMenuOpen(false)} />
              </div>
              <div className="pt-6">
                <UserBox userName={userName} userEmail={userEmail} />
              </div>
            </div>
          </div>
        )}

        <main className="min-w-0 px-4 pb-28 pt-5 sm:px-6 lg:ml-64 lg:px-8 lg:pb-12 lg:pt-8">
          {/* Same data as the phone app: refresh on return to the tab and every minute. */}
          <AutoRefresh />
          <div className="mx-auto max-w-[1360px]">{children}</div>
        </main>

        {/* Phones and tablets: bottom tabs */}
        <nav
          aria-label="Quick"
          className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        >
          {TABS.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold ${active ? 'text-brand-700' : 'text-slate-500'}`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold text-slate-500"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
            More
          </button>
        </nav>
      </div>
    </FeedbackProvider>
  );
}
