'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowUp, Clock, FileText, Lock, Mail, Plus, Search, Trash2, X } from 'lucide-react';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { fmt } from '@/lib/dates';
import { usePings, type Ping } from '@/hooks/usePings';
import { isDelivered, letterTime, useLetters, type Letter } from '@/hooks/useLetters';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { Alert, EmptyState, Loading } from '@/components/ui/Blocks';
import { Segment } from '@/components/ui/Controls';
import { StoredAudio, StoredImage, TrackCard, formatDuration } from '@/components/Media';

/*
  «Переписка» is a chat: your messages on the right, your partner's on the
  left, oldest at the top, newest by the input. Notes (весточки) are bubbles;
  a letter is a card in the stream that opens on its own screen. Filters show
  only media or only letters; search reads note and letter text.
*/

type Item = { kind: 'ping'; at: string; ping: Ping } | { kind: 'letter'; at: string; letter: Letter };
type Filter = 'all' | 'media' | 'letters';

const EASE = [0.32, 0.72, 0, 1] as const;

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function dayLabel(iso: string) {
  return safe(() => {
    const d = parseISO(iso);
    const diff = differenceInCalendarDays(new Date(), d);
    if (diff === 0) return 'Сегодня';
    if (diff === 1) return 'Вчера';
    return fmt(iso, diff < 300 ? 'd MMMM' : 'd MMMM yyyy');
  }, '');
}

const time = (iso: string) => safe(() => fmt(iso, 'HH:mm'), '');

function LetterBubble({ letter, mine, onRemove }: { letter: Letter; mine: boolean; onRemove?: () => void }) {
  const delivered = isDelivered(letter);
  const unread = !mine && delivered && !letter.sealed && !letter.is_read;
  const Icon = letter.sealed ? Lock : letter.status === 'draft' ? FileText : Mail;
  const meta =
    letter.status === 'draft'
      ? 'Черновик'
      : letter.status === 'scheduled' && !delivered
        ? letter.deliver_at
          ? fmt(letter.deliver_at, 'd MMMM, HH:mm')
          : ''
        : time(letterTime(letter));

  const body = (
    <span
      className={`flex w-64 max-w-full items-center gap-3 rounded-[1.25rem] p-3 shadow-card transition-shadow duration-500 ${
        mine ? 'bg-accent text-accent-ink' : 'bg-surface text-ink'
      } ${unread || (letter.sealed && !mine) ? 'focus-ring' : ''}`}
    >
      <span
        aria-hidden
        className={`flex size-10 shrink-0 items-center justify-center rounded-full ${mine ? 'bg-white/20' : 'bg-sunken text-ink-soft'}`}
      >
        <Icon className="size-4.5" />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-body font-semibold">{letter.sealed ? 'Письмо' : letter.title || 'Без темы'}</span>
        <span className={`flex items-center gap-1 text-footnote ${mine ? 'text-white/75' : 'text-ink-faint'}`}>
          {letter.status === 'scheduled' && !delivered && <Clock className="size-3.5" aria-hidden />}
          {meta}
        </span>
      </span>
    </span>
  );

  return (
    <div className={`flex items-center gap-2 ${mine ? 'justify-end' : 'justify-start'}`}>
      {letter.status === 'draft' && onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Удалить черновик"
          className="flex size-9 items-center justify-center rounded-full text-ink-faint hover:bg-sunken hover:text-ink"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      )}
      {letter.sealed ? (
        <span aria-label="Откроется, когда вы отметите свой день">{body}</span>
      ) : (
        <Link href={`/messages/letter?id=${letter.id}`} className="max-w-[85%] rounded-[1.25rem] transition-opacity active:opacity-70">
          {body}
        </Link>
      )}
    </div>
  );
}

