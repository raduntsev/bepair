import Link from 'next/link';
import { PairMark } from '@/components/PairMark';
import { tr } from '@/lib/i18n';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-5">
      <div className="max-w-sm text-center">
        <PairMark variant="apart" className="mx-auto size-16" />
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">{tr('Такой страницы нет', 'There’s no such page')}</h1>
        <p className="mt-2 text-sm text-ink-soft">{tr('Возможно, ссылка устарела. Сегодняшний день на месте.', 'The link may be out of date. Today is still here.')}</p>
        <Link
          href="/day"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-accent px-5 text-sm font-medium text-accent-ink shadow-card hover:bg-accent-hover"
        >
          {tr('Открыть день', 'Open the day')}
        </Link>
      </div>
    </div>
  );
}
