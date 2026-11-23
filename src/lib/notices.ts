import { genitive, verb, type Gender } from './words';
import { getLang, trIn, type Lang } from './i18n';

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
  | 'remind_evening';

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
    case 'remind_morning':
      return t(
        `Вчерашний день ${actor === 'Партнёр' ? 'партнёра' : genitive(actor, gender)} ждёт вас — вы его ещё не открывали`,
        `${actor === 'Partner' ? 'Your partner’s' : `${actor}’s`} yesterday is waiting — you haven’t opened it yet`,
      );
    case 'remind_evening':
      return t('Вечер. Можно отметить, как прошёл день', 'Evening. Time to mark how the day went');
    default:
      return t('Новое событие', 'Something new');
  }
}

export function noticeHref(kind: NoticeKind, payload?: Record<string, unknown> | null) {
  switch (kind) {
    case 'remind_morning':
      return typeof payload?.date === 'string' ? `/day?d=${payload.date}` : '/calendar';
    case 'remind_evening':
      return '/day';
    case 'ping':
      return '/messages';
    case 'day':
    case 'joined':
      return '/day';
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
