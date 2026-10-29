'use client';

import { useEffect, useState } from 'react';
import { BellRing, Check } from 'lucide-react';
import { currentSubscription, pushSupported, subscribePush, unsubscribePush, VAPID_PUBLIC_KEY } from '@/lib/push';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { isNative } from '@/lib/native';
import { nativePushStatus, subscribeNativePush, unsubscribeNativePush } from '@/lib/nativePushClient';
import { Button } from '@/components/ui/Button';

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
    checking: 'Проверяем это устройство…',
    on: 'На это устройство приходят уведомления. Весточки — сразу, остальное — по настройкам ниже.',
    off: 'Включите, чтобы весточки и новости партнёра приходили, даже когда приложение закрыто.',
    denied: 'Браузер запретил уведомления для этого сайта. Разрешите их в настройках браузера и обновите страницу.',
    unsupported: 'Этот браузер не умеет присылать уведомления. Лента ниже всё равно обновляется сама.',
    unconfigured: 'Push пока не настроен на сервере: нужен ключ VAPID. Лента в приложении работает и без него.',
    'ios-install': 'На iPhone уведомления работают только у приложения на экране «Домой»: «Поделиться» → «На экран Домой», затем откройте Впаре оттуда.',
  };

  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-card md:p-6">
      <div className="flex items-start gap-3">
        <BellRing className="mt-0.5 size-5 shrink-0 text-ink-soft" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">Уведомления на этом устройстве</h2>
          <p className="mt-1.5 text-sm text-ink-soft" role="status">
            {copy[status]}
          </p>
          {failed && <p className="mt-2 text-sm text-danger">Не получилось подписаться. Попробуйте ещё раз.</p>}
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
                  <Check className="size-4" aria-hidden /> Включено — выключить
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
                  Включить уведомления
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
  const [status, setStatus] = useState<'checking' | 'on' | 'off' | 'denied'>('checking');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    nativePushStatus().then(setStatus);
  }, []);

  const copy = {
    checking: 'Проверяем телефон…',
    on: 'Уведомления приходят на этот телефон. Весточки — сразу, остальное — по настройкам ниже.',
    off: 'Включите, чтобы весточки и новости партнёра приходили, даже когда приложение закрыто.',
    denied: 'Уведомления для Впаре выключены в настройках телефона. Включите их там и вернитесь сюда.',
  };

  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-card md:p-6">
      <div className="flex items-start gap-3">
        <BellRing className="mt-0.5 size-5 shrink-0 text-ink-soft" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">Уведомления на этом телефоне</h2>
          <p className="mt-1.5 text-sm text-ink-soft" role="status">
            {copy[status]}
          </p>
          {failed && <p className="mt-2 text-sm text-danger">Не получилось подключить уведомления. Попробуйте ещё раз чуть позже.</p>}
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
                    else setFailed(true);
                  }
                  setBusy(false);
                }}
              >
                {status === 'on' ? (
                  <>
                    <Check className="size-4" aria-hidden /> Включено — выключить
                  </>
                ) : (
                  'Включить уведомления'
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
