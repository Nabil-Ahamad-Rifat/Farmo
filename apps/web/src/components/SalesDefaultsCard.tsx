"use client";

import { useEffect, useState } from 'react';
import { Milk } from 'lucide-react';
import { webApiClient } from '@farm/api-client';
import { inputCls, labelCls } from '@/components/sales/shared';

/** Settings card for the milk price the sale form starts with for customers who haven't bought milk before. */
export default function SalesDefaultsCard() {
  const [price, setPrice] = useState('');
  const [saved, setSaved] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    webApiClient
      .get<{ defaultMilkPrice: number }>('/api/settings', 'Failed to load settings')
      .then((s) => {
        setPrice(String(s.defaultMilkPrice));
        setSaved(String(s.defaultMilkPrice));
      })
      .catch((err) => setError((err as Error).message));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const s = await webApiClient.put<{ defaultMilkPrice: number }>('/api/settings', { defaultMilkPrice: price }, 'Failed to save settings');
      setPrice(String(s.defaultMilkPrice));
      setSaved(String(s.defaultMilkPrice));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-card border border-line bg-white p-6 shadow-card sm:p-8">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-card bg-sky-600 text-white">
          <Milk className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-ink">Sales defaults</h2>
          <p className="text-sm text-slate-500">
            The sale form fills in each customer&apos;s last milk price. New customers start with this price.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="mt-6 flex flex-wrap items-end gap-3">
        <div className="w-48">
          <label htmlFor="default-milk-price" className={labelCls}>Default milk price (৳ per L)</label>
          <input
            id="default-milk-price"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            required
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className={inputCls}
          />
        </div>
        <button
          type="submit"
          disabled={loading || !price || price === saved}
          className="rounded-control bg-ink px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save'}
        </button>
        {saved && price === saved && !error && <span className="pb-2.5 text-xs font-semibold text-brand-700">Saved</span>}
      </form>
      {error && (
        <p role="alert" className="mt-3 text-xs font-medium text-red-700">{error}</p>
      )}
    </div>
  );
}
