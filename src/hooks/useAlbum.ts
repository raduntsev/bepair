'use client';

import { useCallback, useEffect, useState } from 'react';
import supabase from '@/lib/supabase';
import { BUCKET, fitImage, uploadMedia } from '@/lib/media';
import { refreshWidgets } from '@/lib/native';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { tr } from '@/lib/i18n';

export interface AlbumPhoto {
  id: string;
  path: string;
  added_by: string | null;
  created_at: string;
}

/* The couple's album, oldest first — the order the widget walks through. */
export function useAlbum() {
  const { user, spaceId } = useSpaceAuth();
  const [photos, setPhotos] = useState<AlbumPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(0);

  const load = useCallback(async () => {
    if (!spaceId) return;
    const { data, error: loadError } = await supabase
      .from('album_photos')
      .select('id, path, added_by, created_at')
      .eq('space_id', spaceId)
      .order('created_at', { ascending: true });
    if (loadError) setError(tr('Не удалось загрузить фото. Проверьте связь и обновите страницу.', 'Couldn’t load photos. Check your connection and reload.'));
    else {
      setPhotos((data ?? []) as AlbumPhoto[]);
      setError(null);
    }
    setIsLoading(false);
  }, [spaceId]);

  useEffect(() => {
    load();
  }, [load]);

  const add = useCallback(
    async (files: File[]) => {
      if (!spaceId || !user || files.length === 0) return;
      setError(null);
      setAdding(files.length);
      let failed = 0;
      for (const file of files) {
        try {
          const path = await uploadMedia(spaceId, 'album', await fitImage(file));
          const { error: insertError } = await supabase.from('album_photos').insert({ space_id: spaceId, path, added_by: user.id });
          if (insertError) throw insertError;
        } catch {
          failed += 1;
        }
        setAdding((n) => n - 1);
      }
      if (failed) setError(failed === files.length ? tr('Фото не загрузились. Попробуйте ещё раз.', 'Photos didn’t upload. Please try again.') : tr(tr(`Не загрузилось фото: ${failed}.`, `${failed} photos didn’t upload.`), `${failed} photos didn’t upload.`));
      await load();
      refreshWidgets();
    },
    [spaceId, user, load],
  );

  const remove = useCallback(
    async (photo: AlbumPhoto) => {
      const { error: deleteError } = await supabase.from('album_photos').delete().eq('id', photo.id);
      if (deleteError) {
        setError(tr('Не получилось убрать фото.', 'Couldn’t remove the photo.'));
        return;
      }
      await supabase.storage.from(BUCKET).remove([photo.path]);
      await load();
      refreshWidgets();
    },
    [load],
  );

  return { photos, isLoading, error, adding, add, remove };
}
