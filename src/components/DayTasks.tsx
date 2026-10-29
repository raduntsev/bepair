'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Eye, Plus } from 'lucide-react';
import { points, todayISO } from '@/lib/dates';
import { displayName, verb } from '@/lib/words';

const sentenceVerb = (g: 'm' | 'f' | null | undefined) => {
  const v = verb(g, 'увидел');
  return `${v.charAt(0).toUpperCase()}${v.slice(1)}, спасибо`;
};
import { taskState, type Task } from '@/hooks/useTasks';
import type { Partner } from '@/hooks/useSpaceAuth';
import { Button } from '@/components/ui/Button';

/*
  Two different kinds of action, on two sides of the day, as agreed:
  your side is a checklist you simply tick; the partner's side is what they
  did for you, which you notice on purpose — never a reflexive checkbox.
*/

export function MyTasks({
  tasks,
  userId,
  onComplete,
}: {
  tasks: Task[];
  userId: string;
  onComplete: (task: Task) => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const today = todayISO();
  const forMe = tasks.filter((t) => t.user_id !== userId);
  const open = forMe.filter((t) => taskState(t) === 'awaiting');
  const doneToday = forMe.filter((t) => t.is_completed && t.completed_by === userId && t.completed_at?.slice(0, 10) === today);

  return (
    <section className="rounded-2xl border border-line bg-surface shadow-card">
      <div className="flex items-baseline justify-between gap-3 px-5 pt-5 md:px-6">
        <h2 className="font-semibold">Вас попросили</h2>
        {open.length > 0 && <span className="text-sm text-ink-faint">осталось {open.length}</span>}
      </div>

      {open.length === 0 && doneToday.length === 0 ? (
        <p className="px-5 pt-1.5 pb-5 text-sm text-ink-soft md:px-6">Сейчас ни о чём. Можно просто побыть рядом.</p>
      ) : (
        <ul className="mt-2 pb-2">
          {open.map((task) => (
            <li key={task.id}>
              <button
                type="button"
                disabled={busy !== null}
                onClick={async () => {
                  setBusy(task.id);
                  await onComplete(task);
                  setBusy(null);
                }}
                className="flex min-h-14 w-full items-center gap-3.5 px-5 py-2.5 text-left transition-colors enabled:hover:bg-sunken md:px-6"
              >
                <span
                  aria-hidden
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                    busy === task.id ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong'
                  }`}
                >
                  {busy === task.id && <Check className="size-3.5" strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] text-ink">{task.content}</span>
                  <span className="block text-sm text-ink-faint">{points(task.points)}</span>
                </span>
                <span className="sr-only">Отметить «{task.content}» выполненной</span>
              </button>
            </li>
          ))}
          {doneToday.map((task) => (
            <li key={task.id} className="flex min-h-14 items-center gap-3.5 px-5 py-2.5 md:px-6">
              <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink">
                <Check className="size-3.5" strokeWidth={3} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] text-ink-soft line-through decoration-ink-faint">{task.content}</span>
                <span className="block text-sm text-ink-faint">
                  {taskState(task) === 'confirmed' ? 'партнёр увидел' : 'сделано сегодня'}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function DoneForMe({
  tasks,
  userId,
  partner,
  myGender,
  onAcknowledge,
}: {
  tasks: Task[];
  userId: string;
  partner: Partner | null;
  myGender: 'm' | 'f' | null | undefined;
  onAcknowledge: (id: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const unseen = tasks.filter((t) => t.user_id === userId && taskState(t) === 'done_unseen');
  const waiting = tasks.filter((t) => t.user_id === userId && taskState(t) === 'awaiting').length;
  const name = displayName(partner?.display_name);

  if (!partner) return null;

  return (
    <section className="rounded-2xl border border-line bg-surface shadow-card">
      <div className="px-5 pt-5 md:px-6">
        <h2 className="font-semibold">
          {name} {verb(partner.gender, 'сделал')} для вас
        </h2>
        {unseen.length === 0 && (
          <p className="mt-1.5 text-sm text-ink-soft">
            {waiting > 0
              ? `${waiting === 1 ? 'Одна просьба ждёт' : `Просьб в ожидании: ${waiting}`}. Когда будет сделано, она появится здесь.`
              : 'Пока ничего нового.'}
          </p>
        )}
      </div>

      {unseen.length > 0 && (
        <ul className="mt-2 divide-y divide-line">
          {unseen.map((task) => (
            <li key={task.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 md:px-6">
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] text-ink">{task.content}</span>
                <span className="block text-sm text-ink-faint">вы ещё не видели</span>
              </span>
              <Button
                loading={busy === task.id}
                onClick={async () => {
                  setBusy(task.id);
                  await onAcknowledge(task.id);
                  setBusy(null);
                }}
              >
                <Eye className="size-4" aria-hidden /> {sentenceVerb(myGender)}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="px-3 pt-1 pb-3 md:px-4">
        <Link
          href="/tasks"
          className="tap inline-flex items-center gap-2 rounded-lg px-2 text-sm font-medium text-accent hover:underline"
        >
          <Plus className="size-4" aria-hidden /> Попросить о чём-то
        </Link>
      </div>
    </section>
  );
}
