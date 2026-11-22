/*
  «Планёрка» — the couple's weekly sit-down. The spheres and questions are the
  ones the couple already used in their spreadsheet, kept word for word so a
  year of history reads as one continuous record.
*/

/* `short` is for the radar, where a full label would be cut at the edge of the chart. */
export const SPHERES = [
  { key: 'physical', label: 'Здоровье тела', short: 'Тело' },
  { key: 'mental', label: 'Душевное состояние', short: 'Душа' },
  { key: 'family', label: 'Друзья и семья', short: 'Близкие' },
  { key: 'romance', label: 'Романтика', short: 'Романтика' },
  { key: 'career', label: 'Работа', short: 'Работа' },
  { key: 'finances', label: 'Финансы', short: 'Финансы' },
  { key: 'growth', label: 'Личный рост', short: 'Рост' },
] as const;

export type SphereKey = (typeof SPHERES)[number]['key'];
export type Scores = Partial<Record<SphereKey, number>>;
/* Why a sphere got its score — one short note per sphere, keyed like Scores. */
export type Comments = Partial<Record<SphereKey, string>>;

export const QUESTIONS = [
  { key: 'feel', label: 'Как ты себя чувствуешь в этих отношениях сейчас?' },
  { key: 'change', label: 'Что бы ты хотел(а) изменить?' },
  { key: 'enough', label: 'Всего ли тебе достаточно?' },
  { key: 'love', label: 'Люблю, когда ты…' },
] as const;

export type QuestionKey = (typeof QUESTIONS)[number]['key'];

export const WEEKDAYS = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
export const WEEKDAYS_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

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
