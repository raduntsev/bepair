import { format, parseISO } from 'date-fns';
import supabase from '@/lib/supabase';
import { moodColorName } from '@/lib/mood';
import { QUESTIONS } from '@/lib/questions';
import { tr } from '@/lib/i18n';

/*
  The export for a neural network: your own records for a period, with a prompt
  inside the file that changes with the goal. Only your side (Р-012): your days
  and notes, letters and pings sent and received, requests between you. The
  partner's days and notes never leave the app this way.
*/

export type ExportGoal = 'problem' | 'closer' | 'curious';

export const GOALS: { value: ExportGoal; label: string }[] = [
  { value: 'closer', label: tr('Как стать ближе', 'Get closer') },
  { value: 'problem', label: tr('Разобраться в проблеме', 'Sort out a problem') },
  { value: 'curious', label: tr('Просто интересно', 'Just curious') },
];

export interface ExportData {
  from: string | null;
  to: string;
  name: string;
  days: { entry_date: string; mood: number; note: string }[];
  letters: { title: string | null; content: string | null; created_at: string; delivered_at: string | null; direction: 'sent' | 'received' }[];
  pings: { body: string; track_title: string | null; track_artist: string | null; created_at: string; direction: 'sent' | 'received'; has_photo: boolean; has_voice: boolean }[];
  tasks: { content: string; points: number; created_at: string; completed_at: string | null; acknowledged_at: string | null; direction: 'asked' | 'asked_of_me' }[];
  cycle: string[];
  events: { day: string; kind: 'quarrel' | 'intimacy' }[];
  answers: { question: number; answer: string }[];
}

export async function collectExport(userId: string, name: string, from: string | null, to: string): Promise<ExportData | null> {
  const lo = from ? `${from}T00:00:00` : null;
  const hi = `${to}T23:59:59.999`;

  let daysQ = supabase.from('day_entries').select('entry_date, mood, note').eq('user_id', userId).lte('entry_date', to);
  if (from) daysQ = daysQ.gte('entry_date', from);

  let lettersQ = supabase
    .from('letters')
    .select('title, content, author_id, created_at, delivered_at, status')
    .or(`author_id.eq.${userId},recipient_id.eq.${userId}`)
    .neq('status', 'draft')
    .lte('created_at', hi);
  if (lo) lettersQ = lettersQ.gte('created_at', lo);

  let pingsQ = supabase.from('pings').select('author_id, body, track_title, track_artist, photo_path, voice_path, created_at').lte('created_at', hi);
  if (lo) pingsQ = pingsQ.gte('created_at', lo);

  let tasksQ = supabase.from('checklist_items').select('user_id, content, points, created_at, completed_at, acknowledged_at').lte('created_at', hi);
  if (lo) tasksQ = tasksQ.gte('created_at', lo);

  let cycleQ = supabase.from('cycle_days').select('day').eq('user_id', userId).lte('day', to);
  if (from) cycleQ = cycleQ.gte('day', from);

  /* The pair's marks; intimacy rows come back only while both partners have its consent (RLS, 0024). */
  let eventsQ = supabase.from('day_events').select('day, kind').lte('day', to);
  if (from) eventsQ = eventsQ.gte('day', from);

  const [days, letters, pings, tasks, cycle, answers, events] = await Promise.all([
    daysQ.order('entry_date'),
    lettersQ.order('created_at'),
    pingsQ.order('created_at'),
    tasksQ.order('created_at'),
    cycleQ.order('day'),
    supabase.from('couple_answers').select('question, answer').eq('user_id', userId).order('question'),
    eventsQ.order('day'),
  ]);

  if (days.error || letters.error) return null;

  return {
    from,
    to,
    name,
    days: (days.data ?? []) as ExportData['days'],
    letters: (letters.data ?? []).map((l) => ({
      title: l.title as string | null,
      content: l.content as string | null,
      created_at: l.created_at as string,
      delivered_at: l.delivered_at as string | null,
      direction: l.author_id === userId ? 'sent' : 'received',
    })),
    pings: (pings.data ?? []).map((p) => ({
      body: (p.body as string) ?? '',
      track_title: p.track_title as string | null,
      track_artist: p.track_artist as string | null,
      created_at: p.created_at as string,
      direction: p.author_id === userId ? 'sent' : 'received',
      has_photo: !!p.photo_path,
      has_voice: !!p.voice_path,
    })),
    tasks: (tasks.data ?? []).map((t) => ({
      content: t.content as string,
      points: t.points as number,
      created_at: t.created_at as string,
      completed_at: t.completed_at as string | null,
      acknowledged_at: t.acknowledged_at as string | null,
      direction: t.user_id === userId ? 'asked' : 'asked_of_me',
    })),
    cycle: (cycle.data ?? []).map((row) => row.day as string),
    /* Before migration 0024 the table is missing: no marks, nothing else breaks. */
    events: events.error ? [] : ((events.data ?? []) as ExportData['events']),
    answers: (answers.data ?? []) as ExportData['answers'],
  };
}

