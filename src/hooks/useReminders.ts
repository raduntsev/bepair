'use client';

import { useCallback, useEffect, useState } from 'react';
import supabase from '@/lib/supabase';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';

export interface Reminders {
  remind_morning: boolean;
  remind_morning_at: string;
  remind_evening: boolean;
  remind_evening_at: string;
}

const COLUMNS = 'remind_morning, remind_morning_at, remind_evening, remind_evening_at';

/* Postgres returns «09:00:00»; the time input wants «09:00». */
const hhmm = (value: unknown, fallback: string) => (typeof value === 'string' && value.length >= 5 ? value.slice(0, 5) : fallback);

/*
  Read separately from the main profile on purpose: until migration 0004 is run
  these columns do not exist, and the whole app must keep working. `available`
  is false in that case and the settings simply do not show.
*/
export function useReminders() {
  const { user } = useSpaceAuth();
  const [value, setValue] = useState<Reminders | null>(null);
  const [available, setAvailable] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    supabase
      .from('profiles')
      .select(COLUMNS)
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data, error: readError }) => {
        if (!alive) return;
        if (readError || !data) {
          setAvailable(false);
          return;
        }
        setValue({
          remind_morning: data.remind_morning !== false,
          remind_morning_at: hhmm(data.remind_morning_at, '09:00'),
          remind_evening: data.remind_evening !== false,
          remind_evening_at: hhmm(data.remind_evening_at, '21:30'),
        });
      });
    return () => {
      alive = false;
    };
  }, [user]);

  const update = useCallback(
    async (patch: Partial<Reminders>) => {
      if (!user || !value) return false;
      const previous = value;
      setValue({ ...value, ...patch });
      setError(null);
      const { error: writeError } = await supabase.from('profiles').update(patch).eq('id', user.id);
      if (writeError) {
        setValue(previous);
        setError('Не получилось сохранить. Попробуйте ещё раз.');
        return false;
      }
      return true;
    },
    [user, value],
  );

  return { reminders: value, available, isLoading: available && value === null, error, update };
}
