'use client';

import Link from 'next/link';
import { AlertCircle, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PairLoader } from '@/components/PairLoader';

export function Page({ children, width = 'narrow' }: { children: React.ReactNode; width?: 'narrow' | 'wide' | 'form' }) {
  const max = width === 'wide' ? 'max-w-5xl' : width === 'form' ? 'max-w-2xl' : 'max-w-2xl';
  return <div className={`mx-auto w-full ${max} px-4 pt-6 pb-8 sm:px-6 md:pt-12`}>{children}</div>;
}

/*
  Large-title header, after iOS: an optional back link in the accent above,
  the title at 34px bold, a quiet line beneath. Actions sit on the title's
  baseline, at the right.
*/
export function PageHeader({
  title,
  sub,
  action,
  back,
  eyebrow,
}: {
  title: string;
  sub?: React.ReactNode;
  action?: React.ReactNode;
  back?: { href: string; label: string };
  /* Small caps line over the title — the date on «Сегодня». */
  eyebrow?: React.ReactNode;
}) {
  return (
    <header className="mb-6">
      {back && (
        <Link
          href={back.href}
          className="tap -ml-1.5 mb-1 inline-flex items-center gap-0.5 rounded-lg px-1 text-body text-accent hover:opacity-80"
        >
          <ChevronLeft className="size-6" strokeWidth={2.2} aria-hidden /> {back.label}
        </Link>
      )}
      {eyebrow && <p className="mb-0.5 text-subhead font-medium text-ink-faint first-letter:uppercase">{eyebrow}</p>}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-large-title font-bold">{title}</h1>
          {sub && <p className="mt-1 text-subhead text-ink-faint">{sub}</p>}
        </div>
        {action}
      </div>
    </header>
  );
}

/* Section header inside a page: Title 3, with an optional trailing link. */
export function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mt-8 mb-2.5 flex items-baseline justify-between gap-3 px-1 first:mt-0">
      <h2 className="text-title-3 font-semibold">{title}</h2>
      {action}
    </div>
  );
}

/* Cards carry no border in the light theme — the grey ground already separates them. */
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
  return <Tag className={`rounded-2xl bg-surface shadow-card ${pad ? 'p-5' : ''} ${className}`}>{children}</Tag>;
}

