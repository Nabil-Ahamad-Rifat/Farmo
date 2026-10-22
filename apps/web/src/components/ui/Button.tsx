import Link from 'next/link';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'brand' | 'secondary' | 'ghost' | 'danger' | 'dangerSoft';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

const VARIANTS: Record<ButtonVariant, string> = {
  // Main action of a page: ink.
  primary: 'bg-ink text-white shadow-sm hover:bg-navy-700',
  // Positive money actions (pay, collect, add): brand green.
  brand: 'bg-brand-600 text-white shadow-sm hover:bg-brand-700',
  secondary: 'border border-line bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-ink',
  danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700',
  dangerSoft: 'border border-red-200 bg-white text-red-600 hover:bg-red-50',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 gap-1.5 px-3 text-xs',
  md: 'h-10 gap-2 px-4 text-sm',
  lg: 'h-11 gap-2 px-5 text-sm',
  icon: 'h-10 w-10',
};

/** Class string for a button-looking element (also for <Link>s and <a>s). */
export function buttonCls(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', extra = '') {
  return `inline-flex shrink-0 items-center justify-center rounded-control font-semibold whitespace-nowrap transition-colors duration-200 disabled:pointer-events-none disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${extra}`;
}

type Common = { variant?: ButtonVariant; size?: ButtonSize; className?: string };

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className = '',
  children,
  disabled,
  type = 'button',
  ...rest
}: Common & { loading?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} disabled={disabled || loading} className={buttonCls(variant, size, className)} {...rest}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...rest
}: Common & { href: string } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) {
  return (
    <Link href={href} className={buttonCls(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}
