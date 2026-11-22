'use client';

import { useCallback, useEffect, useState, useId } from 'react';
import supabase from '@/lib/supabase';
import { todayISO } from '@/lib/dates';
import { flushPush } from '@/lib/push';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { tr } from '@/lib/i18n';

export interface Task {
  id: string;
  user_id: string;
  content: string;
  points: number;
  is_completed: boolean;
  completed_by: string | null;
  completed_at: string | null;
  acknowledged_at: string | null;
  created_at: string;
}

export interface Template {
  id: string;
  user_id: string;
  content: string;
  points: number;
}

export type TaskState = 'awaiting' | 'done_unseen' | 'confirmed';

export function taskState(task: Task): TaskState {
  if (!task.is_completed) return 'awaiting';
  return task.acknowledged_at ? 'confirmed' : 'done_unseen';
}

/* Three levels: enough to say «this matters», too few to turn a favour into a grade. */
export const WEIGHTS = [
  { value: 1, label: tr('Мелочь', 'Small'), detail: tr('+1 балл', '+1 point') },
  { value: 2, label: tr('Обычно', 'Usual'), detail: tr('+2 балла', '+2 points') },
  { value: 3, label: tr('Важно', 'Important'), detail: tr('+3 балла', '+3 points') },
];

/* A starter pack, so the first request never has to be typed from nothing. */
export const STARTER_TEMPLATES = [
  { content: tr('Приготовить ужин', 'Cook dinner'), points: 3 },
  { content: tr('Разобрать посуду', 'Put the dishes away'), points: 2 },
  { content: tr('Побыть рядом вечером', 'Be close this evening'), points: 3 },
  { content: tr('Забрать заказ', 'Pick up the order'), points: 2 },
  { content: tr('Позвонить, когда будет минутка', 'Call when you have a minute'), points: 1 },
  { content: tr('Погулять вместе', 'Go for a walk together'), points: 3 },
];

