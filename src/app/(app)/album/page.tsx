'use client';

import { useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ImagePlus, Trash2 } from 'lucide-react';
import { albumIndex } from '@/lib/album';
import { useAlbum } from '@/hooks/useAlbum';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { StoredImage } from '@/components/Media';
import { Button } from '@/components/ui/Button';
import { Alert, EmptyState, Loading, Page, PageHeader } from '@/components/ui/Blocks';
import { tr } from '@/lib/i18n';

/*
  The photos the «Фото» widget shows on both phones, one at a time, turning
  over every three hours. Either of you adds; each removes their own. The one
  on the widgets right now wears a ring.
*/
export default function AlbumPage() {
  const { user } = useSpaceAuth();
  const { photos, isLoading, error, adding, add, remove } = useAlbum();
  const input = useRef<HTMLInputElement>(null);
  const current = photos.length ? albumIndex(photos.length) : -1;

  const picker = (
    <input
      ref={input}
      type="file"
      accept="image/*"
      multiple
      className="sr-only"
      tabIndex={-1}
      onChange={(event) => {
        add(Array.from(event.target.files ?? []));
        event.target.value = '';
      }}
    />
  );

  return (
    <Page>
      <PageHeader
        title={tr('Фото для виджета', 'Photos for the widget')}
        back={{ href: '/settings', label: tr('Профиль', 'Profile') }}
        action={
          photos.length > 0 ? (
            <Button variant="secondary" loading={adding > 0} onClick={() => input.current?.click()}>
              <ImagePlus className="size-4" aria-hidden /> {tr('Добавить', 'Add')}
            </Button>
          ) : undefined
        }
      />
      {picker}

      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      {isLoading ? (
        <Loading label={tr('Загружаем фото…', 'Loading photos…')} />
      ) : photos.length === 0 ? (
        <EmptyState
          title={tr('Здесь будут ваши фото', 'Your photos will be here')}
          variant="together"
          action={
            <Button size="lg" loading={adding > 0} onClick={() => input.current?.click()}>
              <ImagePlus className="size-5" aria-hidden /> {tr('Добавить фото', 'Add photos')}
            </Button>
          }
        >
          {tr('Виджет «Фото» покажет их на обоих телефонах — по одному, сменяя каждые три часа.', 'The Photo widget shows them on both phones, one at a time, changing every three hours.')}
        </EmptyState>
      ) : (
        <>
          <ul className="grid grid-cols-3 gap-1.5 overflow-hidden rounded-2xl">
            <AnimatePresence initial={false}>
              {photos.map((photo, i) => (
                <motion.li
                  key={photo.id}
                  layout
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
                  className={`relative aspect-square overflow-hidden rounded-lg ${i === current ? 'ring-3 ring-accent ring-inset' : ''}`}
                >
                  <StoredImage path={photo.path} alt={i === current ? tr('Сейчас на виджете', 'On the widget now') : tr('Фото', 'Photo')} className="size-full" />
                  {i === current && (
                    <span className="absolute bottom-1.5 left-1.5 rounded-full bg-accent px-2 py-0.5 text-footnote font-semibold text-accent-ink">
                      {tr('сейчас', 'now')}
                    </span>
                  )}
                  {photo.added_by === user?.id && (
                    <button
                      type="button"
                      onClick={() => remove(photo)}
                      aria-label={tr('Убрать фото', 'Remove photo')}
                      className="absolute top-1 right-1 flex size-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  )}
                </motion.li>
              ))}
            </AnimatePresence>
            {Array.from({ length: adding }).map((_, i) => (
              <li key={`adding-${i}`} className="aspect-square animate-pulse rounded-lg bg-sunken" aria-label={tr('Загружается', 'Uploading')} />
            ))}
          </ul>
          <p className="mt-3 px-1 text-footnote text-ink-faint">
            {photos.length} · {tr('меняется каждые 3 часа', 'changes every 3 hours')}
          </p>
        </>
      )}
    </Page>
  );
}
