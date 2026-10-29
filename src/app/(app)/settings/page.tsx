'use client';

import { useEffect, useState } from 'react';
import { Bell, Check, LayoutGrid, Lock, Monitor, Moon, Sun, UserRound } from 'lucide-react';
import { displayName } from '@/lib/words';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Segment } from '@/components/ui/Controls';
import { Card, LinkRow, Page, PageHeader, RowGroup } from '@/components/ui/Blocks';
import { InviteCard } from '@/components/InviteCard';

type ThemeChoice = 'system' | 'light' | 'dark';

function readTheme(): ThemeChoice {
  try {
    const stored = localStorage.getItem('bepair-theme');
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return 'system';
  }
}

export default function SettingsPage() {
  const { profile, partner, updateProfile, signOut } = useSpaceAuth();

  const [name, setName] = useState(profile?.display_name ?? '');
  const [savedName, setSavedName] = useState(false);
  const [theme, setTheme] = useState<ThemeChoice>('system');

  useEffect(() => {
    setTheme(readTheme());
  }, []);

  const applyTheme = (choice: ThemeChoice) => {
    setTheme(choice);
    try {
      if (choice === 'system') localStorage.removeItem('bepair-theme');
      else localStorage.setItem('bepair-theme', choice);
    } catch {}
    if (choice === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = choice;
  };

  return (
    <Page width="form">
      <PageHeader title="Настройки" />

      <div className="space-y-4">
        <Card>
          <h2 className="font-semibold">Как вас зовут</h2>
          <p className="mt-1.5 mb-4 text-sm text-ink-soft">Это имя видит партнёр.</p>
          <form
            className="flex flex-wrap gap-2"
            onSubmit={async (event) => {
              event.preventDefault();
              if (await updateProfile({ display_name: name.trim() })) setSavedName(true);
            }}
          >
            <Input
              aria-label="Имя"
              autoComplete="given-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setSavedName(false);
              }}
              className="min-w-0 flex-1"
            />
            <Button type="submit" variant="secondary" disabled={!name.trim() || name.trim() === profile?.display_name}>
              {savedName && <Check className="size-4" aria-hidden />} {savedName ? 'Сохранено' : 'Сохранить'}
            </Button>
          </form>

          <div className="mt-5">
            <p className="mb-2 text-sm font-medium">Как о вас писать</p>
            <Segment
              legend="Как о вас писать"
              options={[
                { value: 'f' as const, label: 'Она отметила' },
                { value: 'm' as const, label: 'Он отметил' },
              ]}
              value={profile?.gender ?? null}
              onChange={(gender) => updateProfile({ gender })}
            />
            <p className="mt-2 text-sm text-ink-faint">Чтобы уведомления партнёру звучали по-человечески.</p>
          </div>
        </Card>

        <Card>
          <h2 className="font-semibold">Тема</h2>
          <p className="mt-1.5 mb-4 text-sm text-ink-soft">Вечером в темноте светлая тема бьёт по глазам — можно переключить.</p>
          <Segment
            legend="Тема"
            options={[
              { value: 'system' as const, label: 'Как в системе', Icon: Monitor },
              { value: 'light' as const, label: 'Светлая', Icon: Sun },
              { value: 'dark' as const, label: 'Тёмная', Icon: Moon },
            ]}
            value={theme}
            onChange={applyTheme}
          />
        </Card>

        {partner ? (
          <Card>
            <h2 className="font-semibold">Пространство</h2>
            <p className="mt-1.5 text-sm text-ink-soft">
              В пространстве вас двое: вы и {displayName(partner.display_name)}. Больше двух в нём не бывает, поэтому код приглашения уже не нужен.
            </p>
          </Card>
        ) : (
          <InviteCard />
        )}

        <RowGroup label="Ещё настройки">
          <LinkRow href="/settings/paired" Icon={Lock} title="Парные настройки" sub="Меняются только по согласию обоих" />
          <LinkRow href="/settings/personal" Icon={UserRound} title="Личные и данные" sub="Цикл, выгрузка ваших данных" />
          <LinkRow href="/notifications/settings" Icon={Bell} title="Уведомления" sub="Что присылать на это устройство" />
          <LinkRow href="/settings/widgets" Icon={LayoutGrid} title="Виджеты" sub="День и пара на экране «Домой»" />
        </RowGroup>

        <Card>
          <h2 className="font-semibold">Аккаунт</h2>
          <p className="mt-1.5 mb-4 text-sm text-ink-soft">Выход не удаляет ваши дни — они останутся на месте.</p>
          <Button variant="danger" onClick={signOut}>
            Выйти
          </Button>
        </Card>
      </div>
    </Page>
  );
}