export function exportSummary(data: ExportData) {
  const sent = data.letters.filter((l) => l.direction === 'sent').length;
  const notes = data.days.filter((d) => d.note.trim()).length;
  return [
    [tr('Дней', 'Days'), data.days.length],
    [tr('Заметок', 'Notes'), notes],
    [tr('Писем', 'Letters'), data.letters.length, tr(`${sent} отправлено, ${data.letters.length - sent} получено`, `${sent} sent, ${data.letters.length - sent} received`)],
    [tr('Весточек', 'Notes sent'), data.pings.length],
    [tr('Просьб', 'Requests'), data.tasks.length],
    ...(data.cycle.length ? [[tr('Дней цикла', 'Cycle days'), data.cycle.length] as [string, number]] : []),
    ...(data.events.some((e) => e.kind === 'quarrel') ? [[tr('Ссор', 'Fights'), data.events.filter((e) => e.kind === 'quarrel').length] as [string, number]] : []),
    ...(data.events.some((e) => e.kind === 'intimacy') ? [[tr('Дней близости', 'Days of intimacy'), data.events.filter((e) => e.kind === 'intimacy').length] as [string, number]] : []),
  ] as [string, number, string?][];
}

const GOAL_PROMPT: Record<ExportGoal, (concern: string) => string> = {
  problem: (concern) =>
    [
      tr('Цель: разобраться в конкретной проблеме.', 'Goal: understand a specific problem.'),
      concern
        ? tr(`Что беспокоит, словами автора: «${concern}».`, `What worries the author, in their words: “${concern}”.`)
        : tr('Автор не описал проблему словами — начни с вопроса, что именно его беспокоит, а потом опирайся на записи.', 'The author didn’t describe the problem — start by asking what exactly worries them, then lean on the entries.'),
      tr('Найди в записях, когда и при каких обстоятельствах это проявлялось. Предложи две-три гипотезы о причинах и что можно попробовать. Опирайся на конкретные даты и цитаты.', 'Find in the entries when and in what circumstances it showed up. Offer two or three hypotheses about the causes and what could be tried. Rely on specific dates and quotes.'),
    ].join('\n'),
  closer: () =>
    [
      tr('Цель: понять, как стать ближе.', 'Goal: understand how to get closer.'),
      tr('Опиши динамику периода: когда было легче, когда тяжелее и что этому сопутствовало — письма, просьбы, весточки, тишина. Отметь, что у пары уже хорошо получается, и предложи несколько бережных, конкретных шагов.', 'Describe how the period went: when it was easier, when harder, and what came with it — letters, requests, notes, silence. Note what the couple already does well and suggest a few gentle, concrete steps.'),
    ].join('\n'),
  curious: () =>
    [
      tr('Цель: просто интерес.', 'Goal: simple curiosity.'),
      tr('Сделай спокойный обзор периода: что происходило, какие темы повторялись, какие моменты выделяются. Без советов, если о них не попросят.', 'Give a calm overview of the period: what happened, which themes recurred, which moments stand out. No advice unless asked.'),
    ].join('\n'),
};

/* Stamps come from the database in UTC; the file speaks the author's local time. */
const day = (iso: string) => format(parseISO(iso), 'yyyy-MM-dd');
const time = (iso: string) => format(parseISO(iso), 'HH:mm');
const clean = (text: string | null | undefined) => (text ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+\n/g, '\n').trim();