function PingBubble({ ping, mine }: { ping: Ping; mine: boolean }) {
  const onlyPhoto = ping.photo_path && !ping.body && !ping.voice_path && !ping.track_url;
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] overflow-hidden rounded-[1.25rem] shadow-card ${
          mine ? 'rounded-br-md bg-accent text-accent-ink' : 'rounded-bl-md bg-surface text-ink'
        }`}
      >
        {ping.photo_path && <StoredImage path={ping.photo_path} alt={ping.body || 'Снимок'} className="max-h-80 w-full min-w-48" />}
        {!onlyPhoto && (
          <div className="space-y-2 px-3.5 py-2">
            {ping.body && <p className="text-body whitespace-pre-wrap">{ping.body}</p>}
            {ping.voice_path && (
              <StoredAudio path={ping.voice_path} label={`Голосовое${ping.voice_ms ? `, ${formatDuration(ping.voice_ms)}` : ''}`} />
            )}
            {ping.track_url && <TrackCard url={ping.track_url} title={ping.track_title} artist={ping.track_artist} />}
          </div>
        )}
        <p className={`px-3.5 pb-1.5 text-right text-footnote ${mine ? 'text-white/70' : 'text-ink-faint'} ${onlyPhoto ? 'pt-1.5' : ''}`}>
          {time(ping.created_at)}
        </p>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  const { user, partner } = useSpaceAuth();
  const { pings, isLoading: pingsLoading, error: pingError, send } = usePings();
  const { letters, isLoading: lettersLoading, error: letterError, remove } = useLetters();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const isLoading = pingsLoading || lettersLoading;
  const q = query.trim().toLowerCase();

  const items = useMemo(() => {
    const visibleLetters = letters.filter((l) => l.author_id === user?.id || isDelivered(l));
    const all: Item[] = [
      ...pings.map((ping) => ({ kind: 'ping' as const, at: ping.created_at, ping })),
      ...visibleLetters.map((letter) => ({ kind: 'letter' as const, at: letterTime(letter), letter })),
    ].filter((i) => typeof i.at === 'string' && i.at.length >= 10);

    return all
      .filter((i) => {
        if (filter === 'letters') return i.kind === 'letter';
        if (filter === 'media') return i.kind === 'ping' && !!(i.ping.photo_path || i.ping.voice_path || i.ping.track_url);
        return !(i.kind === 'letter' && i.letter.status === 'draft');
      })
      .filter((i) => {
        if (!q) return true;
        if (i.kind === 'ping') return `${i.ping.body} ${i.ping.track_title ?? ''} ${i.ping.track_artist ?? ''}`.toLowerCase().includes(q);
        return !i.letter.sealed && `${i.letter.title} ${i.letter.content ?? ''}`.toLowerCase().includes(q);
      })
      .sort((a, b) => a.at.localeCompare(b.at));
  }, [pings, letters, user?.id, filter, q]);

  const photos = useMemo(
    () => (filter === 'media' ? items.filter((i): i is Extract<Item, { kind: 'ping' }> => i.kind === 'ping' && !!i.ping.photo_path) : []),
    [items, filter],
  );
  const otherMedia = filter === 'media' ? items.filter((i) => i.kind === 'ping' && !i.ping.photo_path) : [];

  /* Land at the newest message, as a chat does. */
  const count = items.length;
  useEffect(() => {
    if (isLoading || filter !== 'all' || q) return;
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [isLoading, count, filter, q]);

  const sendText = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    const ok = await send({ body, photo: null, voice: null, track: null });
    setSending(false);
    if (ok) setText('');
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-6 sm:px-6 md:pt-12" style={{ paddingBottom: '5rem' }}>
      <header className="mb-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-large-title font-bold">Переписка</h1>
          <button
            type="button"
            onClick={() => {
              setSearching((v) => !v);
              setQuery('');
            }}
            aria-label={searching ? 'Закрыть поиск' : 'Поиск'}
            aria-pressed={searching}
            className="flex size-10 items-center justify-center rounded-full bg-sunken text-ink-soft transition-colors hover:text-ink"
          >
            {searching ? <X className="size-5" aria-hidden /> : <Search className="size-5" aria-hidden />}
          </button>
        </div>

        <motion.div
          initial={false}
          animate={{ height: searching ? 'auto' : 0, opacity: searching ? 1 : 0 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="overflow-hidden"
        >
          <label className="mt-3 flex h-11 items-center gap-2 rounded-xl bg-sunken px-3.5 text-ink-faint">
            <Search className="size-4.5 shrink-0" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск"
              aria-label="Поиск по переписке"
              tabIndex={searching ? 0 : -1}
              className="h-full min-w-0 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-ink-faint"
            />
          </label>
        </motion.div>

        <div className="mt-3">
          <Segment
            legend="Показать"
            options={[
              { value: 'all' as const, label: 'Все' },
              { value: 'media' as const, label: 'Медиа' },
              { value: 'letters' as const, label: 'Письма' },
            ]}
            value={filter}
            onChange={setFilter}
          />
        </div>
      </header>

      {(pingError || letterError) && (
        <div className="mb-4">
          <Alert>{pingError ?? letterError}</Alert>
        </div>
      )}

      {isLoading ? (
        <Loading label="Загружаем переписку…" />
      ) : items.length === 0 ? (
        <EmptyState title={q ? 'Ничего не нашлось' : 'Пока пусто'} variant="quiet" />
      ) : filter === 'media' ? (
        <div className="space-y-4">
          {photos.length > 0 && (
            <ul className="grid grid-cols-3 gap-1 overflow-hidden rounded-2xl">
              {photos.map(({ ping }) => (
                <li key={ping.id} className="aspect-square overflow-hidden bg-sunken">
                  <StoredImage path={ping.photo_path!} alt={ping.body || 'Снимок'} className="size-full object-cover" />
                </li>
              ))}
            </ul>
          )}
          <div className="space-y-2">
            {otherMedia.map((i) => i.kind === 'ping' && <PingBubble key={i.ping.id} ping={i.ping} mine={i.ping.author_id === user?.id} />)}
          </div>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, ease: EASE }} className="space-y-2">
          {items.map((i, index) => {
            const day = dayLabel(i.at);
            const separator = index === 0 || dayLabel(items[index - 1].at) !== day ? day : null;
            const mine = (i.kind === 'ping' ? i.ping.author_id : i.letter.author_id) === user?.id;
            return (
              <div key={i.kind === 'ping' ? `p-${i.ping.id}` : `l-${i.letter.id}`}>
                {separator && <p className="pt-4 pb-2 text-center text-footnote font-medium text-ink-faint">{separator}</p>}
                {i.kind === 'ping' ? (
                  <PingBubble ping={i.ping} mine={mine} />
                ) : (
                  <LetterBubble letter={i.letter} mine={mine} onRemove={mine ? () => remove(i.letter.id) : undefined} />
                )}
              </div>
            );
          })}
        </motion.div>
      )}
      <div ref={bottomRef} />

      {/* Input bar: a note in one line, sitting just above the island. */}
      <form
        data-tour="messages-input"
        onSubmit={(e) => {
          e.preventDefault();
          sendText();
        }}
        className="fixed inset-x-0 z-40 flex justify-center px-3"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 4.5rem)' }}
      >
        <div className="material flex w-full max-w-2xl items-center gap-2 rounded-full p-1.5 shadow-lift">
          <Link
            href="/ping"
            aria-label="Весточка со снимком, голосом или музыкой"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-soft transition-colors hover:text-ink"
          >
            <Plus className="size-5" aria-hidden />
          </Link>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Весточка"
            aria-label="Текст весточки"
            disabled={!partner}
            className="h-10 min-w-0 flex-1 bg-transparent px-1 text-body text-ink outline-none placeholder:text-ink-faint"
          />
          {text.trim() ? (
            <button
              type="submit"
              aria-label="Отправить"
              disabled={sending}
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink transition-opacity disabled:opacity-50"
            >
              <ArrowUp className="size-5" strokeWidth={2.4} aria-hidden />
            </button>
          ) : (
            <Link
              href="/messages/letter"
              aria-label="Написать письмо"
              data-tour="messages-letter"
              className={`flex size-10 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-soft transition-colors hover:text-ink ${
                !partner ? 'pointer-events-none opacity-40' : ''
              }`}
            >
              <Mail className="size-5" aria-hidden />
            </Link>
          )}
        </div>
      </form>
    </div>
  );
}
