import Link from 'next/link';
import { PairMark } from '@/components/PairMark';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-5">
      <div className="max-w-sm text-center">
        <PairMark variant="apart" className="mx-auto h-14 w-24" />
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">Такой страницы нет</h1>
        <p className="mt-2 text-sm text-ink-soft">Возможно, ссылка устарела. Сегодняшний день на месте.</p>
        <Link
          href="/day"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-accent px-5 text-sm font-medium text-accent-ink shadow-card hover:bg-accent-hover"
        >
          Открыть день
        </Link>
      </div>
    </div>
  );
}
