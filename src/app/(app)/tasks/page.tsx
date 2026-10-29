'use client';

import { useState } from 'react';
import { Check, Eye, Pencil, Plus, Star, X } from 'lucide-react';
import { points } from '@/lib/dates';
import { displayName, verb } from '@/lib/words';
import { STARTER_TEMPLATES, WEIGHTS, taskState, useTasks, type Task } from '@/hooks/useTasks';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Segment } from '@/components/ui/Controls';
import { Alert, Chip, EmptyState, Loading, Page, PageHeader } from '@/components/ui/Blocks';

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
      <li className="space-y-3 rounded-2xl border border-line bg-surface p-5 shadow-card">
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
    state === 'awaiting' ? (
      <Chip>Ждёт выполнения</Chip>
    ) : state === 'done_unseen' ? (
      <Chip tone="accent" Icon={Eye}>
        {asked ? 'Вы ещё не видели' : `${partnerName} ещё не ${verb(partnerGender, 'видел')}`}
      </Chip>
    ) : (
      <Chip Icon={Check}>Выполнено</Chip>
    );

  const seen = verb(myGender, 'увидел');

  return (
    <li className="rounded-2xl border border-line bg-surface p-5 shadow-card">
      <p className={`text-[15px] font-medium ${state === 'confirmed' ? 'text-ink-soft' : 'text-ink'}`}>{task.content}</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-faint">
          {asked ? 'вы попросили' : 'вас попросили'}, {points(task.points)}
        </p>
        {chip}
      </div>

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

  return (
    <Page>
      <PageHeader title="Задачи" sub="Спокойный способ сказать, что сегодня было бы кстати." />

      <section className="mb-8 rounded-2xl border border-line bg-surface p-5 shadow-card md:p-6">
        <h2 className="text-lg font-semibold">О чём попросить</h2>

        <form
          className="mt-4 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <Input
            aria-label="Просьба"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Например: заварить чай, пока я в душе"
            disabled={!partner}
          />

          <fieldset>
            <legend className="mb-2 text-sm font-medium">Насколько это важно</legend>
            <Segment legend="Насколько это важно" options={WEIGHTS} value={weight} onChange={setWeight} />
            <p className="mt-2 text-sm text-ink-faint">Вес просьбы — это баллы, которые партнёр получит за выполнение.</p>
          </fieldset>

          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
            <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="size-4.5 accent-[var(--c-accent)]" />
            Сохранить в подборку, чтобы не набирать снова
          </label>

          <Button type="submit" loading={busy} disabled={!content.trim() || !partner}>
            <Plus className="size-4" aria-hidden /> Попросить
          </Button>
          {!partner && <p className="text-sm text-ink-faint">Попросить можно, когда партнёр присоединится.</p>}
        </form>

        <div className="mt-6 border-t border-line pt-5">
          <h3 className="mb-3 text-sm font-medium text-ink-soft">Из подборки</h3>
          <div className="flex flex-wrap gap-2">
            {mineSaved.map((template) => (
              <span key={template.id} className="inline-flex items-center rounded-full border border-accent/30 bg-accent-soft">
                <button
                  type="button"
                  onClick={() => {
                    setContent(template.content);
                    setWeight(template.points);
                  }}
                  className="tap inline-flex items-center gap-1.5 rounded-l-full pr-1 pl-4 text-sm text-accent-soft-ink"
                >
                  <Star className="size-3.5" aria-hidden /> {template.content}
                </button>
                <button
                  type="button"
                  aria-label={`Убрать «${template.content}» из подборки`}
                  onClick={() => removeTemplate(template.id)}
                  className="tap flex items-center justify-center rounded-r-full pr-2 text-accent-soft-ink/70 hover:text-accent-soft-ink"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </span>
            ))}
            {starters.map((template) => (
              <button
                key={template.content}
                type="button"
                onClick={() => {
                  setContent(template.content);
                  setWeight(template.points);
                }}
                className="tap rounded-full border border-line px-4 text-sm text-ink-soft transition-colors hover:border-line-strong hover:text-ink"
              >
                {template.content}
              </button>
            ))}
          </div>
        </div>
      </section>

      {error && <div className="mb-4"><Alert>{error}</Alert></div>}

      {isLoading ? (
        <Loading label="Загружаем задачи…" />
      ) : tasks.length === 0 ? (
        <EmptyState title="Пока пусто">Просьба — это не список дел. Одна-две в день работают лучше десяти.</EmptyState>
      ) : (
        <div className="space-y-8">
          {(forMe.length > 0 || doneForMeUnseen.length > 0) && (
            <section>
              <h2 className="mb-3 font-semibold">Вас попросили</h2>
              <ul className="space-y-3">{[...forMe, ...doneForMeUnseen].map(card)}</ul>
            </section>
          )}
          {asked.length > 0 && (
            <section>
              <h2 className="mb-3 font-semibold">Вы попросили</h2>
              <ul className="space-y-3">{asked.map(card)}</ul>
            </section>
          )}
          {finished.length > 0 && (
            <section>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="font-semibold">Выполнено</h2>
                {finished.length > 5 && (
                  <Button variant="ghost" onClick={() => setShowDone(!showDone)}>
                    {showDone ? 'Свернуть' : `Показать все ${finished.length}`}
                  </Button>
                )}
              </div>
              <ul className="space-y-3">{(showDone ? finished : finished.slice(0, 5)).map(card)}</ul>
            </section>
          )}
        </div>
      )}
    </Page>
  );
}
