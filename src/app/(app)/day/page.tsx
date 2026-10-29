'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CalendarHeart, Check, ChevronLeft, Droplet, Mail } from 'lucide-react';
import supabase from '@/lib/supabase';
import { moodColor } from '@/lib/mood';
import { fmt, longDate, todayISO } from '@/lib/dates';
import { MoodScale } from '@/components/MoodScale';
import { PartnerDayCard } from '@/components/PartnerDayCard';
import { Counters } from '@/components/Counters';
import { DoneForMe, MyTasks } from '@/components/DayTasks';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Field';
import { Alert, Loading } from '@/components/ui/Blocks';
import { useCoupleDay } from '@/hooks/useCoupleDay';
import { useTasks } from '@/hooks/useTasks';
import { usePresence } from '@/hooks/usePresence';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { useImportantDates, useShowMoon } from '@/hooks/useImportantDates';
import { occursOn, withAnniversary, upcoming } from '@/lib/importantDates';
import { moonAt } from '@/lib/moon';
import { MoonGlyph } from '@/components/MoonGlyph';

export default function DayPage() {
  return (
    <Suspense fallback={<Loading label="Загружаем день…" />}>
      <DayView />
    </Suspense>
  );
}

function useWaitingLetters(userId: string | undefined, isUnlocked: boolean) {
  const [count, setCount] = useState({ sealed: 0, unread: 0 });
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    Promise.all([
      supabase.rpc('letter_inbox'),
      supabase.from('letters').select('id', { count: 'exact', head: true }).eq('recipient_id', userId).eq('is_read', false),
    ]).then(([sealed, unread]) => {
      if (!alive) return;
      setCount({ sealed: (sealed.data as unknown[] | null)?.length ?? 0, unread: unread.count ?? 0 });
    });
    return () => {
      alive = false;
    };
  }, [userId, isUnlocked]);
  return count;
}

/* Quiet by design: for later analysis, shown nowhere, in neutral ink — the spectrum is mood's alone. */
function CycleRow({ userId }: { userId: string }) {
  const today = todayISO();
  const [marked, setMarked] = useState<boolean | null>(null);

  useEffect(() => {
    supabase
      .from('cycle_days')
      .select('day')
      .eq('user_id', userId)
      .eq('day', today)
      .maybeSingle()
      .then(({ data }) => setMarked(!!data));
  }, [userId, today]);

  const toggle = async () => {
    const next = !marked;
    setMarked(next);
    const { error } = next
      ? await supabase.from('cycle_days').insert({ user_id: userId, day: today })
      : await supabase.from('cycle_days').delete().eq('user_id', userId).eq('day', today);
    if (error) setMarked(!next);
  };

  return (
    <section className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-5 py-4 shadow-card md:px-6">
      <Droplet className="size-5 shrink-0 text-ink-soft" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">День цикла</p>
        <p className="text-sm text-ink-faint">Видно только вам. Нужно для будущего разбора.</p>
      </div>
      <Button variant="secondary" disabled={marked === null} onClick={toggle} aria-pressed={!!marked}>
        {marked ? (
          <>
            <Check className="size-4" aria-hidden /> Отмечен
          </>
        ) : (
          'Отметить'
        )}
      </Button>
    </section>
  );
}

/* Birthdays, anniversaries: shared by the couple, so shown on any day they fall on. */
function DatesChip({ date, isToday, togetherSince }: { date: string; isToday: boolean; togetherSince: string | null }) {
  const { items } = useImportantDates();
  const todays = upcoming(withAnniversary(items, togetherSince).filter((d) => occursOn(d, date)), date, 0);
  if (todays.length === 0) return null;
  return (
    <p className="inline-flex min-h-11 items-center gap-2 rounded-full bg-accent-soft px-4 text-sm font-medium text-accent-soft-ink">
      <CalendarHeart className="size-4" aria-hidden />
      {isToday ? 'Сегодня' : 'В этот день'}: {todays.map((o) => o.title).join(', ')}
    </p>
  );
}

/* Personal and off by default. Ink only — colour is mood's alone. */
function MoonRow() {
  const { showMoon } = useShowMoon();
  if (!showMoon) return null;
  const moon = moonAt(new Date());
  return (
    <section className="order-3 flex items-center gap-3 rounded-2xl border border-line bg-surface px-5 py-4 shadow-card md:px-6">
      <MoonGlyph phase={moon.phase} size={22} className="shrink-0 text-ink-soft" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Луна: {moon.label}</p>
        <p className="text-sm text-ink-faint">Освещено {Math.round(moon.lit * 100)}% · {moon.waxing ? 'растёт' : 'убывает'}</p>
      </div>
    </section>
  );
}

