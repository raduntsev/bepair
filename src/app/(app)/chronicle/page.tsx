'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ImageIcon, Lock, Mail, Mic, Music, Send, Trash2 } from 'lucide-react';
import { fmt, relativeStamp, sentence } from '@/lib/dates';
import { displayName, genitive } from '@/lib/words';
import { usePings, type Ping } from '@/hooks/usePings';
import { letterTime, useLetters, type Letter } from '@/hooks/useLetters';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { LinkButton } from '@/components/ui/Button';
import { Alert, EmptyState, Loading, Page, PageHeader } from '@/components/ui/Blocks';
import { StoredAudio, StoredImage, TrackCard, formatDuration } from '@/components/Media';

type Entry = { kind: 'ping'; at: string; ping: Ping } | { kind: 'letter'; at: string; letter: Letter };

function KindLine({ Icon, label, from, at, theirs }: { Icon: typeof Send; label: string; from: string; at: string; theirs: boolean }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      <span className={`inline-flex items-center gap-1.5 font-medium ${theirs ? 'text-partner-ink' : 'text-accent-soft-ink'}`}>
        <Icon className="size-3.5" aria-hidden /> {label}
      </span>
      <span className="text-ink-faint">
        {from}, {relativeStamp(at)}
      </span>
    </p>
  );
}

export default function ChroniclePage() {
  const { user, partner, settings } = useSpaceAuth();
  const { pings, isLoading: pingsLoading, error: pingError, remove } = usePings();
  const { letters, isLoading: lettersLoading, error: letterError } = useLetters();

  const from = (authorId: string) =>
    authorId === user?.id ? 'от вас' : `от ${partner ? genitive(displayName(partner.display_name), partner.gender) : 'партнёра'}`;

  const groups = useMemo(() => {
    const entries: Entry[] = [
      ...pings.map((ping) => ({ kind: 'ping' as const, at: ping.created_at, ping })),
      ...letters
        .filter((letter) => letter.status === 'delivered' || letter.sealed || letter.delivered_at)
        .map((letter) => ({ kind: 'letter' as const, at: letterTime(letter), letter })),
    ].sort((a, b) => b.at.localeCompare(a.at));

    const byMonth = new Map<string, Entry[]>();
    for (const entry of entries) {
      const key = entry.at.slice(0, 7);
      byMonth.set(key, [...(byMonth.get(key) ?? []), entry]);
    }
    return [...byMonth];
  }, [pings, letters]);

  const isLoading = pingsLoading || lettersLoading;
  const canDelete = settings?.chronicle_deletable ?? false;

  return (
    <Page>
      <PageHeader
        title="Летопись"
        sub="Всё, что вы посылали друг другу. Хранится здесь и не пропадает."
        action={
          <LinkButton href="/ping">
            <Send className="size-4" aria-hidden /> Весточка
          </LinkButton>
        }
      />

      {(pingError || letterError) && (
        <div className="mb-4">
          <Alert>{pingError ?? letterError}</Alert>
        </div>
      )}

      {isLoading ? (
        <Loading label="Загружаем летопись…" />
      ) : groups.length === 0 ? (
        <EmptyState
          title="Летопись пока пуста"
          variant="quiet"
          action={
            <LinkButton href="/ping">
              <Send className="size-4" aria-hidden /> Отправить первую весточку
            </LinkButton>
          }
        >
          Сюда попадает всё, что вы посылали друг другу: весточки, снимки, голос, письма.
        </EmptyState>
      ) : (
        <div className="space-y-8">
          {groups.map(([month, entries]) => (
            <section key={month} aria-label={sentence(fmt(`${month}-01`, 'LLLL yyyy'))}>
              <h2 className="mb-3 text-sm font-medium text-ink-soft">{sentence(fmt(`${month}-01`, 'LLLL yyyy'))}</h2>
              <ul className="space-y-3">
                {entries.map((entry) => {
                  if (entry.kind === 'letter') {
                    const { letter } = entry;
                    const theirs = letter.author_id !== user?.id;
                    return (
                      <li key={`l-${letter.id}`} className="rounded-2xl border border-line bg-surface p-5 shadow-card">
                        <KindLine Icon={Mail} label="Письмо" from={from(letter.author_id)} at={entry.at} theirs={theirs} />
                        {letter.sealed ? (
                          <p className="mt-2 flex items-center gap-2 text-[15px] text-ink-soft">
                            <Lock className="size-4 text-partner" aria-hidden /> Откроется, когда вы отметите свой день
                          </p>
                        ) : (
                          <Link href="/letters" className="mt-2 block text-[15px] font-medium text-ink hover:underline">
                            {letter.title || 'Без темы'}
                          </Link>
                        )}
                      </li>
                    );
                  }

                  const { ping } = entry;
                  const theirs = ping.author_id !== user?.id;
                  const label = ping.photo_path ? 'Весточка со снимком' : ping.voice_path ? 'Голосовая весточка' : ping.track_url ? 'Весточка с музыкой' : 'Весточка';
                  const Icon = ping.photo_path ? ImageIcon : ping.voice_path ? Mic : ping.track_url ? Music : Send;
                  return (
                    <li key={`p-${ping.id}`} className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
                      {ping.photo_path && <StoredImage path={ping.photo_path} alt={ping.body || 'Снимок из весточки'} className="max-h-[28rem] w-full" />}
                      <div className="space-y-3 p-5">
                        <div className="flex items-start justify-between gap-3">
                          <KindLine Icon={Icon} label={label} from={from(ping.author_id)} at={ping.created_at} theirs={theirs} />
                          {canDelete && !theirs && (
                            <button
                              type="button"
                              onClick={() => remove(ping.id)}
                              aria-label="Удалить свою запись"
                              className="tap -mt-3 -mr-3 flex items-center justify-center rounded-lg text-ink-faint hover:bg-sunken hover:text-ink"
                            >
                              <Trash2 className="size-4" aria-hidden />
                            </button>
                          )}
                        </div>
                        {ping.body && <p className="measure text-[15px] leading-relaxed whitespace-pre-wrap">{ping.body}</p>}
                        {ping.voice_path && (
                          <StoredAudio path={ping.voice_path} label={`Голосовое${ping.voice_ms ? `, ${formatDuration(ping.voice_ms)}` : ''}`} />
                        )}
                        {ping.track_url && <TrackCard url={ping.track_url} title={ping.track_title} artist={ping.track_artist} />}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Page>
  );
}
