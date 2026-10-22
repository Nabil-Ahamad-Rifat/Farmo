import { Sprout } from 'lucide-react';

/** The Farm Manager mark: a sprout on deep green. */
export function BrandMark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const box = size === 'sm' ? 'h-8 w-8 rounded-lg' : size === 'lg' ? 'h-12 w-12 rounded-xl' : 'h-9 w-9 rounded-[10px]';
  const icon = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-6 w-6' : 'h-[18px] w-[18px]';
  return (
    <span className={`flex shrink-0 items-center justify-center bg-brand-700 text-white shadow-sm ring-1 ring-inset ring-white/10 ${box}`}>
      <Sprout className={icon} aria-hidden="true" />
    </span>
  );
}

/** Mark plus "Farm Manager", for the public pages. `dark` for use on navy. */
export function BrandLockup({ dark = false }: { dark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <BrandMark />
      <span className={`text-[17px] font-bold tracking-tight ${dark ? 'text-white' : 'text-ink'}`}>Farm Manager</span>
    </span>
  );
}
