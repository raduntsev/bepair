'use client';

import { useState } from 'react';
import { Check, Eye, Loader2, ListChecks, Pencil, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { taskState, useTasks, type Task } from '@/hooks/useTasks';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';

const TEMPLATES = [
  { content: 'Приготовить ужин', points: 3 },
  { content: 'Разобрать посуду', points: 2 },
  { content: 'Просто побыть рядом вечером', points: 4 },
  { content: 'Забрать заказ', points: 2 },
  { content: 'Позвонить, когда будет минутка', points: 1 },
  { content: 'Погулять вместе', points: 4 },
];

const WEIGHTS = [
  { value: 1, label: 'мелочь' },
  { value: 2, label: 'обычная' },
  { value: 3, label: 'важная' },
  { value: 5, label: 'очень важная' },
];

function StateChip({ task, partnerName }: { task: Task; partnerName: string }) {
  const state = taskState(task);

  if (state === 'awaiting') {
    return (
      <span className="rounded-full bg-sunken px-2.5 py-1 text-xs font-medium text-ink-soft">
        Ждёт выполнения
      </span>
    );
  }
  if (state === 'done_unseen') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent-soft-ink">
        <Eye className="size-3.5" aria-hidden /> {partnerName} ещё не видел
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-sunken px-2.5 py-1 text-xs font-medium text-ink-soft">
      <Check className="size-3.5" aria-hidden /> Выполнено
    </span>
  );
}

export default function TasksPage() {
  const { user } = useSpaceAuth();
  const { tasks, isLoading, error, add, edit, complete, acknowledge, remove } = useTasks();

  const [content, setContent] = useState('');
  const [points, setPoints] = useState(2);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftContent, setDraftContent] = useState('');
  const [draftPoints, setDraftPoints] = useState(2);

  const submit = async () => {
    if (!content.trim()) return;
    setBusy(true);
    const ok = await add(content.trim(), points);
    setBusy(false);
    if (ok) {
      setContent('');
      setPoints(2);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-7 md:px-8 md:py-10">
      <header className="mb-7">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Задачи</h1>
        <p className="mt-1 text-sm text-ink-faint">
          Спокойный способ сказать, что сегодня было бы кстати.
        </p>
      </header>

      <section className="mb-6 rounded-2xl border border-line bg-surface p-6 shadow-card">
        <h2 className="font-semibold">О чём попросить</h2>

        <div className="mt-4 space-y-4">
          <input
            aria-label="Просьба"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submit();
            }}
            placeholder="Например: заварить чай, пока я в душе"
            className="h-11 w-full rounded-lg border border-line bg-sunken px-3.5 text-base outline-none transition-colors placeholder:text-ink-faint focus:border-accent focus:bg-surface"
          />

          <fieldset>
            <legend className="mb-2 text-sm font-medium">Насколько это важно</legend>
            <div className="flex flex-wrap gap-2">
              {WEIGHTS.map((weight) => (
                <button
                  key={weight.value}
                  type="button"
                  onClick={() => setPoints(weight.value)}
                  aria-pressed={points === weight.value}
                  className={`tap rounded-lg border px-4 text-sm font-medium transition-colors ${
                    points === weight.value
                      ? 'border-accent bg-accent-soft text-accent-soft-ink'
                      : 'border-line text-ink-soft hover:border-line-strong hover:text-ink'
                  }`}
                >
                  {weight.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-sm text-ink-faint">
              Вес просьбы — это баллы, которые партнёр получит за выполнение.
            </p>
          </fieldset>

          <Button loading={busy} disabled={!content.trim()} onClick={submit}>
            <Plus className="size-4" aria-hidden /> Добавить
          </Button>
        </div>

        <div className="mt-6 border-t border-line pt-5">
          <h3 className="mb-3 text-sm font-medium text-ink-soft">Из подборки</h3>
          <div className="flex flex-wrap gap-2">
            {TEMPLATES.map((template) => (
              <button
                key={template.content}
                type="button"
                onClick={() => {
                  setContent(template.content);
                  setPoints(template.points);
                }}
                className="tap rounded-full border border-line px-4 py-2 text-sm text-ink-soft transition-colors hover:border-line-strong hover:text-ink"
              >
                {template.content}
              </button>
            ))}
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="flex items-center gap-2 py-16 text-ink-faint">
          <Loader2 className="size-5 animate-spin" aria-hidden />
          <span className="text-sm">Загружаем задачи…</span>
        </div>
      ) : tasks.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-line-strong bg-surface p-8 text-center">
          <ListChecks className="mx-auto size-7 text-ink-faint" aria-hidden />
          <h2 className="mt-3 font-semibold">Пока пусто</h2>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-soft">
            Просьба — это не список дел. Одна-две в день работают лучше десяти.
          </p>
        </section>
      ) : (
        <ul className="space-y-3">
          {tasks.map((task) => {
            const asked = task.user_id === user?.id;
            const state = taskState(task);
            const editing = editingId === task.id;

            return (
              <li key={task.id} className="rounded-2xl border border-line bg-surface p-5 shadow-card">
                {editing ? (
                  <div className="space-y-3">
                    <input
                      aria-label="Текст просьбы"
                      value={draftContent}
                      onChange={(event) => setDraftContent(event.target.value)}
                      className="h-11 w-full rounded-lg border border-line bg-sunken px-3.5 text-base outline-none focus:border-accent focus:bg-surface"
                    />
                    <div className="flex flex-wrap gap-2">
                      {WEIGHTS.map((weight) => (
                        <button
                          key={weight.value}
                          type="button"
                          onClick={() => setDraftPoints(weight.value)}
                          aria-pressed={draftPoints === weight.value}
                          className={`tap rounded-lg border px-4 text-sm font-medium transition-colors ${
                            draftPoints === weight.value
                              ? 'border-accent bg-accent-soft text-accent-soft-ink'
                              : 'border-line text-ink-soft hover:border-line-strong'
                          }`}
                        >
                          {weight.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={async () => {
                          await edit(task.id, draftContent.trim(), draftPoints);
                          setEditingId(null);
                        }}
                        disabled={!draftContent.trim()}
                      >
                        Сохранить
                      </Button>
                      <Button variant="ghost" onClick={() => setEditingId(null)}>
                        <X className="size-4" aria-hidden /> Отмена
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className={`font-medium ${state === 'confirmed' ? 'text-ink-soft' : ''}`}>
                          {task.content}
                        </p>
                        <p className="mt-1 text-sm text-ink-faint">
                          {asked ? 'вы попросили' : 'вас попросили'} · {task.points}{' '}
                          {task.points === 1 ? 'балл' : task.points < 5 ? 'балла' : 'баллов'}
                        </p>
                      </div>
                      <StateChip task={task} partnerName={asked ? 'Партнёр' : 'Вы'} />
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {state === 'awaiting' && !asked && (
                        <Button onClick={() => complete(task)}>
                          <Check className="size-4" aria-hidden /> Сделано
                        </Button>
                      )}
                      {state === 'done_unseen' && asked && (
                        <Button onClick={() => acknowledge(task.id)}>
                          <Eye className="size-4" aria-hidden /> Увидел, спасибо
                        </Button>
                      )}
                      {asked && state === 'awaiting' && (
                        <>
                          <Button
                            variant="secondary"
                            onClick={() => {
                              setEditingId(task.id);
                              setDraftContent(task.content);
                              setDraftPoints(task.points);
                            }}
                          >
                            <Pencil className="size-4" aria-hidden /> Изменить
                          </Button>
                          <Button variant="ghost" onClick={() => remove(task.id)}>
                            Убрать
                          </Button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}
    </div>
  );
}
