'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import supabase from '@/lib/supabase';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';

/*
  «Ссора» and «Близость»: marks on the couple's day, not on one person's.
  Either partner sets one, both see it, either takes it off (0024).
  Intimacy exists only while both have given its consent — RLS hides the rows
  otherwise, so here it is only a question of which toggle to show.
*/
export type DayEventKind = 'quarrel' | 'intimacy';

export interface IntimacyState {
  mine: boolean;
  partner: boolean;
}

export function useDayEvents(fromISO: string, toISO: string) {
  const instance = useId();
  const { user, spaceId } = useSpaceAuth();
  const [byDay, setByDay] = useState<Record<string, Set<DayEventKind>>>({});
  const [intimacy, setIntimacy] = useState<IntimacyState>({ mine: false, partner: false });
  /* False before migration 0024: the marks simply do not appear. */
  const [available, setAvailable] = useState(false);

  const load = useCallback(async () => {
    if (!user || !spaceId) return;
    const [events, state] = await Promise.all([
      supabase.from('day_events').select('day, kind').eq('space_id', spaceId).gte('day', fromISO).lte('day', toISO),
      supabase.rpc('bp_intimacy_state'),
    ]);
    if (events.error) {
      setAvailable(false);
      return;
    }
    const next: Record<string, Set<DayEventKind>> = {};
    for (const row of (events.data ?? []) as { day: string; kind: DayEventKind }[]) (next[row.day] ??= new Set()).add(row.kind);
    setByDay(next);
    const row = (state.data as IntimacyState[] | null)?.[0];
    setIntimacy({ mine: !!row?.mine, partner: !!row?.partner });
    setAvailable(true);
  }, [user, spaceId, fromISO, toISO]);

  useEffect(() => {
    load();
  }, [load]);

  /* The partner's tap, and the partner switching «Близость» on or off. */
  useEffect(() => {
    if (!spaceId) return;
    const channel = supabase
      .channel(`day-events:${spaceId}:${instance}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'day_events', filter: `space_id=eq.${spaceId}` }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [spaceId, instance, load]);

  const has = useCallback((day: string, kind: DayEventKind) => byDay[day]?.has(kind) ?? false, [byDay]);

  const toggle = useCallback(
    async (day: string, kind: DayEventKind) => {
      if (!user || !spaceId) return false;
      const on = byDay[day]?.has(kind) ?? false;
      /* Optimistic: the chip answers at once, and a failure puts it back. */
      setByDay((current) => {
        const set = new Set(current[day] ?? []);
        if (on) set.delete(kind);
        else set.add(kind);
        return { ...current, [day]: set };
      });
      const { error } = on
        ? await supabase.from('day_events').delete().eq('space_id', spaceId).eq('day', day).eq('kind', kind)
        : await supabase.from('day_events').insert({ space_id: spaceId, day, kind, created_by: user.id });
      if (error) {
        await load();
        return false;
      }
      return true;
    },
    [user, spaceId, byDay, load],
  );

  return { available, has, toggle, intimacy, intimacyOn: intimacy.mine && intimacy.partner, reload: load };
}
