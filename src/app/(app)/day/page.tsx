'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CalendarHeart, Check, ChevronRight, Droplet, Lock, Mail, Pencil } from 'lucide-react';
import Link from 'next/link';
import { displayName, genitive } from '@/lib/words';
import { promptsFor } from '@/lib/dayPrompts';
import supabase from '@/lib/supabase';
import { moodColor, moodLabel } from '@/lib/mood';
import { fmt, longDate, todayISO } from '@/lib/dates';
import { MoodScale } from '@/components/MoodScale';
import { PartnerDayCard } from '@/components/PartnerDayCard';
import { Counters } from '@/components/Counters';
import { DoneForMe, MyTasks } from '@/components/DayTasks';
import { Button } from '@/components/ui/Button';
import { AutoHeight } from '@/components/ui/AutoHeight';
import { AnimatePresence, motion } from 'framer-motion';
import { Textarea } from '@/components/ui/Field';
import { Alert, Loading, PageHeader, RowGroup, SectionHeader } from '@/components/ui/Blocks';
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

/*
  Cycle day — private, for later analysis, in neutral ink (the spectrum is
  mood's alone). It belongs to the day, so it is marked inside the day editor
  and saved with it by the same button, never on its own.
*/
function useCycleMark(userId: string | null, day: string) {
  const [stored, setStored] = useState<boolean | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    supabase
      .from('cycle_days')
      .select('day')
      .eq('user_id', userId)
      .eq('day', day)
      .maybeSingle()
      .then(({ data }) => alive && setStored(!!data));
    return () => {
      alive = false;
    };
  }, [userId, day]);

  const persist = useCallback(
    async (next: boolean) => {
      if (!userId || stored === null || next === stored) return;
      const { error } = next
        ? await supabase.from('cycle_days').insert({ user_id: userId, day })
        : await supabase.from('cycle_days').delete().eq('user_id', userId).eq('day', day);
      if (!error) setStored(next);
    },
    [userId, day, stored],
  );

  return { stored, persist };
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
  const cycleEnabled = !!user && !!profile?.cycle_tracking && profile?.gender === 'f' && date === todayISO();
  const cycle = useCycleMark(cycleEnabled ? user!.id : null, date);
  const [cycleDraft, setCycleDraft] = useState<boolean | null>(null);
  const cycleValue = cycleDraft ?? cycle.stored ?? false;

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
  const cycleDirty = cycleDraft !== null && cycleDraft !== cycle.stored;
  const isDirty = mine === null ? mood !== null : mood !== mine.mood || note.trim() !== mine.note || cycleDirty;

  const onSave = useCallback(async () => {
    if (mood === null) return;
    const first = mine === null;
    setSaving(true);
    const ok = await save(mood, note.trim());
    if (ok && cycleDirty) await cycle.persist(cycleValue);
    setSaving(false);
    if (ok) {
      setJustSaved(true);
      setEditing(false);
      if (first) setJustUnsealed(true);
      presence.reload();
    }
  }, [mood, note, mine, save, presence, cycleDirty, cycle, cycleValue]);

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
  /* A question from today's set stands in for any instruction about what to write. */
  const notePrompt = promptsFor(date, 1)[0] ?? 'Заметка';
  /* Only for those who turned it on, and only for women — a man's profile never shows it. */
  const showCycle = isToday && !!profile?.cycle_tracking && profile?.gender === 'f' && !!user;

  const letters = waitingLetters.sealed + waitingLetters.unread;
  const thanks = user ? tasks.filter((t) => t.user_id === user.id && taskState(t) === 'done_unseen').length : 0;
  const askedOfMe = user ? tasks.filter((t) => t.user_id !== user.id && taskState(t) === 'awaiting').length : 0;
  const partnerName = displayName(partner?.display_name);

  /*
    One thing is «now» at a time, in this order: your own day, then what waits
    for you, then what you were asked. That block wears the accent ring; nothing
    else on the screen does. The order is the instruction — no captions.
  */
  const focus: 'day' | 'letter' | 'thanks' | 'asked' | null =
    showEditor && !mine ? 'day' : !isToday ? null : letters > 0 ? 'letter' : thanks > 0 ? 'thanks' : askedOfMe > 0 ? 'asked' : null;
  const ring = (key: typeof focus) => (focus === key ? 'focus-ring' : '');
  const between = isToday && !!user && (letters > 0 || thanks > 0 || askedOfMe > 0 || !!taskError);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-6 pb-8 sm:px-6 md:pt-12">
      <PageHeader
        eyebrow={longDate(date)}
        title={isToday ? 'Сегодня' : fmt(date, 'd MMMM')}
        back={isToday ? undefined : { href: '/day', label: 'Сегодня' }}
      />
      <div className="-mt-4 mb-6 empty:hidden">
        <DatesChip date={date} isToday={isToday} togetherSince={settings?.together_since ?? null} />
      </div>

      {isLoading ? (
        <Loading label="Загружаем день…" />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
          className="flex flex-col gap-3"
        >
          {/* Your day — the one required thing, first and largest. */}
          <section
            className={`rounded-2xl bg-surface shadow-card transition-[background-color,box-shadow] duration-500 ${ring('day')}`}
            style={{
              backgroundColor: tint ? `color-mix(in srgb, ${tint} 8%, var(--c-surface))` : undefined,
            }}
          >
            {/* Editor ⇄ summary: the card's height springs, the content cross-fades. */}
            <AutoHeight>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={showEditor ? 'editor' : mine ? 'summary' : 'closed'}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="p-5"
                >
                  {showEditor ? (
                    <>
                      <h2 className="mb-5 text-headline font-semibold">Как прошёл день?</h2>

                      <MoodScale value={mood} onChange={setMood} />

                      <div className="mt-4">
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
                          placeholder={notePrompt}
                        />
                      </div>

                      {showCycle && (
                        <button
                          type="button"
                          aria-pressed={cycleValue}
                          disabled={cycle.stored === null}
                          onClick={() => setCycleDraft(!cycleValue)}
                          className={`mt-3 inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-subhead font-medium transition-colors duration-300 ${
                            cycleValue ? 'bg-ink text-surface' : 'bg-sunken text-ink-soft hover:text-ink'
                          }`}
                        >
                          <Droplet className="size-4" aria-hidden /> День цикла
                        </button>
                      )}

                      {/* The button arrives with the colour: until then there is nothing to confirm. */}
                      <AutoHeight>
                        {(mood !== null || mine) && (
                          <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
                            className="flex gap-3 pt-4"
                          >
                            {mine && (
                              <Button
                                variant="secondary"
                                size="lg"
                                onClick={() => {
                                  setMood(mine.mood);
                                  setNote(mine.note ?? '');
                                  setCycleDraft(null);
                                  setEditing(false);
                                }}
                              >
                                Отмена
                              </Button>
                            )}
                            <Button size="lg" block loading={saving} disabled={mood === null || !isDirty} onClick={onSave}>
                              {mine ? 'Сохранить' : 'Отметить день'}
                            </Button>
                          </motion.div>
                        )}
                      </AutoHeight>
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
                          <p className="text-footnote text-ink-faint">Ваш день</p>
                          <h2 className="flex items-center gap-1.5 text-headline font-semibold">
                            <span className="first-letter:uppercase">{moodLabel(mine.mood)}</span>
                            {showCycle && cycle.stored && <Droplet className="size-4 text-ink-faint" aria-label="День цикла" />}
                          </h2>
                        </div>
                        <span role="status" aria-live="polite" className="contents">
                          {justSaved && <Check className="size-5 text-accent" aria-label="Сохранено" />}
                        </span>
                        {!isClosed && (
                          <Button
                            variant="ghost"
                            aria-label="Изменить"
                            className="!size-10 !rounded-full !px-0"
                            onClick={() => {
                              setEditing(true);
                              setJustSaved(false);
                            }}
                          >
                            <Pencil className="size-4.5" aria-hidden />
                          </Button>
                        )}
                      </div>
                      {mine.note && <p className="measure mt-3 line-clamp-4 text-body whitespace-pre-wrap text-ink-soft">{mine.note}</p>}
                    </div>
                  ) : (
                    <div className="flex items-center gap-3.5 text-ink-faint">
                      <span aria-hidden className="size-11 shrink-0 rounded-full border-2 border-dashed border-line-strong" />
                      <h2 className="text-headline font-semibold">Не отмечен</h2>
                    </div>
                  )}

                  {error && (
                    <div className="mt-4">
                      <Alert>{error}</Alert>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </AutoHeight>
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

          {between && user && (
            <>
              <SectionHeader title="Между вами" />
              <div className="flex flex-col gap-3">
                {letters > 0 && (
                  <Link
                    href="/messages"
                    className={`flex items-center gap-3.5 rounded-2xl bg-surface p-4 shadow-card transition-colors hover:bg-sunken ${ring('letter')}`}
                  >
                    <span aria-hidden className="flex size-10 items-center justify-center rounded-full bg-accent text-accent-ink">
                      {waitingLetters.sealed > 0 ? <Lock className="size-4.5" /> : <Mail className="size-4.5" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-body font-semibold">
                        {letters === 1 ? `Письмо от ${genitive(partnerName, partner?.gender ?? null)}` : `Писем: ${letters}`}
                      </span>
                    </span>
                    <ChevronRight className="size-5 text-line-strong" aria-hidden />
                  </Link>
                )}
                {thanks > 0 && (
                  <div className={`rounded-2xl ${ring('thanks')}`}>
                    <DoneForMe tasks={tasks} userId={user.id} partner={partner} myGender={profile?.gender} onAcknowledge={acknowledge} />
                  </div>
                )}
                {askedOfMe > 0 && (
                  <div className={`rounded-2xl ${ring('asked')}`}>
                    <MyTasks tasks={tasks} userId={user.id} onComplete={complete} />
                  </div>
                )}
                {taskError && <Alert>{taskError}</Alert>}
              </div>
            </>
          )}

          {showMoon && <ForYou />}

          {isToday && mine && partner && (
            <Counters
              togetherSince={settings?.together_since ?? null}
              showStreak={settings?.count_streak ?? true}
              current={presence.current}
              best={presence.best}
            />
          )}
        </motion.div>
      )}
    </div>
  );
}

/* Personal rows. Rendered only when there is something to show — the moon is opt-in. */
function ForYou() {
  const { showMoon } = useShowMoon();
  if (!showMoon) return null;
  return (
    <>
      <SectionHeader title="Для себя" />
      <RowGroup label="Для себя">
        <MoonRow />
      </RowGroup>
    </>
  );
}
