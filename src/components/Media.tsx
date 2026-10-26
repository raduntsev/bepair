'use client';

import { useEffect, useRef, useState } from 'react';
import { ExternalLink, FileText, ImageIcon, Mic, Music, Square, Trash2 } from 'lucide-react';
import { signedUrl, type MediaItem } from '@/lib/media';
import { Button } from '@/components/ui/Button';

export function useSignedUrl(path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!path) return;
    let alive = true;
    signedUrl(path).then((value) => alive && setUrl(value));
    return () => {
      alive = false;
    };
  }, [path]);
  return path ? url : null;
}

export function StoredImage({ path, alt, className = '' }: { path: string; alt: string; className?: string }) {
  const url = useSignedUrl(path);
  if (!url) {
    return (
      <div className={`flex items-center justify-center bg-sunken text-ink-faint ${className}`}>
        <ImageIcon className="size-7" aria-hidden />
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- signed, expiring storage URLs; next/image would need a remote pattern per project
  return <img src={url} alt={alt} loading="lazy" className={`object-cover ${className}`} />;
}

export function StoredAudio({ path, label }: { path: string; label: string }) {
  const url = useSignedUrl(path);
  return (
    <div className="flex items-center gap-3 rounded-xl bg-sunken px-3.5 py-2.5">
      <Mic className="size-4.5 shrink-0 text-ink-soft" aria-hidden />
      {url ? (
        <audio src={url} controls preload="metadata" aria-label={label} className="h-10 w-full min-w-0" />
      ) : (
        <span className="text-sm text-ink-faint">Загружаем запись…</span>
      )}
    </div>
  );
}

export function StoredMedia({ item }: { item: MediaItem }) {
  const url = useSignedUrl(item.path);
  if (item.kind === 'image') return <StoredImage path={item.path} alt={item.name ?? 'Снимок'} className="max-h-96 w-full rounded-xl" />;
  if (item.kind === 'voice' || item.kind === 'audio') return <StoredAudio path={item.path} label={item.name ?? 'Голосовое'} />;
  if (item.kind === 'video') {
    return url ? (
      <video src={url} controls preload="metadata" className="max-h-96 w-full rounded-xl bg-sunken" />
    ) : (
      <div className="h-48 w-full rounded-xl bg-sunken" />
    );
  }
  return (
    <a
      href={url ?? undefined}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 rounded-xl bg-sunken px-3.5 py-3 text-sm font-medium text-ink hover:underline"
    >
      <FileText className="size-4.5 text-ink-soft" aria-hidden /> {item.name ?? 'Файл'}
    </a>
  );
}

function serviceOf(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (host.includes('music.yandex')) return 'Яндекс Музыка';
    if (host.includes('spotify')) return 'Spotify';
    if (host.includes('music.apple')) return 'Apple Music';
    if (host.includes('youtube') || host === 'youtu.be') return 'YouTube';
    if (host.includes('vk.com') || host.includes('vk.ru')) return 'VK Музыка';
    if (host.includes('zvuk')) return 'Звук';
    return host;
  } catch {
    return null;
  }
}

export function TrackCard({
  url,
  title,
  artist,
  onRemove,
}: {
  url: string;
  title?: string | null;
  artist?: string | null;
  onRemove?: () => void;
}) {
  const service = serviceOf(url);
  return (
    <div className="flex items-center gap-3 rounded-xl bg-sunken py-2 pr-2 pl-3.5">
      <Music className="size-4.5 shrink-0 text-ink-soft" aria-hidden />
      <a href={url} target="_blank" rel="noreferrer" className="group min-w-0 flex-1 py-1">
        <span className="block truncate text-sm font-medium text-ink group-hover:underline">{title || 'Трек'}</span>
        <span className="block truncate text-xs text-ink-faint">{[artist, service].filter(Boolean).join(', ')}</span>
      </a>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Убрать трек"
          className="tap flex items-center justify-center rounded-lg text-ink-faint hover:bg-surface hover:text-ink"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      ) : (
        <ExternalLink className="mr-2 size-4 shrink-0 text-ink-faint" aria-hidden />
      )}
    </div>
  );
}

function pickMime() {
  if (typeof MediaRecorder === 'undefined') return '';
  for (const type of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

export function formatDuration(ms: number) {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/* Press to record, press to stop. The clip is handed up; nothing uploads until sending. */
export function VoiceRecorder({ onRecorded }: { onRecorded: (blob: Blob, ms: number) => void }) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const started = useRef(0);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearInterval(timer.current);
      recorder.current?.stream.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickMime();
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      rec.ondataavailable = (event) => event.data.size > 0 && chunks.push(event.data);
      rec.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const ms = Date.now() - started.current;
        if (chunks.length) onRecorded(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }), ms);
      };
      recorder.current = rec;
      started.current = Date.now();
      rec.start();
      setRecording(true);
      setElapsed(0);
      timer.current = window.setInterval(() => setElapsed(Date.now() - started.current), 250);
    } catch {
      setError('Нет доступа к микрофону. Разрешите его в настройках браузера.');
    }
  };

  const stop = () => {
    recorder.current?.stop();
    if (timer.current) window.clearInterval(timer.current);
    setRecording(false);
  };

  return (
    <div>
      {recording ? (
        <Button variant="danger" onClick={stop}>
          <Square className="size-3.5 fill-current" aria-hidden /> Остановить, {formatDuration(elapsed)}
        </Button>
      ) : (
        <Button variant="secondary" onClick={start}>
          <Mic className="size-4" aria-hidden /> Голос
        </Button>
      )}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
