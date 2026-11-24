'use client';

import { useEffect, useState } from 'react';
import { LayoutGrid, MapPin, ShieldCheck } from 'lucide-react';
import { agoLabel, distanceLabel, distanceM, isStale, TOGETHER_M, type LocationState } from '@/lib/location';
import { isNative, nativePlatform, type LocationNative } from '@/lib/native';
import { displayName } from '@/lib/words';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { useLocation } from '@/hooks/useLocation';
import { PairMap } from '@/components/PairMap';
import { Button } from '@/components/ui/Button';
import { Alert, Card, LinkRow, Loading, Page, PageHeader, RowGroup, SwitchRow } from '@/components/ui/Blocks';
import { getLang, tr } from '@/lib/i18n';

/*
  «Где мы»: the two of you on one map. The same rule as the day — you see your
  partner only while you share yourself; switching off takes your point away
  for both at once. Only the latest point is kept, never a track.
*/
export default function MapPage() {
  const { profile, partner } = useSpaceAuth();
  const { state, native, isLoading, busy, error, setSharing, allowBackground } = useLocation();
  const [platform, setPlatform] = useState<'ios' | 'android' | 'web'>('web');
  /* Re-render once a minute so «5 мин назад» keeps counting. */
  const [, setNow] = useState(0);

  useEffect(() => {
    setPlatform(isNative() ? nativePlatform() : 'web');
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const name = displayName(partner?.display_name);
  const myName = displayName(profile?.display_name, tr('Вы', 'You'));
  const initial = (text: string) => (text.trim()[0] ?? '·').toLocaleUpperCase();

  return (
    <Page>
      <PageHeader title={tr('Где мы', 'Where we are')} back={{ href: '/settings', label: tr('Профиль', 'Profile') }} />

      {isLoading ? (
        <Loading label={tr('Загружаем карту…', 'Loading the map…')} />
      ) : !state ? (
        <Alert>{error ?? tr('Карта пока недоступна.', 'The map isn’t available yet.')}</Alert>
      ) : (
        <div className="space-y-4">
          {error && <Alert>{error}</Alert>}

          {state.me || state.partner ? (
            <>
              <PairMap
                className="h-[min(58dvh,30rem)]"
                me={{ point: state.me, initial: initial(myName), label: myName }}
                partner={{ point: state.partner, initial: initial(name), label: name }}
              />
              <Status state={state} name={name} />
            </>
          ) : (
            <Card>
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 size-5 shrink-0 text-ink-soft" aria-hidden />
                <div>
                  <h2 className="font-semibold">{emptyTitle(state)}</h2>
                  <p className="mt-1.5 text-sm text-ink-soft">{emptyText(state, name)}</p>
                </div>
              </div>
            </Card>
          )}

          {state.has_partner && (
            <RowGroup
              label={tr('Местоположение', 'Location')}
              footer={tr(
                'Раз в 5 минут. Видно только вам двоим и только пока вы оба делитесь. Хранится одна последняя точка, без истории перемещений.',
                `Every 5 minutes. Only ${name} sees it, and only while you both share. Just the latest point is kept — no history of where you went.`,
              )}
            >
              <SwitchRow
                Icon={MapPin}
                title={tr('Делиться моим местоположением', 'Share my location')}
                sub={sharingSub(state, name)}
                checked={state.sharing}
                disabled={busy}
                onChange={setSharing}
              />
            </RowGroup>
          )}

          {state.sharing && <Delivery platform={platform} native={native} onAllowBackground={allowBackground} />}
        </div>
      )}
    </Page>
  );
}

function Status({ state, name }: { state: LocationState; name: string }) {
  const lang = getLang();
  if (!state.partner) {
    return (
      <p className="px-1 text-subhead text-ink-faint">
        {state.partner_sharing
          ? tr(`${name} пока не на карте — точка появится, когда телефон её пришлёт`, `${name} isn’t on the map yet — the dot appears once their phone sends it`)
          : tr(`${name} пока не делится местоположением`, `${name} isn’t sharing their location yet`)}
      </p>
    );
  }
  const ago = agoLabel(state.partner.recorded_at, lang);
  const metres = state.me ? distanceM(state.me, state.partner) : null;
  const where =
    metres === null
      ? null
      : metres < TOGETHER_M
        ? tr('Вы рядом', 'You’re together')
        : tr(`${distanceLabel(metres, lang)} от вас`, `${distanceLabel(metres, lang)} away`);
  return (
    <div className="px-1">
      <p className="text-headline font-semibold">{where ? `${name} · ${where}` : name}</p>
      <p className="text-subhead text-ink-faint">
        {isStale(state.partner.recorded_at)
          ? tr(`Последняя точка — ${ago}, новых пока нет`, `Last point ${ago}, nothing newer yet`)
          : tr(`Обновлено ${ago}`, `Updated ${ago}`)}
      </p>
    </div>
  );
}

function emptyTitle(state: LocationState) {
  if (!state.has_partner) return tr('Карта — для двоих', 'The map is for two');
  if (!state.sharing) return tr('Видеть друг друга на карте', 'See each other on the map');
  return tr('Ищем вас на карте…', 'Finding you on the map…');
}

function emptyText(state: LocationState, name: string) {
  if (!state.has_partner) return tr('Позовите партнёра — код в профиле. Карта откроется, когда вы оба включите её.', 'Invite your partner — the code is in your profile. The map opens once you both switch it on.');
  if (!state.sharing) {
    return state.partner_sharing
      ? tr(`${name} уже делится. Включите своё — и вы увидите друг друга.`, `${name} is already sharing. Turn yours on and you’ll see each other.`)
      : tr('Включите ниже. Партнёр увидит вас, когда тоже включит, — и вы его.', 'Switch it on below. Your partner sees you once they switch it on too — and you them.');
  }
  return tr('Точка появится через несколько секунд.', 'Your dot appears in a few seconds.');
}

function sharingSub(state: LocationState, name: string) {
  if (!state.sharing) return state.partner_sharing ? tr(`${name} уже делится`, `${name} is already sharing`) : undefined;
  return state.partner_sharing ? tr('Вы видите друг друга', 'You see each other') : tr(`Ждём, когда ${name === 'Партнёр' ? 'партнёр' : name} тоже включит`, `Waiting for ${name} to switch it on too`);
}

/* How the point gets sent from this device, and what would make it better. */
function Delivery({ platform, native, onAllowBackground }: { platform: 'ios' | 'android' | 'web'; native: LocationNative | null; onAllowBackground: () => void }) {
  if (platform === 'android' && native) {
    return (
      <div className="space-y-4">
        {!native.background && (
          <Card>
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-ink-soft" aria-hidden />
              <div className="min-w-0">
                <h2 className="font-semibold">{tr('Чтобы карта не замирала', 'So the map keeps going')}</h2>
                <p className="mt-1.5 text-sm text-ink-soft">
                  {tr(
                    'Сейчас точка отправляется, пока работает сервис Впаре — его видно в шторке. Разрешите доступ «Всегда», и он сам включится после перезагрузки телефона.',
                    'Right now your point is sent while the Bepair service runs — you can see it in the notification shade. Allow access “All the time” and it comes back by itself after a restart.',
                  )}
                </p>
                <Button variant="secondary" className="mt-3" onClick={onAllowBackground}>
                  {tr('Разрешить «Всегда»', 'Allow “All the time”')}
                </Button>
              </div>
            </div>
          </Card>
        )}
        <RowGroup label={tr('Виджет', 'Widget')}>
          <LinkRow
            href="/settings/widgets"
            Icon={LayoutGrid}
            title={tr('Виджет «Карта»', 'The Map widget')}
            sub={tr('Вы и партнёр на рабочем столе, обновляется раз в 5 минут', 'The two of you on the home screen, every 5 minutes')}
          />
        </RowGroup>
      </div>
    );
  }
  return (
    <p className="px-1 text-footnote text-ink-faint">
      {tr(
        'В браузере точка обновляется, пока Впаре открыта. В приложении для Android — каждые 5 минут, даже когда оно закрыто, и есть виджет «Карта».',
        'In a browser your point updates while Bepair is open. The Android app sends it every 5 minutes even when closed, and has a Map widget.',
      )}
    </p>
  );
}
