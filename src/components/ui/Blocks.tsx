'use client';

import Link from 'next/link';
import { AlertCircle, Check, ChevronRight, Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PairMark } from '@/components/PairMark';

export function Page({ children, width = 'narrow' }: { children: React.ReactNode; width?: 'narrow' | 'wide' | 'form' }) {
  const max = width === 'wide' ? 'max-w-6xl' : width === 'form' ? 'max-w-2xl' : 'max-w-3xl';
  return <div className={`mx-auto w-full ${max} px-5 pt-7 pb-8 md:px-8 md:pt-10`}>{children}</div>;
}

export function PageHeader({
  title,
  sub,
  action,
  back,
}: {
  title: string;
  sub?: React.ReactNode;
  action?: React.ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header className="mb-7">
      {back && (
        <Link
          href={back.href}
          className="tap -ml-2 mb-2 inline-flex items-center gap-1 rounded-lg px-2 text-sm font-medium text-ink-soft hover:text-ink"
        >
          <ChevronRight className="size-4 rotate-180" aria-hidden /> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
          {sub && <p className="mt-1 text-sm text-ink-faint">{sub}</p>}
        </div>
        {action}
      </div>
    </header>
  );
}

export function Card({
  children,
  className = '',
  as: Tag = 'section',
  pad = true,
}: {
  children: React.ReactNode;
  className?: string;
  as?: 'section' | 'div' | 'li' | 'article';
  pad?: boolean;
}) {
  return (
    <Tag className={`rounded-2xl border border-line bg-surface shadow-card ${pad ? 'p-5 md:p-6' : ''} ${className}`}>
      {children}
    </Tag>
  );
}

export function Alert({ kind = 'error', children }: { kind?: 'error' | 'success'; children: React.ReactNode }) {
  const error = kind === 'error';
  const Icon = error ? AlertCircle : Check;
  return (
    <p
      role={error ? 'alert' : 'status'}
      className={`flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm ${
        error ? 'bg-danger-soft text-danger' : 'bg-accent-soft text-accent-soft-ink'
      }`}
    >
      <Icon className="mt-px size-4.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

export function Loading({ label }: { label: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-16 text-ink-faint">
      <Loader2 className="size-5 animate-spin" aria-hidden />
      <span className="text-sm">{label}</span>
    </div>
  );
}

/*
  Empty is an invitation, not a dead end. The illustration is the product's own
  mark — your ring and your partner's disc — waiting to overlap.
*/
export function EmptyState({
  title,
  children,
  action,
  variant = 'apart',
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  variant?: 'apart' | 'together' | 'quiet';
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface px-6 py-9 text-center">
      <PairMark variant={variant} className="mx-auto h-14 w-24" />
      <h2 className="mt-4 font-semibold">{title}</h2>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-soft">{children}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </section>
  );
}

interface RowBase {
  Icon: LucideIcon;
  title: string;
  sub?: string;
}

export function RowGroup({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <section aria-label={label} className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <ul className="divide-y divide-line">{children}</ul>
    </section>
  );
}

export function LinkRow({ Icon, title, sub, href, badge }: RowBase & { href: string; badge?: number }) {
  return (
    <li>
      <Link
        href={href}
        className="flex min-h-14 items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-sunken focus-visible:bg-sunken"
      >
        <Icon className="size-5 shrink-0 text-ink-soft" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-ink">{title}</span>
          {sub && <span className="block text-sm text-ink-faint">{sub}</span>}
        </span>
        {badge ? (
          <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-ink">{badge}</span>
        ) : null}
        <ChevronRight className="size-4.5 shrink-0 text-ink-faint" aria-hidden />
      </Link>
    </li>
  );
}

/* The whole row is the target, not only the switch on the right. */
export function SwitchRow({
  Icon,
  title,
  sub,
  checked,
  onChange,
  disabled,
  note,
}: RowBase & { checked: boolean; onChange: (next: boolean) => void; disabled?: boolean; note?: React.ReactNode }) {
  return (
    <li>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="flex min-h-14 w-full items-center gap-3.5 px-5 py-3.5 text-left transition-colors enabled:hover:bg-sunken disabled:cursor-not-allowed"
      >
        <Icon className="size-5 shrink-0 text-ink-soft" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-ink">{title}</span>
          {sub && <span className="block text-sm text-ink-faint">{sub}</span>}
          {note && <span className="mt-1 block text-sm font-medium text-accent-soft-ink">{note}</span>}
        </span>
        <span
          aria-hidden
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ${
            checked ? 'bg-accent' : 'bg-line-strong'
          } ${disabled ? 'opacity-50' : ''}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 size-6 rounded-full bg-surface shadow-card transition-transform duration-200 ease-out-soft ${
              checked ? 'translate-x-5' : ''
            }`}
          />
        </span>
      </button>
    </li>
  );
}

export function Chip({
  children,
  tone = 'neutral',
  Icon,
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'accent' | 'partner';
  Icon?: LucideIcon;
}) {
  const tones = {
    neutral: 'bg-sunken text-ink-soft',
    accent: 'bg-accent-soft text-accent-soft-ink',
    partner: 'bg-partner-soft text-partner-ink',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone]}`}>
      {Icon && <Icon className="size-3.5" aria-hidden />}
      {children}
    </span>
  );
}
