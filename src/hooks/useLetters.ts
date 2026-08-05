'use client';

import { useCallback, useEffect, useState } from 'react';
import supabase from '@/lib/supabase';
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
  reveal_after_day: boolean;
  is_read: boolean;
  created_at: string;
}

export function isDelivered(letter: Letter) {
  if (letter.status === 'delivered') return true;
  if (letter.status !== 'scheduled' || !letter.deliver_at) return false;
  return new Date(letter.deliver_at) <= new Date();
}

export function useLetters() {
  const { user, spaceId } = useSpaceAuth();
  const [letters, setLetters] = useState<Letter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user || !spaceId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);

    /*
      RLS returns only letters this user may actually read. Sealed ones never
      arrive as rows, so their arrival is fetched separately without content —
      the recipient learns a letter is waiting, not what it says.
    */
    const [{ data, error: loadError }, inbox] = await Promise.all([
      supabase
        .from('letters')
        .select('id, author_id, recipient_id, title, content, status, deliver_at, reveal_after_day, is_read, created_at')
        .eq('space_id', spaceId)
        .order('created_at', { ascending: false }),
      supabase.rpc('letter_inbox'),
    ]);

    const readable = (data ?? []) as Letter[];
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
        reveal_after_day: true,
        is_read: false,
        created_at: row.created_at,
      }));

    setLetters(
      [...readable, ...sealed].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    );
    setError(loadError ? 'Не удалось загрузить письма. Проверьте связь и обновите страницу.' : null);
    setIsLoading(false);
  }, [user, spaceId]);

  useEffect(() => {
    load();
  }, [load]);

  const create = useCallback(
    async (input: {
      recipientId: string;
      title: string;
      content: string;
      status: LetterStatus;
      deliverAt: string | null;
      revealAfterDay: boolean;
    }) => {
      if (!user || !spaceId) return false;

      const { error: saveError } = await supabase.from('letters').insert({
        space_id: spaceId,
        author_id: user.id,
        recipient_id: input.recipientId,
        title: input.title,
        content: input.content,
        status: input.status,
        deliver_at: input.deliverAt,
        reveal_after_day: input.revealAfterDay,
      });

      if (saveError) {
        setError('Письмо не сохранилось. Попробуйте ещё раз.');
        return false;
      }
      await load();
      return true;
    },
    [user, spaceId, load],
  );

  /* Cancellable until delivered — irreversibility begins at delivery. */
  const cancelScheduled = useCallback(
    async (id: string) => {
      const { error: cancelError } = await supabase
        .from('letters')
        .update({ status: 'draft', deliver_at: null })
        .eq('id', id)
        .eq('status', 'scheduled');

      if (cancelError) {
        setError('Не удалось отменить отправку. Возможно, письмо уже доставлено.');
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

  return { letters, isLoading, error, create, cancelScheduled, remove, reload: load };
}
