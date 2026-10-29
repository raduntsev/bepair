import { verb, type Gender } from './words';

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
  | 'joined';

export interface NoticeLike {
  kind: NoticeKind;
  payload: Record<string, unknown> | null;
}

export const PAIRED_LABELS: Record<string, string> = {
  reveal_first: 'Сначала свой день',
  chronicle_deletable: 'Удалять свои записи',
  long_distance: 'Мы на расстоянии',
  count_streak: 'Считать серию',
};

export function noticeText(notice: NoticeLike, actor: string, gender: Gender) {
  const p = notice.payload ?? {};
  const quoted = (key: string) => (typeof p[key] === 'string' && p[key] ? `«${p[key]}»` : '');

  switch (notice.kind) {
    case 'ping':
      return `${actor} ${verb(gender, 'прислал')} весточку`;
    case 'day':
      return `${actor} ${verb(gender, 'отметил')} день`;
    case 'task_new':
      return `${actor} ${verb(gender, 'попросил')}: ${quoted('content')}`;
    case 'task_done':
      return `${actor} ${verb(gender, 'выполнил')} ${quoted('content')}`;
    case 'task_seen':
      return `${actor} ${verb(gender, 'увидел')}, что вы сделали ${quoted('content')}`;
    case 'letter':
      return `${actor} ${verb(gender, 'отправил')} письмо`;
    case 'service':
      return `${actor} ${verb(gender, 'попросил')} об услуге ${quoted('title')}`;
    case 'paired_proposal': {
      const label = PAIRED_LABELS[String(p.key)] ?? 'парную настройку';
      return `${actor} ${verb(gender, 'предложил')} ${p.value ? 'включить' : 'выключить'} «${label}»`;
    }
    case 'paired_answer': {
      const label = PAIRED_LABELS[String(p.key)] ?? 'парную настройку';
      return p.accepted
        ? `${actor} ${verb(gender, 'согласился')}: «${label}» ${p.value ? 'включено' : 'выключено'}`
        : `${actor} ${verb(gender, 'оставил')} «${label}» как было`;
    }
    case 'joined':
      return `${actor} ${verb(gender, 'присоединился')} к пространству`;
    default:
      return 'Новое событие';
  }
}

export function noticeHref(kind: NoticeKind) {
  switch (kind) {
    case 'ping':
      return '/chronicle';
    case 'day':
    case 'joined':
      return '/day';
    case 'task_new':
    case 'task_done':
    case 'task_seen':
      return '/tasks';
    case 'letter':
      return '/letters';
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
