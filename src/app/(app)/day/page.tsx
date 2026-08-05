'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Check, Loader2 } from 'lucide-react';
import { MoodScale } from '@/components/MoodScale';
import { PartnerDayCard } from '@/components/PartnerDayCard';
import { Button } from '@/components/ui/Button';
import { todayISO, useCoupleDay } from '@/hooks/useCoupleDay';

export default function DayPage() {
  return (
    <Suspense fallback={null}>
      <DayView />
    </Suspense>
  );
}

function DayView() {
  const params = useSearchParams();
  const date = params.get('d') ?? todayISO();

  const { partner, mine, theirs, isLoading, error, save, isUnlocked, isToday } = useCoupleDay(date);

  const [mood, setMood] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    setMood(mine ? mine.mood : null);
    setNote(mine?.note ?? '');
    setJustSaved(false);
  }, [mine, date]);

  /*
    A past day is closed whether or not it was filled in. Offering a live editor
    for an unmarked past date let a user backdate an entry and unseal the
    partner's day for it.
  */
  const isClosed = !isToday;
  const isDirty = mine === null ? mood !== null : mood !== mine.mood || note !== mine.note;

  const heading = isToday
    ? 'Сегодня'
    : format(parseISO(date), 'd MMMM', { locale: ru });

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-7 md:px-8 md:py-10">
      <header className="mb-7">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{heading}</h1>
        <p className="mt-1 text-sm capitalize text-ink-faint">
          {format(parseISO(date), 'EEEE, d MMMM yyyy', { locale: ru })}
        </p>
      </header>

      {isLoading ? (
        <div className="flex items-center gap-2 py-16 text-ink-faint">
          <Loader2 className="size-5 animate-spin" aria-hidden />
          <span className="text-sm">Загружаем день…</span>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8">
          <div className="space-y-6">
            <section className="rounded-2xl border border-line bg-surface p-6 shadow-card md:p-8">
              <h2 className="text-lg font-semibold">Как прошёл день</h2>
              <p className="mt-1.5 mb-7 text-sm text-ink-soft">
                {!isClosed
                  ? 'Единственное, что обязательно. Цветом, без оценок.'
                  : mine
                    ? 'Этот день уже закрыт — так и было задумано.'
                    : 'Этот день остался неотмеченным. Задним числом его не заполнить.'}
              </p>

              <MoodScale value={mood} onChange={setMood} disabled={isClosed} />

              <div className="mt-8">
                <label htmlFor="note" className="mb-2 block text-sm font-medium">
                  Заметка
                  <span className="ml-2 font-normal text-ink-faint">по желанию</span>
                </label>
                <textarea
                  id="note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  disabled={isClosed}
                  rows={5}
                  placeholder="Что случилось, о чём думаете, чего хотелось бы завтра…"
                  className="w-full resize-y rounded-xl border border-line bg-sunken p-3.5 text-[15px] leading-relaxed outline-none transition-colors placeholder:text-ink-faint focus:border-accent focus:bg-surface disabled:text-ink-soft"
                />
              </div>

              {!isClosed && (
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Button
                    size="lg"
                    loading={saving}
                    disabled={mood === null || !isDirty}
                    onClick={async () => {
                      if (mood === null) return;
                      setSaving(true);
                      const ok = await save(mood, note.trim());
                      setSaving(false);
                      if (ok) setJustSaved(true);
                    }}
                  >
                    {mine ? 'Сохранить' : 'Отметить день'}
                  </Button>

                  {mood === null && (
                    <span className="text-sm text-ink-faint">Сначала выберите цвет дня</span>
                  )}
                  <span role="status" aria-live="polite">
                    {justSaved && !isDirty && (
                      <span className="flex items-center gap-1.5 text-sm font-medium text-accent">
                        <Check className="size-4" aria-hidden /> Сохранено
                      </span>
                    )}
                  </span>
                </div>
              )}

              {error && (
                <p role="alert" className="mt-4 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
                  {error}
                </p>
              )}
            </section>
          </div>

          <aside className="lg:sticky lg:top-8 lg:self-start">
            <PartnerDayCard partner={partner} entry={theirs} isUnlocked={isUnlocked} />
          </aside>
        </div>
      )}
    </div>
  );
}
