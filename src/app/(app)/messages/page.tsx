'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Clock, FileText, ImageIcon, Lock, Mail, Mic, Music, Paperclip, PenLine, Send, Trash2 } from 'lucide-react';
import { fmt, relativeStamp, sentence } from '@/lib/dates';
import { displayName } from '@/lib/words';
import { usePings, type Ping } from '@/hooks/usePings';
import { isDelivered, letterTime, useLetters, type Letter } from '@/hooks/useLetters';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { Button, LinkButton } from '@/components/ui/Button';
import { Alert, EmptyState, Loading, Page, PageHeader } from '@/components/ui/Blocks';
import { AutoHeight } from '@/components/ui/AutoHeight';
import { LetterComposer } from '@/components/LetterComposer';
import { StoredAudio, StoredImage, StoredMedia, TrackCard, formatDuration } from '@/components/Media';

/*
  «Переписка» — everything the two of you sent each other, in one feed:
  short notes (весточки) and letters alike. What waits for you sits on top,
  lit; the rest is the shared history, newest first, by month.
*/

type Entry = { kind: 'ping'; at: string; ping: Ping } | { kind: 'letter'; at: string; letter: Letter };

const EASE = [0.32, 0.72, 0, 1] as const;

/* Safe month heading: one odd timestamp must never take the whole screen down. */
function monthTitle(key: string) {
  try {
    return sentence(fmt(`${key}-01`, 'LLLL yyyy'));
  } catch {
    return '';
  }
}

function safeStamp(at: string) {
  try {
    return relativeStamp(at);
  } catch {
    return '';
  }
}

function Meta({ Icon, from, at, theirs }: { Icon: typeof Send; from: string; at: string; theirs: boolean }) {
  return (
    <p className="flex items-center gap-1.5 text-footnote text-ink-faint">
      <span
        aria-hidden
        className={`flex size-5 items-center justify-center rounded-full ${theirs ? 'bg-partner-soft text-partner-ink' : 'bg-accent-soft text-accent-soft-ink'}`}
      >
        <Icon className="size-3" />
      </span>
      {from} · {safeStamp(at)}
    </p>
  );
}

