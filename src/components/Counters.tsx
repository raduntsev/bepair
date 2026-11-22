'use client';

import Link from 'next/link';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { fmt, plural, todayISO } from '@/lib/dates';
import { tr } from '@/lib/i18n';

/*
  Two small tiles on the couple's profile. Days together is a
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
          <p className="text-footnote font-medium text-accent">{tr('Вместе', 'Together')}</p>
          <p className="mt-1 text-title-1 font-bold tabular-nums">{together}</p>
          <p className="text-footnote text-ink-faint">
            {tr(`${plural(together, 'день', 'дня', 'дней')} · с ${fmt(togetherSince!, 'd MMM yyyy')}`, `${together === 1 ? 'day' : 'days'} · since ${fmt(togetherSince!, 'd MMM yyyy')}`)}
          </p>
        </section>
      ) : (
        <Link href="/couple" className="rounded-2xl bg-surface p-4 shadow-card transition-colors hover:bg-sunken">
          <p className="text-footnote font-medium text-accent">{tr('Вместе', 'Together')}</p>
          <p className="mt-1 text-headline font-semibold">{tr('Сколько?', 'How long?')}</p>
        </Link>
      )}

      {showStreak && (
        <section className="rounded-2xl bg-surface p-4 shadow-card">
          <p className="text-footnote font-medium text-partner-ink">{tr('Отмечаете вместе', 'Marking together')}</p>
          <p className="mt-1 text-title-1 font-bold tabular-nums">{current}</p>
          <p className="text-footnote text-ink-faint">
            {tr(`${plural(current, 'день', 'дня', 'дней')} подряд`, `${current === 1 ? 'day' : 'days'} in a row`)}{best > current ? tr(` · рекорд ${best}`, ` · best ${best}`) : ''}
          </p>
        </section>
      )}
    </div>
  );
}
