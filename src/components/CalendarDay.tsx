'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarHeart, Check, ChevronRight, Heart, Pencil, Users, Zap } from 'lucide-react';
import supabase from '@/lib/supabase';
import { moodColor, moodColorName } from '@/lib/mood';
import { displayName } from '@/lib/words';
import { useCoupleDay } from '@/hooks/useCoupleDay';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { yesterdayISO } from '@/lib/dates';
import { PartnerDayCard } from '@/components/PartnerDayCard';
import { tr } from '@/lib/i18n';

/*
  One day from the calendar, opened under the week strip: what the home screen
  held that day — your day, your partner's (under the same reciprocity rule),
  the pair's marks, an important date, what you did for each other, the
  check-in. Letters stay in their own place.
*/

interface DoneTask {
  id: string;
  user_id: string;
  completed_by: string | null;
  content: string;
}

function useTasksDoneOn(date: string) {
  const { spaceId } = useSpaceAuth();
  const [tasks, setTasks] = useState<DoneTask[]>([]);
  useEffect(() => {
    if (!spaceId) return;
    let alive = true;
    /* The local day's bounds, so «done that day» means the day as the person lived it. */
    const from = new Date(`${date}T00:00:00`).toISOString();
    const to = new Date(`${date}T23:59:59.999`).toISOString();
    supabase
      .from('checklist_items')
      .select('id, user_id, completed_by, content')
      .eq('space_id', spaceId)
      .eq('is_completed', true)
      .gte('completed_at', from)
      .lte('completed_at', to)
      .order('completed_at')
      .then(({ data }) => alive && setTasks((data ?? []) as DoneTask[]));
    return () => {
      alive = false;
    };
  }, [spaceId, date]);
  return tasks;
}

function usePlanerkaOn(date: string) {
  const { spaceId } = useSpaceAuth();
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (!spaceId) return;
    let alive = true;
    supabase
      .from('planerkas')
      .select('id')
      .eq('space_id', spaceId)
      .eq('held_on', date)
      .maybeSingle()
      .then(({ data }) => alive && setHeld(!!data));
    return () => {
      alive = false;
    };
  }, [spaceId, date]);
  return held;
}

export function CalendarDay({
  date,
  quarrel,
  intimacy,
  special,
}: {
  date: string;
  quarrel: boolean;
  intimacy: boolean;
  special: string[];
}) {
  const { user } = useSpaceAuth();
  const { partner, mine, theirs, isLoading, isUnlocked, isToday } = useCoupleDay(date);
  const done = useTasksDoneOn(date);
  const planerka = usePlanerkaOn(date);
  const partnerName = displayName(partner?.display_name);

  if (isLoading) return <div className="h-40 animate-pulse rounded-2xl bg-surface shadow-card" aria-hidden />;

  return (
    <div className="flex flex-col gap-3">
      {special.length > 0 && (
        <p className="inline-flex min-h-9 w-fit items-center gap-2 rounded-full bg-accent-soft px-3.5 text-subhead font-medium text-accent-soft-ink">
          <CalendarHeart className="size-4" aria-hidden />
          {special.join(', ')}
        </p>
      )}

      <section className="rounded-2xl bg-surface p-5 shadow-card">
        <div className="flex items-center gap-3.5">
          {mine ? (
            <span aria-hidden className="size-11 shrink-0 rounded-full shadow-card" style={{ backgroundColor: moodColor(mine.mood) }} />
          ) : (
            <span aria-hidden className="size-11 shrink-0 rounded-full border-2 border-dashed border-line-strong" />
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-headline font-semibold">
              {tr('Ваш день', 'Your day')}
              {mine && <span className="sr-only">, {moodColorName(mine.mood)}</span>}
            </h2>
            {!mine && <p className="text-subhead text-ink-faint">{tr('Не отмечен', 'Not marked')}</p>}
          </div>
          {quarrel && (
            <span role="img" aria-label={tr('Ссора', 'A fight')} title={tr('Ссора', 'A fight')} className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sunken text-ink">
              <Zap className="size-4.5" fill="currentColor" aria-hidden />
            </span>
          )}
          {intimacy && (
            <span role="img" aria-label={tr('Близость', 'Intimacy')} title={tr('Близость', 'Intimacy')} className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sunken text-ink">
              <Heart className="size-4.5" fill="currentColor" aria-hidden />
            </span>
          )}
          {/* Today and yesterday can still be filled in or changed (0026). */}
          {(isToday || date === yesterdayISO()) && (
            <Link
              href={isToday ? '/day' : `/day?d=${date}`}
              aria-label={mine ? tr('Изменить', 'Edit') : tr('Отметить день', 'Mark the day')}
              className="flex size-10 shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-sunken hover:text-ink"
            >
              <Pencil className="size-4.5" aria-hidden />
            </Link>
          )}
        </div>
        {mine?.note && <p className="measure mt-3 text-body whitespace-pre-wrap text-ink-soft">{mine.note}</p>}
      </section>

      <PartnerDayCard partner={partner} entry={theirs} isUnlocked={isUnlocked} isToday={isToday} />

      {done.length > 0 && user && (
        <section className="overflow-hidden rounded-2xl bg-surface shadow-card">
          <h3 className="px-4 pt-4 pb-1 text-headline font-semibold">{tr('Сделали друг для друга', 'Done for each other')}</h3>
          <ul className="pb-2">
            {done.map((task) => {
              const byMe = task.completed_by === user.id;
              return (
                <li key={task.id} className="flex min-h-11 items-center gap-3.5 px-4 py-1.5">
                  <span
                    aria-hidden
                    className={`flex size-[1.625rem] shrink-0 items-center justify-center rounded-full ${byMe ? 'bg-accent text-accent-ink' : 'bg-partner text-white'}`}
                  >
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                  <span className="min-w-0 flex-1 text-body text-ink">{task.content}</span>
                  <span className="shrink-0 text-subhead text-ink-faint">{byMe ? tr('вы', 'you') : partnerName}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {planerka && (
        <Link
          href={`/planerka/session?d=${date}`}
          className="flex items-center gap-3.5 rounded-2xl bg-surface p-4 shadow-card transition-colors hover:bg-sunken"
        >
          <span aria-hidden className="flex size-10 items-center justify-center rounded-full bg-sunken text-ink-soft">
            <Users className="size-4.5" />
          </span>
          <span className="min-w-0 flex-1 text-body font-semibold">{tr('Планёрка', 'Weekly check-in')}</span>
          <ChevronRight className="size-5 text-line-strong" aria-hidden />
        </Link>
      )}
    </div>
  );
}
