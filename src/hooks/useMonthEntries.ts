'use client';

import { useCallback, useEffect, useState } from 'react';
import supabase from '@/lib/supabase';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';

export interface DayMark {
  /* Mood is present only where the reciprocity gate has opened. */
  mineMood: number | null;
  theirsMood: number | null;
  /* Presence is always visible: "a day exists here", without its content. */
  mineMarked: boolean;
  theirsMarked: boolean;
}

function emptyMark(): DayMark {
  return { mineMood: null, theirsMood: null, mineMarked: false, theirsMarked: false };
}

export function useMonthEntries(fromISO: string, toISO: string) {
  const { user, spaceId } = useSpaceAuth();
  const [marks, setMarks] = useState<Record<string, DayMark>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user || !spaceId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);

    const [moodResult, presenceResult] = await Promise.all([
      supabase
        .from('day_entries')
        .select('user_id, entry_date, mood')
        .eq('space_id', spaceId)
        .gte('entry_date', fromISO)
        .lte('entry_date', toISO),
      supabase.rpc('day_presence_for_space', { target_space: spaceId }),
    ]);

    const next: Record<string, DayMark> = {};

    for (const row of (presenceResult.data ?? []) as { user_id: string; entry_date: string }[]) {
      if (row.entry_date < fromISO || row.entry_date > toISO) continue;
      const slot = (next[row.entry_date] ??= emptyMark());
      if (row.user_id === user.id) slot.mineMarked = true;
      else slot.theirsMarked = true;
    }

    for (const row of (moodResult.data ?? []) as { user_id: string; entry_date: string; mood: number }[]) {
      const slot = (next[row.entry_date] ??= emptyMark());
      if (row.user_id === user.id) {
        slot.mineMood = row.mood;
        slot.mineMarked = true;
      } else {
        slot.theirsMood = row.mood;
        slot.theirsMarked = true;
      }
    }

    setMarks(next);
    /* An unreported failure renders an empty month, which reads as "you never marked a day". */
    setError(
      moodResult.error || presenceResult.error
        ? 'Не удалось загрузить месяц. Проверьте связь и обновите страницу.'
        : null,
    );
    setIsLoading(false);
  }, [user, spaceId, fromISO, toISO]);

  useEffect(() => {
    load();
  }, [load]);

  return { marks, isLoading, error };
}
