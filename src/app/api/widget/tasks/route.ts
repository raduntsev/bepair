import type { SupabaseClient } from '@supabase/supabase-js';
import { authorizeWidget } from '@/lib/widgetAuth';
import { localDate } from '@/lib/widgetSnapshot';
import { claimAndDeliver, pushConfigured } from '@/lib/pushDelivery';
import { displayName } from '@/lib/words';
import { inLang, tr, type Lang } from '@/lib/i18n';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/*
  The «Дела» widget: what the partner asked of the key's owner — still open,
  then what was done today. All wording is composed here, in the owner's
  language, like the day widget's snapshot.

  POST {id} ticks one off. This is the one thing a widget key may change, and
  only this: a request addressed to the key's owner, in their own space, not
  yet done. Points and the partner's notification follow exactly as in the app.
*/

interface Item {
  id: string;
  content: string;
  points: number;
  done: boolean;
}

export interface TasksPayload {
  v: 1;
  title: string;
  /* Shown in place of the list when there is nothing to do. */
  empty: string;
  /* «осталось 2» — empty once everything is done. */
  left: string;
  open: number;
  items: Item[];
  updatedAt: string;
}

const LIMIT = 6;

async function build(admin: SupabaseClient, userId: string): Promise<TasksPayload | null> {
  const { data: me } = await admin.from('profiles').select('id, space_id, timezone, lang').eq('id', userId).maybeSingle();
  if (!me) return null;
  const lang: Lang = me.lang === 'en' ? 'en' : 'ru';
  const today = localDate(me.timezone);

  if (!me.space_id) {
    return inLang(lang, () => ({
      v: 1 as const,
      title: tr('Дела на сегодня', 'Today’s to-dos'),
      empty: tr('Откройте Впаре, чтобы начать', 'Open Bepair to begin'),
      left: '',
      open: 0,
      items: [],
      updatedAt: new Date().toISOString(),
    }));
  }

  const [partnerResult, openResult, doneResult] = await Promise.all([
    admin.from('profiles').select('display_name').eq('space_id', me.space_id).neq('id', me.id).maybeSingle(),
    admin
      .from('checklist_items')
      .select('id, content, points')
      .eq('space_id', me.space_id)
      .neq('user_id', me.id)
      .eq('is_completed', false)
      .order('created_at', { ascending: true })
      .limit(50),
    admin
      .from('checklist_items')
      .select('id, content, points, completed_at')
      .eq('space_id', me.space_id)
      .eq('completed_by', me.id)
      .neq('user_id', me.id)
      .eq('is_completed', true)
      /* A day and a half back, then cut to the owner's own today below. */
      .gte('completed_at', new Date(Date.now() - 36 * 3600 * 1000).toISOString())
      .order('completed_at', { ascending: false }),
  ]);

  const open = (openResult.data ?? []).map((t) => ({ id: t.id, content: t.content, points: t.points, done: false }));
  const done = (doneResult.data ?? [])
    .filter((t) => t.completed_at && localDayOf(t.completed_at, me.timezone) === today)
    .map((t) => ({ id: t.id, content: t.content, points: t.points, done: true }));
  const partner = partnerResult.data;

  return inLang(lang, () => {
    const name = displayName(partner?.display_name);
    return {
      v: 1 as const,
      title: tr('Дела на сегодня', 'Today’s to-dos'),
      empty: !partner
        ? tr('Позовите партнёра — код в настройках', 'Invite your partner — the code is in settings')
        : done.length > 0
          ? tr('Всё сделано — спасибо!', 'All done — thank you!')
          : tr(`${name} пока ни о чём не просит`, `${name} hasn’t asked for anything yet`),
      left: open.length > 0 ? tr(`осталось ${open.length}`, `${open.length} left`) : '',
      open: open.length,
      items: [...open, ...done].slice(0, LIMIT),
      updatedAt: new Date().toISOString(),
    };
  });
}

function localDayOf(iso: string, timezone: string | null) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone || 'UTC' }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

export async function GET(request: Request) {
  const auth = await authorizeWidget(request);
  if ('response' in auth) return auth.response;
  const payload = await build(auth.admin, auth.userId);
  if (!payload) return Response.json({ error: 'no-profile' }, { status: 404 });
  return Response.json(payload, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const auth = await authorizeWidget(request);
  if ('response' in auth) return auth.response;
  const { admin, userId } = auth;

  const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
  const id = typeof body?.id === 'string' ? body.id : null;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: 'bad-request' }, { status: 400 });

  const { data: me } = await admin.from('profiles').select('space_id').eq('id', userId).maybeSingle();
  if (!me?.space_id) return Response.json({ error: 'no-space' }, { status: 404 });

  const { data: task } = await admin
    .from('checklist_items')
    .select('id, user_id, is_completed')
    .eq('id', id)
    .eq('space_id', me.space_id)
    .maybeSingle();
  /* Only a request made to you: never your own, never another couple's. */
  if (!task || task.user_id === userId) return Response.json({ error: 'not-found' }, { status: 404 });

  if (!task.is_completed) {
    /*
      Guarded on is_completed: a double tap, or the app and the widget at once,
      complete it once. The database pays the points in the same statement
      (bp_task_points, migration 0017), at most once per request.
    */
    const { data: completed, error: completeError } = await admin
      .from('checklist_items')
      .update({ is_completed: true, completed_by: userId, completed_at: new Date().toISOString() })
      .eq('id', id)
      .eq('is_completed', false)
      .select('id');

    if (completeError) return Response.json({ error: 'failed' }, { status: 500 });
    if (completed && completed.length > 0 && pushConfigured()) await claimAndDeliver(admin, me.space_id).catch(() => 0);
  }

  const payload = await build(admin, userId);
  return Response.json(payload, { headers: { 'Cache-Control': 'no-store' } });
}
