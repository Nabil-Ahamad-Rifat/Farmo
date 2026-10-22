"use client";

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AlertTriangle, Plus, Sprout } from 'lucide-react';

export default function RanchesPage() {
  const router = useRouter();
  const [ranchName, setRanchName] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleCreateRanch(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!confirmed) {
      setError('Please confirm you understand this switches your account away from the current ranch.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/ranches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ranchName }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Unable to create ranch');
      }

      router.refresh();
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create ranch');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl rounded-card border border-line bg-white p-6 shadow-card sm:p-8">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-card bg-brand-600 text-white">
          <Sprout className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-ink">Create a New Ranch</h1>
          <p className="text-sm text-slate-500">Start a fresh ranch workspace and switch your account to it.</p>
        </div>
      </div>

      <div className="mt-6 flex gap-3 rounded-control border border-amber-200 bg-amber-50 p-4">
        <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-600" />
        <p className="text-sm text-amber-800">
          This switches your account to a brand-new, empty workspace. You will lose access to your current
          ranch&apos;s cows, employees, sales, and every other record — there is no way to switch back from here.
        </p>
      </div>

      <form onSubmit={handleCreateRanch} className="mt-6 space-y-5">
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">Ranch Name</label>
          <input
            value={ranchName}
            onChange={(e) => setRanchName(e.target.value)}
            placeholder="e.g. Sunrise Meadow Ranch"
            className="w-full rounded-control border border-slate-300 px-4 py-3 text-sm text-ink outline-none ring-0 focus:border-brand-600"
            required
          />
        </div>

        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-600/10"
          />
          I understand this abandons access to my current ranch&apos;s data.
        </label>

        {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={loading || !confirmed}
          className="flex items-center gap-2 rounded-control bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:opacity-60"
        >
          <Plus className="h-4 w-4" />
          {loading ? 'Creating Ranch...' : 'Create Ranch'}
        </button>
      </form>
    </div>
  );
}
