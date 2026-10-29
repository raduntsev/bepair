'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { BookOpen, ImageIcon, Music, Send, Trash2, X } from 'lucide-react';
import { displayName } from '@/lib/words';
import { usePings, type PingDraft } from '@/hooks/usePings';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { Button, LinkButton } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Blocks';
import { formatDuration, TrackCard, VoiceRecorder } from '@/components/Media';

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
  const name = displayName(partner?.display_name);

  const close = () => (window.history.length > 1 ? router.back() : router.push('/chronicle'));

  if (sent) {
    return (
      <div className="mx-auto w-full max-w-xl px-5 pt-7 md:pt-10">
        <motion.section
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface px-6 py-10 text-center shadow-card"
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
            Весточка ушла
          </h1>
          <p className="max-w-xs text-sm text-ink-soft">
            {name} получит уведомление на телефон. Запись уже лежит в летописи.
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <LinkButton href="/chronicle" variant="secondary">
              <BookOpen className="size-4" aria-hidden /> Открыть летопись
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
              Ещё одну
            </Button>
          </div>
        </motion.section>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl px-5 pt-7 md:pt-10">
      <header className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Весточка</h1>
        <button
          type="button"
          onClick={close}
          aria-label="Закрыть"
          className="tap flex items-center justify-center rounded-lg text-ink-faint hover:bg-sunken hover:text-ink"
        >
          <X className="size-5" aria-hidden />
        </button>
      </header>
      <p className="mb-5 text-sm text-ink-faint">
        Короткое сообщение, которое сразу придёт {partner ? 'партнёру' : 'в летопись'} на телефон. Можно приложить снимок, трек или голос.
      </p>

      {!partner && (
        <div className="mb-4">
          <Alert>Партнёр ещё не присоединился — весточка сохранится в летописи и дождётся его.</Alert>
        </div>
      )}

      <div className="space-y-4">
        <Textarea
          aria-label="Текст весточки"
          rows={4}
          autoFocus
          value={draft.body}
          onChange={(event) => setDraft({ ...draft, body: event.target.value })}
          placeholder="Напишите что угодно…"
        />

        {photoUrl && (
          <div className="relative overflow-hidden rounded-2xl bg-sunken">
            {/* eslint-disable-next-line @next/next/no-img-element -- local preview of a picked file */}
            <img src={photoUrl} alt="Выбранный снимок" className="max-h-80 w-full object-cover" />
            <button
              type="button"
              onClick={() => setDraft({ ...draft, photo: null })}
              aria-label="Убрать снимок"
              className="tap absolute top-2 right-2 flex items-center justify-center rounded-full bg-surface/90 text-ink shadow-card"
            >
              <X className="size-4.5" aria-hidden />
            </button>
          </div>
        )}

        {draft.voice && voiceUrl && (
          <div className="flex items-center gap-2 rounded-xl bg-sunken py-2 pr-2 pl-3.5">
            <audio src={voiceUrl} controls className="h-10 min-w-0 flex-1" aria-label="Записанное голосовое" />
            <span className="text-xs text-ink-faint tabular-nums">{formatDuration(draft.voice.ms)}</span>
            <button
              type="button"
              onClick={() => setDraft({ ...draft, voice: null })}
              aria-label="Убрать голосовое"
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
          <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
            <Input
              aria-label="Ссылка на трек"
              type="url"
              inputMode="url"
              autoFocus
              value={track.url}
              onChange={(event) => setTrack({ ...track, url: event.target.value })}
              placeholder="Ссылка из Яндекс Музыки, Spotify, YouTube…"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input aria-label="Название" value={track.title} onChange={(event) => setTrack({ ...track, title: event.target.value })} placeholder="Название" />
              <Input aria-label="Исполнитель" value={track.artist} onChange={(event) => setTrack({ ...track, artist: event.target.value })} placeholder="Исполнитель" />
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
                Приложить
              </Button>
              <Button variant="ghost" onClick={() => setTrackOpen(false)}>
                Отмена
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
            <ImageIcon className="size-4" aria-hidden /> {draft.photo ? 'Другой снимок' : 'Снимок'}
          </Button>
          <Button variant="secondary" onClick={() => setTrackOpen(true)} disabled={!!draft.track || trackOpen}>
            <Music className="size-4" aria-hidden /> Музыка
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
          <Send className="size-4.5" aria-hidden /> Отправить весточку
        </Button>
      </div>
    </div>
  );
}
