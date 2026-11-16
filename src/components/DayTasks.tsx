'use client';

import { useState } from 'react';
import { Check, Eye } from 'lucide-react';
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

  /* Nothing asked: say nothing. The «Попросить» row below already covers the empty case. */
  if (open.length === 0 && doneToday.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-2xl bg-surface shadow-card">
      <div className="flex items-baseline justify-between gap-3 px-4 pt-4 pb-1">
        <h3 className="text-headline font-semibold">Вас попросили</h3>
        {open.length > 0 && <span className="text-footnote text-ink-faint">осталось {open.length}</span>}
      </div>

      <ul className="pb-1.5">
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
              className="flex min-h-13 w-full items-center gap-3.5 px-4 py-2 text-left transition-colors enabled:hover:bg-sunken"
            >
              <span
                aria-hidden
                className={`flex size-[1.625rem] shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                  busy === task.id ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong'
                }`}
              >
                {busy === task.id && <Check className="size-3.5" strokeWidth={3} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-body text-ink">{task.content}</span>
                <span className="block text-footnote text-ink-faint">{points(task.points)}</span>
              </span>
              <span className="sr-only">Отметить «{task.content}» выполненной</span>
            </button>
          </li>
        ))}
        {doneToday.map((task) => (
          <li key={task.id} className="flex min-h-13 items-center gap-3.5 px-4 py-2">
            <span aria-hidden className="flex size-[1.625rem] shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink">
              <Check className="size-3.5" strokeWidth={3} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-body text-ink-faint line-through decoration-ink-faint">{task.content}</span>
              <span className="block text-footnote text-ink-faint">
                {taskState(task) === 'confirmed' ? 'партнёр увидел' : 'сделано сегодня'}
              </span>
            </span>
          </li>
        ))}
      </ul>
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
  const name = displayName(partner?.display_name);

  /* Appears only when there is something to notice — never as an empty box. */
  if (!partner || unseen.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-2xl bg-surface shadow-card">
      <h3 className="px-4 pt-4 pb-1 text-headline font-semibold">
        {name} {verb(partner.gender, 'сделал')} для вас
      </h3>
      <ul>
        {unseen.map((task) => (
          <li key={task.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="min-w-0 flex-1">
              <span className="block text-body text-ink">{task.content}</span>
            </span>
            <Button
              className="!h-9 !rounded-full"
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
    </section>
  );
}
