'use client';

import { useState } from 'react';
import { ArrowUp, Check, Eye, Plus } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { points, todayISO } from '@/lib/dates';
import { displayName, verb } from '@/lib/words';

const sentenceVerb = (g: 'm' | 'f' | null | undefined) => {
  const v = verb(g, 'увидел');
  return tr(`${v.charAt(0).toUpperCase()}${v.slice(1)}, спасибо`, 'Seen, thank you');
};
import { STARTER_TEMPLATES, WEIGHTS, taskState, type Task, type Template } from '@/hooks/useTasks';
import type { Partner } from '@/hooks/useSpaceAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Segment } from '@/components/ui/Controls';
import { AutoHeight } from '@/components/ui/AutoHeight';
import { tr } from '@/lib/i18n';

/*
  Two different kinds of action, on two sides of the day, as agreed:
  your side is a checklist you simply tick; the partner's side is what they
  did for you, which you notice on purpose — never a reflexive checkbox.
*/

/*
  «Дела на сегодня» on the day screen: what your partner asked of you, ticked
  right here; what you asked of them, with where it stands; and the way to ask
  for something new without leaving the day. The composer stays folded to one
  row until you want it.
*/
export function TodayTasks({
  tasks,
  templates,
  userId,
  partner,
  onComplete,
  onAdd,
}: {
  tasks: Task[];
  templates: Template[];
  userId: string;
  partner: Partner | null;
  onComplete: (task: Task) => Promise<void>;
  onAdd: (content: string, weight: number) => Promise<boolean>;
}) {
  const reduce = useReducedMotion();
  const [busy, setBusy] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [content, setContent] = useState('');
  const [weight, setWeight] = useState(2);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const today = todayISO();
  const name = displayName(partner?.display_name);

  const forMe = tasks.filter((t) => t.user_id !== userId);
  const open = forMe.filter((t) => taskState(t) === 'awaiting');
  const doneToday = forMe.filter((t) => t.is_completed && t.completed_by === userId && t.completed_at?.slice(0, 10) === today);
  /* Your own asks: still waiting, or done today and already thanked — the unthanked ones have their own card above. */
  const mine = tasks.filter(
    (t) =>
      t.user_id === userId &&
      (taskState(t) === 'awaiting' || (taskState(t) === 'confirmed' && t.completed_at?.slice(0, 10) === today)),
  );

  const saved = templates.filter((t) => t.user_id === userId).map((t) => ({ content: t.content, points: t.points }));
  const suggestions = [...saved, ...STARTER_TEMPLATES.filter((s) => !saved.some((t) => t.content === s.content))].slice(0, 4);

  const rowMotion = reduce
    ? {}
    : {
        layout: true as const,
        initial: { opacity: 0, y: 6 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -4 },
        transition: { duration: 0.28, ease: [0.32, 0.72, 0, 1] as const },
      };

  const send = async () => {
    const text = content.trim();
    if (!text) return;
    setSending(true);
    const ok = await onAdd(text, weight);
    setSending(false);
    if (ok) {
      setContent('');
      setWeight(2);
      setComposing(false);
      setSent(true);
      window.setTimeout(() => setSent(false), 2400);
    }
  };

  return (
    <section data-tour="day-tasks" className="overflow-hidden rounded-2xl bg-surface shadow-card">
      <div className="flex items-baseline justify-between gap-3 px-4 pt-4 pb-1">
        <h3 className="text-headline font-semibold">{tr('Дела на сегодня', 'Today’s to-dos')}</h3>
        {open.length > 0 && <span className="text-footnote text-ink-faint">{tr(`осталось ${open.length}`, `${open.length} left`)}</span>}
      </div>

      <p className="px-4 pt-2 text-footnote font-medium text-ink-faint">{tr(`${name} просит`, `${name} asks`)}</p>
      {open.length === 0 && doneToday.length === 0 ? (
        <p className="px-4 pt-1 pb-3 text-subhead text-ink-faint">{tr('Пока ни о чём — день свободен.', 'Nothing yet — the day is yours.')}</p>
      ) : (
        <ul className="pb-1">
          <AnimatePresence initial={false}>
            {open.map((task) => (
              <motion.li key={task.id} {...rowMotion}>
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
                  <span className="sr-only">{tr(`Отметить «${task.content}» выполненной`, `Mark “${task.content}” as done`)}</span>
                </button>
              </motion.li>
            ))}
            {doneToday.map((task) => (
              <motion.li key={task.id} {...rowMotion} className="flex min-h-13 items-center gap-3.5 px-4 py-2">
                <span aria-hidden className="flex size-[1.625rem] shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink">
                  <Check className="size-3.5" strokeWidth={3} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-body text-ink-faint line-through decoration-ink-faint">{task.content}</span>
                  <span className="block text-footnote text-ink-faint">
                    {taskState(task) === 'confirmed' ? tr('партнёр увидел', 'partner saw it') : tr('сделано сегодня', 'done today')}
                  </span>
                </span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      {mine.length > 0 && (
        <>
          <p className="border-t border-line px-4 pt-3 text-footnote font-medium text-ink-faint">{tr('Вы попросили', 'You asked')}</p>
          <ul className="pb-1">
            <AnimatePresence initial={false}>
              {mine.map((task) => {
                const done = task.is_completed;
                return (
                  <motion.li key={task.id} {...rowMotion} className="flex min-h-11 items-center gap-3.5 px-4 py-1.5">
                    <span
                      aria-hidden
                      className={`flex size-[1.625rem] shrink-0 items-center justify-center rounded-full ${
                        done ? 'bg-partner text-white' : 'border-2 border-dashed border-line-strong'
                      }`}
                    >
                      {done && <Check className="size-3.5" strokeWidth={3} />}
                    </span>
                    <span className={`min-w-0 flex-1 text-body ${done ? 'text-ink-faint line-through decoration-ink-faint' : 'text-ink-soft'}`}>
                      {task.content}
                    </span>
                    <span className="shrink-0 text-footnote text-ink-faint">{done ? tr('сделано', 'done') : tr('ждёт', 'waiting')}</span>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        </>
      )}

      <div className="border-t border-line">
        <AutoHeight>
          {composing ? (
            <form
              className="space-y-3 p-3"
              onSubmit={(event) => {
                event.preventDefault();
                send();
              }}
            >
              <Input
                aria-label={tr('О чём попросить', 'What to ask for')}
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder={tr('Что сделать сегодня?', 'What needs doing today?')}
                autoFocus
              />
              {!content.trim() && suggestions.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {suggestions.map((s) => (
                    <li key={s.content}>
                      <button
                        type="button"
                        onClick={() => {
                          setContent(s.content);
                          setWeight(Math.min(3, s.points));
                        }}
                        className="flex h-9 items-center rounded-full bg-sunken px-3.5 text-subhead text-ink-soft transition-colors hover:text-ink"
                      >
                        {s.content}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <Segment legend={tr('Насколько это важно', 'How much it matters')} options={WEIGHTS} value={weight} onChange={setWeight} />
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setComposing(false);
                    setContent('');
                  }}
                >
                  {tr('Отмена', 'Cancel')}
                </Button>
                <Button type="submit" className="min-w-0 flex-1" loading={sending} disabled={!content.trim()}>
                  <ArrowUp className="size-4.5" strokeWidth={2.4} aria-hidden /> {tr('Попросить', 'Ask')}
                </Button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              disabled={!partner}
              onClick={() => {
                setComposing(true);
                setSent(false);
              }}
              className="flex min-h-13 w-full items-center gap-3.5 px-4 py-2 text-left text-accent transition-colors enabled:hover:bg-sunken disabled:opacity-40"
            >
              <span aria-hidden className="flex size-[1.625rem] shrink-0 items-center justify-center rounded-full bg-accent-soft">
                {sent ? <Check className="size-3.5" strokeWidth={3} /> : <Plus className="size-4" strokeWidth={2.6} />}
              </span>
              <span className="text-body font-medium" role="status" aria-live="polite">
                {sent ? tr(`${name} получит уведомление`, `${name} will be notified`) : tr('Предложить дело на сегодня', 'Suggest a to-do for today')}
              </span>
            </button>
          )}
        </AutoHeight>
      </div>
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
        {tr(`${name} ${verb(partner.gender, 'сделал')} для вас`, `${name} did this for you`)}
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
