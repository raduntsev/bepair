import 'server-only';
import { createHash } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/*
  Shared by every widget endpoint: a widget authorises with its own key, never
  a session. The key reads the owner's own widget data; the only things it may
  change are ticking off a request made to its owner (/api/widget/tasks) and
  the owner's own point on the map, while they share it (/api/widget/location).
  Returns the service client and the key's owner, or the response to send
  instead.
*/
export async function authorizeWidget(
  request: Request,
): Promise<{ admin: SupabaseClient; userId: string } | { response: Response }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return { response: Response.json({ error: 'not-configured' }, { status: 503 }) };

  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!token || token.length < 32) return { response: Response.json({ error: 'unauthorized' }, { status: 401 }) };

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const hash = createHash('sha256').update(token, 'utf8').digest('hex');
  const { data: row } = await admin.from('widget_tokens').select('id, user_id, last_used_at').eq('token_hash', hash).maybeSingle();

  /* Revoked or unknown: the widget shows «подключите заново» instead of stale data. */
  if (!row) return { response: Response.json({ error: 'revoked' }, { status: 401 }) };

  const lastUsed = row.last_used_at ? new Date(row.last_used_at).getTime() : 0;
  if (Date.now() - lastUsed > 60 * 60 * 1000) {
    await admin.from('widget_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', row.id);
  }
  return { admin, userId: row.user_id as string };
}
