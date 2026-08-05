'use client';

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Clock, FileText, Loader2, Lock, Mail, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { isDelivered, useLetters, type Letter } from '@/hooks/useLetters';
import { todayISO, useCoupleDay } from '@/hooks/useCoupleDay';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';

function StatusChip({ letter }: { letter: Letter }) {
  if (letter.status === 'draft') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-sunken px-2.5 py-1 text-xs font-medium text-ink-soft">
        <FileText className="size-3.5" aria-hidden /> Черновик
      </span>
    );
  }
  if (letter.status === 'scheduled' && !isDelivered(letter)) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent-soft-ink">
        <Clock className="size-3.5" aria-hidden />
        {letter.deliver_at
          ? `Придёт ${format(parseISO(letter.deliver_at), 'd MMMM, HH:mm', { locale: ru })}`
          : 'Отложено'}
      </span>
    );
  }
  return null;
}

export default function LettersPage() {
  const { user } = useSpaceAuth();
  const { letters, isLoading, error, create, cancelScheduled, remove } = useLetters();
  const { partner, isUnlocked } = useCoupleDay(todayISO());

  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [deliverAt, setDeliverAt] = useState('');
  const [revealAfterDay, setRevealAfterDay] = useState(true);
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const reset = () => {
    setTitle('');
    setContent('');
    setDeliverAt('');
    setRevealAfterDay(true);
    setComposing(false);
  };

  const submit = async (status: 'draft' | 'scheduled' | 'delivered') => {
    if (!partner) return;
    setBusy(true);
    const ok = await create({
      recipientId: partner.id,
      title: title.trim() || 'Без темы',
      content,
      status,
      deliverAt: status === 'scheduled' && deliverAt ? new Date(deliverAt).toISOString() : null,
      revealAfterDay,
    });
    setBusy(false);
    if (ok) reset();
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-7 md:px-8 md:py-10">
      <header className="mb-7 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Письма</h1>
          <p className="mt-1 text-sm text-ink-faint">То, что не помещается в заметку дня.</p>
        </div>
        {!composing && (
          <Button onClick={() => setComposing(true)} disabled={!partner}>
            <Plus className="size-4" aria-hidden /> Написать
          </Button>
        )}
      </header>

      {composing && (
        <section className="mb-6 rounded-2xl border border-line bg-surface p-6 shadow-card">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-semibold">Новое письмо</h2>
            <button
              type="button"
              onClick={reset}
              aria-label="Закрыть"
              className="tap flex items-center justify-center rounded-lg text-ink-faint hover:bg-sunken hover:text-ink"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>

          <div className="space-y-4">
            <input
              aria-label="Тема"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Тема"
              className="h-11 w-full rounded-lg border border-line bg-sunken px-3.5 text-base outline-none transition-colors placeholder:text-ink-faint focus:border-accent focus:bg-surface"
            />
            <textarea
              aria-label="Текст письма"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={8}
              placeholder="Пишите столько, сколько хочется."
              className="w-full resize-y rounded-xl border border-line bg-sunken p-3.5 text-[15px] leading-relaxed outline-none transition-colors placeholder:text-ink-faint focus:border-accent focus:bg-surface"
            />

            <div className="space-y-3 rounded-xl bg-sunken p-4">
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={revealAfterDay}
                  onChange={(event) => setRevealAfterDay(event.target.checked)}
                  className="mt-0.5 size-4.5 accent-[var(--c-accent)]"
                />
                <span>
                  Открыть после того, как партнёр отметит свой день
                  <span className="block text-ink-faint">
                    Он увидит, что письмо пришло, но не увидит текст.
                  </span>
                </span>
              </label>

              <label className="block text-sm">
                <span className="mb-1.5 block font-medium">Отправить позже</span>
                <input
                  type="datetime-local"
                  value={deliverAt}
                  onChange={(event) => setDeliverAt(event.target.value)}
                  className="h-11 w-full rounded-lg border border-line bg-surface px-3.5 text-base outline-none focus:border-accent"
                />
                <span className="mt-1.5 block text-ink-faint">
                  Пока письмо не доставлено, отправку можно отменить.
                </span>
              </label>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                loading={busy}
                disabled={!content.trim()}
                onClick={() => submit(deliverAt ? 'scheduled' : 'delivered')}
              >
                {deliverAt ? 'Запланировать' : 'Отправить'}
              </Button>
              <Button variant="secondary" disabled={busy || !content.trim()} onClick={() => submit('draft')}>
                В черновики
              </Button>
            </div>
          </div>
        </section>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 py-16 text-ink-faint">
          <Loader2 className="size-5 animate-spin" aria-hidden />
          <span className="text-sm">Загружаем письма…</span>
        </div>
      ) : letters.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-line-strong bg-surface p-8 text-center">
          <Mail className="mx-auto size-7 text-ink-faint" aria-hidden />
          <h2 className="mt-3 font-semibold">Писем пока нет</h2>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-soft">
            Письмо живёт дольше заметки. Его можно отложить или открыть только после того,
            как партнёр отметит свой день.
          </p>
        </section>
      ) : (
        <ul className="space-y-3">
          {letters.map((letter) => {
            const mine = letter.author_id === user?.id;
            const delivered = isDelivered(letter);
            const hidden = !mine && letter.reveal_after_day && !isUnlocked;
            const open = openId === letter.id;

            /* Draft belongs to its author alone. */
            if (!mine && letter.status === 'draft') return null;

            return (
              <li
                key={letter.id}
                className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 p-5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold">{hidden ? 'Письмо ждёт вас' : letter.title}</h2>
                      <StatusChip letter={letter} />
                    </div>
                    <p className="mt-1 text-sm text-ink-faint">
                      {mine ? 'от вас' : `от ${partner?.display_name ?? 'партнёра'}`} ·{' '}
                      {format(parseISO(letter.created_at), 'd MMMM', { locale: ru })}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    {letter.status === 'scheduled' && !delivered && mine && (
                      <Button variant="secondary" onClick={() => cancelScheduled(letter.id)}>
                        Отменить отправку
                      </Button>
                    )}
                    {letter.status === 'draft' && mine && (
                      <Button variant="ghost" onClick={() => remove(letter.id)}>
                        Удалить
                      </Button>
                    )}
                    {!hidden && (
                      <Button variant="secondary" onClick={() => setOpenId(open ? null : letter.id)}>
                        {open ? 'Свернуть' : 'Читать'}
                      </Button>
                    )}
                  </div>
                </div>

                {hidden && (
                  <div className="flex items-start gap-3 border-t border-line bg-partner-soft px-5 py-4">
                    <Lock className="mt-0.5 size-4.5 shrink-0 text-partner" aria-hidden />
                    <p className="text-sm text-ink-soft">
                      Откроется, когда вы отметите свой день. Письмо — награда, а не повод.
                    </p>
                  </div>
                )}

                {open && !hidden && (
                  <p className="whitespace-pre-wrap border-t border-line px-5 py-5 text-[15px] leading-relaxed">
                    {letter.content}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}
    </div>
  );
}
