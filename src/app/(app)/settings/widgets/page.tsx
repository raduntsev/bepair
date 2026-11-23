'use client';

import { useCallback, useEffect, useState } from 'react';
import { EyeOff, Images, LockKeyhole, Smartphone, Trash2 } from 'lucide-react';
import supabase from '@/lib/supabase';
import { relativeStamp } from '@/lib/dates';
import { WidgetBridge, clearWidgets, isNative, nativePlatform, refreshWidgets } from '@/lib/native';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { Button } from '@/components/ui/Button';
import { Card, LinkRow, Page, PageHeader, RowGroup, SwitchRow } from '@/components/ui/Blocks';
import { tr } from '@/lib/i18n';

interface Device {
  id: string;
  platform: 'ios' | 'android' | 'unknown';
  created_at: string;
  last_used_at: string | null;
}

const PLATFORM = { ios: 'iPhone', android: 'Android', unknown: tr('Устройство', 'Device') };

const HOW_TO = {
  ios: [
    tr('Нажмите и подержите пустое место на экране «Домой», пока значки не задрожат.', 'Touch and hold an empty spot on the Home Screen until the icons jiggle.'),
    tr('Нажмите «Изменить» → «Добавить виджет» и найдите «Впаре».', 'Tap Edit → Add Widget and find Bepair.'),
    tr('Выберите размер: маленький — ваш день и день партнёра, средний — ещё дни вместе и серия. «Фото» — ваши общие снимки.', 'Pick a size: small shows both your days, medium adds the run. “Photo” shows your shared photos.'),
    tr('Для экрана блокировки: подержите экран блокировки → «Настроить» → «Виджеты».', 'For the Lock Screen: touch and hold it → Customize → Widgets.'),
  ],
  android: [
    tr('Нажмите и подержите пустое место на рабочем столе.', 'Touch and hold an empty spot on the home screen.'),
    tr('Выберите «Виджеты» и найдите «Впаре».', 'Choose Widgets and find Bepair.'),
    tr('Перетащите «День», «Пара» или «Фото» на рабочий стол.', 'Drag Day, Couple or Photo onto the home screen.'),
  ],
};

