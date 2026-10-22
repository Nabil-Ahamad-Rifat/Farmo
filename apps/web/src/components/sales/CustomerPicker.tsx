"use client";

import { useMemo, useState } from 'react';
import { Search, UserPlus, X } from 'lucide-react';
import { CustomerTypeBadge, inputCls, tk } from './shared';

export interface PickerCustomer {
  id: string;
  name: string;
  phone?: string | null;
  /** Regular/New for customers; suppliers have none. */
  type?: string;
  totalDue?: number;
  /** Their last milk price per litre, used to prefill the sale form. */
  lastMilkPrice?: number | null;
}

/** Either an existing customer, or a brand-new one to be created with the sale. */
export type CustomerChoice =
  | { kind: 'existing'; id: string; name: string; type?: string }
  | { kind: 'new'; name: string; type: 'regular' | 'new' }
  | null;

/** Search-or-add picker for customers, or for suppliers with noun="supplier". */
export default function CustomerPicker({
  customers,
  value,
  onChange,
  noun = 'customer',
}: {
  customers: PickerCustomer[];
  value: CustomerChoice;
  onChange: (v: CustomerChoice) => void;
  noun?: 'customer' | 'supplier';
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? customers.filter((c) => c.name.toLowerCase().includes(q) || (c.phone ?? '').includes(q))
      : customers;
    return list.slice(0, 8);
  }, [customers, query]);

  const exact = customers.some((c) => c.name.trim().toLowerCase() === query.trim().toLowerCase());

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-control border border-line bg-slate-50 px-3.5 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold text-ink">{value.name}</span>
          {value.kind === 'existing' ? (
            value.type && <CustomerTypeBadge type={value.type} />
          ) : (
            <span className="text-[11px] font-semibold text-slate-500">will be added</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            onChange(null);
            setQuery('');
          }}
          className="ml-2 rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
          aria-label={`Change ${noun}`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={`Search ${noun} by name or phone...`}
        className={`${inputCls} pl-10`}
        autoComplete="off"
        aria-label={noun === 'supplier' ? 'Supplier' : 'Customer'}
      />
      {open && (
        <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-control border border-line bg-white py-1 shadow-lg">
          {matches.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onChange({ kind: 'existing', id: c.id, name: c.name, type: c.type })}
                className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left hover:bg-slate-50"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-medium text-ink">{c.name}</span>
                  {c.type && <CustomerTypeBadge type={c.type} />}
                </span>
                {c.totalDue ? (
                  <span className="shrink-0 text-xs font-semibold text-red-600">Due {tk(c.totalDue)}</span>
                ) : c.phone ? (
                  <span className="shrink-0 text-xs text-slate-400">{c.phone}</span>
                ) : null}
              </button>
            </li>
          ))}
          {query.trim() && !exact && (
            <li className="border-t border-slate-100">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onChange({ kind: 'new', name: query.trim(), type: 'new' })}
                className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm font-semibold text-brand-700 hover:bg-brand-50"
              >
                <UserPlus className="h-4 w-4" />
                Add &ldquo;{query.trim()}&rdquo; as a new {noun}
              </button>
            </li>
          )}
          {!query.trim() && matches.length === 0 && (
            <li className="px-3.5 py-2.5 text-sm text-slate-500">No {noun}s yet. Type a name to add one.</li>
          )}
        </ul>
      )}
    </div>
  );
}
