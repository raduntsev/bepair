'use client';

import { useMemo, useState } from 'react';
import { addMonths, format, isSameMonth, startOfMonth } from 'date-fns';
import { ChevronLeft, ChevronRight, Minus, PiggyBank, Plus, X } from 'lucide-react';
import { useBudget, type BudgetGoal } from '@/hooks/useBudget';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { fmt, sentence, todayISO } from '@/lib/dates';
import { displayName } from '@/lib/words';
import { Alert, EmptyState, Loading } from '@/components/ui/Blocks';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Segment } from '@/components/ui/Controls';
import { Sheet } from '@/components/ui/Sheet';
import { getLang, tr } from '@/lib/i18n';

/*
  «Бюджет»: the couple's own spreadsheet, in the planerka. The month opens on
  what is left for each of you — the number the table was kept for — then the
  categories side by side, the goals, and every entry of the month.
  Expenses are added as they happen; the check-in reads the month.
*/

const money = (n: number) =>
  `${new Intl.NumberFormat(getLang() === 'en' ? 'en-GB' : 'ru-RU', { maximumFractionDigits: 0 }).format(Math.round(n))}\u00A0₽`;

/* «2790,77+767,94» — the way amounts were typed into the table's cells. */
function parseAmount(text: string): number | null {
  const parts = text.replace(/\s+/g, '').replace(/,/g, '.').split('+').filter(Boolean);
  if (parts.length === 0) return null;
  let sum = 0;
  for (const p of parts) {
    if (!/^\d+(\.\d{1,2})?$/.test(p)) return null;
    sum += Number(p);
  }
  return sum > 0 ? sum : null;
}

type Whose = 'me' | 'partner' | 'shared';

