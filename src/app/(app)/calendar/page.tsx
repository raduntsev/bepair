'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight, Heart, Zap } from 'lucide-react';
import { MOOD_INK, moodColor } from '@/lib/mood';
import { fmt, sentence, todayISO } from '@/lib/dates';
import { Alert } from '@/components/ui/Blocks';
import { useMonthEntries, type DayMark } from '@/hooks/useMonthEntries';
import { useDayEvents } from '@/hooks/useDayEvents';
import { useImportantDates, useShowMoon } from '@/hooks/useImportantDates';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { occursOn, withAnniversary } from '@/lib/importantDates';
import { PRINCIPAL_LABEL, phasesBetween, type Principal } from '@/lib/moon';
import { ImportantDates } from '@/components/ImportantDates';
import { MoonGlyph } from '@/components/MoonGlyph';
import { CalendarDay } from '@/components/CalendarDay';
import { TIME_TABS, TabbedHeader } from '@/components/TabbedHeader';
import { tr } from '@/lib/i18n';

const PRINCIPAL_PHASE: Record<Principal, number> = { new: 0, first: 0.25, full: 0.5, last: 0.75 };

const WEEKDAYS = tr('пн вт ср чт пт сб вс', 'Mo Tu We Th Fr Sa Su').split(' ');

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

const EASE = [0.32, 0.72, 0, 1] as const;

/* The strip holds this many days either side of where it was opened; it re-centres before the edge. */
const STRIP_REACH = 150;
const STRIP_RECENTER = 110;
const VISIBLE_DAYS = 7;

