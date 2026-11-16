'use client';

import { useState } from 'react';
import { ArrowUp, Check, Eye, Pencil, Star, X } from 'lucide-react';
import { points } from '@/lib/dates';
import { displayName, verb } from '@/lib/words';
import { STARTER_TEMPLATES, WEIGHTS, taskState, useTasks, type Task } from '@/hooks/useTasks';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Segment } from '@/components/ui/Controls';
import { Alert, Chip, Loading, Page, SectionHeader } from '@/components/ui/Blocks';
import { AutoHeight } from '@/components/ui/AutoHeight';
import { ExchangeHeader } from '@/components/ExchangeHeader';

function TaskCard({
  task,
  asked,
  partnerName,
  partnerGender,
  myGender,
  onComplete,
  onAcknowledge,
  onEdit,
  onRemove,
}: {
  task: Task;
  asked: boolean;
  partnerName: string;
  partnerGender: 'm' | 'f' | null | undefined;
  myGender: 'm' | 'f' | null | undefined;
  onComplete: () => Promise<void>;
  onAcknowledge: () => Promise<void>;
  onEdit: (content: string, weight: number) => Promise<boolean>;
  onRemove: () => Promise<void>;
}) {
  const state = taskState(task);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.content);
  const [weight, setWeight] = useState(task.points);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    await action();
    setBusy(false);
  };

  if (editing) {
    return (
      <li className="space-y-3 rounded-2xl bg-surface p-5 shadow-card">
        <Input aria-label="Текст просьбы" value={draft} onChange={(event) => setDraft(event.target.value)} autoFocus />
        <Segment legend="Насколько это важно" options={WEIGHTS} value={weight} onChange={setWeight} />
        <div className="flex gap-2">
          <Button
            loading={busy}
            disabled={!draft.trim()}
            onClick={() =>
              run(async () => {
                if (await onEdit(draft.trim(), weight)) setEditing(false);
              })
            }
          >
            Сохранить
          </Button>
          <Button variant="ghost" onClick={() => setEditing(false)}>
            <X className="size-4" aria-hidden /> Отмена
          </Button>
        </div>
      </li>
    );
  }

  /*
    The middle state is «not noticed yet», never «under review». From the
    asker's side it is them who has not seen it; from the doer's, the partner.
  */
  const chip =
    state === 'awaiting' ? null : state === 'done_unseen' ? (
      <Chip tone="accent" Icon={Eye}>
        {asked ? 'Вы ещё не видели' : `${partnerName} ещё не ${verb(partnerGender, 'видел')}`}
      </Chip>
    ) : (
      <Chip Icon={Check}>Выполнено</Chip>
    );

  const seen = verb(myGender, 'увидел');

  return (
    <li className="rounded-2xl bg-surface p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <p className={`text-body font-medium ${state === 'confirmed' ? 'text-ink-faint' : 'text-ink'}`}>{task.content}</p>
        {chip}
      </div>
      <p className="mt-1 text-footnote text-ink-faint">{points(task.points)}</p>

      {state !== 'confirmed' && (
        <div className="mt-4 flex flex-wrap gap-2 empty:hidden">
          {state === 'awaiting' && !asked && (
            <Button loading={busy} onClick={() => run(onComplete)}>
              <Check className="size-4" aria-hidden /> Сделано
            </Button>
          )}
          {state === 'done_unseen' && asked && (
            <Button loading={busy} onClick={() => run(onAcknowledge)}>
              <Eye className="size-4" aria-hidden /> {seen.charAt(0).toUpperCase() + seen.slice(1)}, спасибо
            </Button>
          )}
          {asked && state === 'awaiting' && (
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setDraft(task.content);
                  setWeight(task.points);
                  setEditing(true);
                }}
              >
                <Pencil className="size-4" aria-hidden /> Изменить
              </Button>
              <Button variant="ghost" loading={busy} onClick={() => run(onRemove)}>
                Убрать
              </Button>
            </>
          )}
        </div>
      )}
    </li>
  );
}

