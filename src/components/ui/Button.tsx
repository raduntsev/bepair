'use client';

import { forwardRef } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'lg';

/*
  Apple's button set: filled (primary), gray (secondary — a tinted fill, no
  border), plain (ghost — accent text only), and a tinted destructive.
  Pressing dims instead of recolouring, as on iOS.
*/
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:bg-accent-hover disabled:bg-sunken disabled:text-ink-faint',
  secondary: 'bg-sunken text-accent hover:bg-line disabled:text-ink-faint',
  ghost: 'bg-transparent text-accent hover:bg-sunken disabled:text-ink-faint',
  danger: 'bg-danger-soft text-danger hover:brightness-95 disabled:text-ink-faint',
};

const SIZES: Record<Size, string> = {
  md: 'h-11 px-4 text-subhead rounded-xl gap-2',
  lg: 'h-[3.25rem] px-6 text-headline rounded-[0.875rem] gap-2.5',
};

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', block = false) {
  return `inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap transition-[background-color,opacity,filter] duration-150 active:opacity-70 disabled:cursor-not-allowed disabled:active:opacity-100 ${VARIANTS[variant]} ${SIZES[size]} ${block ? 'w-full' : ''}`;
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
