'use client';

import { Lock } from 'lucide-react';
import { moodColor, moodLabel } from '@/lib/mood';
import type { DayEntry, Partner } from '@/hooks/useCoupleDay';

interface PartnerDayCardProps {
  partner: Partner | null;
  entry: DayEntry | null;
  isUnlocked: boolean;
}

export function PartnerDayCard({ partner, entry, isUnlocked }: PartnerDayCardProps) {
  const name = partner?.display_name ?? 'Партнёр';

  if (!partner) {
    return (
      <section className="rounded-2xl border border-dashed border-line-strong bg-surface p-6">
        <h2 className="font-semibold">Пока вы здесь один</h2>
        <p className="mt-1.5 text-sm text-ink-soft">
          Отправьте партнёру код приглашения из настроек — тогда этот блок оживёт.
        </p>
      </section>
    );
  }

  /*
    Sealed, not broken: the lock is the product working. Copy and colour say
    "waiting for you", never "unavailable" or "error".
  */
  if (!isUnlocked) {
    return (
      <section className="rounded-2xl border border-line bg-partner-soft p-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-surface text-partner shadow-card">
            <Lock className="size-4.5" aria-hidden />
          </span>
          <div>
            <h2 className="font-semibold">День {name} закрыт</h2>
            <p className="mt-1.5 text-sm text-ink-soft">
              Он откроется, как только вы отметите свой. Так вы оба говорите первыми.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (!entry) {
    return (
      <section className="rounded-2xl border border-line bg-surface p-6 shadow-card">
        <h2 className="font-semibold">{name} ещё не отмечал день</h2>
        <p className="mt-1.5 text-sm text-ink-soft">
          Вы узнаете об этом — приходить и проверять не нужно.
        </p>
      </section>
    );
  }

  const color = moodColor(entry.mood);

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <div className="flex items-center gap-3 p-6 pb-4">
        <span
          className="size-11 shrink-0 rounded-full border-2 border-surface shadow-card"
          style={{ backgroundColor: color }}
          aria-hidden
        />
        <div>
          <h2 className="font-semibold">День {name}</h2>
          <p className="text-sm text-ink-soft">{moodLabel(entry.mood)}</p>
        </div>
      </div>

      {entry.note ? (
        <p className="whitespace-pre-wrap px-6 pb-6 text-[15px] leading-relaxed text-ink-soft">
          {entry.note}
        </p>
      ) : (
        <p className="px-6 pb-6 text-sm text-ink-faint">Без заметки — только цвет.</p>
      )}
    </section>
  );
}
