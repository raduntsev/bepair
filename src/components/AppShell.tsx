'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import supabase from '@/lib/supabase';
import { usePathname } from 'next/navigation';
import { ArrowLeftRight, CalendarDays, Send, Sun, UserRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { Wordmark } from '@/components/PairMark';
import { SectionTabs, type SubItem } from '@/components/SectionTabs';

interface Section {
  href: string;
  label: string;
  Icon: LucideIcon;
  children?: SubItem[];
}

/*
  Four sections, not eleven destinations. Every screen the product had is still
  here — the ones that used to sit in a flat list, or behind «Ещё», are now the
  sub-tabs of the section they belong to, visible as soon as you open it.

  Grouping rule: «День» is today, «Вместе» is looking back, «Обмен» is what the
  two of you pass between you, «Профиль» is everything that configures the pair.
*/
const SECTIONS: Section[] = [
  { href: '/day', label: 'День', Icon: Sun },
  {
    href: '/calendar',
    label: 'Вместе',
    Icon: CalendarDays,
    children: [
      { href: '/calendar', label: 'Календарь' },
      { href: '/chronicle', label: 'Летопись' },
    ],
  },
  {
    href: '/tasks',
    label: 'Обмен',
    Icon: ArrowLeftRight,
    children: [
      { href: '/tasks', label: 'Задачи' },
      { href: '/store', label: 'Услуги' },
      { href: '/letters', label: 'Письма' },
    ],
  },
  {
    href: '/couple',
    label: 'Профиль',
    Icon: UserRound,
    children: [
      { href: '/couple', label: 'Пара' },
      { href: '/notifications', label: 'Уведомления' },
      { href: '/settings', label: 'Настройки' },
    ],
  },
];

function matches(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/* A section owns its own route and every route under its sub-tabs. */
function sectionRoutes(section: Section) {
  return [section.href, ...(section.children ?? []).map((child) => child.href)];
}

function activeSection(pathname: string) {
  return SECTIONS.find((section) => sectionRoutes(section).some((href) => matches(pathname, href)));
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { unread } = useNotifications();
  /* The ping composer is a focused task: no tab bar under the thumb. */
  const focused = pathname === '/ping';
  const current = activeSection(pathname);
  const subTabs = focused ? undefined : current?.children;

  /* «Заходил(а)» in the partner's profile: on open and on coming back. Throttled in SQL. */
  useEffect(() => {
    const touch = () => {
      if (document.visibilityState === 'visible') supabase.rpc('bp_touch').then(() => undefined);
    };
    touch();
    document.addEventListener('visibilitychange', touch);
    return () => document.removeEventListener('visibilitychange', touch);
  }, []);

  return (
    <div className="min-h-dvh md:flex">
      <nav
        aria-label="Разделы"
        className="hidden md:sticky md:top-0 md:flex md:h-dvh md:w-60 md:shrink-0 md:flex-col md:gap-1 md:overflow-y-auto md:border-r md:border-line md:bg-rail md:p-3"
      >
        <Link href="/day" className="mb-4 rounded-lg px-3 pt-3 pb-2">
          <Wordmark />
        </Link>

        <Link
          href="/ping"
          className="mb-3 flex h-11 items-center justify-center gap-2 rounded-lg bg-accent px-3 text-sm font-medium text-accent-ink shadow-card transition-colors hover:bg-accent-hover"
        >
          <Send className="size-4.5" aria-hidden /> Весточка
        </Link>

        {SECTIONS.map((section) => {
          const sectionActive = sectionRoutes(section).some((href) => matches(pathname, href));
          return (
            <div key={section.label} className="mb-1">
              <Link
                href={section.href}
                aria-current={sectionActive && !section.children ? 'page' : undefined}
                className={`flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-150 ${
                  sectionActive ? 'text-ink' : 'text-ink-soft hover:bg-sunken hover:text-ink'
                }`}
              >
                <section.Icon className="size-5 shrink-0" aria-hidden />
                <span className="flex-1">{section.label}</span>
              </Link>

              {section.children && sectionActive && (
                <ul className="mt-0.5 ml-5 border-l border-line pl-3">
                  {section.children.map((child) => {
                    const childActive = matches(pathname, child.href);
                    const badge = child.href === '/notifications' ? unread : 0;
                    return (
                      <li key={child.href}>
                        <Link
                          href={child.href}
                          aria-current={childActive ? 'page' : undefined}
                          className={`flex h-10 items-center gap-2 rounded-lg px-3 text-sm transition-colors duration-150 ${
                            childActive
                              ? 'bg-accent-soft font-medium text-accent-soft-ink'
                              : 'text-ink-soft hover:bg-sunken hover:text-ink'
                          }`}
                        >
                          <span className="flex-1">{child.label}</span>
                          {badge > 0 && (
                            <span className="rounded-full bg-accent px-1.5 py-0.5 text-[11px] leading-none font-semibold text-accent-ink">
                              {badge > 9 ? '9+' : badge}
                              <span className="sr-only"> новых</span>
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      <div className="flex-1 md:min-w-0">
        {subTabs && (
          <SectionTabs items={subTabs} pathname={pathname} badges={{ '/notifications': unread }} />
        )}
        <main className={`md:pb-0 ${focused ? 'pb-8' : 'pb-28'}`}>{children}</main>
      </div>

      {!focused && (
        <nav
          aria-label="Разделы"
          className="safe-b fixed inset-x-0 bottom-0 z-30 border-t border-line bg-rail/95 backdrop-blur-sm md:hidden"
        >
          <ul className="mx-auto flex max-w-lg">
            {SECTIONS.map((section) => {
              const { href, label, Icon } = section;
              const active = sectionRoutes(section).some((route) => matches(pathname, route));
              const badge = sectionRoutes(section).includes('/notifications') && unread > 0;
              return (
                <li key={label} className="flex-1">
                  <Link
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    className={`tap flex flex-col items-center justify-center gap-1 px-0.5 py-2 text-[11px] leading-tight font-medium transition-colors duration-150 ${
                      active ? 'text-accent' : 'text-ink-faint'
                    }`}
                  >
                    <span className="relative">
                      <Icon className="size-6 shrink-0" strokeWidth={active ? 2.2 : 1.8} aria-hidden />
                      {badge && (
                        <span className="absolute -top-0.5 -right-1 size-2.5 rounded-full bg-accent ring-2 ring-rail">
                          <span className="sr-only">есть новые уведомления</span>
                        </span>
                      )}
                    </span>
                    <span className="w-full truncate text-center">{label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}