export default function TasksPage() {
  const { user, partner, profile } = useSpaceAuth();
  const { tasks, templates, isLoading, error, add, edit, complete, acknowledge, remove, saveTemplate, removeTemplate } = useTasks();

  const [content, setContent] = useState('');
  const [weight, setWeight] = useState(2);
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showDone, setShowDone] = useState(false);
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

  const forMe = tasks.filter((t) => t.user_id !== user?.id && taskState(t) === 'awaiting');
  const asked = tasks.filter((t) => t.user_id === user?.id && taskState(t) !== 'confirmed');
  const doneForMeUnseen = tasks.filter((t) => t.user_id !== user?.id && taskState(t) === 'done_unseen');
  const finished = tasks.filter((t) => taskState(t) === 'confirmed');

  const card = (task: Task) => (
    <TaskCard
      key={task.id}
      task={task}
      asked={task.user_id === user?.id}
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
  const incoming = [...forMe, ...doneForMeUnseen];

  return (
    <Page>
      <ExchangeHeader current="/tasks" />

      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      {/* One field. Weight and templates unfold only once you start — nothing to read before then. */}
      <section className={`mb-7 rounded-2xl bg-surface shadow-card transition-shadow duration-500 ${composerOpen ? 'ring-2 ring-accent' : ''}`}>
        <form
          className="p-2"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="flex items-center gap-2">
            <Input
              aria-label="О чём попросить"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="Попросить о…"
              disabled={!partner}
              className="!bg-transparent focus:!shadow-none !border-transparent"
            />
            <Button type="submit" loading={busy} disabled={!content.trim() || !partner} aria-label="Попросить" className="!size-11 !rounded-full !px-0">
              <ArrowUp className="size-5" strokeWidth={2.4} aria-hidden />
            </Button>
          </div>

          <AutoHeight>
            {composerOpen ? (
              <div className="space-y-3 px-2 pt-2 pb-2" onMouseDown={(e) => e.target === e.currentTarget && e.preventDefault()}>
                <Segment legend="Насколько это важно" options={WEIGHTS} value={weight} onChange={setWeight} />
                <label className="flex min-h-11 cursor-pointer items-center gap-3 text-subhead text-ink-soft">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(event) => setRemember(event.target.checked)}
                    className="size-4.5 accent-[var(--c-accent)]"
                  />
                  <Star className="size-4" aria-hidden /> В подборку
                </label>
              </div>
            ) : (
              <ul className="-mx-2 flex gap-2 overflow-x-auto px-4 pt-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {[...mineSaved.map((t) => ({ key: t.id, content: t.content, points: t.points, saved: true })), ...starters.map((t) => ({ key: t.content, content: t.content, points: t.points, saved: false }))].map((t) => (
                  <li key={t.key} className="shrink-0">
                    <button
                      type="button"
                      disabled={!partner}
                      onClick={() => {
                        setContent(t.content);
                        setWeight(Math.min(3, t.points));
                      }}
                      className="flex h-9 items-center gap-1.5 rounded-full bg-sunken px-3.5 text-subhead text-ink-soft transition-colors hover:text-ink disabled:opacity-40"
                    >
                      {t.saved && <Star className="size-3.5 text-accent" aria-hidden />}
                      {t.content}
                      {t.saved && (
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label={`Убрать «${t.content}» из подборки`}
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
                          className="-mr-1.5 ml-0.5 flex size-6 items-center justify-center rounded-full text-ink-faint hover:bg-line hover:text-ink"
                        >
                          <X className="size-3.5" aria-hidden />
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
        <Loading label="Загружаем просьбы…" />
      ) : tasks.length === 0 ? null : (
        <div className="space-y-7">
          {incoming.length > 0 && (
            <section>
              <SectionHeader title="Вас попросили" />
              <ul className="space-y-3">{incoming.map(card)}</ul>
            </section>
          )}
          {asked.length > 0 && (
            <section>
              <SectionHeader title="Вы попросили" />
              <ul className="space-y-3">{asked.map(card)}</ul>
            </section>
          )}
          {finished.length > 0 && (
            <section>
              <SectionHeader
                title="Выполнено"
                action={
                  finished.length > 5 && (
                    <Button variant="ghost" className="!h-9 !px-3" onClick={() => setShowDone(!showDone)}>
                      {showDone ? 'Свернуть' : `Все ${finished.length}`}
                    </Button>
                  )
                }
              />
              <ul className="space-y-3">{(showDone ? finished : finished.slice(0, 5)).map(card)}</ul>
            </section>
          )}
        </div>
      )}
    </Page>
  );
}