export function buildMarkdown(data: ExportData, goal: ExportGoal, concern: string) {
  const period = data.from ? tr(`с ${data.from} по ${data.to}`, `${data.from} to ${data.to}`) : tr(`за всё время по ${data.to}`, `all time to ${data.to}`);
  const out: string[] = [];

  out.push(`# ${tr('Впаре', 'Bepair')} — ${data.name.trim() || tr('записи', 'entries')}, ${period}`, '');
  out.push(tr('## Инструкция для нейросети', '## Instructions for the AI'), '');
  out.push(
    tr('Ты — внимательный и бережный собеседник, который помогает человеку разобраться в его отношениях. Ниже — его записи из приложения «Впаре»: это общее пространство дня для пары, где каждый отмечает свой день цветом и может написать партнёру.', 'You are an attentive, caring companion helping a person make sense of their relationship. Below are their entries from Bepair, a shared daily space for a couple where each marks their day with a colour and can write to their partner.'),
    '',
    tr('Это записи **одного человека**: его дни и заметки, письма и весточки, которые он отправил и получил, просьбы между партнёрами. Дни и заметки партнёра сюда не входят — не додумывай, что партнёр чувствовал, сверх того, что видно в письмах, весточках и просьбах.', 'These are the entries of **one person**: their days and notes, letters and notes they sent and received, requests between the partners. The partner’s days and notes are not included — don’t guess what the partner felt beyond what the letters, notes and requests show.'),
    '',
    GOAL_PROMPT[goal](concern.trim()),
    '',
    tr('Как читать данные:', 'How to read the data:'),
    tr('- Настроение дня в приложении — цвет на шкале без цифр. Здесь оно записано числом от 0 (зелёный край шкалы) до 1 (красный) и названием цвета. Что значит каждый цвет, человек решает сам — приложение не подписывает их. Это не оценка: не называй дни хорошими или плохими; если смысл цвета важен для ответа, спроси.', '- In the app a day’s mood is a colour on a scale with no numbers. Here it is written as a number from 0 (the green end) to 1 (the red end) and the colour’s name. What each colour means is the person’s own choice — the app doesn’t caption them. It is not a grade: don’t call days good or bad; if the meaning of a colour matters for your answer, ask.'),
    tr('- Просьбы — то, о чём партнёры просят друг друга. Баллы — вес, который поставил тот, кто просит. «Увидено» — партнёр заметил, что просьба выполнена.', '- Requests are what the partners ask of each other. Points are the weight set by the one asking. “Seen” means the partner noticed it was done.'),
    tr('- Пропущенные дни — не провал, а просто дни без записи.', '- Missing days are not failures, just days without an entry.'),
    '',
    tr('Правила: пиши по-русски, тепло и конкретно. Не ставь диагнозов и не делай выводов о партнёре как о человеке. Если в записях есть признаки опасности — насилия, мыслей о самоповреждении, — мягко посоветуй обратиться к специалисту.', 'Rules: write in English, warmly and specifically. Don’t diagnose, and don’t draw conclusions about the partner as a person. If the entries show signs of danger — violence, thoughts of self-harm — gently suggest seeing a professional.'),
    '',
  );

  out.push(tr('## Дни', '## Days'), '');
  if (!data.days.length) out.push(tr('Дней с отметкой за период нет.', 'No marked days in this period.'), '');
  for (const d of data.days) {
    out.push(`### ${d.entry_date} · ${d.mood.toFixed(2)} (${moodColorName(d.mood)})`);
    out.push(clean(d.note) ? clean(d.note) : tr('_без заметки_', '_no note_'), '');
  }

  if (data.letters.length) {
    out.push(tr('## Письма', '## Letters'), '');
    for (const l of data.letters) {
      const when = l.delivered_at ?? l.created_at;
      out.push(`### ${day(when)} ${time(when)} · ${l.direction === 'sent' ? tr('отправлено', 'sent') : tr('получено', 'received')}${l.title ? ` · «${clean(l.title)}»` : ''}`);
      out.push(clean(l.content) || tr('_без текста — только вложения_', '_no text — attachments only_'), '');
    }
  }

  if (data.pings.length) {
    out.push(tr('## Весточки', '## Notes'), '');
    for (const p of data.pings) {
      const parts = [clean(p.body)];
      if (p.track_title) parts.push(`${tr('трек', 'track')}: ${p.track_title}${p.track_artist ? ` — ${p.track_artist}` : ''}`);
      if (p.has_photo) parts.push(tr('снимок', 'photo'));
      if (p.has_voice) parts.push(tr('голосовое', 'voice note'));
      out.push(`- ${day(p.created_at)} ${time(p.created_at)} · ${p.direction === 'sent' ? tr('отправлено', 'sent') : tr('получено', 'received')}: ${parts.filter(Boolean).join(' · ')}`);
    }
    out.push('');
  }

  if (data.tasks.length) {
    out.push(tr('## Просьбы', '## Requests'), '');
    for (const t of data.tasks) {
      const status = t.completed_at
        ? tr(`выполнено ${day(t.completed_at)}${t.acknowledged_at ? ', увидено' : ''}`, `done ${day(t.completed_at)}${t.acknowledged_at ? ', seen' : ''}`)
        : tr('не выполнено', 'not done');
      out.push(`- ${day(t.created_at)} · ${t.direction === 'asked' ? tr('автор попросил', 'the author asked') : tr('автора попросили', 'the author was asked')}: «${clean(t.content)}» · ${t.points} ${tr('б.', 'pts')} · ${status}`);
    }
    out.push('');
  }

  const quarrels = data.events.filter((e) => e.kind === 'quarrel').map((e) => e.day);
  const intimacy = data.events.filter((e) => e.kind === 'intimacy').map((e) => e.day);
  if (quarrels.length) out.push(tr('## Дни, отмеченные как ссора (отметка общая для пары)', '## Days marked as a fight (a shared mark of the couple)'), '', quarrels.join(', '), '');
  if (intimacy.length) out.push(tr('## Дни близости (отметка общая для пары)', '## Days of intimacy (a shared mark of the couple)'), '', intimacy.join(', '), '');

  if (data.cycle.length) {
    out.push(tr('## Дни цикла', '## Cycle days'), '', data.cycle.join(', '), '');
  }

  const answered = data.answers.filter((a) => a.answer.trim());
  if (answered.length) {
    out.push(tr('## Ответы на вопросы при знакомстве с приложением', '## Answers to the getting-started questions'), '');
    for (const a of answered) out.push(`**${QUESTIONS[a.question - 1] ?? `${tr('Вопрос', 'Question')} ${a.question}`}**`, clean(a.answer), '');
  }

  return out.join('\n');
}

export function download(name: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
