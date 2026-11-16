'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown, ArrowUp, Check, ChevronDown, Plus, Trash2 } from 'lucide-react';
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from 'recharts';
import { displayName } from '@/lib/words';
import { fmt } from '@/lib/dates';
import { QUESTIONS, SPHERES, type QuestionKey, type Scores } from '@/lib/planerka';
import { type PlanTodo, type TodoStatus, usePlanerka } from '@/hooks/usePlanerka';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { Segment } from '@/components/ui/Controls';
import { Alert, Loading } from '@/components/ui/Blocks';

const EASE = [0.32, 0.72, 0, 1] as const;

/*
  Text that saves itself. Shows the server value until you start typing; while
  you type it is yours; a moment after you stop it is saved and becomes the
  server value again. A field you are not editing follows the other phone live.
*/
function useAutosave<T>(server: T, save: (value: T) => Promise<void>, delay = 700) {
  const [local, setLocal] = useState(server);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Compared by content: a fresh `{}` from the server on every render is not a change. */
  const [seen, setSeen] = useState(server);
  if (!dirty && JSON.stringify(seen) !== JSON.stringify(server)) {
    setSeen(server);
    setLocal(server);
  }

  const change = (value: T) => {
    setLocal(value);
    setDirty(true);
    setSaved(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      await save(value);
      setDirty(false);
      setSaved(true);
    }, delay);
  };

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return { value: local, change, saving: dirty, saved };
}

function SaveMark({ saving, saved }: { saving: boolean; saved: boolean }) {
  return (
    <span aria-live="polite" className="text-footnote text-ink-faint">
      {saving ? 'сохраняем…' : saved ? <Check className="inline size-4 text-accent" aria-label="Сохранено" /> : null}
    </span>
  );
}

function AutoTextarea({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder?: string; label: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={3}
      className="w-full resize-none rounded-xl border border-transparent bg-sunken p-3.5 text-body text-ink outline-none transition-[border-color,background-color,box-shadow] placeholder:text-ink-faint focus:border-accent focus:bg-surface focus:shadow-[0_0_0_3px_var(--c-accent-soft)]"
    />
  );
}

/* ——— Колесо ——— */

