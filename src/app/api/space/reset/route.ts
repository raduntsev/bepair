import { adminClient } from '@/lib/pushDelivery';
import { BUCKET } from '@/lib/media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/*
  Deletes everything a couple has: their files, then the space and every row
  in it. Both accounts stay, unlinked. Allowed only when it was agreed — the
  caller is answering their partner's proposal — or when the caller is alone
  in the space. The proposal itself is bp_propose_reset (0013).
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

  const [{ data: members }, { data: settings }] = await Promise.all([
    admin.from('profiles').select('id').eq('space_id', spaceId),
    admin.from('space_settings').select('pending_key, pending_by').eq('space_id', spaceId).maybeSingle(),
  ]);
  const partner = (members ?? []).map((m) => m.id as string).find((id) => id !== auth.user!.id);
  const agreed = settings?.pending_key === 'reset_space' && !!partner && settings.pending_by === partner;
  if (partner && !agreed) return Response.json({ error: 'not-agreed' }, { status: 403 });

  /* Files first: once the space row is gone, nothing points at them any more. */
  const paths = await listAll(admin, spaceId);
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await admin.storage.from(BUCKET).remove(paths.slice(i, i + 100));
    if (error) return Response.json({ error: 'storage' }, { status: 502 });
  }

  const { error } = await admin.rpc('bp_reset_space', { sp: spaceId });
  if (error) return Response.json({ error: 'database' }, { status: 500 });

  return Response.json({ ok: true, files: paths.length });
}

/* Every file under <space>/, through its sub-folders. */
async function listAll(admin: ReturnType<typeof adminClient>, prefix: string): Promise<string[]> {
  const out: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin.storage.from(BUCKET).list(prefix, { limit: 1000, offset });
    if (error || !data || data.length === 0) break;
    for (const item of data) {
      const path = `${prefix}/${item.name}`;
      /* Folders come back without an id. */
      if (item.id) out.push(path);
      else out.push(...(await listAll(admin, path)));
    }
    if (data.length < 1000) break;
  }
  return out;
}
