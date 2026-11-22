'use client';

import { useEffect } from 'react';
import { PairMark } from '@/components/PairMark';
import { tr } from '@/lib/i18n';

/* An unexpected failure, said plainly, with the one thing that usually fixes it. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-5">
      <div role="alert" className="max-w-sm text-center">
        <PairMark variant="quiet" className="mx-auto size-16" />
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">{tr('Экран не загрузился', 'This screen didn’t load')}</h1>
        <p className="mt-2 text-sm text-ink-soft">{tr('Ваши дни и письма в порядке — сломалась только эта страница. Попробуйте открыть её ещё раз.', 'Your days and letters are fine — only this page broke. Try opening it again.')}</p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-accent px-5 text-sm font-medium text-accent-ink shadow-card hover:bg-accent-hover"
        >
          {tr('Открыть ещё раз', 'Open again')}
        </button>
      </div>
    </div>
  );
}
