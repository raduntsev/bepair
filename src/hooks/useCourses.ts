'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import supabase from '@/lib/supabase';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { courseById, lessonsOf, type LessonAnswers } from '@/lib/courses';
import { tr } from '@/lib/i18n';

export interface CoursePrefs {
  user_id: string;
  share_answers: boolean;
  notify_partner: boolean;
  remind: boolean;
  remind_at: string;
  remind_days: number[];
}

export interface Enrolment {
  user_id: string;
  course_id: string;
  started_at: string;
  finished_at: string | null;
}

export interface Step {
  user_id: string;
  course_id: string;
  lesson_id: string;
  done_at: string;
}

export interface AnswerRow {
  user_id: string;
  course_id: string;
  lesson_id: string;
  data: LessonAnswers;
  updated_at: string;
}

export interface JournalEntry {
  id: string;
  user_id: string;
  kind: 'note' | 'thought';
  body: string;
  data: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export const DEFAULT_PREFS: Omit<CoursePrefs, 'user_id'> = {
  share_answers: false,
  notify_partner: true,
  remind: false,
  remind_at: '20:00',
  remind_days: [1, 2, 3, 4, 5, 6, 0],
};

const PREF_COLUMNS = 'user_id, share_answers, notify_partner, remind, remind_at, remind_days';
const ANSWER_COLUMNS = 'user_id, course_id, lesson_id, data, updated_at';
const ENTRY_COLUMNS = 'id, user_id, kind, body, data, created_at, updated_at';

const key = (courseId: string, lessonId: string) => `${courseId}/${lessonId}`;
const hhmm = (v: unknown) => (typeof v === 'string' && v.length >= 5 ? v.slice(0, 5) : DEFAULT_PREFS.remind_at);

function readPrefs(row: Record<string, unknown>): CoursePrefs {
  return {
    user_id: String(row.user_id),
    share_answers: row.share_answers === true,
    notify_partner: row.notify_partner !== false,
    remind: row.remind === true,
    remind_at: hhmm(row.remind_at),
    remind_days: Array.isArray(row.remind_days) ? (row.remind_days as number[]) : DEFAULT_PREFS.remind_days,
  };
}

/* Until migration 0015 runs, the tables are not there: the section says so instead of breaking. */
function isMissingTable(error: { code?: string; message?: string } | null) {
  return !!error && (error.code === '42P01' || error.code === 'PGRST205' || /does not exist|schema cache/i.test(error.message ?? ''));
}

/*
  Everything about courses and the journal for both people in the space.

  Progress is always shared; answers and journal entries come back from the
  database only for yourself and for a partner who has opened theirs — the
  privacy lives in row-level security, so `partnerAnswers` is empty because
  nothing was sent, not because it was filtered here.
*/
export function useCourses() {
  const instance = useId();
  const { user, partner, spaceId } = useSpaceAuth();
  const me = user?.id ?? null;
  const them = partner?.id ?? null;

  const [prefs, setPrefs] = useState<CoursePrefs[]>([]);
  const [enrolments, setEnrolments] = useState<Enrolment[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [answers, setAnswers] = useState<AnswerRow[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [available, setAvailable] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!spaceId) return;
    const [p, e, s, a, j] = await Promise.all([
      supabase.from('course_prefs').select(PREF_COLUMNS).eq('space_id', spaceId),
      supabase.from('course_enrolments').select('user_id, course_id, started_at, finished_at').eq('space_id', spaceId),
      supabase.from('course_steps').select('user_id, course_id, lesson_id, done_at').eq('space_id', spaceId),
      supabase.from('course_answers').select(ANSWER_COLUMNS).eq('space_id', spaceId),
      supabase.from('journal_entries').select(ENTRY_COLUMNS).eq('space_id', spaceId).order('created_at', { ascending: false }),
    ]);
    const first = p.error ?? e.error ?? s.error ?? a.error ?? j.error;
    if (first) {
      if (isMissingTable(first)) setAvailable(false);
      else setError(tr('Не удалось загрузить курсы. Проверьте связь и обновите страницу.', 'Couldn’t load your courses. Check your connection and reload.'));
    } else {
      setPrefs((p.data ?? []).map((row) => readPrefs(row as Record<string, unknown>)));
      setEnrolments((e.data ?? []) as Enrolment[]);
      setSteps((s.data ?? []) as Step[]);
      setAnswers((a.data ?? []) as AnswerRow[]);
      setEntries((j.data ?? []) as JournalEntry[]);
      setError(null);
    }
    setIsLoading(false);
  }, [spaceId]);

  useEffect(() => {
    load();
  }, [load]);

  /* The partner's sharing switch, read inside Realtime callbacks without resubscribing. */
  const partnerShared = useRef(false);