/*
  A tapped day turns the month into one row of days that spins like a wheel:
  swipe and it runs on with momentum, snapping day by day. The day under the
  centre wears the ring while it turns; the one it stops on opens below.
*/
function DayStrip({
  days,
  selected,
  onSelect,
  renderCell,
  reduce,
}: {
  days: Date[];
  selected: string;
  onSelect: (key: string) => void;
  renderCell: (day: Date, centered: boolean) => React.ReactNode;
  reduce: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const cellW = width / VISIBLE_DAYS;
  const [center, setCenter] = useState<string | null>(null);
  const settleTimer = useRef<number | undefined>(undefined);
  /* What the scroll position already shows, so a settle does not scroll again. */
  const shown = useRef<{ key: string; layout: string } | null>(null);
  const layout = `${days.length ? iso(days[0]) : ''}:${cellW}`;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /* Bring the selected day to the centre: instantly on open or after the strip re-centres, smoothly after a tap or an arrow. */
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !cellW) return;
    const index = days.findIndex((d) => iso(d) === selected);
    if (index < 0) return;
    const previous = shown.current;
    if (previous && previous.key === selected && previous.layout === layout) return;
    const instant = !previous || previous.layout !== layout || reduce;
    el.scrollTo({ left: index * cellW, behavior: instant ? 'auto' : 'smooth' });
    shown.current = { key: selected, layout };
  }, [selected, layout, cellW, days, reduce]);

  const onScroll = () => {
    const el = ref.current;
    if (!el || !cellW || days.length === 0) return;
    const index = Math.max(0, Math.min(days.length - 1, Math.round(el.scrollLeft / cellW)));
    const key = iso(days[index]);
    if (key !== center) setCenter(key);
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      if (key === selected) return;
      shown.current = { key, layout };
      onSelect(key);
    }, 120);
  };

  const centered = center ?? selected;

  return (
    <div
      ref={ref}
      onScroll={onScroll}
      className="no-scrollbar -mx-1 snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
      style={{
        maskImage: 'linear-gradient(to right, transparent, #000 16%, #000 84%, transparent)',
        WebkitMaskImage: 'linear-gradient(to right, transparent, #000 16%, #000 84%, transparent)',
      }}
    >
      {cellW > 0 ? (
        <div className="flex py-2" style={{ paddingInline: (width - cellW) / 2 }}>
          {days.map((day) => {
            const key = iso(day);
            return (
              <div key={key} className="flex shrink-0 snap-center flex-col items-stretch px-1" style={{ width: cellW }}>
                <span className="pb-1.5 text-center text-footnote text-ink-faint" aria-hidden>
                  {WEEKDAYS[(day.getDay() + 6) % 7]}
                </span>
                {renderCell(day, key === centered)}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="h-20" />
      )}
    </div>
  );
}

export default function CalendarPage() {
  const reduce = useReducedMotion();
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  /*
    A tapped day: the month turns into a strip of days (DayStrip) and the day
    opens underneath. The strip spins day by day (a swipe, a tap or the
    arrows); the calendar icon brings the month back.
  */
  const [selected, setSelected] = useState<string | null>(null);
  const today = todayISO();

  const gridStart = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
  const gridKey = iso(gridStart);
  const days = useMemo(
    () => eachDayOfInterval({ start: gridStart, end: gridEnd }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the month: the dates are rebuilt every render
    [gridKey],
  );
  const weeks = useMemo(() => Array.from({ length: days.length / 7 }, (_, i) => days.slice(i * 7, i * 7 + 7)), [days]);

  /* The strip's span, around where it was opened; moved once the selection nears an edge. */
  const [anchor, setAnchor] = useState<string | null>(null);
  if (selected && (!anchor || Math.abs(differenceInCalendarDays(parseISO(selected), parseISO(anchor))) > STRIP_RECENTER)) {
    setAnchor(selected);
  }
  const stripDays = useMemo(() => {
    if (!anchor) return [];
    const start = addDays(parseISO(anchor), -STRIP_REACH);
    const end = addDays(parseISO(anchor), STRIP_REACH);
    return eachDayOfInterval({ start, end: iso(end) > today ? parseISO(today) : end });
  }, [anchor, today]);

  const strip = !!selected && stripDays.length > 0;
  const rangeFrom = strip ? iso(stripDays[0]) : iso(gridStart);
  const rangeTo = strip ? iso(stripDays[stripDays.length - 1]) : iso(gridEnd);

  const { marks, error, isLoading } = useMonthEntries(rangeFrom, rangeTo);
  const { settings } = useSpaceAuth();
  const events = useDayEvents(rangeFrom, rangeTo);
  const dates = useImportantDates();
  const { showMoon } = useShowMoon();
  const allDates = useMemo(() => withAnniversary(dates.items, settings?.together_since ?? null), [dates.items, settings?.together_since]);

  /* Principal phases only, on the local day they fall on: a quiet mark, not a lunar chart. */
  const moonByDay = useMemo(() => {
    const map: Record<string, Principal> = {};
    if (!showMoon) return map;
    for (const e of phasesBetween(parseISO(rangeFrom), addDays(parseISO(rangeTo), 1))) map[iso(e.at)] = e.kind;
    return map;
  }, [showMoon, rangeFrom, rangeTo]);
  const monthHasDays = days.some((day) => isSameMonth(day, cursor) && (marks[iso(day)]?.mineMarked || marks[iso(day)]?.theirsMarked));
  const isCurrentMonth = isSameMonth(cursor, new Date());

  const select = (key: string) => {
    const clamped = key > today ? today : key;
    setSelected(clamped);
    /* The month whose grid holds the day, so its week and marks are loaded. */
    setCursor(startOfMonth(parseISO(clamped)));
  };
  const shiftDay = (delta: number) => selected && select(iso(addDays(parseISO(selected), delta)));
  const canGoForward = !!selected && selected < today;
  const specialOn = (key: string) => allDates.filter((d) => occursOn(d, key));

  const cell = (day: Date, ringed = false) => {
    const key = iso(day);
    const outside = !selected && !isSameMonth(day, cursor);
    const isToday = key === today;
    const isFuture = key > today;
    const isSelected = key === selected;
    const mark = marks[key];
    const special = specialOn(key);
    const moon = moonByDay[key];
    const quarrel = events.has(key, 'quarrel');
    const intimacy = events.has(key, 'intimacy');

    return (
      <button
        key={key}
        type="button"
        disabled={isFuture}
        aria-pressed={selected ? isSelected : undefined}
        onClick={() => select(key)}
        aria-label={`${fmt(day, 'd MMMM yyyy')}${mark?.theirsMarked ? tr(', партнёр отметил день', ', partner marked the day') : ''}${mark?.mineMarked ? tr(', ваш день отмечен', ', your day is marked') : ''}${special.length ? `, ${special.map((d) => (d.id ? d.title : tr('годовщина', 'anniversary'))).join(', ')}` : ''}${moon ? `, ${PRINCIPAL_LABEL[moon]}` : ''}${quarrel ? tr(', ссора', ', a fight') : ''}${intimacy ? tr(', близость', ', intimacy') : ''}`}
        className={`relative flex aspect-square min-h-11 w-full items-center justify-center rounded-full text-sm font-medium transition-[background-color,box-shadow] enabled:hover:bg-sunken disabled:cursor-default ${
          special.length ? 'disabled:opacity-60' : 'disabled:opacity-30'
        } ${ringed ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface' : ''}`}
      >
        <DayCell mark={mark} muted={outside} />
        {special.length > 0 && (
          <span
            className="pointer-events-none absolute bottom-1 left-1/2 z-10 size-1.5 -translate-x-1/2 rounded-full bg-accent ring-[1.5px] ring-surface"
            aria-hidden
          />
        )}
        {/* The pair's marks: badges on the surface, so they read on any mood colour. Heart top-left, lightning bottom-right. */}
        {intimacy && (
          <span className="pointer-events-none absolute -top-0.5 -left-0.5 z-10 flex size-4 items-center justify-center rounded-full bg-surface text-ink shadow-card" aria-hidden>
            <Heart className="size-2.5" fill="currentColor" strokeWidth={0} />
          </span>
        )}
        {quarrel && (
          <span className="pointer-events-none absolute -right-0.5 -bottom-0.5 z-10 flex size-4 items-center justify-center rounded-full bg-surface text-ink shadow-card" aria-hidden>
            <Zap className="size-2.5" fill="currentColor" strokeWidth={0} />
          </span>
        )}
        {moon && <MoonGlyph phase={PRINCIPAL_PHASE[moon]} size={10} className="pointer-events-none absolute top-0.5 right-0.5 z-10 text-ink-soft" />}
        <span
          className={`relative z-10 ${mark?.theirsMood == null && outside ? 'text-ink-faint' : 'text-ink'} ${
            isToday ? 'font-bold underline decoration-2 underline-offset-4' : ''
          }`}
          style={mark?.theirsMood != null ? { color: MOOD_INK } : undefined}
        >
          {format(day, 'd')}
        </span>
      </button>
    );
  };

  const navButton = 'tap flex items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-sunken hover:text-ink disabled:opacity-30';

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-6 pb-8 sm:px-6 md:pt-12">
      <TabbedHeader id="time" title={tr('Календарь', 'Calendar')} tabs={TIME_TABS} current="/calendar" />

      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      <div data-tour="calendar-grid" className="rounded-2xl bg-surface p-3 shadow-card md:p-6">
        <div className="mb-5 flex items-center justify-between gap-2">
          <button
            type="button"
            aria-label={selected ? tr('Предыдущий день', 'Previous day') : tr('Предыдущий месяц', 'Previous month')}
            onClick={() => (selected ? shiftDay(-1) : setCursor((value) => addMonths(value, -1)))}
            className={navButton}
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>

          <h2 className="flex items-center gap-2 text-headline font-semibold" aria-live="polite">
            {selected ? fmt(selected, 'd MMMM') : sentence(fmt(cursor, 'LLLL yyyy'))}
          </h2>

          <div className="flex items-center gap-1">
            {selected && (
              <button type="button" aria-label={tr('Весь месяц', 'Whole month')} onClick={() => setSelected(null)} className={navButton}>
                <CalendarDays className="size-5" aria-hidden />
              </button>
            )}
            <button
              type="button"
              disabled={!!selected && !canGoForward}
              aria-label={selected ? tr('Следующий день', 'Next day') : tr('Следующий месяц', 'Next month')}
              onClick={() => (selected ? shiftDay(1) : setCursor((value) => addMonths(value, 1)))}
              className={navButton}
            >
              <ChevronRight className="size-5" aria-hidden />
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {strip && selected ? (
            <motion.div
              key="strip"
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduce ? undefined : { opacity: 0 }}
              transition={{ duration: 0.25, ease: EASE }}
            >
              <DayStrip days={stripDays} selected={selected} onSelect={select} renderCell={cell} reduce={!!reduce} />
            </motion.div>
          ) : (
            <motion.div
              key="month"
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduce ? undefined : { opacity: 0 }}
              transition={{ duration: 0.25, ease: EASE }}
            >
              <div className="grid grid-cols-7 gap-1">
                {WEEKDAYS.map((day) => (
                  <div key={day} className="pb-2 text-center text-subhead text-ink-faint">
                    {day}
                  </div>
                ))}
              </div>
              {weeks.map((week) => (
                <div key={iso(week[0])} className="grid grid-cols-7 gap-1 p-1">
                  {week.map((day) => cell(day))}
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {!selected && !isLoading && !error && !monthHasDays && (
          <p className="mt-4 rounded-xl bg-sunken px-4 py-3 text-center text-sm text-ink-soft">
            {isCurrentMonth
              ? tr('В этом месяце пока ни одного отмеченного дня. Начните с сегодняшнего.', 'No marked days this month yet. Start with today.')
              : tr('Этот месяц пуст. Дни появляются здесь, когда вы их отмечаете.', 'This month is empty. Days appear here as you mark them.')}
          </p>
        )}
        {!selected && !isCurrentMonth && (
          <div className="mt-3 flex justify-center">
            <button
              type="button"
              onClick={() => setCursor(startOfMonth(new Date()))}
              className="tap rounded-lg px-3 text-sm font-medium text-accent hover:underline"
            >
              {tr('К текущему месяцу', 'To this month')}
            </button>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {selected && (
          <motion.div
            key={selected}
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="mt-3"
          >
            <CalendarDay
              date={selected}
              quarrel={events.has(selected, 'quarrel')}
              intimacy={events.has(selected, 'intimacy')}
              special={specialOn(selected).map((d) => (d.id ? d.title : tr('Годовщина', 'Anniversary')))}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {!selected && (
      <>
      <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3 text-subhead text-ink-soft">
        <span className="flex items-center gap-2">
          <span className="size-5 rounded-full ring-[2.5px] ring-inset ring-line-strong" aria-hidden />
          {tr('ваш день', 'your day')}
        </span>
        <span className="flex items-center gap-2">
          <span className="size-5 rounded-full bg-sunken" aria-hidden />
          {tr('день партнёра', 'partner’s day')}
        </span>
        <span className="flex items-center gap-2">
          <span className="size-5 rounded-full bg-sunken ring-[2.5px] ring-inset ring-line-strong" aria-hidden />
          {tr('отметились оба', 'both marked')}
        </span>
        {allDates.length > 0 && (
          <span className="flex items-center gap-2">
            <span className="flex size-5 items-center justify-center" aria-hidden>
              <span className="size-1.5 rounded-full bg-accent" />
            </span>
            {tr('важная дата', 'important date')}
          </span>
        )}
        {events.available && (
          <span className="flex items-center gap-2">
            <span className="flex size-5 items-center justify-center" aria-hidden>
              <Zap className="size-3.5 text-ink" fill="currentColor" strokeWidth={0} />
            </span>
            {tr('ссора', 'a fight')}
          </span>
        )}
        {events.intimacyOn && (
          <span className="flex items-center gap-2">
            <span className="flex size-5 items-center justify-center" aria-hidden>
              <Heart className="size-3.5 text-ink" fill="currentColor" strokeWidth={0} />
            </span>
            {tr('близость', 'intimacy')}
          </span>
        )}
        {showMoon && (
          <span className="flex items-center gap-2">
            <MoonGlyph phase={0.5} size={14} className="text-ink-soft" />
            {tr('главные фазы луны', 'main moon phases')}
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
      </>
      )}
    </div>
  );
}
