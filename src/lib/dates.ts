import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';

/* The local calendar date, which is what "today" means to the person holding the phone. */
export function todayISO(date: Date = new Date()) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

export function isoDate(date: Date) {
  return format(date, 'yyyy-MM-dd');
}

export function localTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

/*
  Russian capitalises the first word of a sentence, not every word. CSS
  `capitalize` produced «Среда, 5 Августа 2026»; this produces «Среда, 5 августа 2026».
*/
export function sentence(text: string) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

export function fmt(value: string | Date, pattern: string) {
  const date = typeof value === 'string' ? parseISO(value) : value;
  return format(date, pattern, { locale: ru });
}

export function longDate(value: string | Date) {
  return sentence(fmt(value, 'EEEE, d MMMM yyyy'));
}

/* «21:40», «вчера, 21:40», «4 августа, 21:40» — the way people say it. */
export function relativeStamp(value: string) {
  const date = parseISO(value);
  const days = differenceInCalendarDays(new Date(), date);
  if (days === 0) return format(date, 'HH:mm');
  if (days === 1) return `вчера, ${format(date, 'HH:mm')}`;
  return format(date, 'd MMMM, HH:mm', { locale: ru });
}

export function plural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export const points = (n: number) => `${n} ${plural(n, 'балл', 'балла', 'баллов')}`;
export const daysWord = (n: number) => plural(n, 'день', 'дня', 'дней');

/* The partner's wall clock, for couples who live apart. */
export function timeIn(timezone: string | null | undefined) {
  if (!timezone) return null;
  try {
    return new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: timezone }).format(
      new Date(),
    );
  } catch {
    return null;
  }
}
