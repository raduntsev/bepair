'use client';

import { useCallback, useEffect, useState } from 'react';
import supabase from '@/lib/supabase';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import type { ImportantDate } from '@/lib/importantDates';

/*
  Shared by the couple. Until migration 0006 is run the table does not exist:
  `available` is false and the calendar simply shows no dates section.
*/
export function useImportantDates() {
  const { user, spaceId } = useSpaceAuth();
  const [items, setItems] = useState<ImportantDate[]>([]);
  const [available, setAvailable] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!spaceId) return;
    const { data, error: readError } = await supabase
      .from('important_dates')
      .select('id, title, date, yearly, created_by')
      .eq('space_id', spaceId)
      .order('date');
    if (readError) {
      setAvailable(false);
      return;
    }
    setItems((data ?? []) as ImportantDate[]);
  }, [spaceId]);

  useEffect(() => {
    load();
  }, [load]);

  const add = useCallback(
    async (title: string, date: string, yearly: boolean) => {
      if (!user || !spaceId) return false;
      setError(null);
      const { error: writeError } = await supabase
        .from('important_dates')
        .insert({ space_id: spaceId, created_by: user.id, title: title.trim(), date, yearly });
      if (writeError) {
        setError('Не получилось добавить дату. Попробуйте ещё раз.');
        return false;
      }
      await load();
      return true;
    },
    [user, spaceId, load],
  );

  const remove = useCallback(
    async (id: string) => {
      setError(null);
      const { error: writeError } = await supabase.from('important_dates').delete().eq('id', id);
      if (writeError) setError('Не получилось убрать дату.');
      await load();
    },
    [load],
  );

  return { items, available, error, add, remove };
}

/* Personal and off by default; read on its own so a missing column breaks nothing. */
export function useShowMoon() {
  const { user } = useSpaceAuth();
  const [value, setValue] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('show_moon')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data, error }) => setValue(error || !data ? null : !!data.show_moon));
  }, [user]);

  const set = useCallback(
    async (next: boolean) => {
      if (!user) return;
      setValue(next);
      const { error } = await supabase.from('profiles').update({ show_moon: next }).eq('id', user.id);
      if (error) setValue(!next);
    },
    [user],
  );

  /* null = not available yet (migration 0006 not run). */
  return { showMoon: value, setShowMoon: set };
}
