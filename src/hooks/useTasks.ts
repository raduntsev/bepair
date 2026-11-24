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

const TASK_COLUMNS = 'id, user_id, content, points, is_completed, completed_by, completed_at, acknowledged_at, created_at';
/* How much finished history comes with the page; older pages load on request. */
const DONE_PAGE = 30;

const byNewest = (a: { created_at: string }, b: { created_at: string }) => (a.created_at < b.created_at ? 1 : -1);

/* Put a row from the server (a response or a Realtime event) into the list in place — no refetch. */
function merge(list: Task[], row: Partial<Task> & { id: string }): Task[] {
  const at = list.findIndex((t) => t.id === row.id);
  if (at === -1) return row.content === undefined ? list : [...list, row as Task].sort(byNewest);
  const next = list.slice();
  next[at] = { ...next[at], ...row };
  return next;
}

/*
  Requests of the couple. The first load brings everything still in motion
  (open, or done and not yet noticed) and the latest finished ones; after that
  nothing is refetched: every change — yours from the response, the partner's
  from Realtime — is merged into the list in place.
*/
export function useTasks() {
  /* Two components on one screen may use this hook; a shared channel name would make the second subscription throw. */
  const instance = useId();
  const { user, spaceId, partner } = useSpaceAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [moreDone, setMoreDone] = useState(false);

  const load = useCallback(async () => {
    if (!user || !spaceId) {
      setIsLoading(false);
      return;
    }

    const [activeResult, doneResult, templateResult] = await Promise.all([
      supabase
        .from('checklist_items')
        .select(TASK_COLUMNS)
        .eq('space_id', spaceId)
        .or('is_completed.eq.false,acknowledged_at.is.null')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('checklist_items')
        .select(TASK_COLUMNS)
        .eq('space_id', spaceId)
        .eq('is_completed', true)
        .not('acknowledged_at', 'is', null)
        .order('created_at', { ascending: false })
        .limit(DONE_PAGE + 1),
      supabase.from('task_templates').select('id, user_id, content, points').eq('space_id', spaceId).order('created_at'),
    ]);

    if (!activeResult.error && !doneResult.error) {
      const done = (doneResult.data ?? []) as Task[];
      setMoreDone(done.length > DONE_PAGE);
      setTasks([...((activeResult.data ?? []) as Task[]), ...done.slice(0, DONE_PAGE)].sort(byNewest));
    }
    if (!templateResult.error) setTemplates((templateResult.data ?? []) as Template[]);
    setError(activeResult.error ? tr('Не удалось загрузить задачи. Проверьте связь и обновите страницу.', 'Couldn’t load requests. Check your connection and reload.') : null);
    setIsLoading(false);
  }, [user, spaceId]);

  useEffect(() => {
    load();
  }, [load]);

  /* Older finished requests, a page at a time, only when someone scrolls back for them. */
  const loadMoreDone = useCallback(async () => {
    if (!spaceId) return;
    const oldest = tasks.filter((t) => t.is_completed && t.acknowledged_at).at(-1)?.created_at;
    let query = supabase
      .from('checklist_items')
      .select(TASK_COLUMNS)
      .eq('space_id', spaceId)
      .eq('is_completed', true)
      .not('acknowledged_at', 'is', null)
      .order('created_at', { ascending: false })
      .limit(DONE_PAGE + 1);
    if (oldest) query = query.lt('created_at', oldest);
    const { data, error: moreError } = await query;
    if (moreError) return;
    const rows = (data ?? []) as Task[];
    setMoreDone(rows.length > DONE_PAGE);
    setTasks((list) => rows.slice(0, DONE_PAGE).reduce(merge, list));
  }, [spaceId, tasks]);

  useEffect(() => {
    if (!spaceId) return;
    const channel = supabase
      .channel(`tasks:${spaceId}:${instance}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist_items', filter: `space_id=eq.${spaceId}` }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const id = (payload.old as { id?: string }).id;
          if (id) setTasks((list) => list.filter((t) => t.id !== id));
        } else {
          setTasks((list) => merge(list, payload.new as Task));
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [spaceId, instance]);

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

      const { data: added, error: addError } = await supabase
        .from('checklist_items')
        .insert({
          checklist_id: checklistId,
          space_id: spaceId,
          user_id: user.id,
          content,
          points: weight,
        })
        .select(TASK_COLUMNS)
        .single();

      if (addError || !added) {
        setError(tr('Задача не добавилась. Попробуйте ещё раз.', 'The request wasn’t added. Please try again.'));
        return false;
      }
      setError(null);
      setTasks((list) => merge(list, added as Task));
      flushPush();
      return true;
    },
    [user, spaceId, ensureChecklist],
  );

  const edit = useCallback(
    async (id: string, content: string, weight: number) => {
      const { data: edited, error: editError } = await supabase
        .from('checklist_items')
        .update({ content, points: weight })
        .eq('id', id)
        .select(TASK_COLUMNS)
        .maybeSingle();
      setError(editError ? tr('Изменения не сохранились. Попробуйте ещё раз.', 'Changes weren’t saved. Please try again.') : null);
      if (edited) setTasks((list) => merge(list, edited as Task));
      return !editError;
    },
    [],
  );

  const complete = useCallback(
    async (task: Task) => {
      if (!user || !spaceId) return;

      /*
        Guarded on is_completed and checked by row count. The points are paid by
        the database in the same statement (bp_task_points, migration 0017), once
        per request — so there is nothing to write here and nothing to roll back.
      */
      const { data: completed, error: completeError } = await supabase
        .from('checklist_items')
        .update({ is_completed: true, completed_by: user.id, completed_at: new Date().toISOString() })
        .eq('id', task.id)
        .eq('is_completed', false)
        .select(TASK_COLUMNS);

      if (completeError) {
        setError(tr('Не удалось отметить задачу. Попробуйте ещё раз.', 'Couldn’t mark the request. Please try again.'));
        return;
      }
      if (!completed || completed.length === 0) {
        await load();
        return;
      }

      setError(null);
      setTasks((list) => merge(list, completed[0] as Task));
      flushPush();
    },
    [user, spaceId, load],
  );

  /* The requester noticing it — not approving it. */
  const acknowledge = useCallback(
    async (id: string) => {
      if (!user) return;
      const { data: seen } = await supabase
        .from('checklist_items')
        .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: user.id })
        .eq('id', id)
        .is('acknowledged_at', null)
        .select(TASK_COLUMNS);
      if (seen?.[0]) setTasks((list) => merge(list, seen[0] as Task));
      flushPush();
    },
    [user],
  );

  const remove = useCallback(
    async (id: string) => {
      const { error: removeError } = await supabase.from('checklist_items').delete().eq('id', id).eq('is_completed', false);
      if (removeError) setError(tr('Не удалось убрать задачу. Попробуйте ещё раз.', 'Couldn’t remove the request. Please try again.'));
      else setTasks((list) => list.filter((t) => t.id !== id));
    },
    [],
  );

  const saveTemplate = useCallback(
    async (content: string, weight: number) => {
      if (!user || !spaceId) return;
      if (templates.some((t) => t.content.toLowerCase() === content.toLowerCase())) return;
      const { data: saved, error: saveError } = await supabase
        .from('task_templates')
        .insert({ space_id: spaceId, user_id: user.id, content, points: weight })
        .select('id, user_id, content, points')
        .single();
      if (saveError) setError(tr('Не удалось сохранить в подборку.', 'Couldn’t save to favourites.'));
      else if (saved) setTemplates((list) => [...list, saved as Template]);
    },
    [user, spaceId, templates],
  );

  const removeTemplate = useCallback(
    async (id: string) => {
      const { error: removeError } = await supabase.from('task_templates').delete().eq('id', id);
      if (!removeError) setTemplates((list) => list.filter((t) => t.id !== id));
    },
    [],
  );

  return {
    tasks,
    templates,
    isLoading,
    error,
    moreDone,
    loadMoreDone,
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
