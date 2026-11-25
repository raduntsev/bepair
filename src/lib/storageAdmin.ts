import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { BUCKET } from '@/lib/media';

/* Every file under <prefix>/, through its sub-folders. */
export async function listFiles(admin: SupabaseClient, prefix: string): Promise<string[]> {
  const out: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin.storage.from(BUCKET).list(prefix, { limit: 1000, offset });
    if (error || !data || data.length === 0) break;
    for (const item of data) {
      const path = `${prefix}/${item.name}`;
      /* Folders come back without an id. */
      if (item.id) out.push(path);
      else out.push(...(await listFiles(admin, path)));
    }
    if (data.length < 1000) break;
  }
  return out;
}

/* Removes in batches of 100; false if storage refused any of them. */
export async function removeFiles(admin: SupabaseClient, paths: string[]): Promise<boolean> {
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await admin.storage.from(BUCKET).remove(paths.slice(i, i + 100));
    if (error) return false;
  }
  return true;
}
