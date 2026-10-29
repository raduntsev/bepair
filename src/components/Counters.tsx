'use client';

import Link from 'next/link';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { Flame } from 'lucide-react';
import { daysWord, fmt, plural, todayISO } from '@/lib/dates';

/*
  Standalone full-width bands — nothing sits beside them. Days together is a
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
    <div className="-mx-5 grid gap-px overflow-hidden md:mx-0 md:grid-cols-2 md:gap-4">
      {together !== null && together > 0 ? (
        <section className="bg-accent-soft px-5 py-7 text-center md:rounded-2xl">
          <p className="text-5xl font-semibold tracking-tight text-accent-soft-ink tabular-nums">{together}</p>
          <p className="mt-1 text-sm font-medium text-accent-soft-ink">
            {plural(together, 'день', 'дня', 'дней')} вместе
          </p>
          <p className="mt-0.5 text-sm text-ink-faint">с {fmt(togetherSince!, 'd MMMM yyyy')}</p>
        </section>
      ) : (
        <section className="bg-accent-soft px-5 py-7 text-center md:rounded-2xl">
          <p className="text-sm font-medium text-accent-soft-ink">Сколько вы вместе?</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-ink-soft">Укажите день, который считаете началом, — здесь появится счёт.</p>
          <Link href="/couple" className="tap mt-2 inline-flex items-center px-2 text-sm font-medium text-accent-soft-ink underline underline-offset-4">
            Указать дату
          </Link>
        </section>
      )}

      {showStreak && (
        <section className="bg-partner-soft px-5 py-7 text-center md:rounded-2xl">
          <Flame className="mx-auto mb-1 size-5.5 text-partner" aria-hidden />
          <p className="text-5xl font-semibold tracking-tight text-partner-ink tabular-nums">{current}</p>
          <p className="mt-1 text-sm font-medium text-partner-ink">
            {current === 0 ? 'серия начнётся, когда вы оба отметите день' : `${daysWord(current)} подряд отметились оба`}
          </p>
          <p className="mt-0.5 text-sm text-ink-faint">
            {best > 0 ? `самая длинная серия — ${best} ${daysWord(best)}` : 'пропуск ничего не сбрасывает навсегда'}
          </p>
        </section>
      )}
    </div>
  );
}
