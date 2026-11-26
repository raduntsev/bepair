'use client';

import { Suspense, useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { CalendarClock, Check, ChevronRight, MessageSquare, Users } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fmt, todayISO } from '@/lib/dates';
import { displayName } from '@/lib/words';
import { QUESTIONS, SPHERES, WEEKDAYS, WEEKDAYS_SHORT, average, type QuestionKey, type SphereKey } from '@/lib/planerka';
import { type PlanerkaSettings, usePlanerka } from '@/hooks/usePlanerka';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { Segment } from '@/components/ui/Controls';
import { Alert, EmptyState, Loading, Page } from '@/components/ui/Blocks';
import { TIME_TABS, TabbedHeader } from '@/components/TabbedHeader';
import { TodosBoard } from '@/components/PlanerkaSession';
import { Budget } from '@/components/Budget';
import { AutoHeight } from '@/components/ui/AutoHeight';
import { Sheet } from '@/components/ui/Sheet';
import { tr } from '@/lib/i18n';

type View = 'week' | 'todos' | 'budget' | 'history';
const EASE = [0.32, 0.72, 0, 1] as const;
/* Sessions shown in «История» before «Показать все». */
const HISTORY_PAGE = 6;

const one = (n: number | null | undefined) => (n === null || n === undefined ? '–' : n.toFixed(1).replace('.', ','));

/* «+0,5» / «−1» against last week; nothing when there is nothing to compare. */
function Delta({ now, before }: { now: number | null | undefined; before: number | null | undefined }) {
  if (now == null || before == null) return null;
  const d = Math.round((now - before) * 10) / 10;
  if (d === 0) return <span className="ml-1 text-caption text-ink-faint">=</span>;
  return (
    <span className={`ml-1 text-caption tabular-nums ${d > 0 ? 'text-accent' : 'text-ink-faint'}`}>
      {d > 0 ? '↑' : '↓'}
      {Math.abs(d).toFixed(Number.isInteger(d) ? 0 : 1).replace('.', ',')}
    </span>
  );
}

export default function PlanerkaPage() {
  return (
    <Suspense fallback={<Loading label={tr('Загружаем планёрки…', 'Loading check-ins…')} />}>
      <PlanerkaView />
    </Suspense>
  );
}

function PlanerkaView() {
  const params = useSearchParams();
  const { user, partner } = useSpaceAuth();
  const store = usePlanerka();
  const { planerkas, wheels, settings, isLoading, error, saveSettings } = store;
  const asked = params.get('view');
  const [view, setView] = useState<View>(asked === 'todos' || asked === 'budget' ? asked : 'week');
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const closeSchedule = useCallback(() => setScheduleOpen(false), []);
  const partnerName = displayName(partner?.display_name);

  const today = todayISO();
  const isDay = new Date().getDay() === settings.weekday;
  const todaySession = planerkas.find((p) => p.held_on === today);
  const closedToday = !!todaySession && wheels.some((w) => w.planerka_id === todaySession.id && w.user_id === user?.id && !!w.closed_at);

  return (
    <Page>
      <TabbedHeader
        id="time"
        title={tr('Календарь', 'Calendar')}
        tabs={TIME_TABS}
        current="/planerka"
        action={
          <button
            type="button"
            onClick={() => setScheduleOpen(true)}
            aria-label={tr('Когда встречаемся', 'When we meet')}
            aria-haspopup="dialog"
            data-tour="planerka-schedule"
            className="flex size-10 items-center justify-center rounded-full bg-sunken text-ink-soft transition-colors hover:text-ink"
          >
            <CalendarClock className="size-5" aria-hidden />
          </button>
        }
      />

      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      {/* The session of the day, lit on the couple's day; a quiet way in on any other. */}
      <Link
        href={`/planerka/session?d=${today}`}
        data-tour="planerka-start"
        className={`mb-6 flex items-center gap-3.5 rounded-2xl bg-surface p-4 shadow-card transition-colors hover:bg-sunken ${(isDay || todaySession) && !closedToday ? 'focus-ring' : ''}`}
      >
        <span aria-hidden className={`flex size-11 items-center justify-center rounded-full ${isDay || todaySession ? 'bg-accent text-accent-ink' : 'bg-sunken text-ink-soft'}`}>
          {closedToday ? <Check className="size-5" strokeWidth={2.6} /> : <Users className="size-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-headline font-semibold">{closedToday
              ? tr('Планёрка проведена', 'Check-in done')
              : todaySession
                ? tr('Продолжить планёрку', 'Continue the check-in')
                : isDay
                  ? tr('Планёрка сегодня', 'Check-in today')
                  : tr('Начать планёрку', 'Start a check-in')}</span>
          <span className="block text-footnote text-ink-faint">
            {isDay || todaySession ? fmt(today, 'd MMMM') : `${WEEKDAYS[settings.weekday]}, ${settings.at_time}`}
          </span>
        </span>
        <ChevronRight className="size-5 text-line-strong" aria-hidden />
      </Link>

      <div data-tour="planerka-views">
      <Segment
        legend={tr('Показать', 'Show')}
        options={[
          { value: 'week' as const, label: tr('Неделя', 'Week') },
          { value: 'todos' as const, label: tr('Дела', 'To-dos') },
          { value: 'budget' as const, label: tr('Бюджет', 'Budget') },
          { value: 'history' as const, label: tr('История', 'History') },
        ]}
        value={view}
        onChange={setView}
      />
      </div>

      {isLoading ? (
        <Loading label={tr('Загружаем планёрки…', 'Loading check-ins…')} />
      ) : (
        <motion.div key={view} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE }} className="mt-5">
          {view === 'week' && <WeekView store={store} userId={user?.id} partnerId={partner?.id} partnerName={partnerName} />}
          {view === 'todos' && <TodosBoard planerkaId={null} store={store} />}
          {view === 'budget' && <Budget />}
          {view === 'history' && <HistoryView store={store} userId={user?.id} partnerId={partner?.id} partnerName={partnerName} />}
        </motion.div>
      )}

      <ScheduleSheet open={scheduleOpen} onClose={closeSchedule} settings={settings} onChange={saveSettings} />
    </Page>
  );
}

