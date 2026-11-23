import { tr } from '@/lib/i18n';

/*
  «Планёрка» — the couple's weekly sit-down. The spheres and questions are the
  ones the couple already used in their spreadsheet, kept word for word so a
  year of history reads as one continuous record.
*/

/* `short` is for the radar, where a full label would be cut at the edge of the chart. */
export const SPHERES = [
  { key: 'physical', label: tr('Здоровье тела', 'Physical health'), short: tr('Тело', 'Body') },
  { key: 'mental', label: tr('Душевное состояние', 'Peace of mind'), short: tr('Душа', 'Mind') },
  { key: 'family', label: tr('Друзья и семья', 'Friends and family'), short: tr('Близкие', 'People') },
  { key: 'romance', label: tr('Романтика', 'Romance'), short: tr('Романтика', 'Romance') },
  { key: 'career', label: tr('Работа', 'Work'), short: tr('Работа', 'Work') },
  { key: 'finances', label: tr('Финансы', 'Money'), short: tr('Финансы', 'Money') },
  { key: 'growth', label: tr('Личный рост', 'Personal growth'), short: tr('Рост', 'Growth') },
] as const;

export type SphereKey = (typeof SPHERES)[number]['key'];
export type Scores = Partial<Record<SphereKey, number>>;
/* Why a sphere got its score — one short note per sphere, keyed like Scores. */
export type Comments = Partial<Record<SphereKey, string>>;

export const QUESTIONS = [
  { key: 'feel', label: tr('Как ты себя чувствуешь в этих отношениях сейчас?', 'How do you feel in this relationship right now?') },
  { key: 'change', label: tr('Что бы ты хотел(а) изменить?', 'What would you like to change?') },
  { key: 'enough', label: tr('Всего ли тебе достаточно?', 'Do you have enough of everything?') },
  { key: 'love', label: tr('Люблю, когда ты…', 'I love it when you…') },
] as const;

export type QuestionKey = (typeof QUESTIONS)[number]['key'];

export const WEEKDAYS = tr('Воскресенье Понедельник Вторник Среда Четверг Пятница Суббота', 'Sunday Monday Tuesday Wednesday Thursday Friday Saturday').split(' ');
export const WEEKDAYS_SHORT = tr('Вс Пн Вт Ср Чт Пт Сб', 'Su Mo Tu We Th Fr Sa').split(' ');

export function average(scores: Scores | undefined) {
  const values = SPHERES.map((s) => scores?.[s.key]).filter((v): v is number => typeof v === 'number');
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

/* Local calendar date, not UTC: a Sunday-evening session must land on Sunday. */
export function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/*
  The planerka week: from the last session held (today included) to the next
  meeting day. A to-do set at a session is meant for this week; one still open
  from before the last session has been carried over.
*/
export interface PlanerkaWeek {
  /* held_on of the last session on or before today; null before the first one. */
  start: string | null;
  /* The next meeting day: today while today's session is still ahead, else the next weekday. */
  due: string;
  /* Calendar days from today to `due`. */
  daysLeft: number;
}

export function planerkaWeek(sessions: { held_on: string }[], weekday: number, today: string): PlanerkaWeek {
  const start = sessions.map((s) => s.held_on).filter((d) => d <= today).sort().at(-1) ?? null;
  const [y, m, d] = today.split('-').map(Number);
  const now = new Date(y, m - 1, d);
  let ahead = (weekday - now.getDay() + 7) % 7;
  /* Meeting day with today's session already held: the week runs to the next one. */
  if (ahead === 0 && start === today) ahead = 7;
  const due = new Date(y, m - 1, d + ahead);
  return { start, due: isoDate(due), daysLeft: ahead };
}

export type TodoWeek = 'this' | 'carried' | 'done-this' | 'done-before';

/* Which part of the week a to-do belongs to. */
export function todoWeek(
  todo: { status: string; created_at: string; done_at: string | null; week_of?: string | null },
  week: PlanerkaWeek,
): TodoWeek {
  const day = (iso: string) => isoDate(new Date(iso));
  if (todo.status === 'done') return !week.start || (todo.done_at && day(todo.done_at) >= week.start) ? 'done-this' : 'done-before';
  const set = todo.week_of ?? day(todo.created_at);
  return !week.start || set >= week.start ? 'this' : 'carried';
}
