import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import { noticeHref, noticeText, pushPreference, type NoticeKind } from '@/lib/notices';
import { displayName } from '@/lib/words';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/*
  Delivers the space's not-yet-pushed notifications to the recipients' devices.
  Any signed-in member may trigger it; it only ever sends what the database
  triggers already wrote, to the people they were written for, in wording that
  states a fact and never sealed content.
*/

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:hello@example.com';

interface Row {
  id: string;
  user_id: string;
  actor_id: string | null;
  kind: NoticeKind;
  payload: Record<string, unknown> | null;
}

export async function POST(request: Request) {
  if (!URL || !SERVICE_KEY || !VAPID_PUBLIC || !VAPID_PRIVATE) {
    return Response.json({ configured: false, sent: 0 });
  }

  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const admin = createClient(URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth } = await admin.auth.getUser(token);
  if (!auth.user) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const { data: me } = await admin.from('profiles').select('space_id').eq('id', auth.user.id).maybeSingle();
  const spaceId = me?.space_id as string | undefined;
  if (!spaceId) return Response.json({ sent: 0 });

  /*
    Claim before sending, so two simultaneous flushes never double-notify.
    Anything older than a day is marked without sending: a push about
    yesterday is noise, and the feed already holds it.
  */
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  await admin.from('notifications').update({ pushed_at: new Date().toISOString() }).eq('space_id', spaceId).is('pushed_at', null).lt('created_at', since);

  const { data: claimed } = await admin
    .from('notifications')
    .update({ pushed_at: new Date().toISOString() })
    .eq('space_id', spaceId)
    .is('pushed_at', null)
    .select('id, user_id, actor_id, kind, payload');

  const rows = (claimed ?? []) as Row[];
  if (rows.length === 0) return Response.json({ sent: 0 });

  const people = [...new Set(rows.flatMap((r) => [r.user_id, r.actor_id]).filter(Boolean))] as string[];
  const [{ data: profiles }, { data: subscriptions }] = await Promise.all([
    admin
      .from('profiles')
      .select('id, display_name, gender, notify_pings, notify_day, notify_tasks, notify_letters, notify_sound')
      .in('id', people),
    admin.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth').in('user_id', [...new Set(rows.map((r) => r.user_id))]),
  ]);

  const byId = new Map((profiles ?? []).map((p) => [p.id as string, p as Record<string, unknown>]));
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

  let sent = 0;
  const dead: string[] = [];

  for (const row of rows) {
    const recipient = byId.get(row.user_id);
    if (!recipient) continue;
    const pref = pushPreference(row.kind);
    if (pref && recipient[pref] === false) continue;

    const actor = row.actor_id ? byId.get(row.actor_id) : undefined;
    const name = displayName(actor?.display_name as string | undefined);
    const body = noticeText({ kind: row.kind, payload: row.payload }, name, actor?.gender as 'm' | 'f' | null);
    const silent = row.kind !== 'ping' && recipient.notify_sound === false;

    const message = JSON.stringify({ title: 'Впаре', body, url: noticeHref(row.kind), tag: row.kind === 'day' ? 'day' : row.id, silent });

    for (const sub of (subscriptions ?? []).filter((s) => s.user_id === row.user_id)) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, message, { TTL: 60 * 60 * 12 });
        sent += 1;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) dead.push(sub.id as string);
      }
    }
  }

  if (dead.length) await admin.from('push_subscriptions').delete().in('id', dead);
  return Response.json({ sent });
}
