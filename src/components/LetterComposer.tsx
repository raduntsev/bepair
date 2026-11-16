'use client';

import { useRef, useState } from 'react';
import { Paperclip, X } from 'lucide-react';
import type { MediaItem } from '@/lib/media';
import type { Letter, LetterInput } from '@/hooks/useLetters';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Field';
import { Toggle } from '@/components/ui/Controls';
import { VoiceRecorder } from '@/components/Media';

/* The letter editor, shared by «Переписка». Moved out of the old letters page unchanged in behaviour. */
function localInputValue(iso: string | null) {
  if (!iso) return '';
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function LetterComposer({
  initial,
  onClose,
  onSave,
}: {
  initial: Letter | null;
  onClose: () => void;
  onSave: (input: LetterInput, id?: string) => Promise<boolean>;
}) {
  const [title, setTitle] = useState(initial?.title === 'Без темы' ? '' : (initial?.title ?? ''));
  const [content, setContent] = useState(initial?.content ?? '');
  const [deliverAt, setDeliverAt] = useState(localInputValue(initial?.deliver_at ?? null));
  const [revealAfterDay, setRevealAfterDay] = useState(initial?.reveal_after_day ?? true);
  const [keep, setKeep] = useState<MediaItem[]>(initial?.media ?? []);
  const [files, setFiles] = useState<(File | Blob)[]>([]);
  const [busy, setBusy] = useState<'send' | 'draft' | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [minDate] = useState(() => localInputValue(new Date(Date.now() + 5 * 60_000).toISOString()));
  /* Any chosen time counts as «later»; a time already past simply delivers on the next minute. */
  const scheduled = deliverAt !== '';
  const hasBody = content.trim().length > 0 || keep.length > 0 || files.length > 0;

  const submit = async (status: 'draft' | 'scheduled' | 'delivered') => {
    setBusy(status === 'draft' ? 'draft' : 'send');
    const ok = await onSave(
      {
        title: title.trim() || 'Без темы',
        content,
        status,
        deliverAt: status === 'scheduled' ? new Date(deliverAt).toISOString() : null,
        revealAfterDay,
        keep,
        files,
      },
      initial?.id,
    );
    setBusy(null);
    if (ok) onClose();
  };

  return (
    <section className="rounded-2xl bg-surface shadow-card">
      <div className="flex items-center justify-between px-5 pt-5 md:px-6">
        <h1 className="text-large-title font-bold">{initial ? 'Черновик' : 'Письмо'}</h1>
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
          className="tap flex items-center justify-center rounded-lg text-ink-faint hover:bg-sunken hover:text-ink"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>

      <div className="space-y-4 px-5 pt-4 pb-5 md:px-6">
        <Input aria-label="Тема" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Тема" />
        <Textarea
          aria-label="Текст письма"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          rows={9}
          placeholder="Письмо"
          className="measure"
        />

        {(keep.length > 0 || files.length > 0) && (
          <ul className="space-y-2">
            {keep.map((item) => (
              <li key={item.path} className="flex items-center gap-2 rounded-xl bg-sunken px-3.5 py-2 text-sm">
                <Paperclip className="size-4 text-ink-soft" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{item.name ?? 'Вложение'}</span>
                <button
                  type="button"
                  aria-label={`Убрать ${item.name ?? 'вложение'}`}
                  onClick={() => setKeep(keep.filter((k) => k.path !== item.path))}
                  className="tap flex items-center justify-center rounded-lg text-ink-faint hover:text-ink"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </li>
            ))}
            {files.map((file, index) => {
              const name = 'name' in file ? (file as File).name : 'Голосовое';
              return (
                <li key={`${name}-${index}`} className="flex items-center gap-2 rounded-xl bg-sunken px-3.5 py-2 text-sm">
                  <Paperclip className="size-4 text-ink-soft" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{name}</span>
                  <button
                    type="button"
                    aria-label={`Убрать ${name}`}
                    onClick={() => setFiles(files.filter((_, i) => i !== index))}
                    className="tap flex items-center justify-center rounded-lg text-ink-faint hover:text-ink"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex flex-wrap items-start gap-2">
          <input
            ref={fileRef}
            type="file"
            multiple
            hidden
            accept="image/*,video/*,audio/*,.pdf"
            onChange={(event) => {
              const picked = Array.from(event.target.files ?? []);
              setFiles((current) => [...current, ...picked]);
              event.target.value = '';
            }}
          />
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            <Paperclip className="size-4" aria-hidden /> Фото, видео, аудио
          </Button>
          <VoiceRecorder onRecorded={(blob) => setFiles((current) => [...current, blob])} />
        </div>
      </div>

      <div className="space-y-5 border-t border-line px-5 py-5 md:px-6">
        <div className="flex items-start justify-between gap-4">
          <div className="text-sm">
            <p className="font-medium" id="reveal-label">
              Открыть после его дня
            </p>
          </div>
          <Toggle checked={revealAfterDay} onChange={setRevealAfterDay} label="Открыть после того, как партнёр отметит свой день" />
        </div>

        <label className="block text-sm">
          <span className="mb-1.5 block font-medium">Отправить позже</span>
          <span className="flex gap-2">
            <Input type="datetime-local" min={minDate} value={deliverAt} onChange={(event) => setDeliverAt(event.target.value)} className="max-w-xs" />
            {deliverAt && (
              <Button variant="ghost" onClick={() => setDeliverAt('')}>
                Сбросить
              </Button>
            )}
          </span>
        </label>

        <div className="flex flex-wrap gap-3">
          <Button loading={busy === 'send'} disabled={!hasBody || busy !== null} onClick={() => submit(scheduled ? 'scheduled' : 'delivered')}>
            {scheduled ? 'Запланировать' : 'Отправить'}
          </Button>
          <Button variant="secondary" loading={busy === 'draft'} disabled={!hasBody || busy !== null} onClick={() => submit('draft')}>
            В черновики
          </Button>
        </div>
      </div>
    </section>
  );
}

