'use client';

import { useEffect } from 'react';
import { PairMark } from '@/components/PairMark';

/* An unexpected failure, said plainly, with the one thing that usually fixes it. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-5">
      <div role="alert" className="max-w-sm text-center">
        <PairMark variant="quiet" className="mx-auto h-14 w-24" />
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">Экран не загрузился</h1>
        <p className="mt-2 text-sm text-ink-soft">Ваши дни и письма в порядке — сломалась только эта страница. Попробуйте открыть её ещё раз.</p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-accent px-5 text-sm font-medium text-accent-ink shadow-card hover:bg-accent-hover"
        >
          Открыть ещё раз
        </button>
      </div>
    </div>
  );
}
