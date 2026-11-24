'use client';

import { Fragment, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, Check, ChevronDown, Clock, ExternalLink, Eye, Hand, Lightbulb, MessagesSquare, Quote, Sparkles, X } from 'lucide-react';
import type { Theory, TheoryBlock } from '@/lib/courses';
import { AutoHeight } from '@/components/ui/AutoHeight';
import { tr } from '@/lib/i18n';

const EASE = [0.32, 0.72, 0, 1] as const;

/* **bold** inside a sentence, and nothing else — the text stays text. */
function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <strong key={i} className="font-semibold text-ink">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

/*
  The theory of a lesson. A card with a rhythm: lead, short paragraphs,
  a key thought on the accent ground, a story set apart, two columns, and the
  interactive pieces — terms that unfold, a card to open after thinking, a
  small quiz that explains every answer, a «try it now» to tick off.
*/
export function TheoryCard({ theory }: { theory: Theory }) {
  return (
    <article className="rounded-2xl bg-surface p-5 shadow-card">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="flex items-center gap-2 text-title-3 font-semibold">
          <BookOpen className="size-5 text-accent" aria-hidden /> {tr('Теория', 'Theory')}
        </h2>
        <span className="flex shrink-0 items-center gap-1 text-footnote text-ink-faint">
          <Clock className="size-3.5" aria-hidden /> {tr(`${theory.minutes} мин`, `${theory.minutes} min`)}
        </span>
      </div>

      <div className="measure mt-4 space-y-4">
        {theory.blocks.map((block, i) => (
          <Block key={i} block={block} />
        ))}
      </div>

      {theory.read && theory.read.length > 0 && (
        <section className="mt-6 border-t border-line pt-4">
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

function Block({ block }: { block: TheoryBlock }) {
  switch (block.t) {
    case 'lead':
      return (
        <p className="text-headline leading-snug font-medium text-ink">
          <Rich text={block.text} />
        </p>
      );
    case 'p':
      return (
        <p className="text-body text-ink-soft">
          <Rich text={block.text} />
        </p>
      );
    case 'h':
      return <h3 className="pt-2 text-headline font-semibold text-ink">{block.text}</h3>;
    case 'key':
      return (
        <div className="flex gap-3 rounded-xl bg-accent-soft p-4">
          <Lightbulb className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
          <p className="text-body font-medium text-accent-soft-ink">
            <span className="sr-only">{tr('Главное: ', 'Key point: ')}</span>
            <Rich text={block.text} />
          </p>
        </div>
      );
    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul';
      return (
        <Tag className="space-y-2">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-3 text-body text-ink-soft">
              {block.ordered ? (
                <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-footnote font-semibold text-accent-soft-ink">
                  {i + 1}
                </span>
              ) : (
                <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-accent" />
              )}
              <span className={block.ordered ? 'pt-0.5' : ''}>
                <Rich text={item} />
              </span>
            </li>
          ))}
        </Tag>
      );
    }
    case 'terms':
      return <Terms items={block.items} />;
    case 'story':
      return (
        <figure className="rounded-xl border border-line p-4">
          <figcaption className="flex items-center gap-2 text-footnote font-semibold text-partner-ink">
            <MessagesSquare className="size-4" aria-hidden /> {block.title}
          </figcaption>
          <p className="mt-2 text-body text-ink-soft">
            <Rich text={block.text} />
          </p>
        </figure>
      );
    case 'compare':
      return (
        <div className="grid grid-cols-2 gap-2">
          {[block.left, block.right].map((side, i) => (
            <div key={i} className={`rounded-xl p-3 ${i === 0 ? 'bg-sunken' : 'bg-accent-soft'}`}>
              <p className={`text-footnote font-semibold ${i === 0 ? 'text-ink-soft' : 'text-accent-soft-ink'}`}>{side.title}</p>
              <ul className="mt-2 space-y-1.5">
                {side.items.map((item, j) => (
                  <li key={j} className="text-footnote leading-snug text-ink">
                    <Rich text={item} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      );
    case 'reveal':
      return <Reveal prompt={block.prompt} answer={block.answer} />;
    case 'quiz':
      return <Quiz q={block.q} options={block.options} />;
    case 'try':
      return <Try text={block.text} />;
    case 'quote':
      return (
        <figure className="border-l-2 border-accent py-1 pl-4">
          <Quote className="mb-1 size-4 text-accent" aria-hidden />
          <blockquote className="text-body text-ink italic">{block.text}</blockquote>
          <figcaption className="mt-1.5 text-footnote text-ink-faint">{block.source}</figcaption>
        </figure>
      );
  }
}

/* Terms that unfold one at a time. */
function Terms({ items }: { items: { term: string; def: string }[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
      {items.map((item, i) => (
        <li key={item.term}>
          <button
            type="button"
            aria-expanded={open === i}
            onClick={() => setOpen(open === i ? null : i)}
            className="flex min-h-11 w-full items-center gap-2 px-3.5 py-2 text-left transition-colors hover:bg-sunken/60"
          >
            <span className="min-w-0 flex-1 text-subhead font-semibold text-ink">{item.term}</span>
            <ChevronDown className={`size-4.5 shrink-0 text-ink-faint transition-transform duration-300 ${open === i ? 'rotate-180' : ''}`} aria-hidden />
          </button>
          <AutoHeight>
            {open === i && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-3.5 pb-3 text-subhead text-ink-soft">
                <Rich text={item.def} />
              </motion.p>
            )}
          </AutoHeight>
        </li>
      ))}
    </ul>
  );
}

/* Think first, then open. */
function Reveal({ prompt, answer }: { prompt: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl bg-sunken p-4">
      <p className="flex gap-2 text-subhead font-semibold text-ink">
        <Eye className="mt-0.5 size-4.5 shrink-0 text-accent" aria-hidden />
        <span>
          <Rich text={prompt} />
        </span>
      </p>
      <AutoHeight>
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.p key="a" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE }} className="mt-2.5 text-subhead text-ink-soft">
              <Rich text={answer} />
            </motion.p>
          ) : (
            <motion.button
              key="b"
              type="button"
              exit={{ opacity: 0 }}
              onClick={() => setOpen(true)}
              className="tap mt-2 inline-flex items-center gap-1.5 rounded-lg px-1 text-subhead font-semibold text-accent hover:opacity-80"
            >
              {tr('Подумайте — и откройте', 'Think, then open')}
            </motion.button>
          )}
        </AnimatePresence>
      </AutoHeight>
    </div>
  );
}

/* A one-question check. Every option explains itself; the right one is marked once chosen. */
function Quiz({ q, options }: { q: string; options: { text: string; ok?: boolean; why: string }[] }) {
  const [picked, setPicked] = useState<number | null>(null);
  const chosen = picked !== null ? options[picked] : null;
  return (
    <fieldset className="rounded-xl border border-accent/30 p-4">
      <legend className="px-1 text-footnote font-semibold text-accent">{tr('Проверьте себя', 'Check yourself')}</legend>
      <p className="text-subhead font-semibold text-ink">
        <Rich text={q} />
      </p>
      <div className="mt-3 space-y-2">
        {options.map((o, i) => {
          const isPicked = picked === i;
          const showRight = picked !== null && o.ok;
          return (
            <button
              key={i}
              type="button"
              aria-pressed={isPicked}
              onClick={() => setPicked(i)}
              className={`flex min-h-11 w-full items-start gap-2.5 rounded-xl px-3.5 py-2.5 text-left text-subhead transition-colors ${
                showRight ? 'bg-accent text-accent-ink' : isPicked ? 'bg-sunken text-ink ring-2 ring-line-strong' : 'bg-sunken text-ink hover:bg-line'
              }`}
            >
              <span aria-hidden className="mt-0.5 shrink-0">
                {showRight ? <Check className="size-4" strokeWidth={2.6} /> : isPicked ? <X className="size-4" /> : <span className="block size-4 rounded-full border-2 border-line-strong" />}
              </span>
              <span>{o.text}</span>
            </button>
          );
        })}
      </div>
      <AutoHeight>
        {chosen && (
          <motion.p
            key={picked}
            role="status"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-3 flex gap-2 text-subhead text-ink-soft"
          >
            {chosen.ok ? <Sparkles className="mt-0.5 size-4.5 shrink-0 text-accent" aria-hidden /> : <Lightbulb className="mt-0.5 size-4.5 shrink-0 text-ink-faint" aria-hidden />}
            <span>
              <strong className="font-semibold text-ink">{chosen.ok ? tr('Верно. ', 'Right. ') : tr('Не совсем. ', 'Not quite. ')}</strong>
              <Rich text={chosen.why} />
            </span>
          </motion.p>
        )}
      </AutoHeight>
    </fieldset>
  );
}

/* A small action to do right now, ticked off when done. */
function Try({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="rounded-xl bg-partner-soft p-4">
      <p className="flex items-center gap-2 text-footnote font-semibold text-partner-ink">
        <Hand className="size-4" aria-hidden /> {tr('Попробуйте прямо сейчас', 'Try it right now')}
      </p>
      <p className="mt-1.5 text-body text-ink">
        <Rich text={text} />
      </p>
      <button
        type="button"
        aria-pressed={done}
        onClick={() => setDone(!done)}
        className={`mt-3 inline-flex h-10 items-center gap-2 rounded-full px-4 text-subhead font-semibold transition-colors ${
          done ? 'bg-partner text-mood-ink' : 'bg-surface text-partner-ink hover:bg-surface/70'
        }`}
      >
        {done ? <Check className="size-4" strokeWidth={2.6} aria-hidden /> : null}
        {done ? tr('Сделано', 'Done') : tr('Сделал(а)', 'Done it')}
      </button>
    </div>
  );
}
