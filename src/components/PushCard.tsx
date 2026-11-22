'use client';

import { useEffect, useState } from 'react';
import { BellRing, Check } from 'lucide-react';
import { currentSubscription, pushSupported, subscribePush, unsubscribePush, VAPID_PUBLIC_KEY } from '@/lib/push';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { isNative } from '@/lib/native';
import { nativePushStatus, subscribeNativePush, unsubscribeNativePush } from '@/lib/nativePushClient';
import { Button } from '@/components/ui/Button';
import { tr } from '@/lib/i18n';

type Status = 'checking' | 'on' | 'off' | 'denied' | 'unsupported' | 'unconfigured' | 'ios-install';

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true);
}

/* Push is per device: this card is about the phone or laptop in your hand. */
function WebPushCard() {
  const { user } = useSpaceAuth();
  const [status, setStatus] = useState<Status>('checking');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    (async () => {
      if (!VAPID_PUBLIC_KEY) return setStatus('unconfigured');
      if (isIOS() && !isStandalone()) return setStatus('ios-install');
      if (!pushSupported()) return setStatus('unsupported');
      if (Notification.permission === 'denied') return setStatus('denied');
      setStatus((await currentSubscription()) ? 'on' : 'off');
    })();
  }, []);

  const copy: Record<Status, string> = {
    checking: tr('Проверяем это устройство…', 'Checking this device…'),
    on: tr('На это устройство приходят уведомления. Весточки — сразу, остальное — по настройкам ниже.', 'Notifications arrive on this device. Notes at once, the rest as set below.'),
    off: tr('Включите, чтобы весточки и новости партнёра приходили, даже когда приложение закрыто.', 'Turn on to get notes and news from your partner even when the app is closed.'),
    denied: tr('Браузер запретил уведомления для этого сайта. Разрешите их в настройках браузера и обновите страницу.', 'The browser blocked notifications for this site. Allow them in browser settings and reload.'),
    unsupported: tr('Этот браузер не умеет присылать уведомления. Лента ниже всё равно обновляется сама.', 'This browser can’t send notifications. The feed still updates by itself.'),
    unconfigured: tr('Push пока не настроен на сервере: нужен ключ VAPID. Лента в приложении работает и без него.', 'Push isn’t set up on the server yet (needs a VAPID key). The in-app feed works without it.'),
    'ios-install': tr('На iPhone уведомления работают только у приложения на экране «Домой»: «Поделиться» → «На экран Домой», затем откройте Впаре оттуда.', 'On iPhone, notifications only work for the app on the Home Screen: Share → Add to Home Screen, then open Bepair from there.'),
  };

  return (
    <section className="rounded-2xl bg-surface p-5 shadow-card md:p-6">
      <div className="flex items-start gap-3">
        <BellRing className="mt-0.5 size-5 shrink-0 text-ink-soft" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">{tr('Уведомления на этом устройстве', 'Notifications on this device')}</h2>
          <p className="mt-1.5 text-sm text-ink-soft" role="status">
            {copy[status]}
          </p>
          {failed && <p className="mt-2 text-sm text-danger">{tr('Не получилось подписаться. Попробуйте ещё раз.', 'Couldn’t subscribe. Please try again.')}</p>}
          {(status === 'on' || status === 'off') && (
            <div className="mt-4">
              {status === 'on' ? (
                <Button
                  variant="secondary"
                  loading={busy}
                  onClick={async () => {
                    setBusy(true);
                    await unsubscribePush();
                    setBusy(false);
                    setStatus('off');
                  }}
                >
                  <Check className="size-4" aria-hidden /> {tr('Включено — выключить', 'On — turn off')}
                </Button>
              ) : (
                <Button
                  loading={busy}
                  onClick={async () => {
                    if (!user) return;
                    setBusy(true);
                    setFailed(false);
                    const result = await subscribePush(user.id);
                    setBusy(false);
                    if (result === 'subscribed') setStatus('on');
                    else if (result === 'denied') setStatus('denied');
                    else if (result === 'unsupported') setStatus('unsupported');
                    else setFailed(true);
                  }}
                >
                  {tr('Включить уведомления', 'Turn on notifications')}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* Inside the iOS/Android app: APNs or FCM instead of web push. */
function NativePushCard() {
  const { user } = useSpaceAuth();
  const [status, setStatus] = useState<'checking' | 'on' | 'off' | 'denied' | 'unavailable'>('checking');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    nativePushStatus().then(setStatus);
  }, []);

  const copy = {
    checking: tr('Проверяем телефон…', 'Checking the phone…'),
    on: tr('Уведомления приходят на этот телефон. Весточки — сразу, остальное — по настройкам ниже.', 'Notifications arrive on this phone. Notes at once, the rest as set below.'),
    off: tr('Включите, чтобы весточки и новости партнёра приходили, даже когда приложение закрыто.', 'Turn on to get notes and news from your partner even when the app is closed.'),
    denied: tr('Уведомления для Впаре выключены в настройках телефона. Включите их там и вернитесь сюда.', 'Notifications for Bepair are off in phone settings. Turn them on there and come back.'),
    unavailable: tr('В этой сборке приложения push пока не подключён. Уведомления приходят в браузере на этом телефоне, а статус дня можно вывести на экран блокировки в разделе «Виджеты».', 'Push isn’t connected in this build yet. Notifications come through the browser on this phone, and the day’s status can go on the lock screen in Widgets.'),
  };

  return (
    <section className="rounded-2xl bg-surface p-5 shadow-card md:p-6">
      <div className="flex items-start gap-3">
        <BellRing className="mt-0.5 size-5 shrink-0 text-ink-soft" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">{tr('Уведомления на этом телефоне', 'Notifications on this phone')}</h2>
          <p className="mt-1.5 text-sm text-ink-soft" role="status">
            {copy[status]}
          </p>
          {failed && <p className="mt-2 text-sm text-danger">{tr('Не получилось подключить уведомления. Попробуйте ещё раз чуть позже.', 'Couldn’t turn on notifications. Try again a little later.')}</p>}
          {(status === 'on' || status === 'off') && (
            <div className="mt-4">
              <Button
                variant={status === 'on' ? 'secondary' : 'primary'}
                loading={busy}
                onClick={async () => {
                  if (!user) return;
                  setBusy(true);
                  setFailed(false);
                  if (status === 'on') {
                    await unsubscribeNativePush();
                    setStatus('off');
                  } else {
                    const result = await subscribeNativePush(user.id);
                    if (result === 'subscribed') setStatus('on');
                    else if (result === 'denied') setStatus('denied');
                    else if (result === 'unavailable') setStatus('unavailable');
                    else setFailed(true);
                  }
                  setBusy(false);
                }}
              >
                {status === 'on' ? (
                  <>
                    <Check className="size-4" aria-hidden /> {tr('Включено — выключить', 'On — turn off')}
                  </>
                ) : (
                  tr('Включить уведомления', 'Turn on notifications')
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export function PushCard() {
  const [native, setNative] = useState<boolean | null>(null);
  useEffect(() => {
    setNative(isNative());
  }, []);
  if (native === null) return null;
  return native ? <NativePushCard /> : <WebPushCard />;
}
