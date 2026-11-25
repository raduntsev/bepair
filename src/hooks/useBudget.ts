'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import supabase from '@/lib/supabase';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { tr } from '@/lib/i18n';

/*
  «Бюджет»: the couple's spreadsheet, month by month (0025). Each partner's
  income and expenses by category; savings goals with a planned share of
  income and what was actually put away. Visible to both; either may enter
  the other's numbers.
*/

export interface BudgetEntry {
  id: string;
  user_id: string;
  kind: 'expense' | 'income';
  amount: number;
  category: string;
  note: string;
  spent_on: string;
  created_at: string;
}

export interface BudgetGoal {
  id: string;
  owner_id: string | null;
  title: string;
  target: number | null;
  percent: number;
  created_at: string;
}

export interface BudgetSaving {
  id: string;
  goal_id: string;
  user_id: string;
  amount: number;
  month: string;
}

/* The categories of their own table, in its order; anything typed later joins them. */
export const DEFAULT_CATEGORIES = () => [
  tr('Жильё', 'Housing'),
  tr('Продукты', 'Groceries'),
  tr('Транспорт и поездки', 'Transport and trips'),
  tr('Кафе и рестораны', 'Eating out'),
  tr('Уход', 'Self-care'),
  tr('Здоровье', 'Health'),
  tr('Одежда', 'Clothes'),
  tr('Кредит', 'Loan'),
  tr('Развлечения', 'Fun'),
  tr('Подарки', 'Gifts'),
  tr('Переводы людям', 'Transfers to people'),
  tr('На себя', 'For myself'),
  tr('Психолог', 'Therapist'),
  tr('Домой', 'For home'),
];

const num = (v: unknown) => Number(v) || 0;

export function monthKey(month: Date) {
  return format(startOfMonth(month), 'yyyy-MM-dd');
}

