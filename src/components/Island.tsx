'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  BookOpen,
  Bell,
  CalendarDays,
  ChevronUp,
  Gift,
  ListChecks,
  Mail,
  Send,
  Settings,
  Sun,
  UserRound,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/*
  The island. One black capsule at the bottom of every screen — the only
  navigation the app has. Closed, it says where you are and nothing else.
  Tapped, it grows in place into a compact panel (never a full-screen sheet)
  holding every destination, then shrinks back on choice, on Esc, or on a tap
  outside. Scrolling down tucks it away; scrolling up brings it back.

  Nine destinations on a 3×3 grid, because nine is what the product has and a
  grid of nine is read in one glance. The one action — «Весточка» — sits under
  them as the only filled control in the panel.
*/

export interface Destination {
  href: string;
  label: string;
  Icon: LucideIcon;
  /* Other routes that count as being «here». */
  also?: string[];
}

export const DESTINATIONS: Destination[] = [
  { href: '/day', label: 'Сегодня', Icon: Sun },
  { href: '/calendar', label: 'Календарь', Icon: CalendarDays },
  { href: '/chronicle', label: 'Летопись', Icon: BookOpen },
  { href: '/tasks', label: 'Просьбы', Icon: ListChecks },
  { href: '/store', label: 'Услуги', Icon: Gift },
  { href: '/letters', label: 'Письма', Icon: Mail },
  { href: '/couple', label: 'Пара', Icon: UserRound },
  { href: '/notifications', label: 'Уведомления', Icon: Bell },
  { href: '/settings', label: 'Настройки', Icon: Settings },
];

const PING: Destination = { href: '/ping', label: 'Весточка', Icon: Send };

function matches(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function currentDestination(pathname: string): Destination {
  if (matches(pathname, PING.href)) return PING;
  return DESTINATIONS.find((d) => [d.href, ...(d.also ?? [])].some((h) => matches(pathname, h))) ?? DESTINATIONS[0];
}

const SPRING = { type: 'spring', stiffness: 420, damping: 34, mass: 0.9 } as const;

/* Tucks away on the way down, returns on the way up and near the top. */
function useScrollTuck(disabled: boolean) {
  const [tucked, setTucked] = useState(false);
  useEffect(() => {
    if (disabled) return;
    let last = window.scrollY;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - last;
        const nearBottom = window.innerHeight + y >= document.documentElement.scrollHeight - 24;
        if (y < 80 || nearBottom) setTucked(false);
        else if (delta > 6) setTucked(true);
        else if (delta < -6) setTucked(false);
        last = y;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
    };
  }, [disabled]);
  return disabled ? false : tucked;
}

export function Island({ pathname, unread }: { pathname: string; unread: number }) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const tucked = useScrollTuck(open);
  const here = currentDestination(pathname);

  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    if (returnFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  /* A new route closes the panel — the choice has been made. */
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    const first = panelRef.current?.querySelector<HTMLElement>('[aria-current="page"], a');
    first?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  const spring = reduce ? { duration: 0 } : SPRING;
  const ring = 'inset 0 0 0 1px var(--c-island-ring)';

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            key="scrim"
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.2 }}
            onClick={() => close(false)}
            className="fixed inset-0 z-40 backdrop-blur-[2px]"
            style={{ backgroundColor: 'var(--c-scrim)' }}
          />
        )}
      </AnimatePresence>

      <nav
        aria-label="Разделы"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-3"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
      >
        <motion.div
          layout
          initial={false}
          animate={{ y: tucked ? 120 : 0, opacity: tucked ? 0 : 1 }}
          transition={spring}
          className="pointer-events-auto overflow-hidden bg-island text-island-ink shadow-island"
          style={{
            borderRadius: open ? 34 : 999,
            width: open ? 'min(100%, 23.5rem)' : 'auto',
            boxShadow: `${ring}, var(--sh-island)`,
          }}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {open ? (
              <motion.div
                key="panel"
                id={panelId}
                ref={panelRef}
                initial={{ opacity: 0, scale: 0.96, filter: 'blur(4px)' }}
                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 0.96, filter: 'blur(4px)', transition: { duration: 0.12 } }}
                transition={reduce ? { duration: 0 } : { duration: 0.22, delay: 0.06 }}
                className="p-3"
              >
                <div className="flex items-center justify-between px-2 pt-1 pb-2">
                  <span className="text-footnote font-semibold tracking-wide text-island-soft uppercase">Разделы</span>
                  <button
                    type="button"
                    onClick={() => close()}
                    aria-label="Закрыть"
                    className="flex size-9 items-center justify-center rounded-full bg-island-fill text-island-ink transition-colors hover:bg-white/15"
                  >
                    <X className="size-4.5" aria-hidden />
                  </button>
                </div>

                <ul className="grid grid-cols-3 gap-1.5">
                  {DESTINATIONS.map(({ href, label, Icon }) => {
                    const active = here.href === href;
                    const badge = href === '/notifications' && unread > 0;
                    return (
                      <li key={href}>
                        <Link
                          href={href}
                          onClick={() => active && close(false)}
                          aria-current={active ? 'page' : undefined}
                          className={`relative flex h-[5.25rem] flex-col items-center justify-center gap-2 rounded-[1.25rem] px-1 text-caption font-medium transition-colors duration-150 ${
                            active ? 'bg-island-ink text-island' : 'text-island-ink hover:bg-island-fill active:bg-island-fill'
                          }`}
                        >
                          <span className="relative">
                            <Icon className="size-6" strokeWidth={active ? 2.2 : 1.8} aria-hidden />
                            {badge && (
                              <span className="absolute -top-1 -right-2 flex min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] leading-4 font-semibold text-white">
                                {unread > 9 ? '9+' : unread}
                                <span className="sr-only"> новых</span>
                              </span>
                            )}
                          </span>
                          <span className="w-full truncate text-center">{label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>

                <Link
                  href={PING.href}
                  className="mt-2 flex h-13 items-center justify-center gap-2 rounded-[1.25rem] bg-[#5856d6] text-headline font-semibold text-white transition-[filter] hover:brightness-110"
                >
                  <Send className="size-5" aria-hidden /> Отправить весточку
                </Link>
              </motion.div>
            ) : (
              <motion.button
                key="pill"
                ref={triggerRef}
                type="button"
                aria-expanded={false}
                aria-controls={panelId}
                onClick={() => setOpen(true)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.08 } }}
                transition={{ duration: reduce ? 0 : 0.18 }}
                className="flex h-13 items-center gap-2.5 pr-4 pl-1.5 whitespace-nowrap"
              >
                <span className="relative flex size-10 items-center justify-center rounded-full bg-island-fill">
                  <here.Icon className="size-5" strokeWidth={2} aria-hidden />
                  {unread > 0 && (
                    <span className="absolute top-0.5 right-0.5 size-2.5 rounded-full bg-accent ring-2 ring-island">
                      <span className="sr-only">есть новые уведомления</span>
                    </span>
                  )}
                </span>
                <span className="text-subhead font-semibold">{here.label}</span>
                <ChevronUp className="size-4 text-island-soft" strokeWidth={2.4} aria-hidden />
                <span className="sr-only">— открыть разделы</span>
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>
      </nav>
    </>
  );
}
