'use client';

import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-accent text-accent-ink hover:bg-accent-hover active:bg-accent-hover shadow-card disabled:bg-line-strong disabled:text-ink-faint disabled:shadow-none',
  secondary:
    'bg-surface text-ink border border-line hover:border-line-strong hover:bg-sunken active:bg-sunken disabled:text-ink-faint',
  ghost:
    'bg-transparent text-ink-soft hover:bg-sunken hover:text-ink active:bg-sunken disabled:text-ink-faint',
  danger:
    'bg-danger-soft text-danger border border-transparent hover:border-danger/30 active:bg-danger-soft disabled:text-ink-faint',
};

const SIZES: Record<Size, string> = {
  md: 'h-11 px-4 text-sm rounded-lg gap-2',
  lg: 'h-13 px-6 text-base rounded-xl gap-2.5',
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, block = false, className = '', children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center font-medium transition-colors duration-150 disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${block ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});
