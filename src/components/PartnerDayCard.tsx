'use client';

import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Clock, Lock, UserPlus } from 'lucide-react';
import { moodColor, moodLabel } from '@/lib/mood';
import { timeIn } from '@/lib/dates';
import { displayName, verb } from '@/lib/words';
import type { DayEntry } from '@/hooks/useCoupleDay';
import type { Partner } from '@/hooks/useSpaceAuth';

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

export function PartnerDayCard({ partner, entry, isUnlocked, isToday, showTime, justUnsealed, partnerMarked }: PartnerDayCardProps) {
  const reduce = useReducedMotion();
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
  const clockLine = clock ? (
    <p className="mt-3 flex items-center gap-1.5 text-sm text-ink-faint">
      <Clock className="size-4" aria-hidden /> Сейчас у партнёра {clock}
    </p>
  ) : null;

  return (
    <div aria-live="polite">
      <AnimatePresence mode="wait" initial={false}>
        {state === 'alone' && (
          <motion.section
            key="alone"
            exit={{ opacity: 0 }}
            className="rounded-2xl border border-dashed border-line-strong bg-surface p-6"
          >
            <h2 className="font-semibold">Пока вы здесь один</h2>
            <p className="mt-1.5 text-sm text-ink-soft">Позовите партнёра — тогда здесь появится его день.</p>
            <Link
              href="/settings"
              className="tap mt-3 -ml-2 inline-flex items-center gap-2 rounded-lg px-2 text-sm font-medium text-accent hover:underline"
            >
              <UserPlus className="size-4" aria-hidden /> Позвать партнёра
            </Link>
          </motion.section>
        )}

        {state === 'sealed' && (
          <motion.section
            key="sealed"
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98, transition: { duration: 0.18 } }}
            className="rounded-2xl border border-line bg-partner-soft p-6"
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-partner shadow-card">
                <Lock className="size-4.5" aria-hidden />
              </span>
              <div>
                <h2 className="font-semibold">{name}</h2>
                <p className="mt-1.5 text-sm text-ink-soft">
                  {!isToday
                    ? 'Этот день остался закрытым: вы его не отметили.'
                    : partnerMarked
                      ? `${name} уже ${verb(partner?.gender, 'отметил')} свой день. Теперь ваша очередь: день откроется, как только вы отметите свой.`
                      : 'День откроется, как только вы отметите свой. Так вы оба говорите первыми.'}
                </p>
              </div>
            </div>
            {clockLine}
          </motion.section>
        )}

        {state === 'waiting' && (
          <motion.section
            key="waiting"
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="rounded-2xl border border-line bg-surface p-6 shadow-card"
          >
            <h2 className="font-semibold">
              {name} {isToday ? 'ещё не' : 'не'} {verb(partner?.gender, 'отметил')} {isToday ? 'день' : 'этот день'}
            </h2>
            <p className="mt-1.5 text-sm text-ink-soft">
              {isToday ? 'Вы узнаете об этом — приходить и проверять не нужно.' : 'Так бывает. Пустой день — тоже часть истории.'}
            </p>
            {clockLine}
          </motion.section>
        )}

        {state === 'open' && entry && (
          <motion.section
            key="open"
            initial={playReveal ? { clipPath: 'circle(0% at 44px 44px)' } : false}
            animate={{ clipPath: 'circle(150% at 44px 44px)' }}
            transition={{ duration: 0.75, ease: EASE }}
            className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card"
          >
            <div className="flex items-center gap-3 p-6 pb-4">
              <motion.span
                initial={playReveal ? { scale: 0.4 } : false}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 320, damping: 18, delay: playReveal ? 0.1 : 0 }}
                className="size-11 shrink-0 rounded-full border-2 border-surface shadow-card"
                style={{ backgroundColor: moodColor(entry.mood) }}
                aria-hidden
              />
              <div>
                <h2 className="font-semibold">{name}</h2>
                <p className="text-sm text-ink-soft">день {moodLabel(entry.mood)}</p>
              </div>
            </div>
            <motion.div
              initial={playReveal ? { opacity: 0, y: 8 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: playReveal ? 0.35 : 0, ease: EASE }}
              className="px-6 pb-6"
            >
              {entry.note ? (
                <p className="measure text-[15px] leading-relaxed whitespace-pre-wrap text-ink-soft">{entry.note}</p>
              ) : (
                <p className="text-sm text-ink-faint">Без заметки — только цвет.</p>
              )}
              {clockLine}
            </motion.div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
