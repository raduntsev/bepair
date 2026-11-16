'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CalendarHeart, Check, Droplet, ListChecks, Mail, Pencil } from 'lucide-react';
import supabase from '@/lib/supabase';
import { moodColor, moodLabel } from '@/lib/mood';
import { fmt, longDate, plural, todayISO } from '@/lib/dates';
import { MoodScale } from '@/components/MoodScale';
import { PartnerDayCard } from '@/components/PartnerDayCard';
import { Counters } from '@/components/Counters';
import { DayPrompts } from '@/components/DayPrompts';
import { DoneForMe, MyTasks } from '@/components/DayTasks';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Field';
import { Alert, LinkRow, Loading, PageHeader, RowGroup, RowIcon, SectionHeader, SwitchTrack } from '@/components/ui/Blocks';
import { useCoupleDay } from '@/hooks/useCoupleDay';
import { useTasks } from '@/hooks/useTasks';
import { usePresence } from '@/hooks/usePresence';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { useImportantDates, useShowMoon } from '@/hooks/useImportantDates';
import { occursOn, withAnniversary, upcoming } from '@/lib/importantDates';
import { moonAt } from '@/lib/moon';
import { MoonGlyph } from '@/components/MoonGlyph';
import { taskState } from '@/hooks/useTasks';

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
    <li>
      <button
        type="button"
        role="switch"
        aria-checked={!!marked}
        disabled={marked === null}
        onClick={toggle}
        className="flex min-h-13 w-full items-center gap-3.5 px-4 py-2.5 text-left transition-colors enabled:hover:bg-sunken"
      >
        <RowIcon Icon={Droplet} tone="neutral" />
        <span className="min-w-0 flex-1">
          <span className="block text-body">День цикла</span>
          <span className="block text-footnote text-ink-faint">Видно только вам</span>
        </span>
        <SwitchTrack checked={!!marked} disabled={marked === null} />
      </button>
    </li>
  );
}

