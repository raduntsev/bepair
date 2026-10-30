import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import { noticeHref, noticeText, pushPreference, type NoticeKind } from '@/lib/notices';
import { apnsConfigured, fcmConfigured, sendApns, sendFcm, type PushMessage } from '@/lib/nativePush';
import { displayName } from '@/lib/words';

/*
  Shared by both delivery routes: /api/push/flush (a member's action, one space)
  and /api/push/cron (the scheduler, every space). It only ever sends what the
  database already wrote, to the people it was written for, in wording that
  states a fact and never sealed content.
*/

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:hello@example.com';

const webReady = () => !!(VAPID_PUBLIC && VAPID_PRIVATE);

interface Row {
  id: string;
  user_id: string;
  actor_id: string | null;
  kind: NoticeKind;
  payload: Record<string, unknown> | null;
}

export function pushConfigured() {
  return !!(URL && SERVICE_KEY && (webReady() || fcmConfigured() || apnsConfigured()));
}

export function adminClient(): SupabaseClient {
  return createClient(URL!, SERVICE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
}

/* `spaceId` limits delivery to one space; `null` means every space. */
export async function claimAndDeliver(admin: SupabaseClient, spaceId: string | null) {
  /*
    Claim before sending, so two simultaneous deliveries never double-notify.
    Anything older than a day is marked without sending: a push about
    yesterday is noise, and the feed already holds it.
  */
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  let stale = admin.from('notifications').update({ pushed_at: new Date().toISOString() }).is('pushed_at', null).lt('created_at', since);
  if (spaceId) stale = stale.eq('space_id', spaceId);
  await stale;

  let fresh = admin.from('notifications').update({ pushed_at: new Date().toISOString() }).is('pushed_at', null);
  if (spaceId) fresh = fresh.eq('space_id', spaceId);
  const { data: claimed } = await fresh.select('id, user_id, actor_id, kind, payload');

  const rows = (claimed ?? []) as Row[];
  if (rows.length === 0) return 0;

  const people = [...new Set(rows.flatMap((r) => [r.user_id, r.actor_id]).filter(Boolean))] as string[];
  const [{ data: profiles }, { data: subscriptions }] = await Promise.all([
    admin
      .from('profiles')
      .select('id, display_name, gender, notify_pings, notify_day, notify_tasks, notify_letters, notify_sound')
      .in('id', people),
    admin.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth, kind').in('user_id', [...new Set(rows.map((r) => r.user_id))]),
  ]);

  const byId = new Map((profiles ?? []).map((p) => [p.id as string, p as Record<string, unknown>]));
  if (webReady()) webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC!, VAPID_PRIVATE!);

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

    const push: PushMessage = {
      title: 'Впаре',
      body,
      url: noticeHref(row.kind, row.payload),
      tag: row.kind === 'day' || row.kind.startsWith('remind_') ? row.kind : row.id,
      silent,
    };
    const message = JSON.stringify(push);

    for (const sub of (subscriptions ?? []).filter((s) => s.user_id === row.user_id)) {
      /* Native devices: FCM for Android, APNs for iPhone. */
      if (sub.kind === 'fcm' || sub.kind === 'apns') {
        const result = sub.kind === 'fcm' ? await sendFcm(sub.endpoint, push) : await sendApns(sub.endpoint, push);
        if (result === 'ok') sent += 1;
        if (result === 'dead') dead.push(sub.id as string);
        continue;
      }
      if (!webReady()) continue;
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
  return sent;
}
