import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { BrandLockup } from '@/components/ui/Brand';

const POINTS = [
  'Sales, dues and payments in one place',
  "Workers' pay worked out to the day",
  'Animals with photos, vaccines and calvings',
  'Profit and cash for any month',
];

/** Sign-in pages: a navy brand panel on large screens, the form on the right. */
export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen bg-white font-sans text-ink lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden overflow-hidden bg-navy-900 px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between">
        {/* Quiet dot grid for texture; no gradients. */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)', backgroundSize: '24px 24px' }}
          aria-hidden="true"
        />
        <Link href="/" className="relative">
          <BrandLockup dark />
        </Link>
        <div className="relative max-w-md">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-400">For dairy farms</p>
          <h2 className="mt-3 text-[34px] font-bold leading-tight tracking-tight">Run your farm with clear numbers.</h2>
          <ul className="mt-8 space-y-3.5">
            {POINTS.map((p) => (
              <li key={p} className="flex items-center gap-3 text-[15px] text-slate-300">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-brand-400" aria-hidden="true" />
                {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-slate-500">© {new Date().getFullYear()} Farm Manager · Your data stays with your farm.</p>
      </aside>

      <div className="flex items-center justify-center px-6 py-10 sm:px-10">
        <div className="w-full max-w-[400px]">
          <Link href="/" className="mb-10 inline-block lg:hidden">
            <BrandLockup />
          </Link>
          {children}
        </div>
      </div>
    </main>
  );
}