export default function MessagesPage() {
  const { user, partner, settings } = useSpaceAuth();
  const { pings, isLoading: pingsLoading, error: pingError, remove: removePing } = usePings();
  const { letters, isLoading: lettersLoading, error: letterError, save, cancelScheduled, remove, markRead } = useLetters();
  const [composing, setComposing] = useState<Letter | 'new' | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const from = (authorId: string) =>
    authorId === user?.id ? 'Вы' : displayName(partner?.display_name);
  const canDelete = settings?.chronicle_deletable ?? false;

  const { waiting, groups } = useMemo(() => {
    const isWaiting = (l: Letter) => l.author_id !== user?.id && (l.sealed || (isDelivered(l) && !l.is_read));
    const entries: Entry[] = [
      ...pings.map((ping) => ({ kind: 'ping' as const, at: ping.created_at, ping })),
      ...letters
        .filter((l) => !isWaiting(l))
        .filter((l) => l.author_id === user?.id || isDelivered(l))
        .map((letter) => ({ kind: 'letter' as const, at: letterTime(letter), letter })),
    ]
      .filter((e) => typeof e.at === 'string' && e.at.length >= 7)
      .sort((a, b) => b.at.localeCompare(a.at));

    const byMonth = new Map<string, Entry[]>();
    for (const entry of entries) {
      const key = entry.at.slice(0, 7);
      byMonth.set(key, [...(byMonth.get(key) ?? []), entry]);
    }
    return { waiting: letters.filter(isWaiting), groups: [...byMonth] };
  }, [pings, letters, user?.id]);

  const isLoading = pingsLoading || lettersLoading;
  const empty = groups.length === 0 && waiting.length === 0;

  const letterCard = (letter: Letter, lit = false) => {
    const mine = letter.author_id === user?.id;
    const delivered = isDelivered(letter);
    const open = openId === letter.id;
    const unread = !mine && delivered && !letter.sealed && !letter.is_read;

    return (
      <li
        key={`l-${letter.id}`}
        className={`overflow-hidden rounded-2xl bg-surface shadow-card transition-shadow duration-500 ${lit ? 'ring-2 ring-accent' : ''}`}
      >
        <button
          type="button"
          disabled={letter.sealed || letter.status === 'draft'}
          onClick={() => {
            setOpenId(open ? null : letter.id);
            if (!open && unread) markRead(letter.id);
          }}
          className="flex w-full items-center gap-3.5 p-4 text-left enabled:hover:bg-sunken/60"
        >
          <span
            aria-hidden
            className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
              letter.sealed ? 'bg-sunken text-ink-faint' : lit ? 'bg-accent text-accent-ink' : 'bg-sunken text-ink-soft'
            }`}
          >
            {letter.sealed ? <Lock className="size-4.5" /> : letter.status === 'draft' ? <FileText className="size-4.5" /> : <Mail className="size-4.5" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-body font-semibold">{letter.sealed ? 'Письмо' : letter.title || 'Без темы'}</span>
            <span className="flex items-center gap-1.5 text-footnote text-ink-faint">
              {letter.status === 'draft' ? (
                'Черновик'
              ) : letter.status === 'scheduled' && !delivered ? (
                <>
                  <Clock className="size-3.5" aria-hidden />
                  {letter.deliver_at ? fmt(letter.deliver_at, 'd MMMM, HH:mm') : ''}
                </>
              ) : (
                <>
                  {from(letter.author_id)} · {safeStamp(letterTime(letter))}
                  {letter.media.length > 0 && !letter.sealed && (
                    <>
                      {' '}
                      · <Paperclip className="size-3.5" aria-hidden /> {letter.media.length}
                    </>
                  )}
                </>
              )}
            </span>
          </span>
          {unread && <span aria-label="Новое" className="size-2.5 shrink-0 rounded-full bg-accent" />}
        </button>

        {(letter.status === 'draft' || (letter.status === 'scheduled' && !delivered)) && mine && (
          <div className="flex gap-2 px-4 pb-4">
            {letter.status === 'draft' ? (
              <>
                <Button variant="secondary" onClick={() => setComposing(letter)}>
                  <PenLine className="size-4" aria-hidden /> Продолжить
                </Button>
                <Button variant="ghost" onClick={() => remove(letter.id)} aria-label="Удалить черновик">
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </>
            ) : (
              <Button variant="secondary" onClick={() => cancelScheduled(letter.id)}>
                Отменить отправку
              </Button>
            )}
          </div>
        )}

        <AnimatePresence initial={false}>
          {open && !letter.sealed && (
            <motion.div
              key="body"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.45, ease: EASE }}
              className="overflow-hidden"
            >
              <div className="space-y-4 border-t border-line px-4 py-4">
                {letter.content && <p className="measure text-body whitespace-pre-wrap">{letter.content}</p>}
                {letter.media.map((item) => (
                  <StoredMedia key={item.path} item={item} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </li>
    );
  };

  const pingCard = (ping: Ping) => {
    const theirs = ping.author_id !== user?.id;
    const Icon = ping.photo_path ? ImageIcon : ping.voice_path ? Mic : ping.track_url ? Music : Send;
    return (
      <li key={`p-${ping.id}`} className="overflow-hidden rounded-2xl bg-surface shadow-card">
        {ping.photo_path && <StoredImage path={ping.photo_path} alt={ping.body || 'Снимок'} className="max-h-[28rem] w-full" />}
        <div className="space-y-2.5 p-4">
          <div className="flex items-center justify-between gap-3">
            <Meta Icon={Icon} from={from(ping.author_id)} at={ping.created_at} theirs={theirs} />
            {canDelete && !theirs && (
              <button
                type="button"
                onClick={() => removePing(ping.id)}
                aria-label="Удалить"
                className="tap -my-3 -mr-3 flex items-center justify-center rounded-lg text-ink-faint hover:text-ink"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            )}
          </div>
          {ping.body && <p className="measure text-body whitespace-pre-wrap">{ping.body}</p>}
          {ping.voice_path && <StoredAudio path={ping.voice_path} label={`Голосовое${ping.voice_ms ? `, ${formatDuration(ping.voice_ms)}` : ''}`} />}
          {ping.track_url && <TrackCard url={ping.track_url} title={ping.track_title} artist={ping.track_artist} />}
        </div>
      </li>
    );
  };

  return (
    <Page>
      <PageHeader title="Переписка" />

      {/* Two ways to write, side by side. The note is the everyday one, so it leads. */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        <LinkButton href="/ping" size="lg" className={!partner ? 'pointer-events-none opacity-40' : ''}>
          <Send className="size-5" aria-hidden /> Весточка
        </LinkButton>
        <Button size="lg" variant="secondary" disabled={!partner} onClick={() => setComposing('new')}>
          <Mail className="size-5" aria-hidden /> Письмо
        </Button>
      </div>

      <AutoHeight>
        <AnimatePresence initial={false}>
          {composing && (
            <motion.div
              key={composing === 'new' ? 'new' : composing.id}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: EASE }}
            >
              <LetterComposer initial={composing === 'new' ? null : composing} onClose={() => setComposing(null)} onSave={save} />
            </motion.div>
          )}
        </AnimatePresence>
      </AutoHeight>

      {(pingError || letterError) && (
        <div className="mb-4">
          <Alert>{pingError ?? letterError}</Alert>
        </div>
      )}

      {isLoading ? (
        <Loading label="Загружаем переписку…" />
      ) : empty ? (
        <EmptyState title="Пока пусто" variant="quiet" />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="space-y-7"
        >
          {waiting.length > 0 && (
            <section aria-label="Ждёт вас">
              <ul className="space-y-3">{waiting.map((l) => letterCard(l, true))}</ul>
            </section>
          )}

          {groups.map(([month, entries]) => (
            <section key={month} aria-label={monthTitle(month)}>
              <h2 className="mb-2.5 px-1 text-subhead font-semibold text-ink-faint">{monthTitle(month)}</h2>
              <ul className="space-y-3">{entries.map((e) => (e.kind === 'letter' ? letterCard(e.letter) : pingCard(e.ping)))}</ul>
            </section>
          ))}
        </motion.div>
      )}
    </Page>
  );
}