/* Birthdays, anniversaries: shared by the couple, so shown on any day they fall on. */
function DatesChip({ date, isToday, togetherSince }: { date: string; isToday: boolean; togetherSince: string | null }) {
  const { items } = useImportantDates();
  const todays = upcoming(withAnniversary(items, togetherSince).filter((d) => occursOn(d, date)), date, 0);
  if (todays.length === 0) return null;
  return (
    <p className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-full bg-accent-soft px-3.5 text-subhead font-medium text-accent-soft-ink">
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
    <li className="flex min-h-13 items-center gap-3.5 px-4 py-2.5">
      <span aria-hidden className="flex size-[1.875rem] shrink-0 items-center justify-center rounded-[0.5rem] bg-ink-faint text-surface">
        <MoonGlyph phase={moon.phase} size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-body">Луна: {moon.label}</span>
        <span className="block text-footnote text-ink-faint">{moon.waxing ? 'растёт' : 'убывает'}</span>
      </span>
      <span className="text-body text-ink-faint tabular-nums">{Math.round(moon.lit * 100)}%</span>
    </li>
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
  const [editing, setEditing] = useState(false);

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
      setEditing(false);
      if (first) setJustUnsealed(true);
      presence.reload();
    }
  }, [mood, note, mine, save, presence]);

  /*
    «Просмотрено»: the morning reminder asks about a partner's day only while you
    have not opened it. Recorded once their day is actually in front of you.
    Fails quietly before migration 0004 — nothing depends on it in the UI.
  */
  const theirsKey = theirs ? `${theirs.user_id}:${theirs.entry_date}` : null;
  useEffect(() => {
    if (!isUnlocked || !theirsKey) return;
    supabase.rpc('bp_mark_day_viewed', { d: date }).then(() => undefined);
  }, [isUnlocked, theirsKey, date]);

  const tint = mood !== null ? moodColor(mood) : null;
  /* Wait for presence before choosing whether prompts start open, so they do not jump. */
  const partnerMarkedToday = !!partner && !presence.isLoading && presence.partnerMarked(date);
  /* Once the day is marked it folds into one line; «Изменить» unfolds it again. */
  const showEditor = !isClosed && (!mine || editing);
  const showMoon = isToday;
  const showCycle = isToday && !!profile?.cycle_tracking && !!user;

  const letters = waitingLetters.sealed + waitingLetters.unread;
  const lettersSub =
    waitingLetters.sealed > 0
      ? waitingLetters.sealed === 1
        ? 'Письмо ждёт вас'
        : `Ждут: ${waitingLetters.sealed}`
      : waitingLetters.unread > 0
        ? waitingLetters.unread === 1
          ? 'Новое письмо'
          : `Новых: ${waitingLetters.unread}`
        : 'Написать или прочитать';
  const asked = user ? tasks.filter((t) => t.user_id === user.id && taskState(t) === 'awaiting').length : 0;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-6 pb-8 sm:px-6 md:pt-12">
      <PageHeader
        eyebrow={longDate(date)}
        title={isToday ? 'Сегодня' : fmt(date, 'd MMMM')}
        back={isToday ? undefined : { href: '/day', label: 'Сегодня' }}
      />
      <div className="-mt-4 mb-6">
        <DatesChip date={date} isToday={isToday} togetherSince={settings?.together_since ?? null} />
      </div>

      {isLoading ? (
        <Loading label="Загружаем день…" />
      ) : (
        <div className="flex flex-col gap-3">
          {/* Your day — the one required thing, first and largest. */}
          <section
            className="rounded-2xl bg-surface p-5 shadow-card transition-colors duration-500"
            style={{
              backgroundColor: tint ? `color-mix(in srgb, ${tint} 8%, var(--c-surface))` : undefined,
            }}
          >
            {showEditor ? (
              <>
                <h2 className="text-title-3 font-semibold">Как прошёл день?</h2>
                <p className="mt-1 mb-6 text-subhead text-ink-faint">Единственное, что обязательно. Цветом, без оценок.</p>

                <MoodScale value={mood} onChange={setMood} />

                <div className="mt-6">
                  <label htmlFor="note" className="sr-only">
                    Заметка
                  </label>
                  <Textarea
                    id="note"
                    value={note}
                    onChange={(event) => {
                      setNote(event.target.value);
                      setJustSaved(false);
                    }}
                    rows={3}
                    placeholder="Заметка, по желанию: что случилось, о чём думаете…"
                  />
                </div>

                {!mine && !presence.isLoading && <DayPrompts key={date} date={date} defaultOpen={partnerMarkedToday} />}

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <Button size="lg" block loading={saving} disabled={mood === null || !isDirty} onClick={onSave}>
                    {mine ? 'Сохранить' : 'Отметить день'}
                  </Button>
                  {mine && (
                    <Button
                      variant="ghost"
                      block
                      onClick={() => {
                        setMood(mine.mood);
                        setNote(mine.note ?? '');
                        setEditing(false);
                      }}
                    >
                      Отменить
                    </Button>
                  )}
                </div>
                {mood === null && <p className="mt-3 text-center text-footnote text-ink-faint">Сначала выберите цвет дня</p>}
              </>
            ) : mine ? (
              <div>
                <div className="flex items-center gap-3.5">
                  <span
                    aria-hidden
                    className="size-11 shrink-0 rounded-full shadow-card"
                    style={{ backgroundColor: moodColor(mine.mood) }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-footnote font-medium text-ink-faint">Ваш день</p>
                    <h2 className="text-headline font-semibold first-letter:uppercase">{moodLabel(mine.mood)}</h2>
                  </div>
                  {!isClosed && (
                    <Button
                      variant="secondary"
                      className="!h-9 !rounded-full !px-3.5"
                      onClick={() => {
                        setEditing(true);
                        setJustSaved(false);
                      }}
                    >
                      <Pencil className="size-3.5" aria-hidden /> Изменить
                    </Button>
                  )}
                </div>
                {mine.note ? (
                  <p className="measure mt-3 line-clamp-4 text-body whitespace-pre-wrap text-ink-soft">{mine.note}</p>
                ) : (
                  <p className="mt-3 text-subhead text-ink-faint">Без заметки — только цвет.</p>
                )}
                <span role="status" aria-live="polite">
                  {justSaved && (
                    <span className="mt-2 flex items-center gap-1.5 text-footnote font-medium text-accent-soft-ink">
                      <Check className="size-4" aria-hidden /> Сохранено
                    </span>
                  )}
                </span>
              </div>
            ) : (
              <div>
                <h2 className="text-headline font-semibold">Этот день остался неотмеченным</h2>
                <p className="mt-1 text-subhead text-ink-faint">Задним числом его не заполнить — так и было задумано.</p>
              </div>
            )}

            {error && (
              <div className="mt-4">
                <Alert>{error}</Alert>
              </div>
            )}
          </section>

          <PartnerDayCard
            partner={partner}
            entry={theirs}
            isUnlocked={isUnlocked}
            isToday={isToday}
            showTime={settings?.long_distance}
            justUnsealed={justUnsealed}
            partnerMarked={partnerMarkedToday}
          />

          {isToday && user && (
            <>
              <SectionHeader title="Между вами" />
              <div className="flex flex-col gap-3">
                <DoneForMe tasks={tasks} userId={user.id} partner={partner} myGender={profile?.gender} onAcknowledge={acknowledge} />
                <MyTasks tasks={tasks} userId={user.id} onComplete={complete} />
                <RowGroup label="Письма и просьбы">
                  <LinkRow
                    Icon={Mail}
                    tone={letters > 0 ? 'partner' : 'accent'}
                    title="Письма"
                    sub={lettersSub}
                    href="/letters"
                    badge={letters || undefined}
                  />
                  <LinkRow
                    Icon={ListChecks}
                    title="Попросить о чём-то"
                    sub={asked > 0 ? `${plural(asked, 'просьба ждёт', 'просьбы ждут', 'просьб ждут')}: ${asked}` : 'Без давления, просто чтобы не забыть'}
                    href="/tasks"
                  />
                </RowGroup>
                {taskError && <Alert>{taskError}</Alert>}
              </div>
            </>
          )}

          {(showCycle || showMoon) && <ForYou cycle={showCycle && user ? <CycleRow userId={user.id} /> : null} />}

          {isToday && mine && partner && (
            <Counters
              togetherSince={settings?.together_since ?? null}
              showStreak={settings?.count_streak ?? true}
              current={presence.current}
              best={presence.best}
            />
          )}
        </div>
      )}
    </div>
  );
}

/* Personal rows. Rendered only when there is something to show — the moon is opt-in. */
function ForYou({ cycle }: { cycle: React.ReactNode }) {
  const { showMoon } = useShowMoon();
  if (!cycle && !showMoon) return null;
  return (
    <>
      <SectionHeader title="Для себя" />
      <RowGroup label="Для себя">
        {cycle}
        <MoonRow />
      </RowGroup>
    </>
  );
}