export function useTasks() {
  /* Two components on one screen may use this hook; a shared channel name would make the second subscription throw. */
  const instance = useId();
  const { user, spaceId, partner } = useSpaceAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user || !spaceId) {
      setIsLoading(false);
      return;
    }

    const [taskResult, templateResult] = await Promise.all([
      supabase
        .from('checklist_items')
        .select('id, user_id, content, points, is_completed, completed_by, completed_at, acknowledged_at, created_at')
        .eq('space_id', spaceId)
        .order('created_at', { ascending: false })
        .limit(200),
      supabase.from('task_templates').select('id, user_id, content, points').eq('space_id', spaceId).order('created_at'),
    ]);

    if (!taskResult.error) setTasks((taskResult.data ?? []) as Task[]);
    if (!templateResult.error) setTemplates((templateResult.data ?? []) as Template[]);
    setError(taskResult.error ? tr('Не удалось загрузить задачи. Проверьте связь и обновите страницу.', 'Couldn’t load requests. Check your connection and reload.') : null);
    setIsLoading(false);
  }, [user, spaceId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!spaceId) return;
    const channel = supabase
      .channel(`tasks:${spaceId}:${instance}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist_items', filter: `space_id=eq.${spaceId}` }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [spaceId, instance, load]);

  /* checklist_items hang off a checklist; one per author per day is enough. */
  const ensureChecklist = useCallback(async () => {
    if (!user || !spaceId) return null;
    const date = todayISO();

    const { data: existing } = await supabase
      .from('checklists')
      .select('id')
      .eq('space_id', spaceId)
      .eq('user_id', user.id)
      .eq('date', date)
      .maybeSingle();
    if (existing) return existing.id as string;

    if (!partner) {
      setError(tr('Пока в пространстве только вы — попросить пока некого.', 'You’re alone in the space for now — there’s no one to ask yet.'));
      return null;
    }

    /* target_user_id is required by the insert policy; a NULL fails silently. */
    const { data: created, error: createError } = await supabase
      .from('checklists')
      .insert({ space_id: spaceId, user_id: user.id, date, target_user_id: partner.id })
      .select('id')
      .single();

    if (createError) {
      setError(tr('Не удалось создать список задач. Попробуйте ещё раз.', 'Couldn’t create the list. Please try again.'));
      return null;
    }
    return created.id as string;
  }, [user, spaceId, partner]);

  const add = useCallback(
    async (content: string, weight: number) => {
      if (!user || !spaceId) return false;
      const checklistId = await ensureChecklist();
      if (!checklistId) return false;

      const { error: addError } = await supabase.from('checklist_items').insert({
        checklist_id: checklistId,
        space_id: spaceId,
        user_id: user.id,
        content,
        points: weight,
      });

      if (addError) {
        setError(tr('Задача не добавилась. Попробуйте ещё раз.', 'The request wasn’t added. Please try again.'));
        return false;
      }
      setError(null);
      flushPush();
      await load();
      return true;
    },
    [user, spaceId, ensureChecklist, load],
  );

  const edit = useCallback(
    async (id: string, content: string, weight: number) => {
      const { error: editError } = await supabase.from('checklist_items').update({ content, points: weight }).eq('id', id);
      setError(editError ? tr('Изменения не сохранились. Попробуйте ещё раз.', 'Changes weren’t saved. Please try again.') : null);
      await load();
      return !editError;
    },
    [load],
  );

  const complete = useCallback(
    async (task: Task) => {
      if (!user || !spaceId) return;

      /* Guarded on is_completed and checked by row count: two taps award points once. */
      const { data: completed, error: completeError } = await supabase
        .from('checklist_items')
        .update({ is_completed: true, completed_by: user.id, completed_at: new Date().toISOString() })
        .eq('id', task.id)
        .eq('is_completed', false)
        .select('id');

      if (completeError) {
        setError(tr('Не удалось отметить задачу. Попробуйте ещё раз.', 'Couldn’t mark the request. Please try again.'));
        return;
      }
      if (!completed || completed.length === 0) {
        await load();
        return;
      }

      const { error: ledgerError } = await supabase.from('points_ledger').insert({
        space_id: spaceId,
        from_user: task.user_id,
        to_user: user.id,
        amount: task.points,
        reason: 'task',
        reference: task.id,
      });

      if (ledgerError) {
        /* Never leave a task done with no points and no explanation. */
        await supabase
          .from('checklist_items')
          .update({ is_completed: false, completed_by: null, completed_at: null })
          .eq('id', task.id);
        setError(tr('Баллы не начислились, задача осталась активной. Попробуйте ещё раз.', 'Points weren’t added; the request is still open. Please try again.'));
      } else {
        setError(null);
        flushPush();
      }
      await load();
    },
    [user, spaceId, load],
  );

  /* The requester noticing it — not approving it. */
  const acknowledge = useCallback(
    async (id: string) => {
      if (!user) return;
      await supabase
        .from('checklist_items')
        .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: user.id })
        .eq('id', id)
        .is('acknowledged_at', null);
      flushPush();
      await load();
    },
    [user, load],
  );

  const remove = useCallback(
    async (id: string) => {
      const { error: removeError } = await supabase.from('checklist_items').delete().eq('id', id).eq('is_completed', false);
      if (removeError) setError(tr('Не удалось убрать задачу. Попробуйте ещё раз.', 'Couldn’t remove the request. Please try again.'));
      await load();
    },
    [load],
  );

  const saveTemplate = useCallback(
    async (content: string, weight: number) => {
      if (!user || !spaceId) return;
      if (templates.some((t) => t.content.toLowerCase() === content.toLowerCase())) return;
      const { error: saveError } = await supabase
        .from('task_templates')
        .insert({ space_id: spaceId, user_id: user.id, content, points: weight });
      if (saveError) setError(tr('Не удалось сохранить в подборку.', 'Couldn’t save to favourites.'));
      await load();
    },
    [user, spaceId, templates, load],
  );

  const removeTemplate = useCallback(
    async (id: string) => {
      await supabase.from('task_templates').delete().eq('id', id);
      await load();
    },
    [load],
  );

  return {
    tasks,
    templates,
    isLoading,
    error,
    add,
    edit,
    complete,
    acknowledge,
    remove,
    saveTemplate,
    removeTemplate,
    reload: load,
  };
}
