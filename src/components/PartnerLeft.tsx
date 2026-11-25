'use client';

import { UserMinus } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { displayName, leftVerb } from '@/lib/words';
import { tr } from '@/lib/i18n';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { LinkButton } from '@/components/ui/Button';

/*
  What the one who stayed sees in place of the invite. Said as a fact, not as
  a loss to dwell on: what happened, what is still here, and the one way to
  start again. The space is closed, so there is no code to send anyone.
*/
export function PartnerLeftCard({ compact = false }: { compact?: boolean }) {
  const { closedSpace } = useSpaceAuth();
  if (!closedSpace) return null;
  const name = displayName(closedSpace.name);
  const date = format(parseISO(closedSpace.at), 'dd.MM.yyyy');

  return (
    <section className="rounded-2xl bg-surface p-5 shadow-card">
      <div className="flex items-center gap-3.5">
        <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-soft">
          <UserMinus className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-headline font-semibold">
            {tr(`${name} ${leftVerb(closedSpace.gender)} из пары`, `${name} left the pair`)}
          </h2>
          <p className="text-footnote text-ink-faint">{date}</p>
        </div>
      </div>
      {!compact && (
        <>
          <p className="mt-3 text-sm text-ink-soft">
            {tr(
              'Всё, что было между вами, осталось здесь: его можно перечитать или скачать. Позвать сюда другого человека нельзя — чтобы начать заново, удалите это пространство.',
              'Everything between you is still here to reread or download. Nobody new can join this space — to start again, delete it.',
            )}
          </p>
          <div className="mt-4">
            <LinkButton href="/settings/account" variant="secondary">
              {tr('Что можно сделать', 'What you can do')}
            </LinkButton>
          </div>
        </>
      )}
    </section>
  );
}
