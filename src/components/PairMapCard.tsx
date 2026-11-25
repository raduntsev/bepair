'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, MapPin } from 'lucide-react';
import { agoLabel, distanceLabel, distanceM, TOGETHER_M, type LocationState } from '@/lib/location';
import { displayName } from '@/lib/words';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { useLocation } from '@/hooks/useLocation';
import { PairMap } from '@/components/PairMap';
import { LinkRow, RowGroup } from '@/components/ui/Blocks';
import { getLang, tr } from '@/lib/i18n';

/*
  «Где мы» in the profile, drawn like the «Карта» widget: the two dots on the
  map edge to edge, one caption laid over the bottom. The whole card is a link
  to the map screen, where sharing is switched on and off. Until there is a
  dot to show, it is an ordinary row that says what is missing.
*/
export function PairMapCard() {
  const { profile, partner } = useSpaceAuth();
  const { state, isLoading } = useLocation();
  /* Re-render once a minute so «5 мин назад» keeps counting. */
  const [, setNow] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const name = displayName(partner?.display_name);
  const myName = displayName(profile?.display_name, tr('Вы', 'You'));
  const initial = (text: string) => (text.trim()[0] ?? '·').toLocaleUpperCase();
  const title = tr('Где мы', 'Where we are');

  if (isLoading || !state || !(state.me || state.partner)) {
    return (
      <RowGroup label={tr('Вместе', 'Together')}>
        <LinkRow href="/map" Icon={MapPin} title={title} sub={rowSub(state, name)} />
      </RowGroup>
    );
  }

  const caption = captionFor(state, name);
  return (
    <Link
      href="/map"
      aria-label={`${title}. ${caption.title}. ${caption.line}`}
      className="group relative block h-52 overflow-hidden rounded-2xl bg-sunken shadow-card"
    >
      <PairMap
        preview
        className="absolute inset-0"
        me={{ point: state.me, initial: initial(myName), label: myName }}
        partner={{ point: state.partner, initial: initial(name), label: name }}
      />
      <span className="absolute inset-x-2 bottom-2 z-[500] flex items-center gap-3 rounded-xl bg-surface/90 px-3 py-2 shadow-card transition-colors group-hover:bg-surface">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-headline font-semibold text-ink">{caption.title}</span>
          <span className="block truncate text-footnote text-ink-faint">{caption.line}</span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-line-strong" strokeWidth={2.2} aria-hidden />
      </span>
    </Link>
  );
}

/* The widget's words: who, how far, how fresh. */
function captionFor(state: LocationState, name: string) {
  if (!state.partner) {
    return {
      title: tr('Где мы', 'Where we are'),
      line: state.partner_sharing
        ? tr(`${name} пока не на карте`, `${name} isn’t on the map yet`)
        : tr(`${name} пока не делится местоположением`, `${name} isn’t sharing their location yet`),
    };
  }
  const lang = getLang();
  const ago = agoLabel(state.partner.recorded_at, lang);
  if (!state.me) return { title: name, line: tr(`Обновлено ${ago}`, `Updated ${ago}`) };
  const metres = distanceM(state.me, state.partner);
  const where = metres < TOGETHER_M ? tr('Вы рядом', 'You’re together') : tr(`${distanceLabel(metres, lang)} от вас`, `${distanceLabel(metres, lang)} away`);
  return { title: name, line: `${where} · ${ago}` };
}

function rowSub(state: LocationState | null, name: string) {
  if (!state) return tr('Вы и партнёр на карте', 'The two of you on a map');
  if (!state.sharing) {
    return state.partner_sharing
      ? tr(`${name} уже делится — включите своё`, `${name} is already sharing — turn yours on`)
      : tr('Включите, чтобы видеть друг друга', 'Turn it on to see each other');
  }
  return tr('Ищем вас на карте…', 'Finding you on the map…');
}
