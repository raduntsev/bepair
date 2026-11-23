'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import supabase from '@/lib/supabase';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import type { Comments, QuestionKey, Scores } from '@/lib/planerka';
import { tr } from '@/lib/i18n';

export interface Planerka {
  id: string;
  held_on: string;
}

export interface Wheel {
  id: string;
  planerka_id: string;
  user_id: string;
  scores: Scores;
  comments: Comments;
  note: string;
  entered_by: string | null;
  /* Set when this person said «my part is done»; null while still filling in. */
  closed_at: string | null;
}

export interface Answer {
  id: string;
  planerka_id: string;
  user_id: string;
  question: QuestionKey;
  answer: string;
  entered_by: string | null;
}

export type TodoStatus = 'todo' | 'in_process' | 'done';

export interface PlanTodo {
  id: string;
  owner_id: string | null;
  content: string;
  status: TodoStatus;
  decision: string;
  planerka_id: string | null;
  created_at: string;
  done_at: string | null;
  /* Moved into this week from an earlier one; null = the week it was created in. */
  week_of: string | null;
}

export interface PlanerkaSettings {
  weekday: number;
  at_time: string;
}

const WHEEL_COLUMNS = 'id, planerka_id, user_id, scores, comments, note, entered_by, closed_at';
const ANSWER_COLUMNS = 'id, planerka_id, user_id, question, answer, entered_by';
const TODO_COLUMNS = 'id, owner_id, content, status, decision, planerka_id, created_at, done_at, week_of';

/* Put one row (a save's response or a Realtime event) into a list in place — no refetch of everything. */
function merge<T extends { id: string }>(list: T[], row: T | null | undefined): T[] {
  if (!row?.id) return list;
  const at = list.findIndex((x) => x.id === row.id);
  if (at === -1) return [...list, row];
  const next = list.slice();
  next[at] = { ...next[at], ...row };
  return next;
}

