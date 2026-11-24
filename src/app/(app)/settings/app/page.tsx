'use client';

import { useEffect, useState } from 'react';
import { Apple, Check, Download, Monitor, Smartphone } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Card, Page, PageHeader } from '@/components/ui/Blocks';
import { InstallCard } from '@/components/InstallCard';
import { tr } from '@/lib/i18n';

/* Published by .github/workflows/native.yml on every merge into main. */
const ANDROID_APK = 'https://github.com/raduntsev/bepair/releases/download/android-latest/vpare.apk';
const RELEASE_PAGE = 'https://github.com/raduntsev/bepair/releases/tag/android-latest';

type Device = 'android' | 'ios' | 'desktop' | 'native';

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="mt-3 space-y-2.5">
      {items.map((text, i) => (
        <li key={i} className="flex gap-3 text-subhead text-ink-soft">
          <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-footnote font-semibold text-accent-soft-ink">
            {i + 1}
          </span>
          <span className="pt-0.5">{text}</span>
        </li>
      ))}
    </ol>
  );
}

/*
  «Приложение на телефон»: where to get Впаре for this phone. Android gets the
  real app with widgets as an APK from the project's releases; iPhone gets the
  home-screen app (a native iPhone build needs a Mac and a paid Apple account,
  so it is not offered as a download). The card for this phone comes first.
*/
export default function PhoneAppPage() {
  const [device, setDevice] = useState<Device>('desktop');

  useEffect(() => {
    if (Capacitor.isNativePlatform()) setDevice('native');
    else if (/android/i.test(navigator.userAgent)) setDevice('android');
    else if (/iphone|ipad|ipod/i.test(navigator.userAgent)) setDevice('ios');
  }, []);

  const android = (
    <Card key="android">
      <h2 className="flex items-center gap-2 text-headline font-semibold">
        <Smartphone className="size-5 text-accent" aria-hidden /> Android
      </h2>
      <p className="measure mt-1.5 text-subhead text-ink-soft">
        {tr('Настоящее приложение: виджеты на экране «Домой», статус дня на экране блокировки, уведомления.', 'The real app: home-screen widgets, the day on the lock screen, notifications.')}
      </p>
      <a
        href={ANDROID_APK}
        className="mt-4 flex h-[3.25rem] w-full items-center justify-center gap-2 rounded-[0.875rem] bg-accent px-6 text-headline font-semibold text-accent-ink transition-opacity active:opacity-70"
      >
        <Download className="size-5" aria-hidden /> {tr('Скачать для Android', 'Download for Android')}
      </a>
      <Steps
        items={[
          tr('Откройте эту страницу на телефоне и нажмите «Скачать».', 'Open this page on the phone and tap Download.'),
          tr('Откройте скачанный файл vpare.apk. Если Android спросит — разрешите установку из браузера.', 'Open the downloaded vpare.apk. If Android asks, allow installs from the browser.'),
          tr('Войдите тем же способом, что здесь.', 'Sign in the same way as here.'),
          tr('Виджеты: долгое нажатие на рабочем столе → «Виджеты» → Впаре.', 'Widgets: long-press the home screen → Widgets → Bepair.'),
        ]}
      />
      <p className="mt-3 text-footnote text-ink-faint">
        {tr('Новая версия появляется по той же ссылке. ', 'New versions appear at the same link. ')}
        <a href={RELEASE_PAGE} target="_blank" rel="noreferrer noopener" className="text-accent">
          {tr('Все сборки', 'All builds')}
        </a>
      </p>
    </Card>
  );

  const iphone = (
    <Card key="ios">
      <h2 className="flex items-center gap-2 text-headline font-semibold">
        <Apple className="size-5 text-accent" aria-hidden /> iPhone
      </h2>
      <p className="measure mt-1.5 text-subhead text-ink-soft">
        {tr(
          'На iPhone Впаре ставится из Safari прямо на экран «Домой» — открывается как приложение и присылает уведомления (iOS 16.4 и новее).',
          'On iPhone, Bepair goes onto the Home Screen straight from Safari — it opens like an app and sends notifications (iOS 16.4 or later).',
        )}
      </p>
      <Steps
        items={[
          tr('Откройте Впаре в Safari.', 'Open Bepair in Safari.'),
          tr('Нажмите «Поделиться» — квадрат со стрелкой внизу экрана.', 'Tap Share — the square with an arrow at the bottom.'),
          tr('Выберите «На экран „Домой“» и нажмите «Добавить».', 'Choose Add to Home Screen and tap Add.'),
          tr('Откройте Впаре с экрана «Домой» и включите уведомления в Профиле.', 'Open Bepair from the Home Screen and turn on notifications in Profile.'),
        ]}
      />
      <p className="mt-3 text-footnote text-ink-faint">
        {tr(
          'Виджеты на iPhone есть только у приложения из App Store или TestFlight: для такой сборки нужен Mac и платный аккаунт Apple Developer.',
          'iPhone widgets need an App Store or TestFlight build, which requires a Mac and a paid Apple Developer account.',
        )}
      </p>
    </Card>
  );

  const order = device === 'ios' ? [iphone, android] : [android, iphone];

  return (
    <Page width="form">
      <PageHeader title={tr('Приложение на телефон', 'App for your phone')} back={{ href: '/settings', label: tr('Профиль', 'Profile') }} />
      <div className="space-y-3">
        {device === 'native' && (
          <Card>
            <p className="flex items-center gap-2 text-body font-semibold">
              <Check className="size-5 text-accent" aria-hidden /> {tr('Вы уже в приложении', 'You are in the app')}
            </p>
            <p className="mt-1 text-subhead text-ink-soft">{tr('Ссылка ниже пригодится, чтобы поставить Впаре партнёру или обновить.', 'The link below helps to install Bepair for your partner or to update.')}</p>
          </Card>
        )}
        {device === 'desktop' && (
          <p className="flex items-center gap-2 px-1 text-subhead text-ink-faint">
            <Monitor className="size-4" aria-hidden /> {tr('Откройте эту страницу на телефоне — там будет нужная кнопка.', 'Open this page on your phone — the right button will be there.')}
          </p>
        )}
        {device !== 'native' && <InstallCard />}
        {order}
      </div>
    </Page>
  );
}
