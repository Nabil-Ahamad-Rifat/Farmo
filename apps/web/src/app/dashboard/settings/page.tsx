"use client";

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ShieldAlert, Trash2 } from 'lucide-react';
import SalesDefaultsCard from '@/components/SalesDefaultsCard';
import DataSyncCard from '@/components/settings/DataSyncCard';

export default function SettingsPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!confirmed) {
      setError('Please confirm you understand this cannot be undone.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Unable to delete account');
      }

      router.push('/login');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete account');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Farm preferences and your account.</p>
      </div>

      <SalesDefaultsCard />

      <DataSyncCard />

      <div className="rounded-card border border-red-200 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-card bg-red-600 text-white">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-ink">Delete My Account</h2>
            <p className="text-sm text-slate-500">Permanently delete your account and all of your farm&apos;s data.</p>
          </div>
        </div>

        <div className="mt-6 flex gap-3 rounded-control border border-red-200 bg-red-50 p-4">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-600" />
          <p className="text-sm text-red-800">
            This permanently deletes your account, your ranch, and every record in it — cows, employees, feed,
            sales, income, and expenses. This cannot be undone.
          </p>
        </div>

        <form onSubmit={handleDelete} className="mt-6 space-y-4">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Confirm your password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave blank if you signed in with Google"
              className="w-full rounded-control border border-slate-300 px-4 py-3 text-sm text-ink outline-none focus:border-red-500"
            />
          </div>

          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
            />
            I understand this permanently deletes my account and all of my data.
          </label>

          {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}

          <button
            type="submit"
            disabled={loading || !confirmed}
            className="flex items-center gap-2 rounded-control bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" />
            {loading ? 'Deleting Account...' : 'Delete My Account'}
          </button>
        </form>
      </div>

      <p className="text-center text-xs text-slate-400">
        Read our <Link href="/privacy" className="underline hover:text-slate-600">Privacy Policy</Link> to learn how your data is handled.
      </p>
    </div>
  );
}
