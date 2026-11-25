import { adminClient, claimAndDeliver, pushConfigured } from '@/lib/pushDelivery';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/*
  Leaving the pair, alone. The database does the leaving (bp_leave, 0020); the
  route exists so the partner's push goes out now — once the caller is out of
  the space, /api/push/flush no longer knows which space to deliver for.
*/
export async function POST(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const admin = adminClient();
  const { data: auth } = await admin.auth.getUser(token);
  if (!auth.user) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const { data: me } = await admin.from('profiles').select('space_id').eq('id', auth.user.id).maybeSingle();
  const spaceId = me?.space_id as string | undefined;
  if (!spaceId) return Response.json({ error: 'no-space' }, { status: 404 });

  const { data: result, error } = await admin.rpc('bp_leave', { uid: auth.user.id, deleting: false });
  if (error) return Response.json({ error: 'database' }, { status: 500 });
  if (result !== 'left') return Response.json({ error: result }, { status: 409 });

  if (pushConfigured()) await claimAndDeliver(admin, spaceId).catch(() => 0);
  return Response.json({ ok: true });
}
