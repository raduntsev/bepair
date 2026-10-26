import { addDays, parseISO } from 'date-fns';
import { isoDate } from './dates';

/*
  «Комбо» counts days on which both of you marked. It shows a coincidence, not
  an achievement: today does not break the run until today is over, and the
  longest run sits beside the current one so a gap never reads as a loss.
*/
export function streaks(bothDates: Set<string>, today: string) {
  let current = 0;
  let cursor = parseISO(today);
  if (!bothDates.has(today)) cursor = addDays(cursor, -1);
  while (bothDates.has(isoDate(cursor))) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  let best = 0;
  let run = 0;
  let previous: string | null = null;
  for (const date of [...bothDates].sort()) {
    run = previous && isoDate(addDays(parseISO(previous), 1)) === date ? run + 1 : 1;
    best = Math.max(best, run);
    previous = date;
  }

  return { current, best: Math.max(best, current) };
}
