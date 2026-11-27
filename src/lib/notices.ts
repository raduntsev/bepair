import { genitive, leftVerb, verb, type Gender } from './words';
import { getLang, trIn, type Lang } from './i18n';
import { courseById, lessonById, lessonsOf, nextLesson } from './courses';

/*
  One wording for the in-app feed and for system push. Every line reports a
  fact — that something happened — never what is inside something that is
  still sealed for the reader. A ping is not sealed, but its text still stays
  off the lock screen: a phone on the table is read by whoever sits nearby.
*/

export type NoticeKind =
  | 'ping'
  | 'day'
  | 'task_new'
  | 'task_done'
  | 'task_seen'
  | 'letter'
  | 'service'
  | 'paired_proposal'
  | 'paired_answer'
  | 'joined'
  | 'remind_morning'
  | 'remind_evening'
  | 'course_step'
  | 'course_shared'
  | 'remind_course'
  | 'location_shared'
  | 'left';

export interface NoticeLike {
  kind: NoticeKind;
  payload: Record<string, unknown> | null;
}

export const PAIRED_LABELS: Record<string, [string, string]> = {
  reveal_first: ['Сначала свой день', 'Your day first'],
  chronicle_deletable: ['Удалять свои записи', 'Delete own entries'],
  long_distance: ['Мы на расстоянии', 'We live apart'],
  count_streak: ['Считать серию', 'Count the run'],
  reset_space: ['Удалить все данные пары', 'Delete all shared data'],
};

export function pairedLabel(key: string, lang: Lang = getLang()) {
  const pair = PAIRED_LABELS[key];
  return pair ? trIn(lang, pair[0], pair[1]) : trIn(lang, 'парную настройку', 'a shared setting');
}

/* The language is the reader's: the app's own, or the recipient's for push. */
export function noticeText(notice: NoticeLike, actor: string, gender: Gender, lang: Lang = getLang()) {
  const p = notice.payload ?? {};
  const raw = (key: string) => (typeof p[key] === 'string' && p[key] ? String(p[key]) : '');
  const ru = (key: string) => (raw(key) ? `«${raw(key)}»` : '');
  const en = (key: string) => (raw(key) ? `“${raw(key)}”` : '');
  const t = (ruText: string, enText: string) => trIn(lang, ruText, enText);

  switch (notice.kind) {
    case 'ping':
      return t(`${actor} ${verb(gender, 'прислал')} весточку`, `${actor} sent you a note`);
    case 'day':
      return t(`${actor} ${verb(gender, 'отметил')} день`, `${actor} marked the day`);
    case 'task_new':
      return t(`${actor} ${verb(gender, 'попросил')}: ${ru('content')}`, `${actor} asked: ${en('content')}`);
    case 'task_done':
      return t(`${actor} ${verb(gender, 'выполнил')} ${ru('content')}`, `${actor} did ${en('content')}`);
    case 'task_seen':
      return t(`${actor} ${verb(gender, 'увидел')}, что вы сделали ${ru('content')}`, `${actor} saw that you did ${en('content')}`);
    case 'letter':
      return t(`${actor} ${verb(gender, 'отправил')} письмо`, `${actor} sent you a letter`);
    case 'service':
      return t(`${actor} ${verb(gender, 'попросил')} об услуге ${ru('title')}`, `${actor} asked for ${en('title')}`);
    case 'paired_proposal': {
      if (p.key === 'reset_space') {
        return t(`${actor} ${verb(gender, 'предложил')} удалить все данные пары`, `${actor} suggests deleting all of your shared data`);
      }
      const label = pairedLabel(String(p.key), lang);
      return t(
        `${actor} ${verb(gender, 'предложил')} ${p.value ? 'включить' : 'выключить'} «${label}»`,
        `${actor} suggests turning ${p.value ? 'on' : 'off'} “${label}”`,
      );
    }
    case 'paired_answer': {
      if (p.key === 'reset_space') {
        return t(`${actor} ${verb(gender, 'решил')} оставить все данные`, `${actor} chose to keep all your data`);
      }
      const label = pairedLabel(String(p.key), lang);
      return p.accepted
        ? t(
            `${actor} ${verb(gender, 'согласился')}: «${label}» ${p.value ? 'включено' : 'выключено'}`,
            `${actor} agreed: “${label}” is ${p.value ? 'on' : 'off'}`,
          )
        : t(`${actor} ${verb(gender, 'оставил')} «${label}» как было`, `${actor} kept “${label}” as it was`);
    }
    case 'joined':
      return t(`${actor} ${verb(gender, 'присоединился')} к пространству`, `${actor} joined your space`);
    case 'left': {
      /* The person is gone from the space by now, so their name travels in the payload. */
      const who = raw('name') || actor;
      const g = (p.gender === 'm' || p.gender === 'f' ? p.gender : gender) as Gender;
      return p.deleted
        ? t(`${who} ${verb(g, 'удалил')} свой аккаунт и ${leftVerb(g)} из пары`, `${who} deleted their account and left the pair`)
        : t(`${who} ${leftVerb(g)} из пары`, `${who} left the pair`);
    }
    case 'remind_morning':
      return t(
        `Вчерашний день ${actor === 'Партнёр' ? 'партнёра' : genitive(actor, gender)} ждёт вас — вы его ещё не открывали`,
        `${actor === 'Partner' ? 'Your partner’s' : `${actor}’s`} yesterday is waiting — you haven’t opened it yet`,
      );
    case 'remind_evening':
      return t('Вечер. Можно отметить, как прошёл день', 'Evening. Time to mark how the day went');
    case 'course_step': {
      /* Which step — never what was written in it. */
      const course = courseById(raw('course_id'));
      const lesson = course ? lessonById(course, raw('lesson_id')) : null;
      if (!course || !lesson) return t(`${actor} ${verb(gender, 'сделал')} шаг курса`, `${actor} took a course step`);
      if (lesson.kind === 'final') {
        return t(`${actor} ${verb(gender, 'завершил')} курс «${course.title}»`, `${actor} finished the course “${course.title}”`);
      }
      const ruStep = lesson.kind === 'practice' ? 'практическую работу' : `урок ${lesson.code}`;
      const enStep = lesson.kind === 'practice' ? 'a practice task' : `lesson ${lesson.code}`;
      return t(`${actor} ${verb(gender, 'закончил')} ${ruStep} «${lesson.title}»`, `${actor} finished ${enStep}: “${lesson.title}”`);
    }
    case 'course_shared':
      return t(`${actor} ${verb(gender, 'открыл')} вам свои ответы в курсах`, `${actor} opened their course answers to you`);
    case 'location_shared':
      return t(
        `${actor} ${verb(gender, 'начал')} делиться местоположением`,
        `${actor} started sharing their location`,
      );
    case 'remind_course': {
      const next = courseNext(raw('course_id'), raw('last_lesson'));
      return next
        ? t(`Курс ждёт: ${next.code} «${next.title}»`, `Your course is waiting: ${next.code} “${next.title}”`)
        : t('Пора вернуться к курсу', 'Time to get back to your course');
    }
    default:
      return t('Новое событие', 'Something new');
  }
}

