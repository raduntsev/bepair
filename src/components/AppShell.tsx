'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import supabase from '@/lib/supabase';
import { usePathname } from 'next/navigation';
import {
  Bell,
  BookOpen,
  CalendarDays,
  Gift,
  ListChecks,
  Mail,
  Menu,
  Send,
  Settings,
  Sun,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { Wordmark } from '@/components/PairMark';

interface NavItem {
  href: string;
  label: string;
  Icon: LucideIcon;
}

/* Five tabs fit 390px; nine would leave 43px each. Everything else lives under «Ещё». */
const TABS: NavItem[] = [
  { href: '/day', label: 'День', Icon: Sun },
  { href: '/calendar', label: 'Календарь', Icon: CalendarDays },
  { href: '/chronicle', label: 'Летопись', Icon: BookOpen },
  { href: '/tasks', label: 'Задачи', Icon: ListChecks },
  { href: '/more', label: 'Ещё', Icon: Menu },
];

/* The desktop rail has room for every destination, so nothing hides behind «Ещё». */
const RAIL_MAIN: NavItem[] = [
  { href: '/day', label: 'День', Icon: Sun },
  { href: '/calendar', label: 'Календарь', Icon: CalendarDays },
  { href: '/chronicle', label: 'Летопись', Icon: BookOpen },
  { href: '/tasks', label: 'Задачи', Icon: ListChecks },
  { href: '/letters', label: 'Письма', Icon: Mail },
  { href: '/store', label: 'Услуги', Icon: Gift },
];
const RAIL_SECONDARY: NavItem[] = [
  { href: '/notifications', label: 'Уведомления', Icon: Bell },
  { href: '/couple', label: 'Профиль пары', Icon: Users },
  { href: '/settings', label: 'Настройки', Icon: Settings },
];

/* Under «Ещё» on a phone; the tab lights up for any of them. */
const MORE_ROUTES = ['/more', '/letters', '/store', '/notifications', '/couple', '/settings'];

function matches(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function RailLink({ item, active, badge }: { item: NavItem; active: boolean; badge?: number }) {
  const { href, label, Icon } = item;
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-150 ${
        active ? 'bg-accent-soft text-accent-soft-ink' : 'text-ink-soft hover:bg-sunken hover:text-ink'
      }`}
    >
      <Icon className="size-5 shrink-0" aria-hidden />
      <span className="flex-1">{label}</span>
      {badge ? (
        <span className="rounded-full bg-accent px-1.5 py-0.5 text-[11px] leading-none font-semibold text-accent-ink">
          {badge > 9 ? '9+' : badge}
          <span className="sr-only"> новых</span>
        </span>
      ) : null}
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { unread } = useNotifications();
  /* The ping composer is a focused task: no tab bar under the thumb. */
  const focused = pathname === '/ping';

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

        {RAIL_MAIN.map((item) => (
          <RailLink key={item.href} item={item} active={matches(pathname, item.href)} />
        ))}
        <div className="my-2 h-px bg-line" aria-hidden />
        {RAIL_SECONDARY.map((item) => (
          <RailLink
            key={item.href}
            item={item}
            active={matches(pathname, item.href)}
            badge={item.href === '/notifications' ? unread : undefined}
          />
        ))}
      </nav>

      <main className={`flex-1 md:min-w-0 md:pb-0 ${focused ? 'pb-8' : 'pb-28'}`}>{children}</main>

      {!focused && (
        <nav
          aria-label="Разделы"
          className="safe-b fixed inset-x-0 bottom-0 z-30 border-t border-line bg-rail/95 backdrop-blur-sm md:hidden"
        >
          <ul className="mx-auto flex max-w-lg">
            {TABS.map(({ href, label, Icon }) => {
              const active =
                href === '/more' ? MORE_ROUTES.some((route) => matches(pathname, route)) : matches(pathname, href);
              const badge = href === '/more' && unread > 0;
              return (
                <li key={href} className="flex-1">
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
