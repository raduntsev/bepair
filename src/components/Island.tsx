'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
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
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/*
  The island. One black shape at the bottom of every screen — the only
  navigation the app has. Closed, it is a capsule that says where you are.
  Open, the same shape grows into a compact panel (never a full-screen sheet)
  with every destination.

  It is one element morphing, not two swapped: the shape's width, height and
  radius are sprung between measured sizes, while the capsule's content and the
  panel's content cross-fade inside it. Nothing is unmounted mid-motion, so
  there is no frame where the shape jumps.

  With a mouse it opens on hover and closes a moment after the pointer leaves.
  With touch it opens on tap, over a scrim, and closes on choice, Esc, or a tap
  outside. Scrolling down tucks it away; scrolling up brings it back.
*/

export interface Destination {
  href: string;
  label: string;
  Icon: LucideIcon;
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
  return DESTINATIONS.find((d) => matches(pathname, d.href)) ?? DESTINATIONS[0];
}

/* One spring for the shape. Soft enough to read as growth, damped so it never wobbles. */
const SHAPE = { type: 'spring', stiffness: 260, damping: 30, mass: 1 } as const;
const PILL_H = 52;
const PANEL_MAX = 376;
const HOVER_OPEN_MS = 60;
const HOVER_CLOSE_MS = 280;

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

/* Natural size of an element, kept current. */
function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setSize({ w: el.offsetWidth, h: el.offsetHeight });
    read();
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, size] as const;
}

function usePanelWidth() {
  const [width, setWidth] = useState(PANEL_MAX);
  useEffect(() => {
    const read = () => setWidth(Math.min(PANEL_MAX, window.innerWidth - 24));
    read();
    window.addEventListener('resize', read);
    return () => window.removeEventListener('resize', read);
  }, []);
  return width;
}

type OpenedBy = 'hover' | 'press' | null;

