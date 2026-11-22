import supabase from './supabase';

export const BUCKET = 'bepair';

export type MediaKind = 'image' | 'video' | 'audio' | 'voice' | 'file';

export interface MediaItem {
  path: string;
  kind: MediaKind;
  name?: string;
}

export function kindOf(file: Blob & { name?: string }): MediaKind {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return 'file';
}

function extension(file: Blob & { name?: string }) {
  const fromName = file.name?.split('.').pop();
  if (fromName && fromName.length <= 5) return fromName.toLowerCase();
  const fromType = file.type.split('/')[1]?.split(';')[0];
  return fromType || 'bin';
}

/*
  Files live under the space's own folder: storage policies admit only paths
  whose first segment is the reader's space, so another couple cannot read them.
*/
export async function uploadMedia(spaceId: string, folder: string, file: Blob & { name?: string }) {
  const path = `${spaceId}/${folder}/${crypto.randomUUID()}.${extension(file)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) throw error;
  return path;
}

const cache = new Map<string, { url: string; expires: number }>();

export async function signedUrl(path: string) {
  const hit = cache.get(path);
  if (hit && hit.expires > Date.now()) return hit.url;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
  if (error || !data) return null;
  cache.set(path, { url: data.signedUrl, expires: Date.now() + 55 * 60 * 1000 });
  return data.signedUrl;
}

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/*
  An avatar is a square photo, cut from the centre and scaled to 512 px on the
  phone, so a 12 MB camera shot uploads as ~60 KB and every circle is sharp.
*/
export async function squareImage(file: Blob, size = 512): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no-canvas');
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('no-blob'))), 'image/jpeg', 0.86),
  );
}
