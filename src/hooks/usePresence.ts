'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import supabase from '@/lib/supabase';
import { todayISO } from '@/lib/dates';
import { streaks } from '@/lib/streak';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';

/* Presence only — who marked which date, never the mood. Enough for «комбо». */
export function usePresence() {
  const { user, spaceId } = useSpaceAuth();
  const [rows, setRows] = useState<{ user_id: string; entry_date: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!spaceId) return;
    const { data } = await supabase.rpc('day_presence_for_space', { target_space: spaceId });
    setRows((data ?? []) as { user_id: string; entry_date: string }[]);
    setIsLoading(false);
  }, [spaceId]);

  useEffect(() => {
    load();
  }, [load]);

  return useMemo(() => {
    const byDate = new Map<string, Set<string>>();
    for (const row of rows) {
      const set = byDate.get(row.entry_date) ?? new Set<string>();
      set.add(row.user_id);
      byDate.set(row.entry_date, set);
    }
    const both = new Set([...byDate].filter(([, users]) => users.size >= 2).map(([date]) => date));
    const mine = new Set(rows.filter((r) => r.user_id === user?.id).map((r) => r.entry_date));
    return { ...streaks(both, todayISO()), bothDays: both.size, myDays: mine.size, isLoading, reload: load };
  }, [rows, user?.id, isLoading, load]);
}
