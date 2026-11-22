import { buildSnapshot } from '@/lib/widgetSnapshot';
import { authorizeWidget } from '@/lib/widgetAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/*
  The endpoint the day and couple widgets call. Authorised by a widget key, not
  a session: the key is read-only by construction — this route can only ever
  return the owner's own snapshot.
*/
export async function GET(request: Request) {
  const auth = await authorizeWidget(request);
  if ('response' in auth) return auth.response;

  const snapshot = await buildSnapshot(auth.admin, auth.userId);
  if (!snapshot) return Response.json({ error: 'no-profile' }, { status: 404 });

  return Response.json(snapshot, { headers: { 'Cache-Control': 'no-store' } });
}