export function Island({ pathname, unread }: { pathname: string; unread: number }) {
  const reduce = useReducedMotion();
  const [openedBy, setOpenedBy] = useState<OpenedBy>(null);
  const open = openedBy !== null;
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelWidth = usePanelWidth();
  const [pillRef, pill] = useSize<HTMLDivElement>();
  const [panelRef, panel] = useSize<HTMLDivElement>();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tucked = useScrollTuck(open);
  const here = currentDestination(pathname);

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const close = useCallback((returnFocus = false) => {
    setOpenedBy(null);
    if (returnFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  /* A new route closes the panel — the choice has been made. */
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setOpenedBy(null);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(true);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  useEffect(() => clearTimer, []);

  /* Opened deliberately (tap or keyboard): focus moves into the panel. Hover leaves focus alone. */
  useEffect(() => {
    if (openedBy !== 'press') return;
    const target = panelRef.current?.querySelector<HTMLElement>('[aria-current="page"]') ?? panelRef.current?.querySelector('a');
    target?.focus({ preventScroll: true });
  }, [openedBy, panelRef]);

  const onPointerEnter = (event: React.PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    clearTimer();
    if (!open) timer.current = setTimeout(() => setOpenedBy('hover'), HOVER_OPEN_MS);
  };
  const onPointerLeave = (event: React.PointerEvent) => {
    if (event.pointerType !== 'mouse' || openedBy !== 'hover') {
      clearTimer();
      return;
    }
    clearTimer();
    timer.current = setTimeout(() => setOpenedBy(null), HOVER_CLOSE_MS);
  };

  const pillW = pill?.w ?? 180;
  const panelH = panel?.h ?? 360;
  const shape = open
    ? { width: panelWidth, height: panelH, borderRadius: 34 }
    : { width: pillW, height: PILL_H, borderRadius: PILL_H / 2 };

  const fade = reduce ? { duration: 0 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <>
      <AnimatePresence>
        {openedBy === 'press' && (
          <motion.div
            key="scrim"
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.25 }}
            onClick={() => close()}
            className="fixed inset-0 z-40"
            style={{ backgroundColor: 'var(--c-scrim)' }}
          />
        )}
      </AnimatePresence>

      <nav
        aria-label="Разделы"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
      >
        <motion.div
          initial={false}
          animate={{ ...shape, y: tucked ? 110 : 0, opacity: tucked ? 0 : 1 }}
          transition={reduce ? { duration: 0 } : SHAPE}
          onPointerEnter={onPointerEnter}
          onPointerLeave={onPointerLeave}
          className="pointer-events-auto relative overflow-hidden bg-island text-island-ink"
          style={{ boxShadow: 'inset 0 0 0 1px var(--c-island-ring), var(--sh-island)', willChange: 'width, height' }}
        >
          {/* Capsule content — anchored to the bottom centre, fades as the shape grows. */}
          <motion.div
            ref={pillRef}
            initial={false}
            animate={{ opacity: open ? 0 : 1, scale: open ? 0.92 : 1, filter: open ? 'blur(6px)' : 'blur(0px)' }}
            transition={fade}
            className="absolute bottom-0 left-1/2 -translate-x-1/2"
            style={{ pointerEvents: open ? 'none' : 'auto' }}
          >
            <button
              ref={triggerRef}
              type="button"
              aria-expanded={open}
              aria-controls={panelId}
              tabIndex={open ? -1 : 0}
              onClick={() => {
                clearTimer();
                setOpenedBy('press');
              }}
              className="flex h-13 items-center gap-2.5 pr-4 pl-1.5 whitespace-nowrap"
            >
              <span className="relative flex size-10 items-center justify-center rounded-full bg-island-fill">
                <here.Icon className="size-5" strokeWidth={2} aria-hidden />
                {unread > 0 && (
                  <span className="absolute top-0.5 right-0.5 size-2.5 rounded-full bg-[#5856d6] ring-2 ring-island">
                    <span className="sr-only">есть новые уведомления</span>
                  </span>
                )}
              </span>
              <span className="text-subhead font-semibold">{here.label}</span>
              <ChevronUp className="size-4 text-island-soft" strokeWidth={2.4} aria-hidden />
              <span className="sr-only">— открыть разделы</span>
            </button>
          </motion.div>

          {/* Panel content — laid out at full width from the start, revealed as the shape reaches it. */}
          <motion.div
            ref={panelRef}
            id={panelId}
            initial={false}
            animate={{ opacity: open ? 1 : 0, scale: open ? 1 : 0.94, filter: open ? 'blur(0px)' : 'blur(6px)' }}
            transition={open && !reduce ? { ...fade, delay: 0.08 } : fade}
            className="absolute bottom-0 left-1/2 origin-bottom -translate-x-1/2 p-3"
            style={{ width: panelWidth, pointerEvents: open ? 'auto' : 'none' }}
            inert={!open}
          >
            <p className="px-2 pt-1 pb-2 text-footnote font-semibold tracking-wide text-island-soft uppercase">Разделы</p>

            <ul className="grid grid-cols-3 gap-1.5">
              {DESTINATIONS.map(({ href, label, Icon }) => {
                const active = here.href === href;
                const badge = href === '/notifications' && unread > 0;
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={() => active && close()}
                      aria-current={active ? 'page' : undefined}
                      className={`relative flex h-[5.25rem] flex-col items-center justify-center gap-2 rounded-[1.25rem] px-1 text-caption font-medium transition-colors duration-200 ${
                        active ? 'bg-island-ink text-island' : 'text-island-ink hover:bg-island-fill active:bg-island-fill'
                      }`}
                    >
                      <span className="relative">
                        <Icon className="size-6" strokeWidth={active ? 2.2 : 1.8} aria-hidden />
                        {badge && (
                          <span className="absolute -top-1 -right-2 flex min-w-4 items-center justify-center rounded-full bg-[#5856d6] px-1 text-[10px] leading-4 font-semibold text-white">
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
              className="mt-2 flex h-13 items-center justify-center gap-2 rounded-[1.25rem] bg-[#5856d6] text-headline font-semibold text-white transition-[filter] duration-200 hover:brightness-110"
            >
              <Send className="size-5" aria-hidden /> Отправить весточку
            </Link>
          </motion.div>
        </motion.div>
      </nav>
    </>
  );
}
