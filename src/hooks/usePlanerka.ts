'use client';

import { useCallback, useEffect, useState } from 'react';
import supabase from '@/lib/supabase';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import type { Comments, QuestionKey, Scores } from '@/lib/planerka';

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
}

export interface PlanerkaSettings {
  weekday: number;
  at_time: string;
}

/*
  Everything of the planerka in one hook: all sessions with their wheels and
  answers (a couple has a few dozen a year, so loading all of it keeps history
  and trends instant), the shared to-dos, and when the couple meets. Changes
  from the other phone arrive through Realtime — you see each other type.
*/
export function usePlanerka() {
  const { user, spaceId } = useSpaceAuth();
  const [planerkas, setPlanerkas] = useState<Planerka[]>([]);
  const [wheels, setWheels] = useState<Wheel[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [todos, setTodos] = useState<PlanTodo[]>([]);
  const [settings, setSettings] = useState<PlanerkaSettings>({ weekday: 0, at_time: '13:00' });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!spaceId) return;
    const [p, w, a, t, s] = await Promise.all([
      supabase.from('planerkas').select('id, held_on').eq('space_id', spaceId).order('held_on', { ascending: false }),
      supabase.from('planerka_wheels').select('id, planerka_id, user_id, scores, comments, note, entered_by').eq('space_id', spaceId),
      supabase.from('planerka_answers').select('id, planerka_id, user_id, question, answer, entered_by').eq('space_id', spaceId),
      supabase
        .from('plan_todos')
        .select('id, owner_id, content, status, decision, planerka_id, created_at, done_at')
        .eq('space_id', spaceId)
        .order('created_at', { ascending: true }),
      supabase.from('planerka_settings').select('weekday, at_time').eq('space_id', spaceId).maybeSingle(),
    ]);
    if (p.error || w.error || a.error || t.error) {
      setError('Не удалось загрузить планёрку. Проверьте связь и обновите страницу.');
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
      .channel(`planerka:${spaceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'planerka_wheels', filter }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'planerka_answers', filter }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plan_todos', filter }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [spaceId, load]);

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
        setError('Не получилось начать планёрку.');
        return null;
      }
      const { data } = await supabase.from('planerkas').select('id, held_on').eq('space_id', spaceId).eq('held_on', heldOn).maybeSingle();
      await load();
      return (data?.id as string | undefined) ?? null;
    },
    [spaceId, user, planerkas, load],
  );

  const saveWheel = useCallback(
    async (planerkaId: string, userId: string, scores: Scores, comments: Comments, note: string) => {
      if (!spaceId || !user) return;
      const { error: saveError } = await supabase.from('planerka_wheels').upsert(
        { planerka_id: planerkaId, space_id: spaceId, user_id: userId, scores, comments, note, entered_by: user.id, updated_at: new Date().toISOString() },
        { onConflict: 'planerka_id,user_id' },
      );
      if (saveError) setError('Колесо не сохранилось. Попробуйте ещё раз.');
      else await load();
    },
    [spaceId, user, load],
  );

  const saveAnswer = useCallback(
    async (planerkaId: string, userId: string, question: QuestionKey, answer: string) => {
      if (!spaceId || !user) return;
      const { error: saveError } = await supabase.from('planerka_answers').upsert(
        { planerka_id: planerkaId, space_id: spaceId, user_id: userId, question, answer, entered_by: user.id, updated_at: new Date().toISOString() },
        { onConflict: 'planerka_id,user_id,question' },
      );
      if (saveError) setError('Ответ не сохранился. Попробуйте ещё раз.');
      else await load();
    },
    [spaceId, user, load],
  );

  const addTodo = useCallback(
    async (content: string, ownerId: string | null, planerkaId: string | null) => {
      if (!spaceId || !user || !content.trim()) return;
      const { error: saveError } = await supabase
        .from('plan_todos')
        .insert({ space_id: spaceId, owner_id: ownerId, content: content.trim(), planerka_id: planerkaId, created_by: user.id });
      if (saveError) setError('Дело не добавилось.');
      else await load();
    },
    [spaceId, user, load],
  );

  const updateTodo = useCallback(
    async (id: string, patch: Partial<Pick<PlanTodo, 'status' | 'decision' | 'content' | 'owner_id'>>) => {
      const extra = patch.status ? { done_at: patch.status === 'done' ? new Date().toISOString() : null } : {};
      const { error: saveError } = await supabase.from('plan_todos').update({ ...patch, ...extra }).eq('id', id);
      if (saveError) setError('Изменение не сохранилось.');
      else await load();
    },
    [load],
  );

  const removeTodo = useCallback(
    async (id: string) => {
      await supabase.from('plan_todos').delete().eq('id', id);
      await load();
    },
    [load],
  );

  const saveSettings = useCallback(
    async (next: PlanerkaSettings) => {
      if (!spaceId) return;
      setSettings(next);
      const { error: saveError } = await supabase
        .from('planerka_settings')
        .upsert({ space_id: spaceId, weekday: next.weekday, at_time: next.at_time, updated_at: new Date().toISOString() });
      if (saveError) setError('Расписание не сохранилось.');
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
    saveAnswer,
    addTodo,
    updateTodo,
    removeTodo,
    saveSettings,
    reload: load,
  };
}
