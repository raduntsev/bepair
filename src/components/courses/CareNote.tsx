'use client';

import { ChevronDown, Phone } from 'lucide-react';
import { tr } from '@/lib/i18n';

/*
  The courses ask about the self, and some questions touch what hurts. Two
  things are said plainly, without alarm: this is not therapy, and if it gets
  very bad there are people to call, now. Full before a course starts; folded
  into one quiet line on every lesson and in the journal.

  Numbers checked on 25.11.2026 against the current help pages of two
  university psychology services (НГТУ, МИЭТ), which list the same lines.
  Re-check them now and then: a wrong number in a crisis is worse than none.
*/
const LINES: { href: string; number: string; ru: string; en: string }[] = [
  { href: 'tel:112', number: '112', ru: 'если есть угроза жизни', en: 'emergency, if a life is at risk (Russia, EU)' },
  { href: 'tel:+78001004994', number: '8 800 100-49-94', ru: 'телефон доверия, круглосуточно, бесплатно и анонимно', en: 'helpline in Russia, 24/7, free and anonymous' },
  { href: 'tel:+74959895050', number: '8 495 989-50-50', ru: 'экстренная психологическая помощь МЧС, круглосуточно', en: 'emergency psychological help (EMERCOM), 24/7' },
];

function Lines() {
  return (
    <>
      <p className="measure text-body text-ink">
        {tr(
          'Если вам очень плохо или появились мысли причинить себе вред — не оставайтесь с этим одни, позвоните:',
          'If you feel very bad or have thoughts of harming yourself, don’t stay alone with it — call:',
        )}
      </p>
      <ul className="mt-3 space-y-2">
        {LINES.map((line) => (
          <li key={line.href}>
            <a href={line.href} className="tap flex items-start gap-3 rounded-xl p-1 -m-1 transition-colors hover:bg-sunken">
              <Phone className="mt-0.5 size-4.5 shrink-0 text-accent" aria-hidden />
              <span className="min-w-0">
                <span className="block text-body font-semibold tabular-nums text-ink">{line.number}</span>
                <span className="block text-footnote text-ink-faint">{tr(line.ru, line.en)}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
      {/* Outside Russia, the numbers above may not reach anyone. */}
      <p className="mt-3 text-footnote text-ink-faint">
        {tr('Не в России — ', 'Elsewhere — ')}
        <a href="https://findahelpline.com" target="_blank" rel="noreferrer noopener" className="font-medium text-accent hover:opacity-80">
          findahelpline.com
        </a>
        {tr(': бесплатные линии помощи в вашей стране.', ': free helplines in your country.')}
      </p>
    </>
  );
}

const NOT_THERAPY = () =>
  tr(
    'Это упражнения, чтобы лучше понять себя и друг друга. Они не лечат и не заменяют психолога или психотерапевта. Если урок задевает что-то тяжёлое, его можно отложить и вернуться позже — одному или вместе со специалистом.',
    'These are exercises to understand yourself and each other better. They don’t treat anything and don’t replace a psychologist or therapist. If a lesson touches something heavy, you can put it aside and come back later — on your own or with a professional.',
  );

export function CareNote({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <details className="group rounded-2xl bg-surface shadow-card">
        <summary className="flex min-h-13 cursor-pointer list-none items-center gap-3 rounded-2xl px-5 py-3 text-subhead font-medium text-ink-soft transition-colors hover:bg-sunken/50 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 flex-1">{tr('Если становится тяжело', 'If it gets heavy')}</span>
          <ChevronDown className="size-5 shrink-0 text-line-strong transition-transform duration-300 group-open:rotate-180" aria-hidden />
        </summary>
        <div className="px-5 pb-5">
          <p className="measure text-subhead text-ink-soft">{NOT_THERAPY()}</p>
          <div className="mt-4">
            <Lines />
          </div>
        </div>
      </details>
    );
  }

  return (
    <section className="rounded-2xl bg-surface p-5 shadow-card" aria-labelledby="care-title">
      <h2 id="care-title" className="text-headline font-semibold">
        {tr('Курс — не терапия', 'This course isn’t therapy')}
      </h2>
      <p className="measure mt-1.5 text-body text-ink-soft">{NOT_THERAPY()}</p>
      <div className="mt-4 border-t border-line pt-4">
        <Lines />
      </div>
    </section>
  );
}
