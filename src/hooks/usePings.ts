'use client';

import { useCallback, useEffect, useState } from 'react';
import supabase from '@/lib/supabase';
import { MAX_UPLOAD_BYTES, uploadMedia } from '@/lib/media';
import { flushPush } from '@/lib/push';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';

export interface Ping {
  id: string;
  author_id: string;
  body: string;
  photo_path: string | null;
  voice_path: string | null;
  voice_ms: number | null;
  track_url: string | null;
  track_title: string | null;
  track_artist: string | null;
  created_at: string;
}

export interface PingDraft {
  body: string;
  photo: File | null;
  voice: { blob: Blob; ms: number } | null;
  track: { url: string; title: string; artist: string } | null;
}

export function usePings() {
  const { user, spaceId } = useSpaceAuth();
  const [pings, setPings] = useState<Ping[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!spaceId) return;
    const { data, error: loadError } = await supabase
      .from('pings')
      .select('id, author_id, body, photo_path, voice_path, voice_ms, track_url, track_title, track_artist, created_at')
      .eq('space_id', spaceId)
      .order('created_at', { ascending: false })
      .limit(300);
    if (!loadError) setPings((data ?? []) as Ping[]);
    setError(loadError ? 'Не удалось загрузить летопись. Проверьте связь и обновите страницу.' : null);
    setIsLoading(false);
  }, [spaceId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!spaceId) return;
    const channel = supabase
      .channel(`pings:${spaceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pings', filter: `space_id=eq.${spaceId}` }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [spaceId, load]);

  const send = useCallback(
    async (draft: PingDraft) => {
      if (!user || !spaceId) return false;
      setError(null);

      if (draft.photo && draft.photo.size > MAX_UPLOAD_BYTES) {
        setError('Снимок больше 50 МБ. Выберите поменьше.');
        return false;
      }

      try {
        const [photoPath, voicePath] = await Promise.all([
          draft.photo ? uploadMedia(spaceId, 'pings', draft.photo) : Promise.resolve(null),
          draft.voice ? uploadMedia(spaceId, 'pings', draft.voice.blob) : Promise.resolve(null),
        ]);

        const { error: insertError } = await supabase.from('pings').insert({
          space_id: spaceId,
          author_id: user.id,
          body: draft.body.trim(),
          photo_path: photoPath,
          voice_path: voicePath,
          voice_ms: draft.voice ? Math.round(draft.voice.ms) : null,
          track_url: draft.track?.url.trim() || null,
          track_title: draft.track?.title.trim() || null,
          track_artist: draft.track?.artist.trim() || null,
        });
        if (insertError) throw insertError;
      } catch {
        setError('Весточка не ушла. Проверьте связь и попробуйте ещё раз.');
        return false;
      }

      flushPush();
      await load();
      return true;
    },
    [user, spaceId, load],
  );

  const remove = useCallback(
    async (id: string) => {
      const { error: removeError } = await supabase.from('pings').delete().eq('id', id);
      if (removeError) setError('Запись не удалилась.');
      await load();
    },
    [load],
  );

  return { pings, isLoading, error, send, remove, reload: load };
}
