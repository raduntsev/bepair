import { differenceInCalendarDays, differenceInYears, isLeapYear, parseISO } from 'date-fns';
import { plural } from '@/lib/dates';

export interface ImportantDate {
  id: string;
  title: string;
  date: string;
  yearly: boolean;
  created_by: string | null;
}

export interface Occurrence {
  id: string | null;
  title: string;
  /* The day it falls on next (or the day itself, for a one-off). */
  on: string;
  inDays: number;
  /* Synthesised from «дней вместе»: cannot be deleted from the list. */
  derived: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');

/* A yearly 29 February is kept on 28 February in ordinary years. */
function inYear(date: string, year: number) {
  const [, m, d] = date.split('-').map(Number);
  const day = m === 2 && d === 29 && !isLeapYear(new Date(year, 0, 1)) ? 28 : d;
  return `${year}-${pad(m)}-${pad(day)}`;
}

export function occursOn(item: Pick<ImportantDate, 'date' | 'yearly'>, iso: string) {
  if (!item.yearly) return item.date === iso;
  if (iso < item.date) return false;
  return inYear(item.date, Number(iso.slice(0, 4))) === iso;
}

function nextOccurrence(item: Pick<ImportantDate, 'date' | 'yearly'>, today: string) {
  if (!item.yearly) return item.date >= today ? item.date : null;
  const year = Number(today.slice(0, 4));
  const thisYear = inYear(item.date, year);
  const next = thisYear >= today ? thisYear : inYear(item.date, year + 1);
  return next >= item.date ? next : item.date;
}

/* The start of «дней вместе» doubles as a yearly anniversary. */
export function withAnniversary(items: ImportantDate[], togetherSince: string | null): ImportantDate[] {
  if (!togetherSince) return items;
  return [...items, { id: '', title: 'Годовщина', date: togetherSince, yearly: true, created_by: null }];
}

export function upcoming(items: ImportantDate[], today: string, horizonDays = 366): Occurrence[] {
  return items
    .map((item) => {
      const on = nextOccurrence(item, today);
      if (!on) return null;
      const inDays = differenceInCalendarDays(parseISO(on), parseISO(today));
      let title = item.title;
      if (!item.id) {
        const years = differenceInYears(parseISO(on), parseISO(item.date));
        title = years > 0 ? `${years} ${plural(years, 'год', 'года', 'лет')} вместе` : 'Начало';
      }
      return { id: item.id || null, title, on, inDays, derived: !item.id };
    })
    .filter((o): o is Occurrence => !!o && o.inDays <= horizonDays)
    .sort((a, b) => a.inDays - b.inDays);
}

export function whenText(inDays: number) {
  if (inDays === 0) return 'сегодня';
  if (inDays === 1) return 'завтра';
  return `через ${inDays} ${plural(inDays, 'день', 'дня', 'дней')}`;
}
