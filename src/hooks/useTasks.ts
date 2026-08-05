'use client';

import { useCallback, useEffect, useState } from 'react';
import supabase from '@/lib/supabase';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { todayISO } from '@/hooks/useCoupleDay';

export interface Task {
  id: string;
  user_id: string;
  content: string;
  points: number;
  is_completed: boolean;
  completed_by: string | null;
  acknowledged_at: string | null;
  created_at: string;
}

export type TaskState = 'awaiting' | 'done_unseen' | 'confirmed';

export function taskState(task: Task): TaskState {
  if (!task.is_completed) return 'awaiting';
  return task.acknowledged_at ? 'confirmed' : 'done_unseen';
}

export function useTasks() {
  const { user, spaceId } = useSpaceAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user || !spaceId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);

    const { data, error: loadError } = await supabase
      .from('checklist_items')
      .select('id, user_id, content, points, is_completed, completed_by, acknowledged_at, created_at')
      .eq('space_id', spaceId)
      .order('created_at', { ascending: false });

    setTasks((data ?? []) as Task[]);
    setError(loadError ? 'Не удалось загрузить задачи. Проверьте связь и обновите страницу.' : null);
    setIsLoading(false);
  }, [user, spaceId]);

  useEffect(() => {
    load();
  }, [load]);

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

    /*
      target_user_id is required by the checklists insert policy — a NULL fails
      the `IN (...)` check silently, which made every "add" a no-op. A request is
      addressed to the partner, so that is who it targets.
    */
    const { data: partner } = await supabase
      .from('profiles')
      .select('id')
      .eq('space_id', spaceId)
      .neq('id', user.id)
      .maybeSingle();

    if (!partner) {
      setError('Пока в пространстве только вы — попросить пока некого.');
      return null;
    }

    const { data: created, error: createError } = await supabase
      .from('checklists')
      .insert({ space_id: spaceId, user_id: user.id, date, target_user_id: partner.id })
      .select('id')
      .single();

    if (createError) {
      setError('Не удалось создать список задач. Попробуйте ещё раз.');
      return null;
    }
    return created.id as string;
  }, [user, spaceId]);

  const add = useCallback(
    async (content: string, points: number) => {
      if (!user || !spaceId) return false;
      const checklistId = await ensureChecklist();
      if (!checklistId) return false;

      const { error: addError } = await supabase.from('checklist_items').insert({
        checklist_id: checklistId,
        space_id: spaceId,
        user_id: user.id,
        content,
        points,
      });

      if (addError) {
        setError('Задача не добавилась. Попробуйте ещё раз.');
        return false;
      }
      await load();
      return true;
    },
    [user, spaceId, ensureChecklist, load],
  );

  const edit = useCallback(
    async (id: string, content: string, points: number) => {
      const { error: editError } = await supabase
        .from('checklist_items')
        .update({ content, points })
        .eq('id', id);
      if (editError) setError('Изменения не сохранились. Попробуйте ещё раз.');
      await load();
    },
    [load],
  );

  const complete = useCallback(
    async (task: Task) => {
      if (!user || !spaceId) return;

      /*
        Guarded on is_completed and checked by row count: two taps award points
        once, because only the first update matches.
      */
      const { data: completed, error: completeError } = await supabase
        .from('checklist_items')
        .update({ is_completed: true, completed_by: user.id, completed_at: new Date().toISOString() })
        .eq('id', task.id)
        .eq('is_completed', false)
        .select('id');

      if (completeError) {
        setError('Не удалось отметить задачу. Попробуйте ещё раз.');
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
        /* Do not leave a task marked done with no points and no explanation. */
        await supabase
          .from('checklist_items')
          .update({ is_completed: false, completed_by: null, completed_at: null })
          .eq('id', task.id);
        setError('Баллы не начислились, задача осталась активной. Попробуйте ещё раз.');
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
        .eq('id', id);
      await load();
    },
    [user, load],
  );

  const remove = useCallback(
    async (id: string) => {
      await supabase.from('checklist_items').delete().eq('id', id);
      await load();
    },
    [load],
  );

  return { tasks, isLoading, error, add, edit, complete, acknowledge, remove, reload: load };
}