/*
  Everything of the planerka in one hook: all sessions with their wheels and
  answers (a couple has a few dozen a year, so loading all of it keeps history
  and trends instant), the shared to-dos, and when the couple meets. Changes
  from the other phone arrive through Realtime — you see each other type.
*/
export function usePlanerka() {
  /* Two components on one screen may use this hook; a shared channel name would make the second subscription throw. */
  const instance = useId();
  const { user, spaceId } = useSpaceAuth();
  const [planerkas, setPlanerkas] = useState<Planerka[]>([]);
  const [wheels, setWheels] = useState<Wheel[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [todos, setTodos] = useState<PlanTodo[]>([]);
  const [settings, setSettings] = useState<PlanerkaSettings>({ weekday: 0, at_time: '13:00' });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /* Session ids already in the list, read from Realtime callbacks without resubscribing. */
  const known = useRef(new Set<string>());
  useEffect(() => {
    known.current = new Set(planerkas.map((p) => p.id));
  }, [planerkas]);

  const load = useCallback(async () => {
    if (!spaceId) return;
    const [p, w, a, t, s] = await Promise.all([
      supabase.from('planerkas').select('id, held_on').eq('space_id', spaceId).order('held_on', { ascending: false }),
      supabase.from('planerka_wheels').select(WHEEL_COLUMNS).eq('space_id', spaceId),
      supabase.from('planerka_answers').select(ANSWER_COLUMNS).eq('space_id', spaceId),
      supabase
        .from('plan_todos')
        .select(TODO_COLUMNS)
        .eq('space_id', spaceId)
        .order('created_at', { ascending: true }),
      supabase.from('planerka_settings').select('weekday, at_time').eq('space_id', spaceId).maybeSingle(),
    ]);
    if (p.error || w.error || a.error || t.error) {
      setError(tr('Не удалось загрузить планёрку. Проверьте связь и обновите страницу.', 'Couldn’t load the check-in. Check your connection and reload.'));
    } else {
      setPlanerkas((p.data ?? []) as Planerka[]);
      setWheels((w.data ?? []) as Wheel[]);
      setAnswers((a.data ?? []) as Answer[]);
      setTodos((t.data ?? []) as PlanTodo[]);
      if (s.data) setSettings({ weekday: s.data.weekday, at_time: String(s.data.at_time).slice(0, 5) });
      setError(null);
    }
    setIsLoading(false);
  }, [spaceId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!spaceId) return;
    const filter = `space_id=eq.${spaceId}`;
    const channel = supabase
      .channel(`planerka:${spaceId}:${instance}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'planerka_wheels', filter }, (payload) => {
        if (payload.eventType === 'DELETE') setWheels((list) => list.filter((x) => x.id !== (payload.old as { id?: string }).id));
        else {
          const row = payload.new as Wheel;
          setWheels((list) => merge(list, row));
          /* A session the partner has just started: the one case that needs the list of sessions again. */
          if (!known.current.has(row.planerka_id)) load();
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'planerka_answers', filter }, (payload) => {
        if (payload.eventType === 'DELETE') setAnswers((list) => list.filter((x) => x.id !== (payload.old as { id?: string }).id));
        else {
          const row = payload.new as Answer;
          setAnswers((list) => merge(list, row));
          if (!known.current.has(row.planerka_id)) load();
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plan_todos', filter }, (payload) => {
        if (payload.eventType === 'DELETE') setTodos((list) => list.filter((x) => x.id !== (payload.old as { id?: string }).id));
        else setTodos((list) => merge(list, payload.new as PlanTodo));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [spaceId, instance, load]);

  /* The session for a date, created on first touch. */
  const ensure = useCallback(
    async (heldOn: string) => {
      if (!spaceId || !user) return null;
      const existing = planerkas.find((p) => p.held_on === heldOn);
      if (existing) return existing.id;
      const { error: insertError } = await supabase
        .from('planerkas')
        .upsert({ space_id: spaceId, held_on: heldOn, created_by: user.id }, { onConflict: 'space_id,held_on', ignoreDuplicates: true });
      if (insertError) {
        setError(tr('Не получилось начать планёрку.', 'Couldn’t start the check-in.'));
        return null;
      }
      const { data } = await supabase.from('planerkas').select('id, held_on').eq('space_id', spaceId).eq('held_on', heldOn).maybeSingle();
      if (data) setPlanerkas((list) => (list.some((p) => p.id === data.id) ? list : [...list, data as Planerka].sort((a, b) => (a.held_on < b.held_on ? 1 : -1))));
      return (data?.id as string | undefined) ?? null;
    },
    [spaceId, user, planerkas],
  );

  const saveWheel = useCallback(
    async (planerkaId: string, userId: string, scores: Scores, comments: Comments, note: string) => {
      if (!spaceId || !user) return;
      const { data, error: saveError } = await supabase
        .from('planerka_wheels')
        .upsert(
          { planerka_id: planerkaId, space_id: spaceId, user_id: userId, scores, comments, note, entered_by: user.id, updated_at: new Date().toISOString() },
          { onConflict: 'planerka_id,user_id' },
        )
        .select(WHEEL_COLUMNS)
        .maybeSingle();
      if (saveError) setError(tr('Колесо не сохранилось. Попробуйте ещё раз.', 'The wheel wasn’t saved. Please try again.'));
      else setWheels((list) => merge(list, data as Wheel | null));
    },
    [spaceId, user],
  );

  /* Only the columns sent are written, so closing never touches the scores. */
  const closePart = useCallback(
    async (planerkaId: string, userId: string, closed: boolean) => {
      if (!spaceId || !user) return;
      const { data, error: saveError } = await supabase
        .from('planerka_wheels')
        .upsert(
          { planerka_id: planerkaId, space_id: spaceId, user_id: userId, closed_at: closed ? new Date().toISOString() : null },
          { onConflict: 'planerka_id,user_id' },
        )
        .select(WHEEL_COLUMNS)
        .maybeSingle();
      if (saveError) setError(tr('Не получилось закрыть планёрку. Попробуйте ещё раз.', 'Couldn’t close the check-in. Please try again.'));
      else setWheels((list) => merge(list, data as Wheel | null));
    },
    [spaceId, user],
  );

  const saveAnswer = useCallback(
    async (planerkaId: string, userId: string, question: QuestionKey, answer: string) => {
      if (!spaceId || !user) return;
      const { data, error: saveError } = await supabase
        .from('planerka_answers')
        .upsert(
          { planerka_id: planerkaId, space_id: spaceId, user_id: userId, question, answer, entered_by: user.id, updated_at: new Date().toISOString() },
          { onConflict: 'planerka_id,user_id,question' },
        )
        .select(ANSWER_COLUMNS)
        .maybeSingle();
      if (saveError) setError(tr('Ответ не сохранился. Попробуйте ещё раз.', 'The answer wasn’t saved. Please try again.'));
      else setAnswers((list) => merge(list, data as Answer | null));
    },
    [spaceId, user],
  );

  const addTodo = useCallback(
    async (content: string, ownerId: string | null, planerkaId: string | null) => {
      if (!spaceId || !user || !content.trim()) return;
      const { data, error: saveError } = await supabase
        .from('plan_todos')
        .insert({ space_id: spaceId, owner_id: ownerId, content: content.trim(), planerka_id: planerkaId, created_by: user.id })
        .select(TODO_COLUMNS)
        .single();
      if (saveError) setError(tr('Дело не добавилось.', 'The to-do wasn’t added.'));
      else setTodos((list) => merge(list, data as PlanTodo));
    },
    [spaceId, user],
  );

  const updateTodo = useCallback(
    async (id: string, patch: Partial<Pick<PlanTodo, 'status' | 'decision' | 'content' | 'owner_id' | 'week_of'>>) => {
      const extra = patch.status ? { done_at: patch.status === 'done' ? new Date().toISOString() : null } : {};
      const { data, error: saveError } = await supabase.from('plan_todos').update({ ...patch, ...extra }).eq('id', id).select(TODO_COLUMNS).maybeSingle();
      if (saveError) setError(tr('Изменение не сохранилось.', 'The change wasn’t saved.'));
      else setTodos((list) => merge(list, data as PlanTodo | null));
    },
    [],
  );

  const removeTodo = useCallback(
    async (id: string) => {
      const { error: removeError } = await supabase.from('plan_todos').delete().eq('id', id);
      if (!removeError) setTodos((list) => list.filter((t) => t.id !== id));
    },
    [],
  );

  const saveSettings = useCallback(
    async (next: PlanerkaSettings) => {
      if (!spaceId) return;
      setSettings(next);
      const { error: saveError } = await supabase
        .from('planerka_settings')
        .upsert({ space_id: spaceId, weekday: next.weekday, at_time: next.at_time, updated_at: new Date().toISOString() });
      if (saveError) setError(tr('Расписание не сохранилось.', 'The schedule wasn’t saved.'));
    },
    [spaceId],
  );

  return {
    planerkas,
    wheels,
    answers,
    todos,
    settings,
    isLoading,
    error,
    ensure,
    saveWheel,
    closePart,
    saveAnswer,
    addTodo,
    updateTodo,
    removeTodo,
    saveSettings,
    reload: load,
  };
}