function WheelStep({
  planerkaId,
  personId,
  scores,
  note,
  previous,
  onSave,
}: {
  planerkaId: string;
  personId: string;
  scores: Scores;
  note: string;
  previous: Scores | null;
  onSave: (scores: Scores, note: string) => Promise<void>;
}) {
  /* Scores and the note save as one row, so each save carries the latest of the other. */
  const noteRef = useRef(note);
  const scoresRef = useRef(scores);
  const wheel = useAutosave<Scores>(scores, (next) => onSave(next, noteRef.current), 500);
  const text = useAutosave<string>(note, (next) => onSave(scoresRef.current, next));
  useEffect(() => {
    noteRef.current = text.value;
    scoresRef.current = wheel.value;
  });

  const data = SPHERES.map((s) => ({ sphere: s.short, now: wheel.value[s.key] ?? 0, before: previous?.[s.key] ?? 0 }));

  return (
    <div key={`${planerkaId}:${personId}`} className="space-y-3">
      <section className="rounded-2xl bg-surface p-4 shadow-card">
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={data} outerRadius="72%">
              <PolarGrid stroke="var(--c-border)" />
              <PolarAngleAxis dataKey="sphere" tick={{ fill: 'var(--c-ink-faint)', fontSize: 13 }} />
              <PolarRadiusAxis domain={[0, 10]} tick={false} axisLine={false} />
              {previous && <Radar dataKey="before" stroke="var(--c-ink-faint)" strokeDasharray="4 4" fill="transparent" isAnimationActive={false} />}
              <Radar dataKey="now" stroke="var(--c-accent)" fill="var(--c-accent)" fillOpacity={0.18} animationDuration={500} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-2xl bg-surface shadow-card">
        <ul>
          {SPHERES.map((s, i) => {
            const v = wheel.value[s.key];
            const before = previous?.[s.key];
            const delta = typeof v === 'number' && typeof before === 'number' ? v - before : null;
            return (
              <li key={s.key} className={`px-4 py-3 ${i > 0 ? 'border-t border-line' : ''}`}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-body">{s.label}</span>
                  <span className="flex items-baseline gap-2">
                    {delta !== null && delta !== 0 && (
                      <span className={`flex items-center text-footnote ${delta > 0 ? 'text-accent' : 'text-ink-faint'}`}>
                        {delta > 0 ? <ArrowUp className="size-3.5" aria-hidden /> : <ArrowDown className="size-3.5" aria-hidden />}
                        {Math.abs(delta)}
                      </span>
                    )}
                    <span className="w-6 text-right text-headline font-semibold tabular-nums">{v ?? '–'}</span>
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  value={v ?? 5}
                  aria-label={s.label}
                  onChange={(e) => wheel.change({ ...wheel.value, [s.key]: Number(e.target.value) })}
                  className={`mt-2 w-full accent-[var(--c-accent)] ${v === undefined ? 'opacity-40' : ''}`}
                />
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-2xl bg-surface p-4 shadow-card">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-headline font-semibold">Что было на неделе</h3>
          <SaveMark saving={wheel.saving || text.saving} saved={wheel.saved || text.saved} />
        </div>
        <AutoTextarea label="Заметка к колесу" value={text.value} onChange={text.change} placeholder="События, настроение, что повлияло" />
      </section>
    </div>
  );
}

/* ——— Вопросы ——— */

function QuestionCard({
  question,
  label,
  value,
  previous,
  onSave,
}: {
  question: QuestionKey;
  label: string;
  value: string;
  previous: { date: string; text: string } | null;
  onSave: (text: string) => Promise<void>;
}) {
  const field = useAutosave(value, onSave);
  const [showPrev, setShowPrev] = useState(false);
  return (
    <section className="rounded-2xl bg-surface p-4 shadow-card">
      <div className="mb-2 flex items-start justify-between gap-3">
        <h3 className="text-headline font-semibold">{label}</h3>
        <SaveMark saving={field.saving} saved={field.saved} />
      </div>
      <AutoTextarea label={label} value={field.value} onChange={field.change} />
      {previous && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowPrev((v) => !v)}
            aria-expanded={showPrev}
            className="tap -ml-1 inline-flex items-center gap-1 rounded-lg px-1 text-subhead font-medium text-accent"
          >
            {fmt(previous.date, 'd MMMM')}
            <ChevronDown className={`size-4 transition-transform duration-300 ${showPrev ? 'rotate-180' : ''}`} aria-hidden />
          </button>
          <AnimatePresence initial={false}>
            {showPrev && (
              <motion.p
                key={question}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.4, ease: EASE }}
                className="overflow-hidden text-subhead whitespace-pre-wrap text-ink-soft"
              >
                {previous.text}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}

/* ——— Дела ——— */

const STATUS_NEXT: Record<TodoStatus, TodoStatus> = { todo: 'in_process', in_process: 'done', done: 'todo' };

function StatusDot({ status, onClick, label }: { status: TodoStatus; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label}: ${status === 'done' ? 'сделано' : status === 'in_process' ? 'в процессе' : 'не начато'}`}
      className="tap -m-2 flex shrink-0 items-center justify-center"
    >
      <span
        className={`flex size-[1.625rem] items-center justify-center rounded-full border-2 transition-colors duration-300 ${
          status === 'done' ? 'border-accent bg-accent text-accent-ink' : status === 'in_process' ? 'border-accent' : 'border-line-strong'
        }`}
      >
        {status === 'done' && <Check className="size-3.5" strokeWidth={3} />}
        {status === 'in_process' && <span className="size-2.5 rounded-full bg-accent" />}
      </span>
    </button>
  );
}

function TodoRow({ todo, onUpdate, onRemove }: { todo: PlanTodo; onUpdate: (patch: Partial<PlanTodo>) => Promise<void>; onRemove: () => void }) {
  const [open, setOpen] = useState(false);
  const decision = useAutosave(todo.decision, (d) => onUpdate({ decision: d }));
  return (
    <li className="px-4 py-2.5">
      <div className="flex items-start gap-3.5">
        <StatusDot status={todo.status} label={todo.content} onClick={() => onUpdate({ status: STATUS_NEXT[todo.status] })} />
        <button type="button" onClick={() => setOpen((v) => !v)} className="min-w-0 flex-1 pt-0.5 text-left">
          <span className={`block text-body whitespace-pre-wrap ${todo.status === 'done' ? 'text-ink-faint line-through decoration-ink-faint' : 'text-ink'}`}>
            {todo.content}
          </span>
          {todo.decision && !open && <span className="mt-0.5 block text-footnote text-ink-faint">{todo.decision}</span>}
        </button>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="flex items-start gap-2 pt-2 pl-10">
              <div className="min-w-0 flex-1">
                <AutoTextarea label="Решение" value={decision.value} onChange={decision.change} placeholder="Решение" />
              </div>
              <button
                type="button"
                onClick={onRemove}
                aria-label="Удалить дело"
                className="flex size-10 shrink-0 items-center justify-center rounded-full text-ink-faint hover:bg-sunken hover:text-danger"
              >
                <Trash2 className="size-4.5" aria-hidden />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

export function TodosBoard({ planerkaId }: { planerkaId: string | null }) {
  const { user, partner } = useSpaceAuth();
  const { todos, addTodo, updateTodo, removeTodo } = usePlanerka();
  const [text, setText] = useState('');
  const [owner, setOwner] = useState<'me' | 'partner' | 'both'>('both');
  const [showDone, setShowDone] = useState(false);
  const partnerName = displayName(partner?.display_name);

  const ownerId = (o: typeof owner) => (o === 'me' ? (user?.id ?? null) : o === 'partner' ? (partner?.id ?? null) : null);
  const groups = [
    { key: 'both', title: 'Общие', id: null as string | null },
    { key: 'me', title: 'Мои', id: user?.id ?? null },
    { key: 'partner', title: partnerName, id: partner?.id ?? null },
  ];
  const open = todos.filter((t) => t.status !== 'done');
  const done = todos.filter((t) => t.status === 'done');

  return (
    <div className="space-y-4">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!text.trim()) return;
          await addTodo(text, ownerId(owner), planerkaId);
          setText('');
        }}
        className="space-y-2 rounded-2xl bg-surface p-2 shadow-card"
      >
        <div className="flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Новое дело"
            aria-label="Новое дело"
            className="h-11 min-w-0 flex-1 bg-transparent px-2.5 text-body text-ink outline-none placeholder:text-ink-faint"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            aria-label="Добавить"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink transition-opacity disabled:opacity-30"
          >
            <Plus className="size-5" aria-hidden />
          </button>
        </div>
        <Segment
          legend="Чьё дело"
          options={[
            { value: 'both' as const, label: 'Общее' },
            { value: 'me' as const, label: 'Моё' },
            { value: 'partner' as const, label: partnerName },
          ]}
          value={owner}
          onChange={setOwner}
        />
      </form>

      {groups.map((g) => {
        const items = open.filter((t) => t.owner_id === g.id);
        if (items.length === 0) return null;
        return (
          <section key={g.key}>
            <h3 className="mb-2 px-1 text-subhead font-semibold text-ink-faint">{g.title}</h3>
            <ul className="overflow-hidden rounded-2xl bg-surface shadow-card [&>li+li]:border-t [&>li+li]:border-line">
              {items.map((t) => (
                <TodoRow key={t.id} todo={t} onUpdate={(patch) => updateTodo(t.id, patch)} onRemove={() => removeTodo(t.id)} />
              ))}
            </ul>
          </section>
        );
      })}

      {done.length > 0 && (
        <section>
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            aria-expanded={showDone}
            className="tap flex items-center gap-1 px-1 text-subhead font-semibold text-ink-faint"
          >
            Сделано · {done.length}
            <ChevronDown className={`size-4 transition-transform duration-300 ${showDone ? 'rotate-180' : ''}`} aria-hidden />
          </button>
          <AnimatePresence initial={false}>
            {showDone && (
              <motion.ul
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.4, ease: EASE }}
                className="mt-2 overflow-hidden rounded-2xl bg-surface shadow-card [&>li+li]:border-t [&>li+li]:border-line"
              >
                {done.map((t) => (
                  <TodoRow key={t.id} todo={t} onUpdate={(patch) => updateTodo(t.id, patch)} onRemove={() => removeTodo(t.id)} />
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </section>
      )}
    </div>
  );
}

/* ——— Сессия ——— */

type Step = 'wheel' | 'questions' | 'todos';

export function PlanerkaSession({ heldOn }: { heldOn: string }) {
  const { user, partner } = useSpaceAuth();
  const { planerkas, wheels, answers, isLoading, error, ensure, saveWheel, saveAnswer } = usePlanerka();
  const [step, setStep] = useState<Step>('wheel');
  const [whose, setWhose] = useState<'me' | 'partner'>('me');
  const [planerkaId, setPlanerkaId] = useState<string | null>(null);

  const existing = planerkas.find((p) => p.held_on === heldOn) ?? null;
  const id = existing?.id ?? planerkaId;

  /*
    The session exists from the first touch, so both phones land in the same one.
    Asked once per date: if creating it fails, the error shows instead of a retry loop.
  */
  const asked = useRef<string | null>(null);
  useEffect(() => {
    if (isLoading || existing || planerkaId || asked.current === heldOn) return;
    asked.current = heldOn;
    ensure(heldOn).then(setPlanerkaId);
  }, [isLoading, existing, planerkaId, ensure, heldOn]);

  const personId = whose === 'me' ? user?.id : partner?.id;
  const partnerName = displayName(partner?.display_name);

  /* «Last time» is the closest earlier session in which this person filled the thing in. */
  const earlier = useMemo(() => planerkas.filter((p) => p.held_on < heldOn), [planerkas, heldOn]);

  const wheel = wheels.find((w) => w.planerka_id === id && w.user_id === personId);
  const previousWheel = useMemo(() => {
    for (const p of earlier) {
      const w = wheels.find((x) => x.planerka_id === p.id && x.user_id === personId);
      if (w) return w.scores;
    }
    return null;
  }, [earlier, wheels, personId]);

  const previousAnswer = (q: QuestionKey) => {
    for (const p of earlier) {
      const a = answers.find((x) => x.planerka_id === p.id && x.user_id === personId && x.question === q && x.answer.trim());
      if (a) return { date: p.held_on, text: a.answer };
    }
    return null;
  };

  if (isLoading || !id || !personId) return <Loading label="Открываем планёрку…" />;

  return (
    <div className="space-y-4">
      {error && <Alert>{error}</Alert>}

      <Segment
        legend="Шаг"
        options={[
          { value: 'wheel' as const, label: 'Колесо' },
          { value: 'questions' as const, label: 'Вопросы' },
          { value: 'todos' as const, label: 'Дела' },
        ]}
        value={step}
        onChange={setStep}
      />

      {step !== 'todos' && partner && (
        <div className="flex items-center gap-3 px-1">
          <span className="shrink-0 text-subhead text-ink-faint">Заполняет</span>
          <div className="min-w-0 flex-1">
            <Segment
              legend="Чьи ответы"
              options={[
                { value: 'me' as const, label: 'Я' },
                { value: 'partner' as const, label: partnerName },
              ]}
              value={whose}
              onChange={setWhose}
            />
          </div>
        </div>
      )}

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${step}:${whose}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.3, ease: EASE }}
        >
          {step === 'wheel' && (
            <WheelStep
              key={`${id}:${personId}`}
              planerkaId={id}
              personId={personId}
              scores={wheel?.scores ?? {}}
              note={wheel?.note ?? ''}
              previous={previousWheel}
              onSave={(scores, note) => saveWheel(id, personId, scores, note)}
            />
          )}
          {step === 'questions' && (
            <div className="space-y-3">
              {QUESTIONS.map((q) => (
                <QuestionCard
                  key={`${id}:${personId}:${q.key}`}
                  question={q.key}
                  label={q.label}
                  value={answers.find((a) => a.planerka_id === id && a.user_id === personId && a.question === q.key)?.answer ?? ''}
                  previous={previousAnswer(q.key)}
                  onSave={(text) => saveAnswer(id, personId, q.key, text)}
                />
              ))}
            </div>
          )}
          {step === 'todos' && <TodosBoard planerkaId={id} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
