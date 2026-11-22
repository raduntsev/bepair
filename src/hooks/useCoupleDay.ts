'use client';

import { useCallback, useEffect, useState, useId } from 'react';
import supabase from '@/lib/supabase';
import { todayISO } from '@/lib/dates';
import { flushPush } from '@/lib/push';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { tr } from '@/lib/i18n';

export { todayISO };
export type { Partner } from '@/hooks/useSpaceAuth';

export interface DayEntry {
  user_id: string;
  entry_date: string;
  mood: number;
  note: string;
  updated_at: string;
}

export function useCoupleDay(date: string) {
  /* Two components on one screen may use this hook; a shared channel name would make the second subscription throw. */
  const instance = useId();
  const { user, spaceId, partner, settings } = useSpaceAuth();

  const [mine, setMine] = useState<DayEntry | null>(null);
  const [theirs, setTheirs] = useState<DayEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user || !spaceId) {
      setIsLoading(false);
      return;
    }

    /* RLS returns the partner's row only once yours exists — the gate lives in SQL. */
    const { data, error: loadError } = await supabase
      .from('day_entries')
      .select('user_id, entry_date, mood, note, updated_at')
      .eq('space_id', spaceId)
      .eq('entry_date', date);

    if (loadError) {
      setError(tr('Не удалось загрузить день. Проверьте связь и обновите страницу.', 'Couldn’t load the day. Check your connection and reload.'));
    } else {
      const rows = (data ?? []) as DayEntry[];
      setMine(rows.find((row) => row.user_id === user.id) ?? null);
      setTheirs(rows.find((row) => row.user_id !== user.id) ?? null);
      setError(null);
    }
    setIsLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the id: a re-issued user object is the same person
  }, [user?.id, spaceId, date]);

  /* The spinner only for a different day; a background re-read keeps what is on screen. */
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const loadKey = `${user?.id}:${spaceId}:${date}`;
  if (loadedFor !== loadKey) {
    setLoadedFor(loadKey);
    setIsLoading(true);
  }

  useEffect(() => {
    load();
  }, [load]);

  /* The partner marking their day while you look at yours. */
  useEffect(() => {
    if (!spaceId) return;
    const channel = supabase
      .channel(`day:${spaceId}:${date}:${instance}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'day_entries', filter: `space_id=eq.${spaceId}` }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [spaceId, date, instance, load]);

  const save = useCallback(
    async (mood: number, note: string) => {
      if (!user || !spaceId) return false;
      const { error: saveError } = await supabase
        .from('day_entries')
        .upsert(
          { space_id: spaceId, user_id: user.id, entry_date: date, mood, note, updated_at: new Date().toISOString() },
          { onConflict: 'user_id,entry_date' },
        );

      if (saveError) {
        setError(tr('Не удалось сохранить день. Проверьте связь и попробуйте ещё раз.', 'Couldn’t save the day. Check your connection and try again.'));
        return false;
      }
      flushPush();
      await load();
      return true;
    },
    [user, spaceId, date, load],
  );

  const revealFirst = settings?.reveal_first ?? true;

  return {
    partner,
    mine,
    theirs,
    isLoading,
    error,
    save,
    reload: load,
    /* With «сначала свой день» switched off by both, the partner's day is open anyway. */
    isUnlocked: mine !== null || !revealFirst,
    isToday: date === todayISO(),
  };
}
