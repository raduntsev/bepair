'use client';

import { useCallback, useEffect, useState } from 'react';
import supabase from '@/lib/supabase';
import { kindOf, MAX_UPLOAD_BYTES, uploadMedia, type MediaItem } from '@/lib/media';
import { flushPush } from '@/lib/push';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';

export type LetterStatus = 'draft' | 'scheduled' | 'delivered';

export interface Letter {
  id: string;
  author_id: string;
  recipient_id: string;
  title: string;
  content: string | null;
  status: LetterStatus;
  deliver_at: string | null;
  delivered_at: string | null;
  reveal_after_day: boolean;
  is_read: boolean;
  media: MediaItem[];
  created_at: string;
  /* Arrived, but closed until the reader marks a day — no content was sent. */
  sealed?: boolean;
}

export interface LetterInput {
  title: string;
  content: string;
  status: LetterStatus;
  deliverAt: string | null;
  revealAfterDay: boolean;
  keep: MediaItem[];
  files: (File | Blob)[];
}

const COLUMNS =
  'id, author_id, recipient_id, title, content, status, deliver_at, delivered_at, reveal_after_day, is_read, media, created_at';

export function isDelivered(letter: Letter) {
  return letter.status === 'delivered' || !!letter.delivered_at || !!letter.sealed;
}

export function letterTime(letter: Letter) {
  /* Undelivered letters are dated by when they were written; the chip carries the delivery time. */
  return letter.delivered_at ?? letter.created_at;
}

export function useLetters() {
  const { user, spaceId, partner } = useSpaceAuth();
  const [letters, setLetters] = useState<Letter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user || !spaceId) {
      setIsLoading(false);
      return;
    }

    /* Hand over anything whose scheduled time has passed before reading. */
    await supabase.rpc('bp_deliver_due');

    /*
      RLS returns only letters this user may actually read. Sealed ones never
      arrive as rows, so their arrival comes separately and without content.
    */
    const [{ data, error: loadError }, inbox] = await Promise.all([
      supabase.from('letters').select(COLUMNS).eq('space_id', spaceId).order('created_at', { ascending: false }),
      supabase.rpc('letter_inbox'),
    ]);

    const readable = ((data ?? []) as Letter[]).map((l) => ({ ...l, media: Array.isArray(l.media) ? l.media : [] }));
    const sealed: Letter[] = ((inbox.data ?? []) as { id: string; author_id: string; created_at: string }[])
      .filter((row) => !readable.some((letter) => letter.id === row.id))
      .map((row) => ({
        id: row.id,
        author_id: row.author_id,
        recipient_id: user.id,
        title: '',
        content: null,
        status: 'delivered',
        deliver_at: null,
        delivered_at: row.created_at,
        reveal_after_day: true,
        is_read: false,
        media: [],
        created_at: row.created_at,
        sealed: true,
      }));

    /* Someone else's draft never reaches this list: RLS keeps it with its author. */
    setLetters([...readable, ...sealed].sort((a, b) => letterTime(b).localeCompare(letterTime(a))));
    setError(loadError ? 'Не удалось загрузить письма. Проверьте связь и обновите страницу.' : null);
    setIsLoading(false);
  }, [user, spaceId]);

  useEffect(() => {
    load();
  }, [load]);

  const uploadAll = useCallback(
    async (files: (File | Blob)[]) => {
      if (!spaceId) return [];
      const items: MediaItem[] = [];
      for (const file of files) {
        if (file.size > MAX_UPLOAD_BYTES) throw new Error('too-big');
        const path = await uploadMedia(spaceId, 'letters', file);
        const name = 'name' in file ? (file as File).name : undefined;
        items.push({ path, kind: name ? kindOf(file) : 'voice', name: name ?? 'Голосовое' });
      }
      return items;
    },
    [spaceId],
  );

  const save = useCallback(
    async (input: LetterInput, existingId?: string) => {
      if (!user || !spaceId || !partner) return false;
      setError(null);

      let media: MediaItem[];
      try {
        media = [...input.keep, ...(await uploadAll(input.files))];
      } catch (uploadError) {
        setError(
          uploadError instanceof Error && uploadError.message === 'too-big'
            ? 'Один из файлов больше 50 МБ. Уберите его или сожмите.'
            : 'Вложения не загрузились. Проверьте связь и попробуйте ещё раз.',
        );
        return false;
      }

      const row = {
        title: input.title,
        content: input.content,
        status: input.status,
        deliver_at: input.deliverAt,
        reveal_after_day: input.revealAfterDay,
        media,
      };

      const { error: saveError } = existingId
        ? await supabase.from('letters').update(row).eq('id', existingId)
        : await supabase.from('letters').insert({ ...row, space_id: spaceId, author_id: user.id, recipient_id: partner.id });

      if (saveError) {
        setError('Письмо не сохранилось. Попробуйте ещё раз.');
        return false;
      }
      if (input.status !== 'draft') flushPush();
      await load();
      return true;
    },
    [user, spaceId, partner, uploadAll, load],
  );

  /* Cancellable until delivered — irreversibility begins at delivery. */
  const cancelScheduled = useCallback(
    async (id: string) => {
      const { data, error: cancelError } = await supabase
        .from('letters')
        .update({ status: 'draft', deliver_at: null })
        .eq('id', id)
        .eq('status', 'scheduled')
        .select('id');
      if (cancelError || !data?.length) {
        setError('Не удалось отменить отправку — похоже, письмо уже доставлено.');
        await load();
        return false;
      }
      await load();
      return true;
    },
    [load],
  );

  const remove = useCallback(
    async (id: string) => {
      await supabase.from('letters').delete().eq('id', id).eq('status', 'draft');
      await load();
    },
    [load],
  );

  const markRead = useCallback(async (id: string) => {
    setLetters((list) => list.map((l) => (l.id === id ? { ...l, is_read: true } : l)));
    await supabase.rpc('bp_mark_letter_read', { letter: id });
  }, []);

  return { letters, isLoading, error, save, cancelScheduled, remove, markRead, reload: load };
}