function DayView() {
  const params = useSearchParams();
  const date = params.get('d') ?? todayISO();
  const { user, profile, settings } = useSpaceAuth();

  const { partner, mine, theirs, isLoading, error, save, isUnlocked, isToday } = useCoupleDay(date);
  const { tasks, complete, acknowledge, error: taskError } = useTasks();
  const presence = usePresence();
  const waitingLetters = useWaitingLetters(user?.id, isUnlocked);

  const [mood, setMood] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [justUnsealed, setJustUnsealed] = useState(false);
  const [syncedFor, setSyncedFor] = useState<string | null>(null);

  /* Adopt the stored entry once per loaded day, without clobbering what is being typed. */
  const key = `${date}:${mine?.updated_at ?? 'none'}`;
  if (!isLoading && syncedFor !== key) {
    setSyncedFor(key);
    setMood(mine ? mine.mood : null);
    setNote(mine?.note ?? '');
  }

  /*
    A past day is closed whether or not it was filled in: a live editor for an
    unmarked past date would let anyone backdate and unseal the partner's day.
  */
  const isClosed = !isToday;
  const isDirty = mine === null ? mood !== null : mood !== mine.mood || note.trim() !== mine.note;

  const onSave = useCallback(async () => {
    if (mood === null) return;
    const first = mine === null;
    setSaving(true);
    const ok = await save(mood, note.trim());
    setSaving(false);
    if (ok) {
      setJustSaved(true);
      if (first) setJustUnsealed(true);
      presence.reload();
    }
  }, [mood, note, mine, save, presence]);

  const tint = mood !== null ? moodColor(mood) : null;

  return (
    <div className="mx-auto w-full max-w-6xl px-5 pt-7 pb-8 md:px-8 md:pt-10">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-3">
        <div>
          {!isToday && (
            <Link
              href="/day"
              className="tap -ml-2 mb-1 inline-flex items-center gap-1 rounded-lg px-2 text-sm font-medium text-ink-soft hover:text-ink"
            >
              <ChevronLeft className="size-4" aria-hidden /> К сегодняшнему дню
            </Link>
          )}
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{isToday ? 'Сегодня' : fmt(date, 'd MMMM')}</h1>
          <p className="mt-1 text-sm text-ink-faint">{longDate(date)}</p>
        </div>
        <DatesChip date={date} isToday={isToday} togetherSince={settings?.together_since ?? null} />
        {isToday && waitingLetters.sealed + waitingLetters.unread > 0 && (
          <Link
            href="/letters"
            className="tap inline-flex items-center gap-2 rounded-full bg-partner-soft px-4 text-sm font-medium text-partner-ink transition-colors hover:brightness-95"
          >
            <Mail className="size-4" aria-hidden />
            {waitingLetters.sealed > 0
              ? waitingLetters.sealed === 1
                ? 'Письмо ждёт вас'
                : `Писем ждут: ${waitingLetters.sealed}`
              : waitingLetters.unread === 1
                ? 'Новое письмо'
                : `Новых писем: ${waitingLetters.unread}`}
          </Link>
        )}
      </header>

      {isLoading ? (
        <Loading label="Загружаем день…" />
      ) : (
        <>
          <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start lg:gap-6">
            <div className="contents lg:flex lg:flex-col lg:gap-5">
              <section
                className="order-1 rounded-2xl border border-line p-5 shadow-card transition-colors duration-500 md:p-8"
                style={{
                  backgroundColor: tint
                    ? `color-mix(in srgb, ${tint} 9%, var(--c-surface))`
                    : 'var(--c-surface)',
                }}
              >
                <h2 className="text-lg font-semibold">Как прошёл день</h2>
                <p className="mt-1.5 mb-7 text-sm text-ink-soft">
                  {!isClosed
                    ? 'Единственное, что обязательно. Цветом, без оценок.'
                    : mine
                      ? 'Этот день уже закрыт — так и было задумано.'
                      : 'Этот день остался неотмеченным. Задним числом его не заполнить.'}
                </p>

                <MoodScale value={mood} onChange={setMood} disabled={isClosed} />

                <div className="measure mt-8">
                  <label htmlFor="note" className="mb-2 block text-sm font-medium">
                    Заметка
                    <span className="ml-2 font-normal text-ink-faint">по желанию</span>
                  </label>
                  <Textarea
                    id="note"
                    value={note}
                    onChange={(event) => {
                      setNote(event.target.value);
                      setJustSaved(false);
                    }}
                    disabled={isClosed}
                    rows={4}
                    placeholder={isClosed ? 'Без заметки' : 'Что случилось, о чём думаете, чего хотелось бы завтра…'}
                  />
                </div>

                {!isClosed && (
                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <Button size="lg" loading={saving} disabled={mood === null || !isDirty} onClick={onSave}>
                      {mine ? 'Сохранить' : 'Отметить день'}
                    </Button>
                    {mood === null && <span className="text-sm text-ink-faint">Сначала выберите цвет дня</span>}
                    <span role="status" aria-live="polite">
                      {justSaved && !isDirty && (
                        <span className="flex items-center gap-1.5 text-sm font-medium text-accent-soft-ink">
                          <Check className="size-4" aria-hidden /> Сохранено
                        </span>
                      )}
                    </span>
                  </div>
                )}

                {error && (
                  <div className="mt-4">
                    <Alert>{error}</Alert>
                  </div>
                )}
              </section>

              {isToday && profile?.cycle_tracking && user && (
                <div className="order-3">
                  <CycleRow userId={user.id} />
                </div>
              )}

              {isToday && <MoonRow />}

              {isToday && user && (
                <div className="order-4">
                  <MyTasks tasks={tasks} userId={user.id} onComplete={complete} />
                </div>
              )}
            </div>

            <div className="contents lg:sticky lg:top-8 lg:flex lg:flex-col lg:gap-5">
              <div className="order-2">
                <PartnerDayCard
                  partner={partner}
                  entry={theirs}
                  isUnlocked={isUnlocked}
                  isToday={isToday}
                  showTime={settings?.long_distance}
                  justUnsealed={justUnsealed}
                />
              </div>

              {isToday && user && (
                <div className="order-5">
                  <DoneForMe tasks={tasks} userId={user.id} partner={partner} myGender={profile?.gender} onAcknowledge={acknowledge} />
                </div>
              )}
              {taskError && (
                <div className="order-6">
                  <Alert>{taskError}</Alert>
                </div>
              )}
            </div>
          </div>

          {isToday && mine && partner && (
            <div className="mt-8">
              <Counters
                togetherSince={settings?.together_since ?? null}
                showStreak={settings?.count_streak ?? true}
                current={presence.current}
                best={presence.best}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
