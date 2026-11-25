import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { OPERATOR_FILLED, humanDate } from '@/lib/legal';

/*
  The documents are public pages: a store listing links here, and a person
  reads them before signing in. Plain reading layout, no app chrome.
*/
export function LegalDoc({ title, version, children }: { title: string; version: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-canvas">
      <article className="mx-auto w-full max-w-2xl px-4 pt-8 pb-16 sm:px-6 md:pt-12">
        <Link href="/" className="tap inline-flex items-center gap-1 text-subhead font-medium text-accent hover:opacity-80">
          <ChevronLeft className="size-5" aria-hidden /> Впаре
        </Link>
        <h1 className="mt-4 text-title-1 font-bold tracking-tight text-ink">{title}</h1>
        <p className="mt-2 text-footnote text-ink-faint">Редакция от {humanDate(version)}</p>
        <p lang="en" className="mt-1 text-footnote text-ink-faint">
          This document is in Russian, the language of the law it follows.
        </p>

        {!OPERATOR_FILLED && (
          <p role="note" className="mt-5 rounded-xl bg-danger-soft px-4 py-3 text-subhead text-danger">
            Черновик: данные оператора ещё не заполнены.
          </p>
        )}

        <div className="legal mt-8 space-y-8 text-body text-ink">{children}</div>
      </article>
    </div>
  );
}

export function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-title-3 font-semibold">
        {n}. {title}
      </h2>
      {children}
    </section>
  );
}

export function List({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 marker:text-ink-faint">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}
