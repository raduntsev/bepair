import { tr } from '@/lib/i18n';

/*
  Questions that help describe a day, shown under the note before you mark it.
  They are thinking aids, not a form: nothing is stored about which one you
  read or answered, so the partner never sees it. None asks for a scale and
  none implies a right answer — if a question makes you want to answer just so
  it goes away, it does not belong here.

  Four a day, picked by the date, so both partners see the same four.
*/
export const DAY_PROMPTS = [
  tr('Что сегодня занимало больше всего места в голове?', 'What took up most of your mind today?'),
  tr('Был ли момент, когда стало легче?', 'Was there a moment when it got easier?'),
  tr('Что сегодня забирало силы, а что их возвращало?', 'What drained you today, and what gave strength back?'),
  tr('О чём хотелось рассказать, но было некому?', 'What did you want to tell someone, with no one to tell?'),
  tr('Что из сегодняшнего хочется сохранить, а что — отпустить?', 'What from today do you want to keep, and what to let go?'),
  tr('Когда сегодня вы были больше всего собой?', 'When were you most yourself today?'),
  tr('Что вы хотели бы, чтобы партнёр знал о вашем дне?', 'What would you like your partner to know about your day?'),
  tr('Что сегодня удивило?', 'What surprised you today?'),
  tr('Какая мелочь запомнилась?', 'What small thing stayed with you?'),
  tr('Чего сегодня не хватило?', 'What was missing today?'),
  tr('С каким чувством вы заканчиваете этот день?', 'What feeling are you ending this day with?'),
  tr('Чего хочется от завтра?', 'What do you want from tomorrow?'),
];

export const PROMPTS_PER_DAY = 4;

/* Small deterministic generator: same date, same order, on every device. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function promptsFor(isoDate: string, count = PROMPTS_PER_DAY): string[] {
  let hash = 0;
  for (const ch of isoDate) hash = (Math.imul(hash, 31) + ch.charCodeAt(0)) | 0;
  const rand = seeded(hash);
  const pool = [...DAY_PROMPTS];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}
