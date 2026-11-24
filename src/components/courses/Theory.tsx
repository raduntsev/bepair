'use client';

import { ExternalLink, Lightbulb, Quote } from 'lucide-react';
import type { Theory } from '@/lib/courses';
import { tr } from '@/lib/i18n';

/*
  What to read before the questions. Plain paragraphs first, then how the idea
  shows up in everyday life, a short quote with its author, and where to read
  more. The quote is set apart by a rule, not a filled box, so the card stays
  one surface.
*/
export function TheoryBlock({ theory }: { theory: Theory }) {
  return (
    <article className="rounded-2xl bg-surface p-5 shadow-card">
      <h2 className="text-title-3 font-semibold">{tr('Теория', 'Theory')}</h2>

      <div className="measure mt-3 space-y-3 text-body text-ink">
        {theory.text.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>

      {theory.examples && theory.examples.length > 0 && (
        <section className="mt-5">
          <h3 className="flex items-center gap-2 text-headline font-semibold">
            <Lightbulb className="size-4.5 text-accent" aria-hidden /> {tr('Как это выглядит в жизни', 'What it looks like in life')}
          </h3>
          <ul className="measure mt-2 space-y-2">
            {theory.examples.map((e, i) => (
              <li key={i} className="flex gap-2.5 text-subhead text-ink-soft">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
                <span>{e}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {theory.quote && (
        <figure className="measure mt-5 border-l-2 border-accent pl-4">
          <Quote className="mb-1 size-4 text-accent" aria-hidden />
          <blockquote className="text-body text-ink italic">{theory.quote.text}</blockquote>
          <figcaption className="mt-1.5 text-footnote text-ink-faint">{theory.quote.source}</figcaption>
        </figure>
      )}

      {theory.read && theory.read.length > 0 && (
        <section className="mt-5">
          <h3 className="text-headline font-semibold">{tr('Почитать', 'Further reading')}</h3>
          <ul className="mt-1 space-y-0.5">
            {theory.read.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="tap inline-flex items-center gap-1.5 text-subhead font-medium text-accent hover:opacity-80"
                >
                  <ExternalLink className="size-4 shrink-0" aria-hidden /> {link.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
