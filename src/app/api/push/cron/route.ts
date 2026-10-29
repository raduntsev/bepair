import { timingSafeEqual } from 'node:crypto';
import { adminClient, claimAndDeliver, pushConfigured } from '@/lib/pushDelivery';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/*
  Called by the database every five minutes (pg_cron → pg_net, see
  0004_bepair_reminders.sql) right after it has queued the morning and evening
  reminders. Delivers every space's unsent notifications, which also catches
  anything a client failed to flush. Guarded by CRON_SECRET, which must match
  `cron_secret` in public.bp_server_config.
*/
function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!secret || !given) return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ error: 'unauthorized' }, { status: 401 });
  if (!pushConfigured()) return Response.json({ configured: false, sent: 0 });
  return Response.json({ sent: await claimAndDeliver(adminClient(), null) });
}