export default function WidgetSettingsPage() {
  const { profile, updateProfile } = useSpaceAuth();
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [native, setNative] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'web'>('web');
  /* null: this shell has no lock-screen line (iPhone, the browser, or an older APK). */
  const [lock, setLock] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('widget_tokens').select('id, platform, created_at, last_used_at').order('created_at', { ascending: false });
    setDevices((data ?? []) as Device[]);
  }, []);

  useEffect(() => {
    setNative(isNative());
    setPlatform(nativePlatform());
    load();
    if (nativePlatform() === 'android') {
      WidgetBridge.lockStatus()
        .then(({ enabled, permitted }) => setLock(enabled && permitted))
        .catch(() => setLock(null));
    }
  }, [load]);

  const revoke = async (id?: string) => {
    const query = supabase.from('widget_tokens').delete();
    await (id ? query.eq('id', id) : query.neq('id', '00000000-0000-0000-0000-000000000000'));
    /* This phone forgets its key too; it gets a fresh one the next time the app opens. */
    if (!id || devices?.length === 1) await clearWidgets();
    await load();
  };

  const steps = platform === 'ios' || platform === 'android' ? HOW_TO[platform] : null;

  return (
    <Page width="form">
      <PageHeader title={tr('Виджеты', 'Widgets')} back={{ href: '/settings', label: tr('Профиль', 'Profile') }} />

      <div className="space-y-4">
        {lock !== null && (
          <RowGroup label={tr('Экран блокировки', 'Lock screen')}>
            <SwitchRow
              Icon={LockKeyhole}
              title={tr('Статус дня на экране блокировки', 'Day status on the lock screen')}
              sub={tr('Тихая строка: отмечен ли день, ждёт ли письмо', 'A quiet line: is the day marked, is a letter waiting')}
              checked={lock}
              onChange={async (next) => {
                setLock(next);
                try {
                  const { enabled } = await WidgetBridge.setLockStatus({ enabled: next });
                  setLock(enabled);
                } catch {
                  setLock(!next);
                }
              }}
            />
          </RowGroup>
        )}

        {native && steps ? (
          <Card>
            <h2 className="font-semibold">{tr('Как добавить', 'How to add')}</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-ink-soft">
              {steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </Card>
        ) : (
          <Card>
            <div className="flex items-start gap-3">
              <Smartphone className="mt-0.5 size-5 shrink-0 text-ink-soft" aria-hidden />
              <div>
                <h2 className="font-semibold">{tr('Виджеты — в приложении для телефона', 'Widgets live in the phone app')}</h2>
                <p className="mt-1.5 text-sm text-ink-soft">
                  {tr(
                    'Браузер и сайт на экране «Домой» не могут ставить виджеты — так устроены iOS и Android. Установите приложение Впаре для iPhone или Android и войдите тем же аккаунтом: виджет подключится сам.',
                    'A browser or a Home Screen site can’t place widgets — that’s how iOS and Android work. Install the Bepair app for iPhone or Android and sign in with the same account: the widget connects by itself.',
                  )}
                </p>
              </div>
            </div>
          </Card>
        )}

        <RowGroup label={tr('Фото', 'Photo')}>
          <LinkRow href="/album" Icon={Images} title={tr('Фото для виджета', 'Photos for the widget')} sub={tr('Общий альбом: виджет «Фото» показывает его на обоих телефонах', 'A shared album: the Photo widget shows it on both phones')} />
        </RowGroup>

        <RowGroup label={tr('Что видно на виджете', 'What the widget shows')}>
          <SwitchRow
            Icon={EyeOff}
            title={tr('Скрывать настроение', 'Hide mood')}
            sub={tr('Без цветов и слов — только «отмечено» или нет. Для экрана, который видят другие', 'No colours or words — only marked or not. For a screen others can see')}
            checked={profile?.widget_hide_colors ?? false}
            onChange={async (next) => {
              await updateProfile({ widget_hide_colors: next });
              refreshWidgets();
            }}
          />
        </RowGroup>
        <p className="text-sm text-ink-faint">
          {tr('День партнёра на виджете подчиняется тому же правилу, что и в приложении: пока вы не отметили свой, видно только, что он отмечен.', 'Your partner’s day on the widget follows the same rule as in the app: until you mark yours, you only see that theirs is marked.')}
        </p>

        {devices && devices.length > 0 && (
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">{tr('Подключённые устройства', 'Connected devices')}</h2>
              {devices.length > 1 && (
                <Button variant="ghost" onClick={() => revoke()}>
                  {tr('Отключить все', 'Disconnect all')}
                </Button>
              )}
            </div>
            <ul className="mt-3 divide-y divide-line">
              {devices.map((device) => (
                <li key={device.id} className="flex items-center gap-3 py-3">
                  <Smartphone className="size-4.5 shrink-0 text-ink-soft" aria-hidden />
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="block font-medium text-ink">{PLATFORM[device.platform]}</span>
                    <span className="block text-ink-faint">
                      {device.last_used_at
                        ? tr(`обновлялся ${relativeStamp(device.last_used_at)}`, `updated ${relativeStamp(device.last_used_at)}`)
                        : tr(`подключён ${relativeStamp(device.created_at)}`, `connected ${relativeStamp(device.created_at)}`)}
                    </span>
                  </span>
                  <Button variant="ghost" onClick={() => revoke(device.id)} aria-label={tr(`Отключить ${PLATFORM[device.platform]}`, `Disconnect ${PLATFORM[device.platform]}`)}>
                    <Trash2 className="size-4" aria-hidden /> {tr('Отключить', 'Disconnect')}
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </Page>
  );
}