export function Alert({ kind = 'error', children }: { kind?: 'error' | 'success'; children: React.ReactNode }) {
  const error = kind === 'error';
  const Icon = error ? AlertCircle : Check;
  return (
    <p
      role={error ? 'alert' : 'status'}
      className={`flex items-start gap-2.5 rounded-xl px-4 py-3 text-subhead ${
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
    <div role="status" className="flex flex-col items-center justify-center gap-3 py-16 text-ink-faint">
      <PairLoader className="h-20 w-40" />
      <span className="text-subhead">{label}</span>
    </div>
  );
}

/*
  Empty is an invitation, not a dead end. The illustration is the pair
  themselves — the two characters of the loader in their idle scene.
*/
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  /* Kept for callers; every empty state now shows the same idle pair. */
  variant?: 'apart' | 'together' | 'quiet';
}) {
  return (
    <section className="rounded-2xl bg-surface px-6 py-10 text-center shadow-card">
      {/* The pair, alive and waiting with you; the quiet mark only where nothing should move. */}
      <PairLoader mode="idle" className="mx-auto h-16 w-32" />
      <h2 className="mt-4 text-headline font-semibold">{title}</h2>
      {children && <p className="mx-auto mt-1.5 max-w-sm text-subhead text-ink-faint">{children}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </section>
  );
}

interface RowBase {
  Icon: LucideIcon;
  title: string;
  sub?: string;
}

/*
  Inset grouped list, after iOS Settings: one card, hairline separators that
  start at the text (not the icon), so the icons read as a column.
*/
export function RowGroup({ children, label, footer }: { children: React.ReactNode; label?: string; footer?: React.ReactNode }) {
  return (
    <section aria-label={label}>
      <ul className="overflow-hidden rounded-2xl bg-surface shadow-card [&>li+li]:relative [&>li+li]:before:pointer-events-none [&>li+li]:before:absolute [&>li+li]:before:inset-x-0 [&>li+li]:before:top-0 [&>li+li]:before:ml-[3.75rem] [&>li+li]:before:h-px [&>li+li]:before:bg-line">
        {children}
      </ul>
      {footer && <p className="mt-2 px-4 text-footnote text-ink-faint">{footer}</p>}
    </section>
  );
}

/* The icon tile: a 30px rounded square, accent-tinted, the same in every row. */
export function RowIcon({ Icon, tone = 'accent' }: { Icon: LucideIcon; tone?: 'accent' | 'partner' | 'neutral' }) {
  const tones = {
    accent: 'bg-accent text-accent-ink',
    partner: 'bg-partner text-mood-ink',
    neutral: 'bg-ink-faint text-surface',
  };
  return (
    <span aria-hidden className={`flex size-[1.875rem] shrink-0 items-center justify-center rounded-[0.5rem] ${tones[tone]}`}>
      <Icon className="size-[1.125rem]" strokeWidth={2} />
    </span>
  );
}

export function LinkRow({
  Icon,
  title,
  sub,
  href,
  badge,
  tone,
  detail,
}: RowBase & { href: string; badge?: number; tone?: 'accent' | 'partner' | 'neutral'; detail?: string }) {
  return (
    <li>
      <Link
        href={href}
        className="flex min-h-13 items-center gap-3.5 px-4 py-2.5 transition-colors hover:bg-sunken focus-visible:bg-sunken active:bg-sunken"
      >
        <RowIcon Icon={Icon} tone={tone} />
        <span className="min-w-0 flex-1">
          <span className="block text-body text-ink">{title}</span>
          {sub && <span className="block text-footnote text-ink-faint">{sub}</span>}
        </span>
        {detail && <span className="shrink-0 text-body text-ink-faint">{detail}</span>}
        {badge ? (
          <span className="min-w-6 rounded-full bg-accent px-2 py-0.5 text-center text-footnote font-semibold text-accent-ink">{badge}</span>
        ) : null}
        <ChevronRight className="size-5 shrink-0 text-line-strong" strokeWidth={2.2} aria-hidden />
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
        className="flex min-h-13 w-full items-center gap-3.5 px-4 py-2.5 text-left transition-colors enabled:hover:bg-sunken disabled:cursor-not-allowed"
      >
        <RowIcon Icon={Icon} />
        <span className="min-w-0 flex-1">
          <span className="block text-body text-ink">{title}</span>
          {sub && <span className="block text-footnote text-ink-faint">{sub}</span>}
          {note && <span className="mt-1 block text-footnote font-medium text-accent-soft-ink">{note}</span>}
        </span>
        <SwitchTrack checked={checked} disabled={disabled} />
      </button>
    </li>
  );
}

/* The iOS switch: 51×31 track, 27px knob. Accent, not green — green is mood's. */
export function SwitchTrack({ checked, disabled }: { checked: boolean; disabled?: boolean }) {
  return (
    <span
      aria-hidden
      className={`relative h-[1.9375rem] w-[3.1875rem] shrink-0 rounded-full transition-colors duration-200 ${
        checked ? 'bg-accent' : 'bg-line-strong/70'
      } ${disabled ? 'opacity-50' : ''}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 size-[1.6875rem] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.15),0_1px_1px_rgba(0,0,0,0.16)] transition-transform duration-300 ease-out-soft ${
          checked ? 'translate-x-5' : ''
        }`}
      />
    </span>
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
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-footnote font-medium ${tones[tone]}`}>
      {Icon && <Icon className="size-3.5" aria-hidden />}
      {children}
    </span>
  );
}
