'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CalendarDays, ChevronUp, ListChecks, MessageCircle, PenLine, Sun, UserRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { tr } from '@/lib/i18n';

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
  /* Other routes that count as being «here». */
  also?: string[];
}

/*
  Five places, each one a different question: what is today, what did we say
  to each other, what did we ask of each other, when, and who are we.
*/
export const DESTINATIONS: Destination[] = [
  { href: '/day', label: tr('Сегодня', 'Today'), Icon: Sun, also: ['/notifications'] },
  { href: '/messages', label: tr('Переписка', 'Messages'), Icon: MessageCircle, also: ['/letters', '/chronicle', '/ping'] },
  { href: '/tasks', label: tr('Просьбы', 'Requests'), Icon: ListChecks, also: ['/store'] },
  { href: '/calendar', label: tr('Календарь', 'Calendar'), Icon: CalendarDays, also: ['/planerka'] },
  { href: '/settings', label: tr('Профиль', 'Profile'), Icon: UserRound, also: ['/couple', '/album'] },
];

const COMPOSE = '/ping';

function matches(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function currentDestination(pathname: string): Destination {
  return DESTINATIONS.find((d) => [d.href, ...(d.also ?? [])].some((h) => matches(pathname, h))) ?? DESTINATIONS[0];
}

/*
  Quick and light. Open in about 0.4 s, close in 0.3 s, on a curve that starts
  fast and settles softly (iOS's sheet curve), so the shape answers the finger
  at once. Content moves only by opacity and a small rise — no blur: a blur
  filter on every frame is what made the island stutter on Android phones.
  Content waits a beat for the shape on the way in and leaves first on the way out.
*/
const EASE = [0.32, 0.72, 0, 1] as const;
const GROW = { duration: 0.42, ease: EASE };
const FOLD = { duration: 0.32, ease: EASE };
const PILL_H = 52;
const PANEL_MAX = 320;
const HOVER_OPEN_MS = 180;
const HOVER_CLOSE_MS = 300;

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
  /*
    In «Переписка» the note bar lives in the island's own row, beside a
    capsule shrunk to its icon: one level at the bottom, nothing stacked on
    anything. The page portals its bar into #island-slot. The row never tucks
    away there — the bar is the point of the screen.
  */
  const inChat = currentDestination(pathname).href === '/messages';
  const tucked = useScrollTuck(open || inChat);
  const here = currentDestination(pathname);
  /* Inside «Переписка» the chat has its own input; a second «write» button would be noise. */
  const hideCompose = open || inChat;

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
  const panelH = panel?.h ?? 290;
  const shape = open
    ? { width: panelWidth, height: panelH, borderRadius: 30 }
    : { width: pillW, height: PILL_H, borderRadius: PILL_H / 2 };

  const instant = { duration: 0 };
  /* Content timing hangs off the shape: in after it has grown, out before it folds. */
  const pillFade = reduce ? instant : open ? { duration: 0.12, ease: EASE } : { duration: 0.2, delay: 0.14, ease: EASE };
  const panelFade = reduce ? instant : open ? { duration: 0.24, delay: 0.12, ease: EASE } : { duration: 0.12, ease: EASE };

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
            transition={reduce ? instant : { duration: 0.3, ease: EASE }}
            onClick={() => close()}
            className="fixed inset-0 z-40"
            style={{ backgroundColor: 'var(--c-scrim)' }}
          />
        )}
      </AnimatePresence>

      <nav
        aria-label={tr('Разделы', 'Sections')}
        className={`pointer-events-none fixed inset-x-0 bottom-0 z-50 flex items-end justify-center gap-2 ${inChat ? 'px-3' : ''}`}
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
      >
        <motion.div
          initial={false}
          animate={{ ...shape, y: tucked ? 110 : 0, opacity: tucked ? 0 : 1 }}
          transition={reduce ? instant : open ? GROW : FOLD}
          onPointerEnter={onPointerEnter}
          onPointerLeave={onPointerLeave}
          data-tour="island"
          className="pointer-events-auto relative overflow-hidden bg-island text-island-ink"
          style={{ boxShadow: 'inset 0 0 0 1px var(--c-island-ring), var(--sh-island)', willChange: 'transform' }}
        >
          {/* Capsule content — anchored to the bottom centre, fades as the shape grows. */}
          <motion.div
            ref={pillRef}
            initial={false}
            animate={{ opacity: open ? 0 : 1 }}
            transition={pillFade}
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
              className={`flex h-13 items-center gap-2.5 pl-1.5 whitespace-nowrap ${inChat ? 'pr-1.5' : 'pr-4'}`}
            >
              <span className="relative flex size-10 items-center justify-center rounded-full bg-island-fill">
                <here.Icon className="size-5" strokeWidth={2} aria-hidden />
                {unread > 0 && (
                  <span className="absolute top-0.5 right-0.5 size-2.5 rounded-full bg-[#5856d6] ring-2 ring-island">
                    <span className="sr-only">{tr('есть новые уведомления', 'new notifications')}</span>
                  </span>
                )}
              </span>
              {inChat ? (
                <span className="sr-only">{here.label}</span>
              ) : (
                <>
                  <span className="text-subhead font-semibold">{here.label}</span>
                  <ChevronUp className="size-4 text-island-soft" strokeWidth={2.4} aria-hidden />
                </>
              )}
              <span className="sr-only">{tr('— открыть разделы', '— open sections')}</span>
            </button>
          </motion.div>

          {/* Panel content — laid out at full width from the start, revealed as the shape reaches it. */}
          <motion.div
            ref={panelRef}
            id={panelId}
            initial={false}
            animate={{ opacity: open ? 1 : 0, y: open ? 0 : 8 }}
            transition={panelFade}
            className="absolute bottom-0 left-1/2 -translate-x-1/2 p-2"
            style={{ width: panelWidth, pointerEvents: open ? 'auto' : 'none' }}
            inert={!open}
          >
            <ul className="flex flex-col gap-0.5">
              {DESTINATIONS.map(({ href, label, Icon }) => {
                const active = here.href === href;
                const badge = href === '/day' && unread > 0;
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={() => active && close()}
                      aria-current={active ? 'page' : undefined}
                      className={`flex h-13 items-center gap-3.5 rounded-[1.375rem] pr-4 pl-1.5 text-body font-medium transition-colors duration-300 ${
                        active ? 'bg-island-ink text-island' : 'text-island-ink hover:bg-island-fill active:bg-island-fill'
                      }`}
                    >
                      <span
                        className={`flex size-10 items-center justify-center rounded-full ${active ? '' : 'bg-island-fill'}`}
                      >
                        <Icon className="size-5" strokeWidth={2} aria-hidden />
                      </span>
                      <span className="flex-1">{label}</span>
                      {badge && (
                        <span className="min-w-6 rounded-full bg-[#5856d6] px-2 text-center text-footnote leading-6 font-semibold text-white">
                          {unread > 9 ? '9+' : unread}
                          <span className="sr-only">{tr(' новых', ' new')}</span>
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        </motion.div>

        {/* Writing to the partner is the most frequent thing after the day itself: one tap, always. */}
        <motion.div
          initial={false}
          animate={{
            opacity: hideCompose || tucked ? 0 : 1,
            scale: hideCompose ? 0.6 : 1,
            y: tucked ? 110 : 0,
            width: hideCompose ? 0 : PILL_H,
            marginLeft: hideCompose ? -8 : 0,
          }}
          transition={reduce ? instant : open ? FOLD : GROW}
          className="pointer-events-auto"
          inert={hideCompose}
        >
          <Link
            href={COMPOSE}
            aria-label={tr('Написать партнёру', 'Write to your partner')}
            data-tour="compose"
            className="flex size-13 items-center justify-center rounded-full bg-[#5856d6] text-white transition-[filter] duration-300 hover:brightness-110"
            style={{ boxShadow: 'var(--sh-island)' }}
          >
            <PenLine className="size-5" strokeWidth={2.2} aria-hidden />
          </Link>
        </motion.div>

        {inChat && (
          <div
            id="island-slot"
            className={`pointer-events-auto min-w-0 flex-1 ${open ? 'hidden' : ''}`}
            style={{ maxWidth: '40rem' }}
            inert={open}
          />
        )}
      </nav>
    </>
  );
}
