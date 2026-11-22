'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { BookOpen, ImageIcon, Music, Send, Trash2, X } from 'lucide-react';
import { usePings, type PingDraft } from '@/hooks/usePings';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { Button, LinkButton } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Blocks';
import { formatDuration, TrackCard, VoiceRecorder } from '@/components/Media';
import { tr } from '@/lib/i18n';

const EMPTY: PingDraft = { body: '', photo: null, voice: null, track: null };

export default function PingPage() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const { partner } = useSpaceAuth();
  const { send, error } = usePings();
  const [draft, setDraft] = useState<PingDraft>(EMPTY);
  const [trackOpen, setTrackOpen] = useState(false);
  const [track, setTrack] = useState({ url: '', title: '', artist: '' });
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const photoUrl = useMemo(() => (draft.photo ? URL.createObjectURL(draft.photo) : null), [draft.photo]);
  const voiceUrl = useMemo(() => (draft.voice ? URL.createObjectURL(draft.voice.blob) : null), [draft.voice]);
  useEffect(
    () => () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
      if (voiceUrl) URL.revokeObjectURL(voiceUrl);
    },
    [photoUrl, voiceUrl],
  );

  const trackValid = /^https?:\/\/\S+\.\S+/.test(track.url.trim());
  const hasContent = draft.body.trim() || draft.photo || draft.voice || draft.track;

  const close = () => (window.history.length > 1 ? router.back() : router.push('/messages'));

  if (sent) {
    return (
      <div className="mx-auto w-full max-w-xl px-4 pt-6 sm:px-6 md:pt-12">
        <motion.section
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center gap-3 rounded-2xl bg-surface px-6 py-10 text-center shadow-card"
        >
          <motion.span
            initial={reduce ? false : { x: -24, y: 16, opacity: 0 }}
            animate={{ x: 0, y: 0, opacity: 1 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="flex size-14 items-center justify-center rounded-full bg-accent-soft text-accent-soft-ink"
          >
            <Send className="size-6" aria-hidden />
          </motion.span>
          <h1 role="status" className="text-lg font-semibold">
            {tr('Весточка ушла', 'Note sent')}
          </h1>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <LinkButton href="/messages" variant="secondary">
              <BookOpen className="size-4" aria-hidden /> {tr('В переписку', 'To messages')}
            </LinkButton>
            <Button
              variant="ghost"
              onClick={() => {
                setDraft(EMPTY);
                setTrack({ url: '', title: '', artist: '' });
                setTrackOpen(false);
                setSent(false);
              }}
            >
              {tr('Ещё одну', 'Another one')}
            </Button>
          </div>
        </motion.section>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 pt-6 sm:px-6 md:pt-12">
      <header className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-large-title font-bold">{tr('Весточка', 'Note')}</h1>
        <button
          type="button"
          onClick={close}
          aria-label={tr('Закрыть', 'Close')}
          className="tap flex items-center justify-center rounded-lg text-ink-faint hover:bg-sunken hover:text-ink"
        >
          <X className="size-5" aria-hidden />
        </button>
      </header>

      {!partner && (
        <div className="mb-4">
          <Alert>{tr('Партнёр ещё не присоединился — весточка сохранится в летописи и дождётся его.', 'Your partner hasn’t joined yet — the note will wait for them.')}</Alert>
        </div>
      )}

      <div className="space-y-4">
        <Textarea
          aria-label={tr('Текст весточки', 'Note text')}
          rows={4}
          autoFocus
          value={draft.body}
          onChange={(event) => setDraft({ ...draft, body: event.target.value })}
          placeholder={tr('Напишите что угодно…', 'Write anything…')}
        />

        {photoUrl && (
          <div className="relative overflow-hidden rounded-2xl bg-sunken">
            {/* eslint-disable-next-line @next/next/no-img-element -- local preview of a picked file */}
            <img src={photoUrl} alt={tr('Выбранный снимок', 'Chosen photo')} className="max-h-80 w-full object-cover" />
            <button
              type="button"
              onClick={() => setDraft({ ...draft, photo: null })}
              aria-label={tr('Убрать снимок', 'Remove photo')}
              className="tap absolute top-2 right-2 flex items-center justify-center rounded-full bg-surface/90 text-ink shadow-card"
            >
              <X className="size-4.5" aria-hidden />
            </button>
          </div>
        )}

        {draft.voice && voiceUrl && (
          <div className="flex items-center gap-2 rounded-xl bg-sunken py-2 pr-2 pl-3.5">
            <audio src={voiceUrl} controls className="h-10 min-w-0 flex-1" aria-label={tr('Записанное голосовое', 'Recorded voice note')} />
            <span className="text-xs text-ink-faint tabular-nums">{formatDuration(draft.voice.ms)}</span>
            <button
              type="button"
              onClick={() => setDraft({ ...draft, voice: null })}
              aria-label={tr('Убрать голосовое', 'Remove voice note')}
              className="tap flex items-center justify-center rounded-lg text-ink-faint hover:bg-surface hover:text-ink"
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          </div>
        )}

        {draft.track && (
          <TrackCard url={draft.track.url} title={draft.track.title} artist={draft.track.artist} onRemove={() => setDraft({ ...draft, track: null })} />
        )}

        {trackOpen && !draft.track && (
          <div className="space-y-3 rounded-2xl bg-surface p-4">
            <Input
              aria-label={tr('Ссылка на трек', 'Track link')}
              type="url"
              inputMode="url"
              autoFocus
              value={track.url}
              onChange={(event) => setTrack({ ...track, url: event.target.value })}
              placeholder={tr('Ссылка из Яндекс Музыки, Spotify, YouTube…', 'A link from Spotify, Apple Music, YouTube…')}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input aria-label={tr('Название', 'Title')} value={track.title} onChange={(event) => setTrack({ ...track, title: event.target.value })} placeholder={tr('Название', 'Title')} />
              <Input aria-label={tr('Исполнитель', 'Artist')} value={track.artist} onChange={(event) => setTrack({ ...track, artist: event.target.value })} placeholder={tr('Исполнитель', 'Artist')} />
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={!trackValid}
                onClick={() => {
                  setDraft({ ...draft, track: { ...track, url: track.url.trim() } });
                  setTrackOpen(false);
                }}
              >
                {tr('Приложить', 'Attach')}
              </Button>
              <Button variant="ghost" onClick={() => setTrackOpen(false)}>
                {tr('Отмена', 'Cancel')}
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-start gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              if (file) setDraft((current) => ({ ...current, photo: file }));
              event.target.value = '';
            }}
          />
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            <ImageIcon className="size-4" aria-hidden /> {draft.photo ? tr('Другой снимок', 'Another photo') : tr('Снимок', 'Photo')}
          </Button>
          <Button variant="secondary" onClick={() => setTrackOpen(true)} disabled={!!draft.track || trackOpen}>
            <Music className="size-4" aria-hidden /> {tr('Музыка', 'Music')}
          </Button>
          {!draft.voice && <VoiceRecorder onRecorded={(blob, ms) => setDraft((current) => ({ ...current, voice: { blob, ms } }))} />}
        </div>

        {error && <Alert>{error}</Alert>}

        <Button
          size="lg"
          block
          loading={busy}
          disabled={!hasContent}
          onClick={async () => {
            setBusy(true);
            const ok = await send(draft);
            setBusy(false);
            if (ok) setSent(true);
          }}
        >
          <Send className="size-4.5" aria-hidden /> {tr('Отправить весточку', 'Send the note')}
        </Button>
      </div>
    </div>
  );
}
