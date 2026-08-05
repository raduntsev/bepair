'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, Gift, ListChecks, Mail, Settings, Sun } from 'lucide-react';

const NAV = [
  { href: '/day', label: 'День', Icon: Sun },
  { href: '/calendar', label: 'Календарь', Icon: CalendarDays },
  { href: '/letters', label: 'Письма', Icon: Mail },
  { href: '/tasks', label: 'Задачи', Icon: ListChecks },
  { href: '/store', label: 'Услуги', Icon: Gift },
  { href: '/settings', label: 'Настройки', Icon: Settings },
] as const;

function useActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const isActive = useActive();

  return (
    <div className="min-h-dvh md:flex">
      {/* Desktop rail — the persistent control point the product asked for. */}
      <nav
        aria-label="Разделы"
        className="hidden md:flex md:w-56 lg:w-60 md:shrink-0 md:flex-col md:gap-1 md:border-r md:border-line md:bg-rail md:p-3 md:sticky md:top-0 md:h-dvh"
      >
        <div className="px-3 pt-3 pb-6">
          <span className="text-lg font-semibold tracking-tight">Впаре</span>
        </div>

        {NAV.map(({ href, label, Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-150 ${
                active
                  ? 'bg-accent-soft text-accent-soft-ink'
                  : 'text-ink-soft hover:bg-sunken hover:text-ink'
              }`}
            >
              <Icon className="size-5 shrink-0" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>

      <main className="flex-1 pb-28 md:pb-0 md:min-w-0">{children}</main>

      {/* Mobile tab bar — every destination, including settings: it holds the
          invite code and sign-out, which have no other route on a phone. */}
      <nav
        aria-label="Разделы"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-rail/95 backdrop-blur-sm safe-b md:hidden"
      >
        <ul className="mx-auto flex max-w-lg">
          {NAV.map(({ href, label, Icon }) => {
            const active = isActive(href);
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`tap flex flex-col items-center justify-center gap-1 px-0.5 py-2 text-[10px] leading-tight font-medium transition-colors duration-150 ${
                    active ? 'text-accent' : 'text-ink-faint'
                  }`}
                >
                  <Icon className="size-6 shrink-0" strokeWidth={active ? 2.2 : 1.8} aria-hidden />
                  <span className="w-full truncate text-center">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
