import Link from 'next/link';
import { Sprout } from 'lucide-react';

export const metadata = {
  title: 'Privacy Policy — Farm Manager',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12 font-sans text-ink">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-control bg-brand-600 text-white">
            <Sprout className="h-5 w-5" />
          </div>
          <span className="text-xl font-extrabold tracking-tight">Farm Manager</span>
        </div>

        <h1 className="mt-8 text-3xl font-bold">Privacy Policy</h1>
        <p className="mt-2 text-sm text-slate-500">Last updated: {new Date().toISOString().slice(0, 10)}</p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-slate-700">
          <section>
            <h2 className="text-base font-bold text-ink">What we collect</h2>
            <p className="mt-2">
              When you create an account, we collect your name, email address, and a securely hashed password (or,
              if you sign in with Google, your Google account&apos;s name and email). Once signed in, we store the
              farm operational and financial records you enter yourself: livestock (cows), employees and salary
              payments, feed inventory, sales transactions, and other income and expenses.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-ink">How we store it</h2>
            <p className="mt-2">
              Your data is stored in a MongoDB Atlas database. Passwords are never stored in plain text — they are
              hashed before being saved. We do not sell your data or share it with third parties, and we do not use
              it for advertising or tracking.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-ink">Deleting your account</h2>
            <p className="mt-2">
              You can permanently delete your account and all of its data at any time from within the app: on the
              web, go to <span className="font-semibold">Settings</span>; in the mobile app, go to{' '}
              <span className="font-semibold">More → Delete Account</span>. Deletion is immediate and permanent —
              your account, your ranch, and every record in it (cows, employees, feed, sales, income, and expenses)
              are removed and cannot be recovered.
            </p>
            <p className="mt-2">
              If you no longer have access to the app, email us at the address below and we will delete your
              account and data on your behalf.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-ink">Data retention</h2>
            <p className="mt-2">
              We keep your data only for as long as your account exists. A small technical record (an
              &quot;idempotency key&quot;) used to prevent duplicate submissions from the mobile app is
              automatically deleted after 48 hours regardless of account status.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-ink">Contact</h2>
            <p className="mt-2">
              Questions about this policy or your data? Contact us at{' '}
              <a href="mailto:support@farmmanager.app" className="font-semibold text-brand-600 hover:underline">
                support@farmmanager.app
              </a>
              .
            </p>
          </section>
        </div>

        <Link href="/" className="mt-10 inline-block text-sm font-semibold text-brand-600 hover:underline">
          ← Back to Farm Manager
        </Link>
      </div>
    </main>
  );
}
