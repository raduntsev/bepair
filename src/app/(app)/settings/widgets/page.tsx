'use client';

import { useCallback, useEffect, useState } from 'react';
import { EyeOff, Smartphone, Trash2 } from 'lucide-react';
import supabase from '@/lib/supabase';
import { relativeStamp } from '@/lib/dates';
import { clearWidgets, isNative, nativePlatform, refreshWidgets } from '@/lib/native';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { Button } from '@/components/ui/Button';
import { Card, Page, PageHeader, RowGroup, SwitchRow } from '@/components/ui/Blocks';

interface Device {
  id: string;
  platform: 'ios' | 'android' | 'unknown';
  created_at: string;
  last_used_at: string | null;
}

const PLATFORM = { ios: 'iPhone', android: 'Android', unknown: 'Устройство' };

const HOW_TO = {
  ios: [
    'Нажмите и подержите пустое место на экране «Домой», пока значки не задрожат.',
    'Нажмите «Изменить» → «Добавить виджет» и найдите «Впаре».',
    'Выберите размер: маленький — ваш день и день партнёра, средний — ещё дни вместе и серия.',
    'Для экрана блокировки: подержите экран блокировки → «Настроить» → «Виджеты».',
  ],
  android: [
    'Нажмите и подержите пустое место на рабочем столе.',
    'Выберите «Виджеты» и найдите «Впаре».',
    'Перетащите «День» или «Пара» на рабочий стол.',
  ],
};

export default function WidgetSettingsPage() {
  const { profile, updateProfile } = useSpaceAuth();
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [native, setNative] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'web'>('web');

  const load = useCallback(async () => {
    const { data } = await supabase.from('widget_tokens').select('id, platform, created_at, last_used_at').order('created_at', { ascending: false });
    setDevices((data ?? []) as Device[]);
  }, []);

  useEffect(() => {
    setNative(isNative());
    setPlatform(nativePlatform());
    load();
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
      <PageHeader title="Виджеты" back={{ href: '/settings', label: 'Настройки' }} />

      <div className="space-y-4">
        {native && steps ? (
          <Card>
            <h2 className="font-semibold">Как добавить</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-ink-soft">
              {steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <p className="mt-3 text-sm text-ink-faint">Виджет обновляется сам каждые 15–30 минут и сразу, когда вы что-то делаете в приложении.</p>
          </Card>
        ) : (
          <Card>
            <div className="flex items-start gap-3">
              <Smartphone className="mt-0.5 size-5 shrink-0 text-ink-soft" aria-hidden />
              <div>
                <h2 className="font-semibold">Виджеты — в приложении для телефона</h2>
                <p className="mt-1.5 text-sm text-ink-soft">
                  Браузер и сайт на экране «Домой» не могут ставить виджеты — так устроены iOS и Android. Установите приложение Впаре для iPhone или Android
                  и войдите тем же аккаунтом: виджет подключится сам.
                </p>
              </div>
            </div>
          </Card>
        )}

        <RowGroup label="Что видно на виджете">
          <SwitchRow
            Icon={EyeOff}
            title="Скрывать настроение"
            sub="Без цветов и слов — только «отмечено» или нет. Для экрана, который видят другие"
            checked={profile?.widget_hide_colors ?? false}
            onChange={async (next) => {
              await updateProfile({ widget_hide_colors: next });
              refreshWidgets();
            }}
          />
        </RowGroup>
        <p className="text-sm text-ink-faint">
          День партнёра на виджете подчиняется тому же правилу, что и в приложении: пока вы не отметили свой, видно только, что он отмечен.
        </p>

        {devices && devices.length > 0 && (
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">Подключённые устройства</h2>
              {devices.length > 1 && (
                <Button variant="ghost" onClick={() => revoke()}>
                  Отключить все
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
                      {device.last_used_at ? `обновлялся ${relativeStamp(device.last_used_at)}` : `подключён ${relativeStamp(device.created_at)}`}
                    </span>
                  </span>
                  <Button variant="ghost" onClick={() => revoke(device.id)} aria-label={`Отключить ${PLATFORM[device.platform]}`}>
                    <Trash2 className="size-4" aria-hidden /> Отключить
                  </Button>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-sm text-ink-faint">Потеряли телефон — отключите его здесь, и виджет на нём перестанет показывать ваш день.</p>
          </Card>
        )}
      </div>
    </Page>
  );
}
