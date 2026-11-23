'use client';

import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowUp, Check, ChevronDown, Eye, MoreHorizontal, Star, X } from 'lucide-react';
import { points } from '@/lib/dates';
import { displayName, verb } from '@/lib/words';
import { STARTER_TEMPLATES, WEIGHTS, taskState, useTasks, type Task } from '@/hooks/useTasks';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Segment } from '@/components/ui/Controls';
import { Alert, Loading, Page } from '@/components/ui/Blocks';
import { AutoHeight } from '@/components/ui/AutoHeight';
import { ExchangeHeader } from '@/components/ExchangeHeader';
import { tr } from '@/lib/i18n';

const EASE = [0.32, 0.72, 0, 1] as const;

/*
  A request is one line: what is asked, and its weight in small type. The only
  thing louder than the words is the circle you tick — every rarer action
  (edit, remove) waits behind «⋯» on the row, so a long list stays a list.
*/

type Kind = 'for-me' | 'mine' | 'done';

function TaskRow({
  task,
  kind,
  userId,
  partnerName,
  partnerGender,
  myGender,
  onComplete,
  onAcknowledge,
  onEdit,
  onRemove,
}: {
  task: Task;
  kind: Kind;
  userId: string | undefined;
  partnerName: string;
  partnerGender: 'm' | 'f' | null | undefined;
  myGender: 'm' | 'f' | null | undefined;
  onComplete: () => Promise<void>;
  onAcknowledge: () => Promise<void>;
  onEdit: (content: string, weight: number) => Promise<boolean>;
  onRemove: () => Promise<void>;
}) {
  const state = taskState(task);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.content);
  const [weight, setWeight] = useState(task.points);
  const [busy, setBusy] = useState(false);

  const reduce = useReducedMotion();
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    await action();
    setBusy(false);
  };

  const canTick = kind === 'for-me' && state === 'awaiting';
  const canManage = kind === 'mine' && state === 'awaiting';
  const thank = kind === 'mine' && state === 'done_unseen';
  const done = state !== 'awaiting';
  const seen = verb(myGender, 'увидел');

  const sub =
    state === 'awaiting'
      ? points(task.points)
      : state === 'done_unseen'
        ? kind === 'mine'
          ? tr(`${partnerName} ${verb(partnerGender, 'сделал')} · ${points(task.points)}`, `${partnerName} did it · ${points(task.points)}`)
          : tr(`${partnerName} ещё не ${verb(partnerGender, 'видел')}`, `${partnerName} hasn’t seen it yet`)
        : points(task.points);

  return (
    <motion.li
      layout={reduce ? false : 'position'}
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduce ? undefined : { opacity: 0 }}
      transition={{ duration: 0.25, ease: EASE }}
    >
      <div className="flex min-h-13 items-center gap-3.5 px-4 py-2">
        {canTick ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => run(onComplete)}
            aria-label={tr(`Отметить «${task.content}» выполненной`, `Mark “${task.content}” as done`)}
            className="tap -m-2.5 flex shrink-0 items-center justify-center p-2.5"
          >
            <span
              aria-hidden
              className={`flex size-[1.625rem] items-center justify-center rounded-full border-2 transition-colors ${
                busy ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong hover:border-accent'
              }`}
            >
              {busy && <Check className="size-3.5" strokeWidth={3} />}
            </span>
          </button>
        ) : (
          <span
            aria-hidden
            className={`flex size-[1.625rem] shrink-0 items-center justify-center rounded-full ${
              done
                ? task.completed_by === userId
                  ? 'bg-accent text-accent-ink'
                  : 'bg-partner text-white'
                : 'border-2 border-dashed border-line-strong'
            }`}
          >
            {done && <Check className="size-3.5" strokeWidth={3} />}
          </span>
        )}

        <span className="min-w-0 flex-1">
          <span className={`block text-body ${state === 'confirmed' ? 'text-ink-faint' : 'text-ink'}`}>{task.content}</span>
          <span className="block text-footnote text-ink-faint">{sub}</span>
        </span>

        {thank && (
          <button
            type="button"
            disabled={busy}
            onClick={() => run(onAcknowledge)}
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-accent-soft px-3 text-footnote font-semibold text-accent-soft-ink transition-opacity active:opacity-70"
          >
            <Eye className="size-3.5" aria-hidden /> {tr(`${seen.charAt(0).toUpperCase() + seen.slice(1)}`, 'Seen')}
          </button>
        )}
        {canManage && (
          <button
            type="button"
            onClick={() => {
              setOpen((v) => !v);
              setEditing(false);
            }}
            aria-expanded={open}
            aria-label={tr(`Действия с «${task.content}»`, `Actions for “${task.content}”`)}
            className="tap -mr-2 flex shrink-0 items-center justify-center rounded-full text-ink-faint transition-colors hover:text-ink"
          >
            <MoreHorizontal className="size-5" aria-hidden />
          </button>
        )}
      </div>

      <AutoHeight>
        {open && canManage && (
          <div className="px-4 pb-3 pl-[3.75rem]">
            {editing ? (
              <div className="space-y-2.5">
                <Input aria-label={tr('Текст просьбы', 'Request text')} value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
                <Segment legend={tr('Насколько это важно', 'How much it matters')} options={WEIGHTS} value={weight} onChange={setWeight} />
                <div className="flex gap-2">
                  <Button variant="secondary" className="!h-9" onClick={() => setEditing(false)}>
                    {tr('Отмена', 'Cancel')}
                  </Button>
                  <Button
                    className="!h-9 flex-1"
                    loading={busy}
                    disabled={!draft.trim()}
                    onClick={() =>
                      run(async () => {
                        if (await onEdit(draft.trim(), weight)) {
                          setEditing(false);
                          setOpen(false);
                        }
                      })
                    }
                  >
                    {tr('Сохранить', 'Save')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-4 text-subhead font-medium">
                <button
                  type="button"
                  className="tap text-accent"
                  onClick={() => {
                    setDraft(task.content);
                    setWeight(task.points);
                    setEditing(true);
                  }}
                >
                  {tr('Изменить', 'Edit')}
                </button>
                <button type="button" className="tap text-danger" disabled={busy} onClick={() => run(onRemove)}>
                  {tr('Убрать', 'Remove')}
                </button>
              </div>
            )}
          </div>
        )}
      </AutoHeight>
    </motion.li>
  );
}