/* The step after the last one done — what a reminder points at. */
function courseNext(courseId: string, lastLesson: string) {
  const course = courseById(courseId);
  if (!course) return null;
  const all = lessonsOf(course);
  const at = all.findIndex((l) => l.id === lastLesson);
  return at === -1 ? (nextLesson(course, new Set()) ?? null) : (all[at + 1] ?? null);
}

export function noticeHref(kind: NoticeKind, payload?: Record<string, unknown> | null) {
  const str = (key: string) => (typeof payload?.[key] === 'string' ? String(payload[key]) : '');
  switch (kind) {
    case 'course_step':
      return str('course_id') ? `/courses/course?id=${str('course_id')}` : '/courses';
    case 'course_shared':
      return '/journal?who=partner';
    case 'remind_course': {
      const next = courseNext(str('course_id'), str('last_lesson'));
      return next ? `/courses/lesson?c=${str('course_id')}&l=${next.id}` : '/courses';
    }
    case 'remind_morning':
      return typeof payload?.date === 'string' ? `/day?d=${payload.date}` : '/calendar';
    case 'remind_evening':
      return '/day';
    case 'location_shared':
      return '/map';
    case 'ping':
      return '/messages';
    case 'day':
      return typeof payload?.date === 'string' ? `/day?d=${payload.date}` : '/day';
    case 'joined':
      return '/day';
    case 'left':
      return '/settings/account';
    case 'task_new':
    case 'task_done':
    case 'task_seen':
      return '/tasks';
    case 'letter':
      return '/messages';
    case 'service':
      return '/store';
    case 'paired_proposal':
    case 'paired_answer':
      return '/settings/paired';
    default:
      return '/notifications';
  }
}

/* Which personal switch governs push for each kind. In-app history always records. */
export function pushPreference(kind: NoticeKind) {
  if (kind === 'ping') return 'notify_pings';
  if (kind === 'day') return 'notify_day';
  if (kind === 'letter') return 'notify_letters';
  if (kind === 'task_new' || kind === 'task_done' || kind === 'task_seen' || kind === 'service') return 'notify_tasks';
  return null;
}