export function Budget({ initialMonth }: { initialMonth?: string }) {
  const { user, partner } = useSpaceAuth();
  const [month, setMonth] = useState(() => startOfMonth(initialMonth ? new Date(`${initialMonth}T00:00:00`) : new Date()));
  const budget = useBudget(month);
  const [entrySheet, setEntrySheet] = useState<'expense' | 'income' | null>(null);
  const [goalSheet, setGoalSheet] = useState<BudgetGoal | 'new' | null>(null);
  const [savingFor, setSavingFor] = useState<BudgetGoal | null>(null);

  if (!user) return null;
  if (!budget.available) {
    return <EmptyState title={tr('Бюджет скоро появится', 'The budget is coming')}>{tr('Нужно обновить базу: миграция 0025.', 'The database needs migration 0025.')}</EmptyState>;
  }

  const partnerName = displayName(partner?.display_name);
  const people = [{ id: user.id, name: tr('Вы', 'You') }, ...(partner ? [{ id: partner.id, name: partnerName }] : [])];
  const summaries = people.map((p) => ({ ...p, ...budget.summaryOf(p.id) }));
  const categories = [...new Set(summaries.flatMap((s) => Object.keys(s.byCategory)))].sort(
    (a, b) => summaries.reduce((t, s) => t + (s.byCategory[b] ?? 0), 0) - summaries.reduce((t, s) => t + (s.byCategory[a] ?? 0), 0),
  );
  const isCurrent = isSameMonth(month, new Date());
  const nameOf = (id: string | null) => (id === null ? tr('Общая', 'Shared') : id === user.id ? tr('Ваша', 'Yours') : partnerName);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-2xl bg-surface p-2 shadow-card">
        <button
          type="button"
          aria-label={tr('Предыдущий месяц', 'Previous month')}
          onClick={() => setMonth((m) => addMonths(m, -1))}
          className="tap flex items-center justify-center rounded-lg text-ink-soft hover:bg-sunken hover:text-ink"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <h2 className="text-headline font-semibold" aria-live="polite">
          {sentence(fmt(month, 'LLLL yyyy'))}
        </h2>
        <button
          type="button"
          disabled={isCurrent}
          aria-label={tr('Следующий месяц', 'Next month')}
          onClick={() => setMonth((m) => addMonths(m, 1))}
          className="tap flex items-center justify-center rounded-lg text-ink-soft hover:bg-sunken hover:text-ink disabled:opacity-30"
        >
          <ChevronRight className="size-5" aria-hidden />
        </button>
      </div>

      {budget.error && <Alert>{budget.error}</Alert>}

      {budget.isLoading ? (
        <Loading label={tr('Загружаем бюджет…', 'Loading the budget…')} />
      ) : (
        <>
          {/* What is left — the number the table was for. */}
          <div className={`grid gap-3 ${summaries.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {summaries.map((s, i) => (
              <section key={s.id} className="min-w-0 rounded-2xl bg-surface p-4 shadow-card">
                <h3 className="flex items-center gap-2 text-headline font-semibold">
                  <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${i === 0 ? 'bg-accent' : 'bg-partner'}`} />
                  <span className="truncate">{s.name}</span>
                </h3>
                <p className="mt-2 text-subhead text-ink-faint">{tr('Осталось', 'Left')}</p>
                <p className={`text-large-title font-bold tabular-nums ${s.left < 0 ? 'text-danger' : ''}`}>{money(s.left)}</p>
                <dl className="mt-3 space-y-1 text-subhead">
                  <div className="flex justify-between gap-2">
                    <dt className="text-ink-faint">{tr('Доход', 'Income')}</dt>
                    <dd className="whitespace-nowrap tabular-nums">{money(s.income)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-ink-faint">{tr('Расходы', 'Spent')}</dt>
                    <dd className="whitespace-nowrap tabular-nums">{money(s.expenses)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-ink-faint">{tr('Отложено', 'Saved')}</dt>
                    <dd className="whitespace-nowrap tabular-nums">{money(s.savedTotal)}</dd>
                  </div>
                </dl>
              </section>
            ))}
          </div>

          <div className="flex gap-2">
            <Button size="lg" className="min-w-0 flex-1" onClick={() => setEntrySheet('expense')}>
              <Minus className="size-4.5" aria-hidden /> {tr('Расход', 'Expense')}
            </Button>
            <Button size="lg" variant="secondary" className="min-w-0 flex-1" onClick={() => setEntrySheet('income')}>
              <Plus className="size-4.5" aria-hidden /> {tr('Доход', 'Income')}
            </Button>
          </div>

          {categories.length > 0 && (
            <section className="overflow-hidden rounded-2xl bg-surface shadow-card">
              <h3 className="px-4 pt-4 pb-2 text-headline font-semibold">{tr('Расходы по категориям', 'Spending by category')}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-subhead">
                  <thead>
                    <tr className="text-ink-faint">
                      <th scope="col" className="px-4 py-1.5 text-left font-normal">{tr('Категория', 'Category')}</th>
                      {summaries.map((s) => (
                        <th key={s.id} scope="col" className="px-4 py-1.5 text-right font-normal">
                          {s.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((c) => (
                      <tr key={c} className="border-t border-line">
                        <th scope="row" className="px-4 py-2 text-left font-normal text-ink">
                          {c}
                        </th>
                        {summaries.map((s) => (
                          <td key={s.id} className="px-4 py-2 text-right whitespace-nowrap tabular-nums text-ink">
                            {s.byCategory[c] ? money(s.byCategory[c]) : <span className="text-ink-faint">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr className="border-t border-line-strong font-semibold">
                      <th scope="row" className="px-4 py-2 text-left">
                        {tr('Итого', 'Total')}
                      </th>
                      {summaries.map((s) => (
                        <td key={s.id} className="px-4 py-2 text-right whitespace-nowrap tabular-nums">
                          {money(s.expenses)}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Goals: the share of income meant for each (plan) against what went in (fact). */}
          <section className="overflow-hidden rounded-2xl bg-surface shadow-card">
            <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-2">
              <h3 className="text-headline font-semibold">{tr('Накопления', 'Savings')}</h3>
              <button type="button" onClick={() => setGoalSheet('new')} className="tap rounded-lg px-2 text-subhead font-medium text-accent hover:underline">
                {tr('Новая цель', 'New goal')}
              </button>
            </div>
            {budget.goals.length === 0 ? (
              <p className="px-4 pb-4 text-subhead text-ink-faint">{tr('Например, «Недвижимость» — 20% дохода каждого.', 'For example, «A home» — 20% of each one’s income.')}</p>
            ) : (
              <ul>
                {budget.goals.map((g) => {
                  const total = budget.progressOf(g.id);
                  const share = g.target ? Math.min(1, total / g.target) : null;
                  return (
                    <li key={g.id} className="border-t border-line px-4 py-3">
                      <div className="flex items-start gap-3">
                        <button type="button" onClick={() => setGoalSheet(g)} className="min-w-0 flex-1 text-left">
                          <span className="block text-body font-medium text-ink">{g.title}</span>
                          <span className="block text-subhead text-ink-faint">
                            {nameOf(g.owner_id)}
                            {g.percent > 0 && ` · ${String(g.percent).replace('.', ',')}% ${tr('дохода', 'of income')}`}
                          </span>
                        </button>
                        <Button variant="secondary" className="!h-9 !rounded-full !px-3.5" onClick={() => setSavingFor(g)}>
                          <PiggyBank className="size-4" aria-hidden /> {tr('Отложить', 'Put away')}
                        </Button>
                      </div>
                      {share !== null && (
                        <div className="mt-2.5">
                          <div className="h-2 overflow-hidden rounded-full bg-sunken" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(share * 100)}>
                            <div className="h-full rounded-full bg-accent" style={{ width: `${share * 100}%` }} />
                          </div>
                          <p className="mt-1 text-subhead text-ink-faint tabular-nums">
                            {money(total)} {tr('из', 'of')} {money(g.target!)}
                          </p>
                        </div>
                      )}
                      <ul className="mt-2 space-y-0.5">
                        {summaries
                          .filter((s) => g.owner_id === null || g.owner_id === s.id)
                          .map((s) => {
                            const row = s.plan.find((p) => p.goal.id === g.id);
                            if (!row || (row.planned === 0 && row.fact === 0)) return null;
                            return (
                              <li key={s.id} className="flex justify-between gap-2 text-subhead tabular-nums">
                                <span className="text-ink-faint">{g.owner_id === null ? s.name : tr('В этом месяце', 'This month')}</span>
                                <span className={row.fact >= row.planned && row.planned > 0 ? 'text-accent' : 'text-ink'}>
                                  {money(row.fact)}
                                  {row.planned > 0 && <span className="text-ink-faint"> / {money(row.planned)}</span>}
                                </span>
                              </li>
                            );
                          })}
                      </ul>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="overflow-hidden rounded-2xl bg-surface shadow-card">
            <h3 className="px-4 pt-4 pb-2 text-headline font-semibold">{tr('Записи месяца', 'This month’s entries')}</h3>
            {budget.entries.length === 0 ? (
              <p className="px-4 pb-4 text-subhead text-ink-faint">{tr('Пока пусто. Расходы удобно добавлять сразу, как потратили.', 'Nothing yet. Add expenses as you spend.')}</p>
            ) : (
              <ul>
                {budget.entries.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 border-t border-line py-2 pr-2 pl-4">
                    <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${e.user_id === user.id ? 'bg-accent' : 'bg-partner'}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body text-ink">{e.kind === 'income' ? tr('Доход', 'Income') : e.category || '—'}</span>
                      <span className="block truncate text-subhead text-ink-faint">
                        {fmt(e.spent_on, 'd MMMM')}
                        {e.note && ` · ${e.note}`}
                      </span>
                    </span>
                    <span className={`shrink-0 text-body tabular-nums ${e.kind === 'income' ? 'text-accent' : 'text-ink'}`}>
                      {e.kind === 'income' ? '+' : '−'}
                      {money(e.amount)}
                    </span>
                    <button
                      type="button"
                      aria-label={tr('Удалить запись', 'Delete the entry')}
                      onClick={() => budget.removeEntry(e.id)}
                      className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink-faint hover:bg-sunken hover:text-ink"
                    >
                      <X className="size-4" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <EntrySheet
        kind={entrySheet}
        onClose={() => setEntrySheet(null)}
        partnerName={partner ? partnerName : null}
        categories={budget.categories}
        month={month}
        onSave={async (input) => budget.addEntry({ ...input, userId: input.whose === 'partner' && partner ? partner.id : user.id })}
      />
      <GoalSheet
        goal={goalSheet}
        onClose={() => setGoalSheet(null)}
        partnerName={partner ? partnerName : null}
        userId={user.id}
        partnerId={partner?.id ?? null}
        onSave={(input) => budget.saveGoal(input)}
        onArchive={(id) => budget.archiveGoal(id)}
      />
      <SavingSheet
        goal={savingFor}
        onClose={() => setSavingFor(null)}
        partnerName={partner ? partnerName : null}
        onSave={(whose, amount) =>
          budget.addSaving(savingFor!.id, savingFor!.owner_id ?? (whose === 'partner' && partner ? partner.id : user.id), amount)
        }
      />
    </div>
  );
}

function WhoseSegment({ value, onChange, partnerName, shared = false }: { value: Whose; onChange: (w: Whose) => void; partnerName: string | null; shared?: boolean }) {
  if (!partnerName) return null;
  return (
    <Segment
      legend={tr('Чьё', 'Whose')}
      options={[
        { value: 'me' as const, label: tr('Моё', 'Mine') },
        { value: 'partner' as const, label: partnerName },
        ...(shared ? [{ value: 'shared' as const, label: tr('Общее', 'Shared') }] : []),
      ]}
      value={value}
      onChange={onChange}
    />
  );
}

function EntrySheet({
  kind,
  onClose,
  partnerName,
  categories,
  month,
  onSave,
}: {
  kind: 'expense' | 'income' | null;
  onClose: () => void;
  partnerName: string | null;
  categories: string[];
  month: Date;
  onSave: (input: { whose: Whose; kind: 'expense' | 'income'; amount: number; category: string; note: string; spentOn: string }) => Promise<boolean>;
}) {
  const defaultDay = () => {
    const today = todayISO();
    return isSameMonth(new Date(`${today}T00:00:00`), month) ? today : format(month, 'yyyy-MM-dd');
  };
  const [whose, setWhose] = useState<Whose>('me');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [day, setDay] = useState(defaultDay);
  const [busy, setBusy] = useState(false);
  const [openedFor, setOpenedFor] = useState<string | null>(null);

  /* A fresh form every time the sheet opens. */
  const key = kind ? `${kind}:${format(month, 'yyyy-MM')}` : null;
  if (key && openedFor !== key) {
    setOpenedFor(key);
    setAmount('');
    setCategory('');
    setNote('');
    setDay(defaultDay());
  } else if (!key && openedFor) {
    setOpenedFor(null);
  }

  const value = useMemo(() => parseAmount(amount), [amount]);
  const isSum = amount.includes('+');
  const ready = value !== null && (kind === 'income' || category.trim().length > 0);

  return (
    <Sheet open={kind !== null} onClose={onClose} title={kind === 'income' ? tr('Доход', 'Income') : tr('Расход', 'Expense')}>
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!kind || value === null || !ready) return;
          setBusy(true);
          const ok = await onSave({ whose, kind, amount: value, category: kind === 'income' ? '' : category, note, spentOn: day });
          setBusy(false);
          if (ok) onClose();
        }}
      >
        <WhoseSegment value={whose} onChange={setWhose} partnerName={partnerName} />
        <div>
          <Input
            aria-label={tr('Сумма, ₽', 'Amount, ₽')}
            inputMode="decimal"
            autoFocus
            value={amount}
            onChange={(event) => setAmount(event.target.value.replace(/[^\d.,+\s]/g, ''))}
            placeholder={tr('Сумма, ₽', 'Amount, ₽')}
            className="text-lg tabular-nums"
          />
          <p className="mt-1.5 px-1 text-subhead text-ink-faint">
            {isSum && value !== null ? `= ${money(value)}` : tr('Можно сложить: 2790+767', 'You can add up: 2790+767')}
          </p>
        </div>
        {kind === 'expense' && (
          <div className="space-y-2">
            <ul className="flex flex-wrap gap-2" aria-label={tr('Категория', 'Category')}>
              {categories.map((c) => (
                <li key={c}>
                  <button
                    type="button"
                    aria-pressed={category === c}
                    onClick={() => setCategory(c)}
                    className={`flex h-9 items-center rounded-full px-3.5 text-subhead transition-colors ${
                      category === c ? 'bg-ink text-surface' : 'bg-sunken text-ink-soft hover:text-ink'
                    }`}
                  >
                    {c}
                  </button>
                </li>
              ))}
            </ul>
            <Input
              aria-label={tr('Своя категория', 'Your own category')}
              value={categories.includes(category) ? '' : category}
              onChange={(event) => setCategory(event.target.value.slice(0, 60))}
              placeholder={tr('Или своя категория', 'Or your own category')}
            />
          </div>
        )}
        <div className="grid grid-cols-[auto_1fr] items-center gap-3">
          <label htmlFor="budget-day" className="text-subhead text-ink-faint">
            {tr('Дата', 'Date')}
          </label>
          <Input id="budget-day" type="date" value={day} max={todayISO()} onChange={(event) => setDay(event.target.value || defaultDay())} />
        </div>
        <Input aria-label={tr('Заметка', 'Note')} value={note} onChange={(event) => setNote(event.target.value.slice(0, 300))} placeholder={tr('Заметка, если нужна', 'A note, if needed')} />
        <Button type="submit" size="lg" block loading={busy} disabled={!ready}>
          {tr('Сохранить', 'Save')}
        </Button>
      </form>
    </Sheet>
  );
}

function GoalSheet({
  goal,
  onClose,
  partnerName,
  userId,
  partnerId,
  onSave,
  onArchive,
}: {
  goal: BudgetGoal | 'new' | null;
  onClose: () => void;
  partnerName: string | null;
  userId: string;
  partnerId: string | null;
  onSave: (input: { id?: string; ownerId: string | null; title: string; target: number | null; percent: number }) => Promise<boolean>;
  onArchive: (id: string) => Promise<boolean>;
}) {
  const editing = goal && goal !== 'new' ? goal : null;
  const [title, setTitle] = useState('');
  const [whose, setWhose] = useState<Whose>('shared');
  const [percent, setPercent] = useState('');
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [openedFor, setOpenedFor] = useState<string | null>(null);

  const key = goal ? (editing ? editing.id : 'new') : null;
  if (key && openedFor !== key) {
    setOpenedFor(key);
    setTitle(editing?.title ?? '');
    setWhose(!editing || editing.owner_id === null ? 'shared' : editing.owner_id === userId ? 'me' : 'partner');
    setPercent(editing && editing.percent ? String(editing.percent).replace('.', ',') : '');
    setTarget(editing?.target ? String(editing.target) : '');
  } else if (!key && openedFor) {
    setOpenedFor(null);
  }

  const pct = percent.trim() ? Number(percent.replace(',', '.')) : 0;
  const tgt = target.trim() ? parseAmount(target) : null;
  const valid = title.trim().length > 0 && Number.isFinite(pct) && pct >= 0 && pct <= 100 && (!target.trim() || tgt !== null);

  return (
    <Sheet open={goal !== null} onClose={onClose} title={editing ? tr('Цель', 'Goal') : tr('Новая цель', 'New goal')}>
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!valid) return;
          setBusy(true);
          const ownerId = whose === 'shared' ? null : whose === 'me' ? userId : partnerId;
          const ok = await onSave({ id: editing?.id, ownerId, title, target: tgt, percent: pct });
          setBusy(false);
          if (ok) onClose();
        }}
      >
        <Input aria-label={tr('Название', 'Name')} value={title} autoFocus onChange={(event) => setTitle(event.target.value.slice(0, 80))} placeholder={tr('Например, «Недвижимость»', 'For example, «A home»')} />
        <WhoseSegment value={whose} onChange={setWhose} partnerName={partnerName} shared />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Input aria-label={tr('Доля дохода, %', 'Share of income, %')} inputMode="decimal" value={percent} onChange={(event) => setPercent(event.target.value.replace(/[^\d.,]/g, ''))} placeholder={tr('% дохода', '% of income')} />
            <p className="mt-1.5 px-1 text-subhead text-ink-faint">{whose === 'shared' ? tr('от дохода каждого', 'of each one’s income') : tr('от дохода', 'of income')}</p>
          </div>
          <div>
            <Input aria-label={tr('Сколько нужно, ₽', 'Target, ₽')} inputMode="decimal" value={target} onChange={(event) => setTarget(event.target.value.replace(/[^\d.,+\s]/g, ''))} placeholder={tr('Сколько нужно, ₽', 'Target, ₽')} />
            <p className="mt-1.5 px-1 text-subhead text-ink-faint">{tr('можно не указывать', 'optional')}</p>
          </div>
        </div>
        <Button type="submit" size="lg" block loading={busy} disabled={!valid}>
          {tr('Сохранить', 'Save')}
        </Button>
        {editing && (
          <Button
            variant="ghost"
            block
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const ok = await onArchive(editing.id);
              setBusy(false);
              if (ok) onClose();
            }}
          >
            {tr('Убрать цель', 'Remove the goal')}
          </Button>
        )}
      </form>
    </Sheet>
  );
}

function SavingSheet({
  goal,
  onClose,
  partnerName,
  onSave,
}: {
  goal: BudgetGoal | null;
  onClose: () => void;
  partnerName: string | null;
  onSave: (whose: Whose, amount: number) => Promise<boolean>;
}) {
  const [whose, setWhose] = useState<Whose>('me');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  if (goal && openedFor !== goal.id) {
    setOpenedFor(goal.id);
    setAmount('');
  } else if (!goal && openedFor) {
    setOpenedFor(null);
  }
  const value = parseAmount(amount);
  /* A personal goal is funded by its owner; only a shared one asks whose money it is. */
  const showWhose = !!goal && goal.owner_id === null;

  return (
    <Sheet open={goal !== null} onClose={onClose} title={goal ? `${tr('Отложить', 'Put away')}: ${goal.title}` : ''}>
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          if (value === null) return;
          setBusy(true);
          const ok = await onSave(whose, value);
          setBusy(false);
          if (ok) onClose();
        }}
      >
        {showWhose && <WhoseSegment value={whose} onChange={setWhose} partnerName={partnerName} />}
        <Input
          aria-label={tr('Сумма, ₽', 'Amount, ₽')}
          inputMode="decimal"
          autoFocus
          value={amount}
          onChange={(event) => setAmount(event.target.value.replace(/[^\d.,+\s]/g, ''))}
          placeholder={tr('Сумма, ₽', 'Amount, ₽')}
          className="text-lg tabular-nums"
        />
        <Button type="submit" size="lg" block loading={busy} disabled={value === null}>
          {tr('Отложить', 'Put away')}
        </Button>
      </form>
    </Sheet>
  );
}
