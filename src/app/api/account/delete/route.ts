import { adminClient, claimAndDeliver, pushConfigured } from '@/lib/pushDelivery';
import { listFiles, removeFiles } from '@/lib/storageAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/*
  Deletes the caller's account and everything they wrote (0020).

  With a partner: the caller leaves the pair first — the partner is told and
  keeps what they wrote themselves — then the caller's own rows and files go.
  Alone in the space: the whole space goes, as with «Удалить все данные пары».

  Files first, while the rows still say which files are theirs; if storage
  refuses, nothing else is touched and the person can simply try again.
*/
export async function POST(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const admin = adminClient();
  const { data: auth } = await admin.auth.getUser(token);
  if (!auth.user) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const uid = auth.user.id;

  const { data: me } = await admin.from('profiles').select('space_id').eq('id', uid).maybeSingle();
  const spaceId = (me?.space_id as string | null | undefined) ?? null;

  let alone = true;
  if (spaceId) {
    const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('space_id', spaceId).neq('id', uid);
    alone = (count ?? 0) === 0;
  }

  let paths: string[];
  if (spaceId && alone) {
    paths = await listFiles(admin, spaceId);
  } else {
    const { data, error } = await admin.rpc('bp_account_files', { uid });
    if (error) return Response.json({ error: 'database' }, { status: 500 });
    paths = (data as string[] | null) ?? [];
  }
  if (!(await removeFiles(admin, paths))) return Response.json({ error: 'storage' }, { status: 502 });

  const { error: dataError } = await admin.rpc('bp_delete_account_data', { uid });
  if (dataError) return Response.json({ error: 'database' }, { status: 500 });

  /* The partner hears it now, not at the next cron tick. */
  if (spaceId && !alone && pushConfigured()) await claimAndDeliver(admin, spaceId).catch(() => 0);

  const { error: authError } = await admin.auth.admin.deleteUser(uid);
  if (authError) return Response.json({ error: 'auth' }, { status: 500 });

  return Response.json({ ok: true, files: paths.length });
}
