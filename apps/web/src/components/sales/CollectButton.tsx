"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { HandCoins, Wallet } from 'lucide-react';
import PaymentFormModal, { type PaymentMode } from './PaymentFormModal';

/**
 * "Collect" (from a customer) or "Pay" (to a supplier) button that opens the
 * record-payment form. Usable from server components.
 */
export default function CollectButton({
  party,
  mode = 'collect',
}: {
  party: { id: string; name: string; totalDue: number };
  mode?: PaymentMode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const pay = mode === 'pay';
  const Icon = pay ? Wallet : HandCoins;
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
          pay
            ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
            : 'border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100'
        }`}
        aria-label={pay ? `Pay ${party.name}` : `Collect payment from ${party.name}`}
      >
        <Icon className="h-3.5 w-3.5" /> {pay ? 'Pay' : 'Collect'}
      </button>
      {open && (
        <PaymentFormModal
          party={party}
          mode={mode}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