/*
  «Неделя»: the last session only, set against the one before — the one
  comparison the couple actually makes. Everything older is in «История».
*/
type Store = ReturnType<typeof usePlanerka>;

function WeekView({ store, userId, partnerId, partnerName }: { store: Store; userId?: string; partnerId?: string; partnerName: string }) {
  const { planerkas, wheels, answers } = store;
  const today = todayISO();
  const held = planerkas.filter((p) => p.held_on <= today);
  const current = held[0];
  const previous = held[1];
  const [openSphere, setOpenSphere] = useState<SphereKey | null>(null);
  const [answersOf, setAnswersOf] = useState<'this' | 'last'>('this');

  if (!current) return <EmptyState title={tr('Пока ни одной планёрки', 'No check-ins yet')} variant="quiet" />;

  const wheelOf = (planerkaId: string | undefined, uid: string | undefined) =>
    planerkaId ? wheels.find((w) => w.planerka_id === planerkaId && w.user_id === uid) : undefined;
  const mine = wheelOf(current.id, userId);
  const theirs = wheelOf(current.id, partnerId);
  const mineBefore = wheelOf(previous?.id, userId);
  const theirsBefore = wheelOf(previous?.id, partnerId);
  const shownSession = answersOf === 'this' ? current : previous;
  const answerOf = (uid: string | undefined, q: QuestionKey) =>
    shownSession ? answers.find((a) => a.planerka_id === shownSession.id && a.user_id === uid && a.question === q)?.answer?.trim() : undefined;

  const cell = 'w-16 shrink-0 text-right text-body tabular-nums';

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl bg-surface shadow-card">
        <div className="flex items-baseline justify-between gap-3 px-4 pt-4 pb-2">
          <h2 className="text-headline font-semibold first-letter:uppercase">{fmt(current.held_on, 'd MMMM')}</h2>
          {previous && <span className="text-footnote text-ink-faint">{tr(`к ${fmt(previous.held_on, 'd MMMM')}`, `vs ${fmt(previous.held_on, 'MMMM d')}`)}</span>}
        </div>
        <div className="flex items-center gap-2 border-b border-line px-4 pb-2 text-footnote font-medium">
          <span className="min-w-0 flex-1 text-ink-faint">{tr('Сфера', 'Area')}</span>
          <span className={`${cell} !text-footnote text-accent`}>{tr('Я', 'Me')}</span>
          <span className={`${cell} !text-footnote truncate text-partner-ink`}>{partnerName}</span>
        </div>
        <div className="flex min-h-11 items-center gap-2 px-4 py-2 font-semibold">
          <span className="min-w-0 flex-1 text-body">{tr('В среднем', 'Average')}</span>
          <span className={cell}>
            {one(average(mine?.scores))}
            <Delta now={average(mine?.scores)} before={average(mineBefore?.scores)} />
          </span>
          <span className={cell}>
            {one(average(theirs?.scores))}
            <Delta now={average(theirs?.scores)} before={average(theirsBefore?.scores)} />
          </span>
        </div>
        <ul className="[&>li]:border-t [&>li]:border-line">
          {SPHERES.map((s) => {
            const notes = [
              { who: partnerName, tone: 'text-partner-ink', text: theirs?.comments?.[s.key]?.trim() },
              { who: tr('Я', 'Me'), tone: 'text-accent', text: mine?.comments?.[s.key]?.trim() },
            ].filter((n) => n.text);
            const open = openSphere === s.key;
            return (
              <li key={s.key}>
                <button
                  type="button"
                  disabled={notes.length === 0}
                  onClick={() => setOpenSphere(open ? null : s.key)}
                  aria-expanded={notes.length ? open : undefined}
                  className="flex min-h-11 w-full items-center gap-2 px-4 py-2 text-left enabled:hover:bg-sunken"
                >
                  <span className="flex min-w-0 flex-1 items-center gap-1.5 text-body">
                    <span className="truncate">{s.label}</span>
                    {notes.length > 0 && <MessageSquare className={`size-3.5 shrink-0 ${open ? 'text-accent' : 'text-ink-faint'}`} aria-label={tr('Есть комментарий', 'Has a comment')} />}
                  </span>
                  <span className={cell}>
                    {one(mine?.scores?.[s.key])}
                    <Delta now={mine?.scores?.[s.key]} before={mineBefore?.scores?.[s.key]} />
                  </span>
                  <span className={cell}>
                    {one(theirs?.scores?.[s.key])}
                    <Delta now={theirs?.scores?.[s.key]} before={theirsBefore?.scores?.[s.key]} />
                  </span>
                </button>
                <AutoHeight>
                  {open && (
                    <div className="space-y-2 px-4 pb-3">
                      {notes.map((n) => (
                        <div key={n.who}>
                          <p className={`text-footnote font-medium ${n.tone}`}>{n.who}</p>
                          <p className="text-subhead whitespace-pre-wrap">{n.text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </AutoHeight>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-2xl bg-surface p-4 shadow-card">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-headline font-semibold">{tr('Ответы', 'Answers')}</h2>
          {previous && (
            <div className="w-48">
              <Segment
                legend={tr('Какая неделя', 'Which week')}
                options={[
                  { value: 'this' as const, label: tr('Эта', 'This') },
                  { value: 'last' as const, label: tr('Прошлая', 'Last') },
                ]}
                value={answersOf}
                onChange={setAnswersOf}
              />
            </div>
          )}
        </div>
        <div className="space-y-4">
          {QUESTIONS.map((q) => {
            const theirsA = answerOf(partnerId, q.key);
            const mineA = answerOf(userId, q.key);
            return (
              <div key={q.key}>
                <p className="mb-1 text-footnote font-semibold text-ink-faint">{q.label}</p>
                {!theirsA && !mineA ? (
                  <p className="text-subhead text-ink-faint">—</p>
                ) : (
                  <div className="space-y-1.5">
                    {theirsA && (
                      <p className="text-body whitespace-pre-wrap">
                        <span className="mr-1.5 text-footnote font-medium text-partner-ink">{partnerName}</span>
                        {theirsA}
                      </p>
                    )}
                    {mineA && (
                      <p className="text-body whitespace-pre-wrap">
                        <span className="mr-1.5 text-footnote font-medium text-accent">{tr('Я', 'Me')}</span>
                        {mineA}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <Link
        href={`/planerka/session?d=${current.held_on}`}
        className="flex min-h-12 items-center justify-between rounded-2xl bg-surface px-4 shadow-card transition-colors hover:bg-sunken"
      >
        <span className="text-body">{tr(`Открыть планёрку ${fmt(current.held_on, 'd MMMM')}`, `Open the ${fmt(current.held_on, 'MMMM d')} check-in`)}</span>
        <ChevronRight className="size-5 text-line-strong" aria-hidden />
      </Link>
    </div>
  );
}

/* «История»: the trend over every week, and every past session one tap away — out of the way until wanted. */
function HistoryView({ store, userId, partnerId, partnerName }: { store: Store; userId?: string; partnerId?: string; partnerName: string }) {
  const { planerkas, wheels } = store;
  const [sphere, setSphere] = useState<SphereKey | 'avg'>('avg');
  const [all, setAll] = useState(false);
  const wheelOf = (planerkaId: string, uid: string | undefined) => wheels.find((w) => w.planerka_id === planerkaId && w.user_id === uid);

  /* Oldest → newest for the chart. */
  const series = useMemo(
    () =>
      [...planerkas].reverse().map((p) => {
        const mine = wheels.find((w) => w.planerka_id === p.id && w.user_id === userId)?.scores;
        const theirs = wheels.find((w) => w.planerka_id === p.id && w.user_id === partnerId)?.scores;
        const pick = (s: typeof mine) => (sphere === 'avg' ? average(s) : (s?.[sphere] ?? null));
        return { date: fmt(p.held_on, 'd MMM'), me: pick(mine), partner: pick(theirs) };
      }),
    [planerkas, wheels, userId, partnerId, sphere],
  );

  if (planerkas.length === 0) return <EmptyState title={tr('Пока ни одной', 'None yet')} variant="quiet" />;
  const shown = all ? planerkas : planerkas.slice(0, HISTORY_PAGE);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-surface p-4 shadow-card">
        <div className="mb-3 flex items-center gap-4 text-footnote text-ink-faint">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-accent" /> {tr('Я', 'Me')}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-partner" /> {partnerName}
          </span>
        </div>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: -24 }}>
              <CartesianGrid stroke="var(--c-border)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: 'var(--c-ink-faint)', fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis domain={[0, 10]} ticks={[0, 5, 10]} tick={{ fill: 'var(--c-ink-faint)', fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip
                formatter={(v) => one(typeof v === 'number' ? v : null)}
                contentStyle={{ background: 'var(--c-surface)', border: 'none', borderRadius: 12, boxShadow: 'var(--sh-lift)', fontSize: 13 }}
              />
              <Line type="monotone" dataKey="me" name={tr('Я', 'Me')} stroke="var(--c-accent)" strokeWidth={2.5} dot={false} connectNulls animationDuration={600} />
              <Line type="monotone" dataKey="partner" name={partnerName} stroke="var(--c-partner)" strokeWidth={2.5} dot={false} connectNulls animationDuration={600} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {[{ key: 'avg' as const, label: tr('В среднем', 'Average') }, ...SPHERES].map((s) => (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => setSphere(s.key)}
                aria-pressed={sphere === s.key}
                className={`h-8 rounded-full px-3 text-footnote font-medium transition-colors duration-300 ${
                  sphere === s.key ? 'bg-ink text-surface' : 'bg-sunken text-ink-soft hover:text-ink'
                }`}
              >
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <ul className="overflow-hidden rounded-2xl bg-surface shadow-card [&>li+li]:border-t [&>li+li]:border-line">
        {shown.map((p) => (
          <li key={p.id}>
            <Link href={`/planerka/session?d=${p.held_on}`} className="flex min-h-13 items-center gap-3 px-4 py-2 transition-colors hover:bg-sunken">
              <span className="min-w-0 flex-1">
                <span className="block text-body first-letter:uppercase">{fmt(p.held_on, 'd MMMM')}</span>
                <span className="block text-footnote text-ink-faint">
                  {tr('Я', 'Me')} {one(average(wheelOf(p.id, userId)?.scores))} · {partnerName} {one(average(wheelOf(p.id, partnerId)?.scores))}
                </span>
              </span>
              <ChevronRight className="size-5 text-line-strong" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      {!all && planerkas.length > HISTORY_PAGE && (
        <button type="button" onClick={() => setAll(true)} className="tap mx-auto flex items-center gap-1 text-subhead font-semibold text-accent">
          {tr(`Все планёрки · ${planerkas.length}`, `All check-ins · ${planerkas.length}`)}
        </button>
      )}
    </div>
  );
}

/*
  When the couple meets is set once and then left alone, so it does not live on
  the page: the clock in the header opens it as a sheet.
*/
function ScheduleSheet({
  open,
  onClose,
  settings,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  settings: PlanerkaSettings;
  onChange: (next: PlanerkaSettings) => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={tr('Когда встречаемся', 'When we meet')}>
      <div className="space-y-4">
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
                      onClick={() => onChange({ ...settings, weekday: day })}
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
              <span className="text-body">{tr('Время', 'Time')}</span>
              <input
                type="time"
                value={settings.at_time}
                onChange={(e) => e.target.value && onChange({ ...settings, at_time: e.target.value })}
                className="h-10 rounded-xl bg-sunken px-3 text-body text-ink outline-none focus:shadow-[0_0_0_3px_var(--c-accent-soft)]"
              />
            </label>
      </div>
    </Sheet>
  );
}
