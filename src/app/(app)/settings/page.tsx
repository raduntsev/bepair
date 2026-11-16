'use client';

import { useEffect, useState } from 'react';
import { Bell, Check, Heart, LayoutGrid, Lock, LogOut, Monitor, Moon, Sun, UserRound } from 'lucide-react';
import { displayName } from '@/lib/words';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Segment } from '@/components/ui/Controls';
import { Card, LinkRow, Page, PageHeader, RowGroup, RowIcon, SectionHeader } from '@/components/ui/Blocks';
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
  const { unread } = useNotifications();

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

  const saveName = async () => {
    const next = name.trim();
    if (!next || next === profile?.display_name) return;
    if (await updateProfile({ display_name: next })) setSavedName(true);
  };

  /*
    The profile is one list, in the order people look for things: who you are
    together, what happened, then how the app behaves. No captions — each row
    says what it is.
  */
  return (
    <Page width="form">
      <PageHeader title="Профиль" />

      <div className="space-y-3">
        <RowGroup label="Вы вдвоём">
          <LinkRow href="/couple" Icon={Heart} tone="partner" title={partner ? `Вы и ${displayName(partner.display_name)}` : 'Пара'} />
          <LinkRow href="/notifications" Icon={Bell} title="Уведомления" badge={unread || undefined} />
        </RowGroup>

        {!partner && <InviteCard />}

        <SectionHeader title="Вы" />
        <Card>
          <form
            className="flex items-center gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              saveName();
            }}
          >
            <RowIcon Icon={UserRound} />
            <Input
              aria-label="Ваше имя"
              autoComplete="given-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setSavedName(false);
              }}
              onBlur={saveName}
              className="min-w-0 flex-1"
            />
            <Check
              className={`size-5 shrink-0 text-accent transition-opacity duration-500 ${savedName ? 'opacity-100' : 'opacity-0'}`}
              aria-label={savedName ? 'Сохранено' : undefined}
            />
          </form>

          <div className="mt-4">
            <Segment
              legend="Как о вас писать"
              options={[
                { value: 'f' as const, label: 'Я женщина' },
                { value: 'm' as const, label: 'Я мужчина' },
              ]}
              value={profile?.gender ?? null}
              onChange={(gender) => updateProfile({ gender })}
            />
          </div>
        </Card>

        <SectionHeader title="Оформление" />
        <Card>
          <Segment
            legend="Тема"
            options={[
              { value: 'system' as const, label: 'Авто', Icon: Monitor },
              { value: 'light' as const, label: 'Светлая', Icon: Sun },
              { value: 'dark' as const, label: 'Тёмная', Icon: Moon },
            ]}
            value={theme}
            onChange={applyTheme}
          />
        </Card>

        <SectionHeader title="Настройки" />
        <RowGroup label="Настройки">
          <LinkRow href="/settings/paired" Icon={Lock} title="Парные" />
          <LinkRow href="/settings/personal" Icon={UserRound} title="Личные и данные" />
          <LinkRow href="/notifications/settings" Icon={Bell} title="Что присылать" />
          <LinkRow href="/settings/widgets" Icon={LayoutGrid} title="Виджеты" />
        </RowGroup>

        <div className="pt-6">
          <Button variant="danger" block onClick={signOut}>
            <LogOut className="size-4" aria-hidden /> Выйти
          </Button>
        </div>
      </div>
    </Page>
  );
}
