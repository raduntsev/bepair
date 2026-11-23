'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { tr } from '@/lib/i18n';

/*
  A section title over a pair of real destinations, shown as an iOS segmented
  control: «Календарь | Планёрки», «Просьбы | Услуги». Links, not buttons —
  each tab is a page of its own, so back and deep links work.
*/
export function TabbedHeader({
  title,
  tabs,
  current,
  action,
  id,
}: {
  title: string;
  tabs: { href: string; label: string }[];
  current: string;
  action?: React.ReactNode;
  /* Keeps the sliding plate's animation separate per section. */
  id: string;
}) {
  return (
    <header className="mb-6">
      <div className="flex items-end justify-between gap-4">
        <h1 className="text-large-title font-bold">{title}</h1>
        {action}
      </div>

      <nav aria-label={title} className="mt-4 flex rounded-xl bg-sunken p-1">
        {tabs.map(({ href, label }) => {
          const active = href === current;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`relative flex min-h-10 flex-1 items-center justify-center rounded-[0.625rem] text-subhead font-medium transition-colors duration-300 ${
                active ? 'text-ink' : 'text-ink-faint hover:text-ink'
              }`}
            >
              {active && (
                <motion.span
                  layoutId={`tabbed-${id}`}
                  transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
                  className="absolute inset-0 rounded-[0.625rem] bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.1),0_1px_1px_rgba(0,0,0,0.04)]"
                />
              )}
              <span className="relative">{label}</span>
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

export const TIME_TABS = [
  { href: '/calendar', label: tr('Календарь', 'Calendar') },
  { href: '/planerka', label: tr('Планёрки', 'Check-ins') },
];

export const COURSE_TABS = [
  { href: '/courses', label: tr('Курсы', 'Courses') },
  { href: '/journal', label: tr('Журнал', 'Journal') },
];
