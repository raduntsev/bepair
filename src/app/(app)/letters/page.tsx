'use client';

import { useRef, useState } from 'react';
import { Clock, FileText, Lock, Paperclip, Pencil, Plus, Trash2, X } from 'lucide-react';
import { fmt } from '@/lib/dates';
import { displayName, genitive } from '@/lib/words';
import type { MediaItem } from '@/lib/media';
import { isDelivered, letterTime, useLetters, type Letter, type LetterInput } from '@/hooks/useLetters';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Field';
import { Toggle } from '@/components/ui/Controls';
import { Alert, Chip, EmptyState, Loading, Page, PageHeader } from '@/components/ui/Blocks';
import { StoredMedia, VoiceRecorder } from '@/components/Media';

function localInputValue(iso: string | null) {
  if (!iso) return '';
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function Composer({
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
    <section className="mb-6 rounded-2xl border border-line bg-surface shadow-card">
      <div className="flex items-center justify-between px-5 pt-5 md:px-6">
        <h2 className="text-lg font-semibold">{initial ? 'Черновик' : 'Новое письмо'}</h2>
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
          placeholder="Пишите столько, сколько хочется."
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
              Открыть после того, как партнёр отметит свой день
            </p>
            <p className="mt-0.5 text-ink-faint">Он увидит, что письмо пришло, но не увидит текст.</p>
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
          <span className="mt-1.5 block text-ink-faint">Пока письмо не доставлено, отправку можно отменить.</span>
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

export default function LettersPage() {
  const { user, partner } = useSpaceAuth();
  const { letters, isLoading, error, save, cancelScheduled, remove, markRead } = useLetters();
  const [composing, setComposing] = useState<Letter | 'new' | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const name = displayName(partner?.display_name);

  return (
    <Page>
      <PageHeader
        title="Письма"
        sub="То, что не помещается в заметку дня."
        action={
          !composing && (
            <Button onClick={() => setComposing('new')} disabled={!partner}>
              <Plus className="size-4" aria-hidden /> Написать
            </Button>
          )
        }
      />

      {!partner && <div className="mb-5"><Alert>Письма можно писать, когда партнёр присоединится к пространству.</Alert></div>}

      {composing && (
        <Composer
          key={composing === 'new' ? 'new' : composing.id}
          initial={composing === 'new' ? null : composing}
          onClose={() => setComposing(null)}
          onSave={save}
        />
      )}

      {error && <div className="mb-4"><Alert>{error}</Alert></div>}

      {isLoading ? (
        <Loading label="Загружаем письма…" />
      ) : letters.length === 0 ? (
        <EmptyState title="Писем пока нет" variant="apart">
          Письмо живёт дольше заметки. Его можно отложить или открыть только после того, как партнёр отметит свой день.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {letters.map((letter) => {
            const mine = letter.author_id === user?.id;
            const delivered = isDelivered(letter);
            const open = openId === letter.id;
            const unread = !mine && delivered && !letter.sealed && !letter.is_read;

            return (
              <li key={letter.id} className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
                <div className="flex flex-wrap items-center justify-between gap-3 p-5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold">{letter.sealed ? 'Письмо ждёт вас' : letter.title || 'Без темы'}</h2>
                      {letter.status === 'draft' && <Chip Icon={FileText}>Черновик</Chip>}
                      {letter.status === 'scheduled' && !delivered && (
                        <Chip tone="accent" Icon={Clock}>
                          {letter.deliver_at ? `Придёт ${fmt(letter.deliver_at, 'd MMMM, HH:mm')}` : 'Отложено'}
                        </Chip>
                      )}
                      {unread && <Chip tone="partner">Новое</Chip>}
                      {letter.media.length > 0 && !letter.sealed && (
                        <Chip Icon={Paperclip}>{letter.media.length}</Chip>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-ink-faint">
                      {mine ? "от вас" : `от ${partner ? genitive(name, partner.gender) : "партнёра"}`}, {fmt(letterTime(letter), 'd MMMM')}
                      {mine && delivered && (letter.is_read ? ', прочитано' : ', ещё не открыто')}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {letter.status === 'scheduled' && !delivered && mine && (
                      <Button variant="secondary" onClick={() => cancelScheduled(letter.id)}>
                        Отменить отправку
                      </Button>
                    )}
                    {letter.status === 'draft' && mine && (
                      <>
                        <Button variant="ghost" onClick={() => remove(letter.id)} aria-label="Удалить черновик">
                          <Trash2 className="size-4" aria-hidden /> Удалить
                        </Button>
                        <Button variant="secondary" onClick={() => setComposing(letter)}>
                          <Pencil className="size-4" aria-hidden /> Продолжить
                        </Button>
                      </>
                    )}
                    {!letter.sealed && letter.status !== 'draft' && (
                      <Button
                        variant={unread ? 'primary' : 'secondary'}
                        onClick={() => {
                          setOpenId(open ? null : letter.id);
                          if (!open && unread) markRead(letter.id);
                        }}
                      >
                        {open ? 'Свернуть' : 'Читать'}
                      </Button>
                    )}
                  </div>
                </div>

                {letter.sealed && (
                  <div className="flex items-start gap-3 border-t border-line bg-partner-soft px-5 py-4">
                    <Lock className="mt-0.5 size-4.5 shrink-0 text-partner" aria-hidden />
                    <p className="text-sm text-ink-soft">Откроется, когда вы отметите свой день. Письмо — награда, а не повод.</p>
                  </div>
                )}

                {open && !letter.sealed && (
                  <div className="space-y-4 border-t border-line px-5 py-5">
                    {letter.content && <p className="measure text-[15px] leading-relaxed whitespace-pre-wrap">{letter.content}</p>}
                    {letter.media.map((item) => (
                      <StoredMedia key={item.path} item={item} />
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Page>
  );
}
