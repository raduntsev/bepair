'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MOOD_INK, moodColor } from '@/lib/mood';
import { sentence, todayISO } from '@/lib/dates';
import { Alert } from '@/components/ui/Blocks';
import { useMonthEntries, type DayMark } from '@/hooks/useMonthEntries';
import { useImportantDates, useShowMoon } from '@/hooks/useImportantDates';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { occursOn, withAnniversary } from '@/lib/importantDates';
import { PRINCIPAL_LABEL, phasesBetween, type Principal } from '@/lib/moon';
import { ImportantDates } from '@/components/ImportantDates';
import { MoonGlyph } from '@/components/MoonGlyph';

const PRINCIPAL_PHASE: Record<Principal, number> = { new: 0, first: 0.25, full: 0.5, last: 0.75 };

const WEEKDAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];

function iso(date: Date) {
  return format(date, 'yyyy-MM-dd');
}

/*
  Not a heatmap. Two independent channels so "both" never splits the cell:
  a filled disc is the partner's day (raised contrast — it is the one you
  came to see), a ring is your own. Both marked = a disc inside a ring.
*/
function DayCell({ mark, muted }: { mark: DayMark | undefined; muted: boolean }) {
  const theirs = mark?.theirsMarked ?? false;
  const mine = mark?.mineMarked ?? false;
  const theirColor = mark?.theirsMood != null ? moodColor(mark.theirsMood) : null;
  const myColor = mark?.mineMood != null ? moodColor(mark.mineMood) : null;

  return (
    <span
      className="pointer-events-none absolute inset-1 rounded-full transition-colors"
      style={{
        backgroundColor: theirs ? (theirColor ?? 'var(--c-surface-sunken)') : 'transparent',
        boxShadow: mine
          ? `inset 0 0 0 2.5px ${myColor ?? 'var(--c-border-strong)'}`
          : undefined,
        opacity: muted ? 0.4 : 1,
      }}
    />
  );
}

