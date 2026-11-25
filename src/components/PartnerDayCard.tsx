'use client';

import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Clock, Lock, Reply, UserMinus, UserPlus } from 'lucide-react';
import { moodColor, moodColorName } from '@/lib/mood';
import { timeIn } from '@/lib/dates';
import { displayName, leftVerb, verb } from '@/lib/words';
import type { DayEntry } from '@/hooks/useCoupleDay';
import { useSpaceAuth, type Partner } from '@/hooks/useSpaceAuth';
import { tr } from '@/lib/i18n';

interface PartnerDayCardProps {
  partner: Partner | null;
  entry: DayEntry | null;
  isUnlocked: boolean;
  isToday: boolean;
  showTime?: boolean;
  /* True right after your own mark unsealed this card in front of you. */
  justUnsealed?: boolean;
  /* Presence only: the partner has marked this date, content still sealed. */
  partnerMarked?: boolean;
}

type CardState = 'alone' | 'sealed' | 'waiting' | 'open';

const EASE = [0.22, 1, 0.36, 1] as const;

/* The partner's local time: one quiet line under the name, never its own row. */
function ClockMeta({ clock }: { clock: string }) {
  return (
    <span className="flex items-center gap-1 text-subhead text-ink-faint">
      <Clock className="size-3.5" aria-hidden /> {clock}
    </span>
  );
}

export function PartnerDayCard({ partner, entry, isUnlocked, isToday, showTime, justUnsealed, partnerMarked }: PartnerDayCardProps) {
  const reduce = useReducedMotion();
  const { closedSpace } = useSpaceAuth();
  const name = displayName(partner?.display_name);
  const state: CardState = !partner ? 'alone' : !isUnlocked ? 'sealed' : entry ? 'open' : 'waiting';

  /*
    The unsealing is the product's thesis, so it is the one authored motion
    moment: when your own mark opens their day in front of you, the card opens
    from the lock outward, in the colour of their day. Arriving on an already
    open day plays nothing — it was not opened just now.
  */
  const playReveal = !reduce && !!justUnsealed && state === 'open';

  const clock = showTime && partner ? timeIn(partner.timezone) : null;

  return (
    <div aria-live="polite">
      <AnimatePresence mode="wait" initial={false}>
        {state === 'alone' && (
          <motion.section key="alone" exit={{ opacity: 0 }} className="rounded-2xl border-2 border-dashed border-line-strong p-5">
            {closedSpace ? (
              /* The partner left: nobody to invite into this space, only a way to start again. */
              <Link
                href="/settings/account"
                className="tap -m-2 flex items-center gap-3.5 rounded-xl p-2 text-headline font-semibold text-ink-soft transition-colors hover:bg-sunken"
              >
                <span className="flex size-11 items-center justify-center rounded-full bg-sunken">
                  <UserMinus className="size-5" aria-hidden />
                </span>
                {tr(`${displayName(closedSpace.name)} ${leftVerb(closedSpace.gender)} из пары`, `${displayName(closedSpace.name)} left the pair`)}
              </Link>
            ) : (
              <Link
                href="/couple"
                className="tap -m-2 flex items-center gap-3.5 rounded-xl p-2 text-headline font-semibold text-accent transition-colors hover:bg-sunken"
              >
                <span className="flex size-11 items-center justify-center rounded-full bg-accent-soft">
                  <UserPlus className="size-5" aria-hidden />
                </span>
                {tr('Позвать партнёра', 'Invite your partner')}
              </Link>
            )}
          </motion.section>
        )}

        {/*
          Sealed: their day is there, but behind frosted glass — you can see that
          something waits without reading it. The lock and the blur say it; no sentence.
        */}
        {state === 'sealed' && (
          <motion.section
            key="sealed"
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98, transition: { duration: 0.25 } }}
            className="relative overflow-hidden rounded-2xl bg-surface p-5 shadow-card"
          >
            <div className="flex items-center gap-3.5">
              <span className="relative flex size-11 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-faint">
                <Lock className="size-4.5" aria-hidden />
                {partnerMarked && isToday && (
                  <span className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-partner ring-2 ring-surface">
                    <span className="sr-only">{tr('уже отмечен', 'already marked')}</span>
                  </span>
                )}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-headline font-semibold">{name}</h2>
                {clock && <ClockMeta clock={clock} />}
              </div>
            </div>
            <div aria-hidden className="mt-4 space-y-2 blur-[3px] select-none">
              <div className="h-3 w-11/12 rounded-full bg-sunken" />
              <div className="h-3 w-3/4 rounded-full bg-sunken" />
            </div>
            <span className="sr-only">{tr('Откроется, когда вы отметите свой день.', 'Opens once you mark your own day.')}</span>
          </motion.section>
        )}

        {state === 'waiting' && (
          <motion.section
            key="waiting"
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="rounded-2xl bg-surface p-5 shadow-card"
          >
            <div className="flex items-center gap-3.5">
              <span aria-hidden className="size-11 shrink-0 rounded-full border-2 border-dashed border-line-strong" />
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-headline font-semibold">{name}</h2>
                <p className="flex flex-wrap items-center gap-x-2 text-subhead text-ink-faint">
                  {tr(`${isToday ? 'Ещё не' : 'Не'} ${verb(partner?.gender, 'отметил')}`, isToday ? 'Not marked yet' : 'Not marked')}
                  {clock && <ClockMeta clock={clock} />}
                </p>
              </div>
            </div>
          </motion.section>
        )}

        {state === 'open' && entry && (
          <motion.section
            key="open"
            initial={playReveal ? { clipPath: 'circle(0% at 44px 44px)' } : false}
            animate={{ clipPath: 'circle(150% at 44px 44px)' }}
            transition={{ duration: 0.75, ease: EASE }}
            className="overflow-hidden rounded-2xl bg-surface shadow-card"
          >
            <div className="flex items-center gap-3 p-5 pb-3">
              <motion.span
                initial={playReveal ? { scale: 0.4 } : false}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 320, damping: 18, delay: playReveal ? 0.1 : 0 }}
                className="size-11 shrink-0 rounded-full shadow-card"
                style={{ backgroundColor: moodColor(entry.mood) }}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-headline font-semibold">
                  {name}
                  <span className="sr-only">, {moodColorName(entry.mood)}</span>
                </h2>
                {clock && <ClockMeta clock={clock} />}
              </div>
            </div>
            <motion.div
              initial={playReveal ? { opacity: 0, y: 8 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: playReveal ? 0.35 : 0, ease: EASE }}
              className="px-5 pb-5"
            >
              {entry.note && <p className="measure mb-4 text-body whitespace-pre-wrap text-ink-soft">{entry.note}</p>}
              {isToday && (
                <Link
                  href="/ping"
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-sunken px-4 text-subhead font-semibold text-accent transition-colors hover:bg-line"
                >
                  <Reply className="size-4" aria-hidden /> {tr('Ответить', 'Reply')}
                </Link>
              )}
            </motion.div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
