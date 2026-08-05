'use client';

import { useCallback, useEffect, useState } from 'react';
import supabase from '@/lib/supabase';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';

export interface DayEntry {
  user_id: string;
  entry_date: string;
  mood: number;
  note: string;
  updated_at: string;
}

export interface Partner {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

export function todayISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

export function useCoupleDay(date: string) {
  const { user, spaceId } = useSpaceAuth();

  const [partner, setPartner] = useState<Partner | null>(null);
  const [mine, setMine] = useState<DayEntry | null>(null);
  const [theirs, setTheirs] = useState<DayEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user || !spaceId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);

    const [partnerResult, entriesResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .eq('space_id', spaceId)
        .neq('id', user.id)
        .maybeSingle(),
      supabase
        .from('day_entries')
        .select('user_id, entry_date, mood, note, updated_at')
        .eq('space_id', spaceId)
        .eq('entry_date', date),
    ]);

    /*
      A dropped partner error would render "you are here alone" to a paired user.
      Keep the last known partner rather than inventing an empty space.
    */
    if (!partnerResult.error) setPartner(partnerResult.data ?? null);

    const rows = (entriesResult.data ?? []) as DayEntry[];
    setMine(rows.find((row) => row.user_id === user.id) ?? null);
    setTheirs(rows.find((row) => row.user_id !== user.id) ?? null);
    setError(
      entriesResult.error || partnerResult.error
        ? 'Не удалось загрузить день. Проверьте связь и обновите страницу.'
        : null,
    );
    setIsLoading(false);
  }, [user, spaceId, date]);

  useEffect(() => {
    load();
  }, [load]);

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
        setError('Не удалось сохранить день. Проверьте связь и попробуйте ещё раз.');
        return false;
      }

      await load();
      return true;
    },
    [user, spaceId, date, load],
  );

  return {
    partner,
    mine,
    theirs,
    isLoading,
    error,
    save,
    reload: load,
    /* The partner's day only becomes readable once your own exists. */
    isUnlocked: mine !== null,
    isToday: date === todayISO(),
  };
}