export default function CalendarPage() {
  const router = useRouter();
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const today = todayISO();

  const gridStart = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
  const days = useMemo(
    () => eachDayOfInterval({ start: gridStart, end: gridEnd }),
    [gridStart, gridEnd],
  );

  const { marks, error, isLoading } = useMonthEntries(iso(gridStart), iso(gridEnd));
  const { settings } = useSpaceAuth();
  const dates = useImportantDates();
  const { showMoon } = useShowMoon();
  const allDates = useMemo(() => withAnniversary(dates.items, settings?.together_since ?? null), [dates.items, settings?.together_since]);

  /* Principal phases only, on the local day they fall on: a quiet mark, not a lunar chart. */
  const moonByDay = useMemo(() => {
    const map: Record<string, Principal> = {};
    if (!showMoon) return map;
    for (const e of phasesBetween(gridStart, new Date(gridEnd.getTime() + 86400000))) map[iso(e.at)] = e.kind;
    return map;
  }, [showMoon, gridStart, gridEnd]);
  const monthHasDays = days.some((day) => isSameMonth(day, cursor) && (marks[iso(day)]?.mineMarked || marks[iso(day)]?.theirsMarked));
  const isCurrentMonth = isSameMonth(cursor, new Date());

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-7 md:px-8 md:py-10">
      <header className="mb-7">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Календарь</h1>
        <p className="mt-1 text-sm text-ink-faint">Все ваши дни. Нажмите на день, чтобы открыть его.</p>
      </header>

      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      <div className="rounded-2xl border border-line bg-surface p-3 shadow-card md:p-6">
        <div className="mb-5 flex items-center justify-between">
          <button
            type="button"
            aria-label="Предыдущий месяц"
            onClick={() => setCursor((value) => addMonths(value, -1))}
            className="tap flex items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-sunken hover:text-ink"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>

          <h2 className="text-base font-semibold" aria-live="polite">
            {sentence(format(cursor, 'LLLL yyyy', { locale: ru }))}
          </h2>

          <button
            type="button"
            aria-label="Следующий месяц"
            onClick={() => setCursor((value) => addMonths(value, 1))}
            className="tap flex items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-sunken hover:text-ink"
          >
            <ChevronRight className="size-5" aria-hidden />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((day) => (
            <div key={day} className="pb-2 text-center text-xs font-medium text-ink-faint">
              {day}
            </div>
          ))}

          {days.map((day) => {
            const key = iso(day);
            const outside = !isSameMonth(day, cursor);
            const isToday = key === today;
            const isFuture = key > today;
            const mark = marks[key];
            const special = allDates.filter((d) => occursOn(d, key));
            const moon = moonByDay[key];

            return (
              <button
                key={key}
                type="button"
                disabled={isFuture}
                onClick={() => router.push(`/day?d=${key}`)}
                aria-label={`${format(day, 'd MMMM yyyy', { locale: ru })}${mark?.theirsMarked ? ', партнёр отметил день' : ''}${mark?.mineMarked ? ', ваш день отмечен' : ''}${special.length ? `, ${special.map((d) => (d.id ? d.title : 'годовщина')).join(', ')}` : ''}${moon ? `, ${PRINCIPAL_LABEL[moon]}` : ''}`}
                className={`relative flex aspect-square min-h-11 items-center justify-center rounded-full text-sm font-medium transition-colors enabled:hover:bg-sunken disabled:cursor-default ${
                  special.length ? 'disabled:opacity-60' : 'disabled:opacity-30'
                }`}
              >
                <DayCell mark={mark} muted={outside} />
                {special.length > 0 && (
                  <span
                    className="pointer-events-none absolute bottom-1 left-1/2 z-10 size-1.5 -translate-x-1/2 rounded-full bg-accent ring-[1.5px] ring-surface"
                    aria-hidden
                  />
                )}
                {moon && (
                  <MoonGlyph phase={PRINCIPAL_PHASE[moon]} size={10} className="pointer-events-none absolute top-0.5 right-0.5 z-10 text-ink-soft" />
                )}
                <span
                  className={`relative z-10 ${
                    mark?.theirsMood == null && outside ? 'text-ink-faint' : 'text-ink'
                  } ${isToday ? 'font-bold underline decoration-2 underline-offset-4' : ''}`}
                  style={mark?.theirsMood != null ? { color: MOOD_INK } : undefined}
                >
                  {format(day, 'd')}
                </span>
              </button>
            );
          })}
        </div>

        {!isLoading && !error && !monthHasDays && (
          <p className="mt-4 rounded-xl bg-sunken px-4 py-3 text-center text-sm text-ink-soft">
            {isCurrentMonth
              ? 'В этом месяце пока ни одного отмеченного дня. Начните с сегодняшнего.'
              : 'Этот месяц пуст. Дни появляются здесь, когда вы их отмечаете.'}
          </p>
        )}
        {!isCurrentMonth && (
          <div className="mt-3 flex justify-center">
            <button
              type="button"
              onClick={() => setCursor(startOfMonth(new Date()))}
              className="tap rounded-lg px-3 text-sm font-medium text-accent hover:underline"
            >
              К текущему месяцу
            </button>
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3 text-sm text-ink-soft">
        <span className="flex items-center gap-2">
          <span className="size-5 rounded-full ring-[2.5px] ring-inset ring-line-strong" aria-hidden />
          ваш день
        </span>
        <span className="flex items-center gap-2">
          <span className="size-5 rounded-full bg-sunken" aria-hidden />
          день партнёра
        </span>
        <span className="flex items-center gap-2">
          <span className="size-5 rounded-full bg-sunken ring-[2.5px] ring-inset ring-line-strong" aria-hidden />
          отметились оба
        </span>
        {allDates.length > 0 && (
          <span className="flex items-center gap-2">
            <span className="flex size-5 items-center justify-center" aria-hidden>
              <span className="size-1.5 rounded-full bg-accent" />
            </span>
            важная дата
          </span>
        )}
        {showMoon && (
          <span className="flex items-center gap-2">
            <MoonGlyph phase={0.5} size={14} className="text-ink-soft" />
            главные фазы луны
          </span>
        )}
      </div>

      {dates.available && (
        <div className="mt-6">
          <ImportantDates
            items={dates.items}
            togetherSince={settings?.together_since ?? null}
            error={dates.error}
            onAdd={dates.add}
            onRemove={dates.remove}
          />
        </div>
      )}
    </div>
  );
}
