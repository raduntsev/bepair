'use client';

import { forwardRef } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-accent text-accent-ink hover:bg-accent-hover active:bg-accent-hover shadow-card disabled:bg-line-strong disabled:text-ink-faint disabled:shadow-none',
  secondary:
    'bg-surface text-ink border border-line hover:border-line-strong hover:bg-sunken active:bg-sunken disabled:text-ink-faint',
  ghost: 'bg-transparent text-ink-soft hover:bg-sunken hover:text-ink active:bg-sunken disabled:text-ink-faint',
  danger:
    'bg-danger-soft text-danger border border-transparent hover:border-danger/30 active:bg-danger-soft disabled:text-ink-faint',
};

const SIZES: Record<Size, string> = {
  md: 'h-11 px-4 text-sm rounded-lg gap-2',
  lg: 'h-13 px-6 text-base rounded-xl gap-2.5',
};

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', block = false) {
  return `inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-colors duration-150 disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${block ? 'w-full' : ''}`;
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, block = false, className = '', children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${buttonClass(variant, size, block)} ${className}`}
      {...rest}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

interface LinkButtonProps extends Omit<React.ComponentProps<typeof Link>, 'className'> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  className?: string;
}

export function LinkButton({ variant = 'primary', size = 'md', block = false, className = '', ...rest }: LinkButtonProps) {
  return <Link className={`${buttonClass(variant, size, block)} ${className}`} {...rest} />;
}
