import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { buildSnapshot } from '@/lib/widgetSnapshot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/*
  The one endpoint a home-screen widget calls. Authorised by a widget key, not
  a session: the key is read-only by construction — this route can only ever
  return the owner's own snapshot.
*/
export async function GET(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return Response.json({ error: 'not-configured' }, { status: 503 });
  }

  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!token || token.length < 32) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const hash = createHash('sha256').update(token, 'utf8').digest('hex');

  const { data: row } = await admin
    .from('widget_tokens')
    .select('id, user_id, last_used_at')
    .eq('token_hash', hash)
    .maybeSingle();

  /* Revoked or unknown: the widget shows «подключите заново» instead of stale data. */
  if (!row) return Response.json({ error: 'revoked' }, { status: 401 });

  const lastUsed = row.last_used_at ? new Date(row.last_used_at).getTime() : 0;
  if (Date.now() - lastUsed > 60 * 60 * 1000) {
    await admin.from('widget_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', row.id);
  }

  const snapshot = await buildSnapshot(admin, row.user_id);
  if (!snapshot) return Response.json({ error: 'no-profile' }, { status: 404 });

  return Response.json(snapshot, { headers: { 'Cache-Control': 'no-store' } });
}