  useEffect(() => {
    if (!spaceId) return;
    const filter = `space_id=eq.${spaceId}`;
    const channel = supabase
      .channel(`courses:${spaceId}:${instance}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'course_steps', filter }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const old = payload.old as Partial<Step>;
          setSteps((list) => list.filter((x) => !(x.user_id === old.user_id && x.course_id === old.course_id && x.lesson_id === old.lesson_id)));
          return;
        }
        const row = payload.new as Step;
        setSteps((list) => [...list.filter((x) => !(x.user_id === row.user_id && x.course_id === row.course_id && x.lesson_id === row.lesson_id)), row]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'course_prefs', filter }, (payload) => {
        if (payload.eventType === 'DELETE') return;
        const row = readPrefs(payload.new as Record<string, unknown>);
        setPrefs((list) => [...list.filter((x) => x.user_id !== row.user_id), row]);
        /* The partner opened or closed their answers: what we may read has changed, so read again. */
        if (row.user_id !== me && row.share_answers !== partnerShared.current) load();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [spaceId, instance, me, load]);

  const myPrefs = useMemo<CoursePrefs | null>(
    () => (me ? (prefs.find((p) => p.user_id === me) ?? { user_id: me, ...DEFAULT_PREFS }) : null),
    [prefs, me],
  );
  const theirPrefs = useMemo(() => (them ? (prefs.find((p) => p.user_id === them) ?? null) : null), [prefs, them]);
  const partnerShares = !!theirPrefs?.share_answers;
  useEffect(() => {
    partnerShared.current = partnerShares;
  }, [partnerShares]);

  const doneOf = useCallback(
    (userId: string | null, courseId: string) =>
      new Set(steps.filter((s) => s.user_id === userId && s.course_id === courseId).map((s) => s.lesson_id)),
    [steps],
  );

  const answersOf = useCallback(
    (userId: string | null) => new Map(answers.filter((a) => a.user_id === userId).map((a) => [key(a.course_id, a.lesson_id), a.data])),
    [answers],
  );
  const myAnswers = useMemo(() => answersOf(me), [answersOf, me]);
  const partnerAnswers = useMemo(() => answersOf(them), [answersOf, them]);

  const enrolmentOf = useCallback(
    (userId: string | null, courseId: string) => enrolments.find((e) => e.user_id === userId && e.course_id === courseId) ?? null,
    [enrolments],
  );

  /* ── writes ─────────────────────────────────────────────────────────────── */

  const start = useCallback(
    async (courseId: string) => {
      if (!me || !spaceId) return false;
      if (enrolments.some((e) => e.user_id === me && e.course_id === courseId)) return true;
      const row = { user_id: me, space_id: spaceId, course_id: courseId, started_at: new Date().toISOString(), finished_at: null };
      const { error: writeError } = await supabase.from('course_enrolments').upsert(row, { onConflict: 'user_id,course_id', ignoreDuplicates: true });
      if (writeError) {
        setError(tr('Не получилось начать курс. Попробуйте ещё раз.', 'Couldn’t start the course. Please try again.'));
        return false;
      }
      setEnrolments((list) => [...list, row]);
      return true;
    },
    [me, spaceId, enrolments],
  );

  /* Saves the whole lesson's answers; the caller debounces. Returns whether it reached the database. */
  const saveAnswers = useCallback(
    async (courseId: string, lessonId: string, data: LessonAnswers) => {
      if (!me || !spaceId) return false;
      const row = { user_id: me, space_id: spaceId, course_id: courseId, lesson_id: lessonId, data, updated_at: new Date().toISOString() };
      setAnswers((list) => [...list.filter((a) => !(a.user_id === me && a.course_id === courseId && a.lesson_id === lessonId)), row]);
      const { error: writeError } = await supabase.from('course_answers').upsert(row, { onConflict: 'user_id,course_id,lesson_id' });
      if (writeError) {
        setError(tr('Ответ не сохранился. Проверьте связь — текст остался на экране.', 'Your answer wasn’t saved. Check your connection — the text is still here.'));
        return false;
      }
      setError(null);
      return true;
    },
    [me, spaceId],
  );

  const markDone = useCallback(
    async (courseId: string, lessonId: string) => {
      if (!me || !spaceId) return false;
      const course = courseById(courseId);
      if (!course) return false;
      await start(courseId);
      const row = { user_id: me, space_id: spaceId, course_id: courseId, lesson_id: lessonId, done_at: new Date().toISOString() };
      const { error: writeError } = await supabase.from('course_steps').upsert(row, { onConflict: 'user_id,course_id,lesson_id', ignoreDuplicates: true });
      if (writeError) {
        setError(tr('Не получилось отметить урок. Попробуйте ещё раз.', 'Couldn’t mark the lesson. Please try again.'));
        return false;
      }
      const done = new Set([...steps.filter((s) => s.user_id === me && s.course_id === courseId).map((s) => s.lesson_id), lessonId]);
      setSteps((list) => [...list.filter((s) => !(s.user_id === me && s.course_id === courseId && s.lesson_id === lessonId)), row]);
      /* The last step closes the course, which also stops its reminders. */
      if (lessonsOf(course).every((l) => done.has(l.id))) {
        const finished_at = new Date().toISOString();
        await supabase.from('course_enrolments').update({ finished_at }).eq('user_id', me).eq('course_id', courseId);
        setEnrolments((list) => list.map((e) => (e.user_id === me && e.course_id === courseId ? { ...e, finished_at } : e)));
      }
      return true;
    },
    [me, spaceId, steps, start],
  );

  const updatePrefs = useCallback(
    async (patch: Partial<Omit<CoursePrefs, 'user_id'>>) => {
      if (!me || !spaceId || !myPrefs) return false;
      const previous = myPrefs;
      const next = { ...myPrefs, ...patch };
      setPrefs((list) => [...list.filter((p) => p.user_id !== me), next]);
      const { error: writeError } = await supabase
        .from('course_prefs')
        .upsert({ ...next, space_id: spaceId, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      if (writeError) {
        setPrefs((list) => [...list.filter((p) => p.user_id !== me), previous]);
        setError(tr('Не получилось сохранить. Попробуйте ещё раз.', 'Couldn’t save. Please try again.'));
        return false;
      }
      setError(null);
      return true;
    },
    [me, spaceId, myPrefs],
  );

  const addEntry = useCallback(
    async (kind: JournalEntry['kind'], body: string, data: Record<string, string> = {}) => {
      if (!me || !spaceId) return null;
      const { data: row, error: writeError } = await supabase
        .from('journal_entries')
        .insert({ user_id: me, space_id: spaceId, kind, body, data })
        .select(ENTRY_COLUMNS)
        .maybeSingle();
      if (writeError || !row) {
        setError(tr('Запись не сохранилась. Попробуйте ещё раз.', 'The entry wasn’t saved. Please try again.'));
        return null;
      }
      setEntries((list) => [row as JournalEntry, ...list]);
      setError(null);
      return row as JournalEntry;
    },
    [me, spaceId],
  );

  const updateEntry = useCallback(
    async (id: string, patch: { body?: string; data?: Record<string, string> }) => {
      if (!me) return false;
      const { data: row, error: writeError } = await supabase
        .from('journal_entries')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', me)
        .select(ENTRY_COLUMNS)
        .maybeSingle();
      if (writeError || !row) {
        setError(tr('Изменения не сохранились. Попробуйте ещё раз.', 'Your changes weren’t saved. Please try again.'));
        return false;
      }
      setEntries((list) => list.map((e) => (e.id === id ? (row as JournalEntry) : e)));
      setError(null);
      return true;
    },
    [me],
  );

  const removeEntry = useCallback(
    async (id: string) => {
      if (!me) return false;
      const { error: writeError } = await supabase.from('journal_entries').delete().eq('id', id).eq('user_id', me);
      if (writeError) {
        setError(tr('Не получилось удалить запись.', 'Couldn’t delete the entry.'));
        return false;
      }
      setEntries((list) => list.filter((e) => e.id !== id));
      return true;
    },
    [me],
  );

  return {
    available,
    isLoading: available && isLoading,
    error,
    me,
    partnerId: them,
    myPrefs,
    theirPrefs,
    partnerShares,
    doneOf,
    doneAt: (userId: string | null, courseId: string, lessonId: string) =>
      steps.find((s) => s.user_id === userId && s.course_id === courseId && s.lesson_id === lessonId)?.done_at ?? null,
    enrolmentOf,
    /* When this person last did anything in a course — a step or an answer. */
    lastActivity: (userId: string | null) => {
      const stamps = [
        ...steps.filter((s) => s.user_id === userId).map((s) => s.done_at),
        ...answers.filter((a) => a.user_id === userId).map((a) => a.updated_at),
      ];
      return stamps.length ? stamps.reduce((a, b) => (a > b ? a : b)) : null;
    },
    myAnswers,
    partnerAnswers,
    answersFor: (userId: string | null, courseId: string, lessonId: string) =>
      (userId === me ? myAnswers : partnerAnswers).get(key(courseId, lessonId)) ?? null,
    myEntries: entries.filter((e) => e.user_id === me),
    partnerEntries: entries.filter((e) => e.user_id === them),
    start,
    saveAnswers,
    markDone,
    updatePrefs,
    addEntry,
    updateEntry,
    removeEntry,
    reload: load,
  };
}

export type CoursesStore = ReturnType<typeof useCourses>;