function Group({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 flex items-baseline gap-2 px-1 text-subhead font-semibold text-ink-faint">
        {title}
        {count !== undefined && <span className="tabular-nums">{count}</span>}
      </h2>
      <ul className="overflow-hidden rounded-2xl bg-surface shadow-card [&>li+li]:border-t [&>li+li]:border-line">{children}</ul>
    </section>
  );
}

export default function TasksPage() {
  const { user, partner, profile } = useSpaceAuth();
  const { tasks, templates, isLoading, error, moreDone, loadMoreDone, add, edit, complete, acknowledge, remove, saveTemplate, removeTemplate } = useTasks();

  const [content, setContent] = useState('');
  const [weight, setWeight] = useState(2);
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [focused, setFocused] = useState(false);

  const partnerName = displayName(partner?.display_name);

  const submit = async () => {
    const text = content.trim();
    if (!text) return;
    setBusy(true);
    const ok = await add(text, weight);
    if (ok && remember) await saveTemplate(text, weight);
    setBusy(false);
    if (ok) {
      setContent('');
      setWeight(2);
      setRemember(false);
    }
  };

  const mineSaved = templates.filter((t) => t.user_id === user?.id);
  const starters = STARTER_TEMPLATES.filter((s) => !templates.some((t) => t.content === s.content));
  const suggestions = [
    ...mineSaved.map((t) => ({ key: t.id, content: t.content, points: t.points, saved: true })),
    ...starters.map((t) => ({ key: t.content, content: t.content, points: t.points, saved: false })),
  ].slice(0, Math.max(4, mineSaved.length));

  const forMe = tasks.filter((t) => t.user_id !== user?.id && taskState(t) !== 'confirmed');
  const asked = tasks.filter((t) => t.user_id === user?.id && taskState(t) !== 'confirmed');
  const finished = tasks.filter((t) => taskState(t) === 'confirmed');

  const row = (task: Task, kind: Kind) => (
      <TaskRow
        key={task.id}
        task={task}
        kind={kind}
        userId={user?.id}
        partnerName={partnerName}
        partnerGender={partner?.gender}
        myGender={profile?.gender}
        onComplete={() => complete(task)}
        onAcknowledge={() => acknowledge(task.id)}
        onEdit={(text, w) => edit(task.id, text, w)}
        onRemove={() => remove(task.id)}
      />
  );

  const composerOpen = focused || content.trim().length > 0;

  return (
    <Page>
      <ExchangeHeader current="/tasks" />

      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      {/* One field. Weight and suggestions unfold only once you start — nothing to read before then. */}
      <section data-tour="tasks-compose" className={`mb-7 rounded-2xl bg-surface shadow-card transition-shadow duration-500 ${composerOpen ? 'ring-2 ring-accent' : ''}`}>
        <form
          className="p-2"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="flex items-center gap-2">
            <Input
              aria-label={tr('О чём попросить', 'What to ask for')}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={tr('Попросить о…', 'Ask for…')}
              disabled={!partner}
              className="!bg-transparent focus:!shadow-none !border-transparent"
            />
            <Button type="submit" loading={busy} disabled={!content.trim() || !partner} aria-label={tr('Попросить', 'Ask')} className="!size-11 !rounded-full !px-0">
              <ArrowUp className="size-5" strokeWidth={2.4} aria-hidden />
            </Button>
          </div>

          <AutoHeight>
            {composerOpen ? (
              <div className="space-y-3 px-2 pt-2 pb-2" onMouseDown={(e) => e.target === e.currentTarget && e.preventDefault()}>
                <Segment legend={tr('Насколько это важно', 'How much it matters')} options={WEIGHTS} value={weight} onChange={setWeight} />
                <label className="flex min-h-11 cursor-pointer items-center gap-3 text-subhead text-ink-soft">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(event) => setRemember(event.target.checked)}
                    className="size-4.5 accent-[var(--c-accent)]"
                  />
                  {tr('В подборку', 'Save to favourites')}
                </label>
              </div>
            ) : (
              <ul className="flex flex-wrap gap-1.5 px-1.5 pt-1 pb-1.5">
                {suggestions.map((t) => (
                  <li key={t.key}>
                    <button
                      type="button"
                      disabled={!partner}
                      onClick={() => {
                        setContent(t.content);
                        setWeight(Math.min(3, t.points));
                      }}
                      className="flex h-8 items-center gap-1 rounded-full bg-sunken px-3 text-footnote text-ink-soft transition-colors hover:text-ink disabled:opacity-40"
                    >
                      {t.saved && <Star className="size-3 text-accent" aria-hidden />}
                      {t.content}
                      {t.saved && (
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label={tr(`Убрать «${t.content}» из подборки`, `Remove “${t.content}” from favourites`)}
                          onClick={(event) => {
                            event.stopPropagation();
                            removeTemplate(t.key);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              event.stopPropagation();
                              removeTemplate(t.key);
                            }
                          }}
                          className="-mr-1.5 ml-0.5 flex size-5 items-center justify-center rounded-full text-ink-faint hover:bg-line hover:text-ink"
                        >
                          <X className="size-3" aria-hidden />
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </AutoHeight>
        </form>
      </section>

      {isLoading ? (
        <Loading label={tr('Загружаем просьбы…', 'Loading requests…')} />
      ) : tasks.length === 0 ? null : (
        <div className="space-y-6">
          {forMe.length > 0 && (
            <Group title={tr('Вас попросили', 'Asked of you')} count={forMe.filter((t) => taskState(t) === 'awaiting').length || undefined}>
              <AnimatePresence initial={false}>{forMe.map((t) => row(t, 'for-me'))}</AnimatePresence>
            </Group>
          )}
          {asked.length > 0 && (
            <Group title={tr('Вы попросили', 'You asked')}>
              <AnimatePresence initial={false}>{asked.map((t) => row(t, 'mine'))}</AnimatePresence>
            </Group>
          )}
          {finished.length > 0 && (
            <section>
              <button
                type="button"
                onClick={() => setShowDone((v) => !v)}
                aria-expanded={showDone}
                className="tap flex items-center gap-1 px-1 text-subhead font-semibold text-ink-faint"
              >
                {tr('Выполнено', 'Done')} · {moreDone ? `${finished.length}+` : finished.length}
                <ChevronDown className={`size-4 transition-transform duration-300 ${showDone ? 'rotate-180' : ''}`} aria-hidden />
              </button>
              <AutoHeight>
                {showDone && (
                  <div className="mt-2 space-y-3">
                    <ul className="overflow-hidden rounded-2xl bg-surface shadow-card [&>li+li]:border-t [&>li+li]:border-line">
                      {finished.map((t) => row(t, 'done'))}
                    </ul>
                    {moreDone && (
                      <Button
                        variant="secondary"
                        block
                        loading={loadingMore}
                        onClick={async () => {
                          setLoadingMore(true);
                          await loadMoreDone();
                          setLoadingMore(false);
                        }}
                      >
                        {tr('Показать раньше', 'Show older')}
                      </Button>
                    )}
                  </div>
                )}
              </AutoHeight>
            </section>
          )}
        </div>
      )}
    </Page>
  );
}
