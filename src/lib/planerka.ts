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
