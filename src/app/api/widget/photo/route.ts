import { authorizeWidget } from '@/lib/widgetAuth';
import { ALBUM_ROTATION_MS, albumIndex } from '@/lib/album';
import { BUCKET } from '@/lib/media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/*
  The «Фото» widget's picture. Every few hours the next photo of the couple's
  album, the same one on both phones (the index comes from the clock, not from
  the device). The photo's id is its ETag: a widget that already shows it gets
  304 and downloads nothing.

  204 — the album is empty; the widget invites to add photos.
*/
export async function GET(request: Request) {
  const auth = await authorizeWidget(request);
  if ('response' in auth) return auth.response;
  const { admin, userId } = auth;

  const { data: profile } = await admin.from('profiles').select('space_id').eq('id', userId).maybeSingle();
  if (!profile?.space_id) return Response.json({ error: 'no-space' }, { status: 404 });

  const { data: photos } = await admin
    .from('album_photos')
    .select('id, path')
    .eq('space_id', profile.space_id)
    .order('created_at', { ascending: true });
  if (!photos || photos.length === 0) return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });

  const photo = photos[albumIndex(photos.length)];
  const etag = `"${photo.id}"`;
  const headers = {
    ETag: etag,
    'Cache-Control': 'no-store',
    /* When the next photo is due, so a widget can plan its next look. */
    'X-Next-Change': String(Math.ceil(Date.now() / ALBUM_ROTATION_MS) * ALBUM_ROTATION_MS),
  };
  if (request.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers });

  const { data: file, error } = await admin.storage.from(BUCKET).download(photo.path);
  if (error || !file) return Response.json({ error: 'missing' }, { status: 502 });

  return new Response(await file.arrayBuffer(), {
    status: 200,
    headers: { ...headers, 'Content-Type': file.type || 'image/jpeg' },
  });
}
