'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ChevronRight, Users } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fmt, todayISO } from '@/lib/dates';
import { displayName } from '@/lib/words';
import { QUESTIONS, SPHERES, WEEKDAYS, WEEKDAYS_SHORT, average, type QuestionKey, type SphereKey } from '@/lib/planerka';
import { usePlanerka } from '@/hooks/usePlanerka';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { Segment } from '@/components/ui/Controls';
import { Alert, EmptyState, Loading, Page, SectionHeader } from '@/components/ui/Blocks';
import { TIME_TABS, TabbedHeader } from '@/components/TabbedHeader';
import { TodosBoard } from '@/components/PlanerkaSession';

type View = 'sessions' | 'wheel' | 'answers' | 'todos';
const EASE = [0.32, 0.72, 0, 1] as const;
const SHORT_Q: Record<QuestionKey, string> = { feel: 'Чувства', change: 'Изменить', enough: 'Хватает', love: 'Люблю' };

const one = (n: number | null) => (n === null ? '–' : n.toFixed(1).replace('.', ','));

export default function PlanerkaPage() {
  const { user, partner } = useSpaceAuth();
  const { planerkas, wheels, answers, settings, isLoading, error, saveSettings } = usePlanerka();
  const [view, setView] = useState<View>('sessions');
  const [question, setQuestion] = useState<QuestionKey>('feel');
  const [sphere, setSphere] = useState<SphereKey | 'avg'>('avg');
  const partnerName = displayName(partner?.display_name);

  const today = todayISO();
  const isDay = new Date().getDay() === settings.weekday;
  const todaySession = planerkas.find((p) => p.held_on === today);

  const wheelOf = (planerkaId: string, userId: string | undefined) => wheels.find((w) => w.planerka_id === planerkaId && w.user_id === userId);

  /* Oldest → newest for the charts. */
  const series = useMemo(
    () =>
      [...planerkas].reverse().map((p) => {
        const mine = wheelOf(p.id, user?.id)?.scores;
        const theirs = wheelOf(p.id, partner?.id)?.scores;
        const pick = (s: typeof mine) => (sphere === 'avg' ? average(s) : (s?.[sphere] ?? null));
        return { date: fmt(p.held_on, 'd MMM'), me: pick(mine), partner: pick(theirs) };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [planerkas, wheels, user?.id, partner?.id, sphere],
  );

  return (
    <Page>
      <TabbedHeader id="time" title="Календарь" tabs={TIME_TABS} current="/planerka" />

      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      {/* The session of the day, lit on the couple's day; a quiet way in on any other. */}
      <Link
        href={`/planerka/session?d=${today}`}
        className={`mb-6 flex items-center gap-3.5 rounded-2xl bg-surface p-4 shadow-card transition-colors hover:bg-sunken ${isDay || todaySession ? 'focus-ring' : ''}`}
      >
        <span aria-hidden className={`flex size-11 items-center justify-center rounded-full ${isDay || todaySession ? 'bg-accent text-accent-ink' : 'bg-sunken text-ink-soft'}`}>
          <Users className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-headline font-semibold">{todaySession ? 'Продолжить планёрку' : isDay ? 'Планёрка сегодня' : 'Начать планёрку'}</span>
          <span className="block text-footnote text-ink-faint">
            {isDay || todaySession ? fmt(today, 'd MMMM') : `${WEEKDAYS[settings.weekday]}, ${settings.at_time}`}
          </span>
        </span>
        <ChevronRight className="size-5 text-line-strong" aria-hidden />
      </Link>

      <Segment
        legend="Показать"
        options={[
          { value: 'sessions' as const, label: 'Встречи' },
          { value: 'wheel' as const, label: 'Колесо' },
          { value: 'answers' as const, label: 'Ответы' },
          { value: 'todos' as const, label: 'Дела' },
        ]}
        value={view}
        onChange={setView}
      />

      {isLoading ? (
        <Loading label="Загружаем планёрки…" />
      ) : (
        <motion.div key={view} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE }} className="mt-5">
          {view === 'sessions' &&
            (planerkas.length === 0 ? (
              <EmptyState title="Пока ни одной" variant="quiet" />
            ) : (
              <ul className="overflow-hidden rounded-2xl bg-surface shadow-card [&>li+li]:border-t [&>li+li]:border-line">
                {planerkas.map((p) => {
                  const mine = average(wheelOf(p.id, user?.id)?.scores);
                  const theirs = average(wheelOf(p.id, partner?.id)?.scores);
                  return (
                    <li key={p.id}>
                      <Link href={`/planerka/session?d=${p.held_on}`} className="flex min-h-14 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-sunken">
                        <span className="min-w-0 flex-1">
                          <span className="block text-body first-letter:uppercase">{fmt(p.held_on, 'd MMMM')}</span>
                          <span className="block text-footnote text-ink-faint">
                            Я {one(mine)} · {partnerName} {one(theirs)}
                          </span>
                        </span>
                        <ChevronRight className="size-5 text-line-strong" aria-hidden />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ))}

          {view === 'wheel' && (
            <div className="space-y-4">
              <section className="rounded-2xl bg-surface p-4 shadow-card">
                <div className="mb-3 flex items-center gap-4 text-footnote text-ink-faint">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-accent" /> Я
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-partner" /> {partnerName}
                  </span>
                </div>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: -24 }}>
                      <CartesianGrid stroke="var(--c-border)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: 'var(--c-ink-faint)', fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                      <YAxis domain={[0, 10]} ticks={[0, 5, 10]} tick={{ fill: 'var(--c-ink-faint)', fontSize: 11 }} tickLine={false} axisLine={false} />
                      <Tooltip
                        formatter={(v) => one(typeof v === 'number' ? v : null)}
                        contentStyle={{ background: 'var(--c-surface)', border: 'none', borderRadius: 12, boxShadow: 'var(--sh-lift)', fontSize: 13 }}
                      />
                      <Line type="monotone" dataKey="me" name="Я" stroke="var(--c-accent)" strokeWidth={2.5} dot={false} connectNulls animationDuration={600} />
                      <Line type="monotone" dataKey="partner" name={partnerName} stroke="var(--c-partner)" strokeWidth={2.5} dot={false} connectNulls animationDuration={600} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <ul className="flex flex-wrap gap-2">
                {[{ key: 'avg' as const, label: 'В среднем' }, ...SPHERES].map((s) => (
                  <li key={s.key}>
                    <button
                      type="button"
                      onClick={() => setSphere(s.key)}
                      aria-pressed={sphere === s.key}
                      className={`h-9 rounded-full px-3.5 text-subhead font-medium transition-colors duration-300 ${
                        sphere === s.key ? 'bg-ink text-surface' : 'bg-sunken text-ink-soft hover:text-ink'
                      }`}
                    >
                      {s.label}
                    </button>
                  </li>
                ))}
              </ul>

              {/* Why each score was what it was — only for one sphere, where the words line up with the line above. */}
              {sphere !== 'avg' &&
                planerkas.map((p) => {
                  const of = (uid: string | undefined) => {
                    const w = wheelOf(p.id, uid);
                    const text = w?.comments?.[sphere]?.trim();
                    return text ? { text, score: w?.scores?.[sphere] } : null;
                  };
                  const mine = of(user?.id);
                  const theirs = of(partner?.id);
                  if (!mine && !theirs) return null;
                  return (
                    <section key={p.id} className="rounded-2xl bg-surface p-4 shadow-card">
                      <h3 className="mb-2 text-footnote font-semibold text-ink-faint first-letter:uppercase">{fmt(p.held_on, 'd MMMM')}</h3>
                      {theirs && (
                        <div className="mb-3 last:mb-0">
                          <p className="text-footnote font-medium text-partner-ink">
                            {partnerName}
                            {typeof theirs.score === 'number' && <span className="tabular-nums"> · {theirs.score}</span>}
                          </p>
                          <p className="text-body whitespace-pre-wrap">{theirs.text}</p>
                        </div>
                      )}
                      {mine && (
                        <div>
                          <p className="text-footnote font-medium text-accent">
                            Я{typeof mine.score === 'number' && <span className="tabular-nums"> · {mine.score}</span>}
                          </p>
                          <p className="text-body whitespace-pre-wrap">{mine.text}</p>
                        </div>
                      )}
                    </section>
                  );
                })}
            </div>
          )}

          {view === 'answers' && (
            <div className="space-y-4">
              <Segment legend="Вопрос" options={QUESTIONS.map((q) => ({ value: q.key, label: SHORT_Q[q.key] }))} value={question} onChange={setQuestion} />
              <p className="px-1 text-subhead font-semibold">{QUESTIONS.find((q) => q.key === question)?.label}</p>
              {planerkas.map((p) => {
                const of = (uid: string | undefined) =>
                  answers.find((a) => a.planerka_id === p.id && a.user_id === uid && a.question === question)?.answer?.trim();
                const mine = of(user?.id);
                const theirs = of(partner?.id);
                if (!mine && !theirs) return null;
                return (
                  <section key={p.id} className="rounded-2xl bg-surface p-4 shadow-card">
                    <h3 className="mb-2 text-footnote font-semibold text-ink-faint first-letter:uppercase">{fmt(p.held_on, 'd MMMM')}</h3>
                    {theirs && (
                      <div className="mb-3">
                        <p className="text-footnote font-medium text-partner-ink">{partnerName}</p>
                        <p className="text-body whitespace-pre-wrap">{theirs}</p>
                      </div>
                    )}
                    {mine && (
                      <div>
                        <p className="text-footnote font-medium text-accent">Я</p>
                        <p className="text-body whitespace-pre-wrap">{mine}</p>
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}

          {view === 'todos' && <TodosBoard planerkaId={null} />}
        </motion.div>
      )}

      <SectionHeader title="Когда встречаемся" />
      <section className="space-y-3 rounded-2xl bg-surface p-4 shadow-card">
        <ul className="grid grid-cols-7 gap-1">
          {WEEKDAYS_SHORT.map((label, day) => ({ label, day }))
            /* Monday first, as a Russian week starts. */
            .sort((a, b) => ((a.day + 6) % 7) - ((b.day + 6) % 7))
            .map(({ label, day }) => (
              <li key={day}>
                <button
                  type="button"
                  aria-pressed={settings.weekday === day}
                  aria-label={WEEKDAYS[day]}
                  onClick={() => saveSettings({ ...settings, weekday: day })}
                  className={`flex h-10 w-full items-center justify-center rounded-xl text-subhead font-medium transition-colors duration-300 ${
                    settings.weekday === day ? 'bg-accent text-accent-ink' : 'bg-sunken text-ink-soft hover:text-ink'
                  }`}
                >
                  {label}
                </button>
              </li>
            ))}
        </ul>
        <label className="flex items-center justify-between gap-3">
          <span className="text-body">Время</span>
          <input
            type="time"
            value={settings.at_time}
            onChange={(e) => e.target.value && saveSettings({ ...settings, at_time: e.target.value })}
            className="h-10 rounded-xl bg-sunken px-3 text-body text-ink outline-none focus:shadow-[0_0_0_3px_var(--c-accent-soft)]"
          />
        </label>
      </section>
    </Page>
  );
}
