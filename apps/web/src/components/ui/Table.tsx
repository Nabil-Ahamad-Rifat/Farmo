/** Table pieces with one look everywhere; the wrapper scrolls sideways on phones. */
const ALIGN = { left: 'text-left', right: 'text-right', center: 'text-center' } as const;

export function Table({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="min-w-full text-sm">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="border-b border-line bg-slate-50/70 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
      {children}
    </thead>
  );
}

export function TBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-slate-100">{children}</tbody>;
}

export function Th({ children, align = 'left', className = '' }: { children?: React.ReactNode; align?: 'left' | 'right' | 'center'; className?: string }) {
  return <th className={`whitespace-nowrap px-4 py-3 first:pl-5 last:pr-5 sm:first:pl-6 sm:last:pr-6 ${ALIGN[align]} ${className}`}>{children}</th>;
}

export function Td({
  children,
  align = 'left',
  className = '',
  colSpan,
}: {
  children?: React.ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
  colSpan?: number;
}) {
  return (
    <td colSpan={colSpan} className={`px-4 py-3.5 first:pl-5 last:pr-5 sm:first:pl-6 sm:last:pr-6 ${ALIGN[align]} ${align === 'right' ? 'tabular-nums' : ''} ${className}`}>
      {children}
    </td>
  );
}

export function TRow({ children, className = '', onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return (
    <tr onClick={onClick} className={`transition-colors hover:bg-slate-50/70 ${onClick ? 'cursor-pointer' : ''} ${className}`}>
      {children}
    </tr>
  );
}
