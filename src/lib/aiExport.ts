import { format, parseISO } from 'date-fns';
import supabase from '@/lib/supabase';
import { moodLabel } from '@/lib/mood';
import { QUESTIONS } from '@/lib/questions';

/*
  The export for a neural network: your own records for a period, with a prompt
  inside the file that changes with the goal. Only your side (Р-012): your days
  and notes, letters and pings sent and received, requests between you. The
  partner's days and notes never leave the app this way.
*/

export type ExportGoal = 'problem' | 'closer' | 'curious';

export const GOALS: { value: ExportGoal; label: string }[] = [
  { value: 'closer', label: 'Как стать ближе' },
  { value: 'problem', label: 'Разобраться в проблеме' },
  { value: 'curious', label: 'Просто интересно' },
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

  const [days, letters, pings, tasks, cycle, answers] = await Promise.all([
    daysQ.order('entry_date'),
    lettersQ.order('created_at'),
    pingsQ.order('created_at'),
    tasksQ.order('created_at'),
    cycleQ.order('day'),
    supabase.from('couple_answers').select('question, answer').eq('user_id', userId).order('question'),
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
    answers: (answers.data ?? []) as ExportData['answers'],
  };
}

export function exportSummary(data: ExportData) {
  const sent = data.letters.filter((l) => l.direction === 'sent').length;
  const notes = data.days.filter((d) => d.note.trim()).length;
  return [
    ['Дней', data.days.length],
    ['Заметок', notes],
    ['Писем', data.letters.length, `${sent} отправлено, ${data.letters.length - sent} получено`],
    ['Весточек', data.pings.length],
    ['Просьб', data.tasks.length],
    ...(data.cycle.length ? [['Дней цикла', data.cycle.length] as [string, number]] : []),
  ] as [string, number, string?][];
}

const GOAL_PROMPT: Record<ExportGoal, (concern: string) => string> = {
  problem: (concern) =>
    [
      'Цель: разобраться в конкретной проблеме.',
      concern ? `Что беспокоит, словами автора: «${concern}».` : 'Автор не описал проблему словами — начни с вопроса, что именно его беспокоит, а потом опирайся на записи.',
      'Найди в записях, когда и при каких обстоятельствах это проявлялось. Предложи две-три гипотезы о причинах и что можно попробовать. Опирайся на конкретные даты и цитаты.',
    ].join('\n'),
  closer: () =>
    [
      'Цель: понять, как стать ближе.',
      'Опиши динамику периода: когда было легче, когда тяжелее и что этому сопутствовало — письма, просьбы, весточки, тишина. Отметь, что у пары уже хорошо получается, и предложи несколько бережных, конкретных шагов.',
    ].join('\n'),
  curious: () =>
    [
      'Цель: просто интерес.',
      'Сделай спокойный обзор периода: что происходило, какие темы повторялись, какие моменты выделяются. Без советов, если о них не попросят.',
    ].join('\n'),
};

/* Stamps come from the database in UTC; the file speaks the author's local time. */
const day = (iso: string) => format(parseISO(iso), 'yyyy-MM-dd');
const time = (iso: string) => format(parseISO(iso), 'HH:mm');
const clean = (text: string | null | undefined) => (text ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+\n/g, '\n').trim();

export function buildMarkdown(data: ExportData, goal: ExportGoal, concern: string) {
  const period = data.from ? `с ${data.from} по ${data.to}` : `за всё время по ${data.to}`;
  const out: string[] = [];

  out.push(`# Впаре — ${data.name.trim() || 'записи'}, ${period}`, '');
  out.push('## Инструкция для нейросети', '');
  out.push(
    'Ты — внимательный и бережный собеседник, который помогает человеку разобраться в его отношениях. Ниже — его записи из приложения «Впаре»: это общее пространство дня для пары, где каждый отмечает свой день цветом и может написать партнёру.',
    '',
    'Это записи **одного человека**: его дни и заметки, письма и весточки, которые он отправил и получил, просьбы между партнёрами. Дни и заметки партнёра сюда не входят — не додумывай, что партнёр чувствовал, сверх того, что видно в письмах, весточках и просьбах.',
    '',
    GOAL_PROMPT[goal](concern.trim()),
    '',
    'Как читать данные:',
    '- Настроение дня в приложении — цвет на шкале без цифр. Здесь оно записано числом от 0 (лёгкий день) до 1 (тяжёлый) и словом. Это не оценка: не называй дни хорошими или плохими, говори о том, что было легче или тяжелее.',
    '- Просьбы — то, о чём партнёры просят друг друга. Баллы — вес, который поставил тот, кто просит. «Увидено» — партнёр заметил, что просьба выполнена.',
    '- Пропущенные дни — не провал, а просто дни без записи.',
    '',
    'Правила: пиши по-русски, тепло и конкретно. Не ставь диагнозов и не делай выводов о партнёре как о человеке. Если в записях есть признаки опасности — насилия, мыслей о самоповреждении, — мягко посоветуй обратиться к специалисту.',
    '',
  );

  out.push('## Дни', '');
  if (!data.days.length) out.push('Дней с отметкой за период нет.', '');
  for (const d of data.days) {
    out.push(`### ${d.entry_date} · ${d.mood.toFixed(2)} (${moodLabel(d.mood)})`);
    out.push(clean(d.note) ? clean(d.note) : '_без заметки_', '');
  }

  if (data.letters.length) {
    out.push('## Письма', '');
    for (const l of data.letters) {
      const when = l.delivered_at ?? l.created_at;
      out.push(`### ${day(when)} ${time(when)} · ${l.direction === 'sent' ? 'отправлено' : 'получено'}${l.title ? ` · «${clean(l.title)}»` : ''}`);
      out.push(clean(l.content) || '_без текста — только вложения_', '');
    }
  }

  if (data.pings.length) {
    out.push('## Весточки', '');
    for (const p of data.pings) {
      const parts = [clean(p.body)];
      if (p.track_title) parts.push(`трек: ${p.track_title}${p.track_artist ? ` — ${p.track_artist}` : ''}`);
      if (p.has_photo) parts.push('снимок');
      if (p.has_voice) parts.push('голосовое');
      out.push(`- ${day(p.created_at)} ${time(p.created_at)} · ${p.direction === 'sent' ? 'отправлено' : 'получено'}: ${parts.filter(Boolean).join(' · ')}`);
    }
    out.push('');
  }

  if (data.tasks.length) {
    out.push('## Просьбы', '');
    for (const t of data.tasks) {
      const status = t.completed_at ? `выполнено ${day(t.completed_at)}${t.acknowledged_at ? ', увидено' : ''}` : 'не выполнено';
      out.push(`- ${day(t.created_at)} · ${t.direction === 'asked' ? 'автор попросил' : 'автора попросили'}: «${clean(t.content)}» · ${t.points} б. · ${status}`);
    }
    out.push('');
  }

  if (data.cycle.length) {
    out.push('## Дни цикла', '', data.cycle.join(', '), '');
  }

  const answered = data.answers.filter((a) => a.answer.trim());
  if (answered.length) {
    out.push('## Ответы на вопросы при знакомстве с приложением', '');
    for (const a of answered) out.push(`**${QUESTIONS[a.question - 1] ?? `Вопрос ${a.question}`}**`, clean(a.answer), '');
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
