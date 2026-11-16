'use client';

import Link from 'next/link';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { Flame } from 'lucide-react';
import { daysWord, fmt, plural, todayISO } from '@/lib/dates';

/*
  Two small tiles at the foot of «Сегодня», after the Fitness summary. Days together is a
  quiet fact about the couple, not an engagement metric; the run shows a
  coincidence, and the longest run sits next to it so a gap never reads as a loss.
*/
export function Counters({
  togetherSince,
  showStreak,
  current,
  best,
}: {
  togetherSince: string | null;
  showStreak: boolean;
  current: number;
  best: number;
}) {
  const together = togetherSince ? differenceInCalendarDays(parseISO(todayISO()), parseISO(togetherSince)) + 1 : null;

  return (
    <div className="mt-5 grid grid-cols-2 gap-3">
      {together !== null && together > 0 ? (
        <section className="rounded-2xl bg-surface p-4 shadow-card">
          <p className="text-footnote font-medium text-accent">Вместе</p>
          <p className="mt-1 text-title-1 font-bold tabular-nums">{together}</p>
          <p className="text-footnote text-ink-faint">
            {plural(together, 'день', 'дня', 'дней')} · с {fmt(togetherSince!, 'd MMM yyyy')}
          </p>
        </section>
      ) : (
        <Link href="/couple" className="rounded-2xl bg-surface p-4 shadow-card transition-colors hover:bg-sunken">
          <p className="text-footnote font-medium text-accent">Вместе</p>
          <p className="mt-1 text-headline font-semibold">Сколько?</p>
          <p className="text-footnote text-ink-faint">Укажите дату начала</p>
        </Link>
      )}

      {showStreak && (
        <section className="rounded-2xl bg-surface p-4 shadow-card">
          <p className="flex items-center gap-1 text-footnote font-medium text-partner-ink">
            <Flame className="size-3.5" aria-hidden /> Подряд оба
          </p>
          <p className="mt-1 text-title-1 font-bold tabular-nums">{current}</p>
          <p className="text-footnote text-ink-faint">
            {current === 0 ? 'начнётся, когда отметитесь оба' : best > current ? `рекорд — ${best} ${daysWord(best)}` : daysWord(current)}
          </p>
        </section>
      )}
    </div>
  );
}
