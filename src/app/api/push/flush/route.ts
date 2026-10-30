import { adminClient, claimAndDeliver, pushConfigured } from '@/lib/pushDelivery';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/*
  Delivers the caller's space's not-yet-pushed notifications right after an
  action. Any signed-in member may trigger it; see `claimAndDeliver` for what
  it is allowed to send.
*/
export async function POST(request: Request) {
  if (!pushConfigured()) return Response.json({ configured: false, sent: 0 });

  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const admin = adminClient();
  const { data: auth } = await admin.auth.getUser(token);
  if (!auth.user) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const { data: me } = await admin.from('profiles').select('space_id').eq('id', auth.user.id).maybeSingle();
  const spaceId = me?.space_id as string | undefined;
  if (!spaceId) return Response.json({ sent: 0 });

  return Response.json({ sent: await claimAndDeliver(admin, spaceId) });
}
