'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Lock, X } from 'lucide-react';
import { fmt } from '@/lib/dates';
import { displayName } from '@/lib/words';
import { isDelivered, letterTime, useLetters } from '@/hooks/useLetters';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { Loading } from '@/components/ui/Blocks';
import { LetterComposer } from '@/components/LetterComposer';
import { StoredMedia } from '@/components/Media';
import { tr } from '@/lib/i18n';

/*
  A letter has its own screen, like a note does: writing one (new or a draft)
  and reading one both happen here, never as a box unfolding above the chat.
*/
export default function LetterPage() {
  return (
    <Suspense fallback={<Loading label={tr('Открываем письмо…', 'Opening the letter…')} />}>
      <LetterView />
    </Suspense>
  );
}

function LetterView() {
  const params = useSearchParams();
  const id = params.get('id');
  const router = useRouter();
  const { user, partner } = useSpaceAuth();
  const { letters, isLoading, save, markRead } = useLetters();
  const letter = id ? (letters.find((l) => l.id === id) ?? null) : null;
  const mine = letter?.author_id === user?.id;

  const close = () => (window.history.length > 1 ? router.back() : router.push('/messages'));

  const readable = !!letter && !letter.sealed && letter.status !== 'draft' && isDelivered(letter);
  const unread = readable && !mine && !letter.is_read;
  useEffect(() => {
    if (unread && letter) markRead(letter.id);
  }, [unread, letter, markRead]);

  const ease = [0.32, 0.72, 0, 1] as const;

  if (id && isLoading) return <Loading label={tr('Открываем письмо…', 'Opening the letter…')} />;

  /* New letter, or a draft of mine: the editor. */
  if (!id || (letter && mine && letter.status === 'draft')) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
        className="mx-auto w-full max-w-2xl px-4 pt-6 sm:px-6 md:pt-12"
      >
        <LetterComposer initial={letter} onClose={close} onSave={save} />
      </motion.div>
    );
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease }}
      className="mx-auto w-full max-w-2xl px-4 pt-6 sm:px-6 md:pt-12"
    >
      <header className="mb-6 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-subhead text-ink-faint">
            {letter ? `${mine ? tr('Вы', 'You') : displayName(partner?.display_name)} · ${fmt(letterTime(letter), 'd MMMM, HH:mm')}` : ''}
          </p>
          <h1 className="text-large-title font-bold">{letter?.sealed ? tr('Письмо', 'Letter') : letter?.title || tr('Без темы', 'No subject')}</h1>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label={tr('Закрыть', 'Close')}
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-soft hover:text-ink"
        >
          <X className="size-5" aria-hidden />
        </button>
      </header>

      {!letter ? null : letter.sealed ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-surface px-6 py-12 text-center shadow-card">
          <span className="flex size-14 items-center justify-center rounded-full bg-sunken text-ink-faint">
            <Lock className="size-6" aria-hidden />
          </span>
          <span className="sr-only">{tr('Откроется, когда вы отметите свой день.', 'Opens once you mark your day.')}</span>
        </div>
      ) : (
        <div className="space-y-5 rounded-2xl bg-surface p-5 shadow-card md:p-7">
          {letter.content && <p className="measure text-body leading-relaxed whitespace-pre-wrap">{letter.content}</p>}
          {letter.media.map((item) => (
            <StoredMedia key={item.path} item={item} />
          ))}
        </div>
      )}
    </motion.article>
  );
}