export function useBudget(month: Date) {
  const instance = useId();
  const { user, spaceId } = useSpaceAuth();
  const [entries, setEntries] = useState<BudgetEntry[]>([]);
  const [goals, setGoals] = useState<BudgetGoal[]>([]);
  const [savings, setSavings] = useState<BudgetSaving[]>([]);
  const [usedCategories, setUsedCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  /* False before migration 0025. */
  const [available, setAvailable] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const from = monthKey(month);
  const to = format(endOfMonth(month), 'yyyy-MM-dd');

  const load = useCallback(async () => {
    if (!user || !spaceId) {
      setIsLoading(false);
      return;
    }
    const [e, g, s, c] = await Promise.all([
      supabase
        .from('budget_entries')
        .select('id, user_id, kind, amount, category, note, spent_on, created_at')
        .eq('space_id', spaceId)
        .gte('spent_on', from)
        .lte('spent_on', to)
        .order('spent_on', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase.from('budget_goals').select('id, owner_id, title, target, percent, created_at').eq('space_id', spaceId).is('archived_at', null).order('created_at'),
      supabase.from('budget_savings').select('id, goal_id, user_id, amount, month').eq('space_id', spaceId),
      /* Categories already in use, so a typed one comes back as a chip next month. */
      supabase.from('budget_entries').select('category').eq('space_id', spaceId).eq('kind', 'expense').order('created_at', { ascending: false }).limit(300),
    ]);
    if (e.error) {
      setAvailable(e.error.code !== '42P01' && e.error.code !== 'PGRST205');
      setError(tr('Не удалось загрузить бюджет. Проверьте связь и обновите страницу.', 'Couldn’t load the budget. Check your connection and reload.'));
      setIsLoading(false);
      return;
    }
    setAvailable(true);
    setError(null);
    setEntries(((e.data ?? []) as BudgetEntry[]).map((x) => ({ ...x, amount: num(x.amount) })));
    setGoals(((g.data ?? []) as BudgetGoal[]).map((x) => ({ ...x, target: x.target == null ? null : num(x.target), percent: num(x.percent) })));
    setSavings(((s.data ?? []) as BudgetSaving[]).map((x) => ({ ...x, amount: num(x.amount) })));
    setUsedCategories([...new Set(((c.data ?? []) as { category: string }[]).map((r) => r.category).filter(Boolean))]);
    setIsLoading(false);
  }, [user, spaceId, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!spaceId) return;
    const channel = supabase.channel(`budget:${spaceId}:${instance}`);
    for (const table of ['budget_entries', 'budget_savings', 'budget_goals']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `space_id=eq.${spaceId}` }, () => load());
    }
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [spaceId, instance, load]);

  const fail = (text: string) => {
    setError(text);
    return false;
  };

  const addEntry = useCallback(
    async (input: { userId: string; kind: 'expense' | 'income'; amount: number; category: string; note: string; spentOn: string }) => {
      if (!user || !spaceId) return false;
      const { error: insertError } = await supabase.from('budget_entries').insert({
        space_id: spaceId,
        user_id: input.userId,
        kind: input.kind,
        amount: Math.round(input.amount * 100) / 100,
        category: input.category.trim(),
        note: input.note.trim(),
        spent_on: input.spentOn,
        entered_by: user.id,
      });
      if (insertError) return fail(tr('Не получилось сохранить. Попробуйте ещё раз.', 'Couldn’t save. Please try again.'));
      await load();
      return true;
    },
    [user, spaceId, load],
  );

  const removeEntry = useCallback(
    async (id: string) => {
      const { error: deleteError } = await supabase.from('budget_entries').delete().eq('id', id);
      if (deleteError) return fail(tr('Не получилось удалить. Попробуйте ещё раз.', 'Couldn’t delete. Please try again.'));
      await load();
      return true;
    },
    [load],
  );

  const saveGoal = useCallback(
    async (input: { id?: string; ownerId: string | null; title: string; target: number | null; percent: number }) => {
      if (!user || !spaceId) return false;
      const row = { owner_id: input.ownerId, title: input.title.trim(), target: input.target, percent: input.percent };
      const { error: goalError } = input.id
        ? await supabase.from('budget_goals').update(row).eq('id', input.id)
        : await supabase.from('budget_goals').insert({ ...row, space_id: spaceId, created_by: user.id });
      if (goalError) return fail(tr('Не получилось сохранить цель.', 'Couldn’t save the goal.'));
      await load();
      return true;
    },
    [user, spaceId, load],
  );

  const archiveGoal = useCallback(
    async (id: string) => {
      const { error: goalError } = await supabase.from('budget_goals').update({ archived_at: new Date().toISOString() }).eq('id', id);
      if (goalError) return fail(tr('Не получилось убрать цель.', 'Couldn’t remove the goal.'));
      await load();
      return true;
    },
    [load],
  );

  const addSaving = useCallback(
    async (goalId: string, userId: string, amount: number) => {
      if (!user || !spaceId) return false;
      const { error: savingError } = await supabase.from('budget_savings').insert({
        space_id: spaceId,
        goal_id: goalId,
        user_id: userId,
        amount: Math.round(amount * 100) / 100,
        month: from,
        entered_by: user.id,
      });
      if (savingError) return fail(tr('Не получилось сохранить. Попробуйте ещё раз.', 'Couldn’t save. Please try again.'));
      await load();
      return true;
    },
    [user, spaceId, from, load],
  );

  const categories = useMemo(() => {
    const defaults = DEFAULT_CATEGORIES();
    return [...defaults, ...usedCategories.filter((c) => !defaults.includes(c))];
  }, [usedCategories]);

  /* One person's month, the way their table adds it up. */
  const summaryOf = useCallback(
    (personId: string) => {
      const mine = entries.filter((e) => e.user_id === personId);
      const income = mine.filter((e) => e.kind === 'income').reduce((sum, e) => sum + e.amount, 0);
      const expenses = mine.filter((e) => e.kind === 'expense').reduce((sum, e) => sum + e.amount, 0);
      const byCategory: Record<string, number> = {};
      for (const e of mine) if (e.kind === 'expense') byCategory[e.category || '—'] = (byCategory[e.category || '—'] ?? 0) + e.amount;
      const goalsFor = goals.filter((g) => g.owner_id === null || g.owner_id === personId);
      const saved = savings.filter((s) => s.user_id === personId && s.month === from);
      const plan = goalsFor.map((g) => ({
        goal: g,
        planned: (income * g.percent) / 100,
        fact: saved.filter((s) => s.goal_id === g.id).reduce((sum, s) => sum + s.amount, 0),
      }));
      const savedTotal = saved.reduce((sum, s) => sum + s.amount, 0);
      return { income, expenses, byCategory, plan, savedTotal, left: income - expenses - savedTotal };
    },
    [entries, goals, savings, from],
  );

  /* All-time progress of a goal, both partners together. */
  const progressOf = useCallback(
    (goalId: string) => savings.filter((s) => s.goal_id === goalId).reduce((sum, s) => sum + s.amount, 0),
    [savings],
  );

  return {
    available,
    isLoading,
    error,
    clearError: () => setError(null),
    entries,
    goals,
    categories,
    summaryOf,
    progressOf,
    addEntry,
    removeEntry,
    saveGoal,
    archiveGoal,
    addSaving,
  };
}
