'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { Bell, Check, ChevronRight, GraduationCap, LayoutGrid, Lock, LogOut, Monitor, Moon, Sun, UserRound } from 'lucide-react';
import { displayName } from '@/lib/words';
import { plural, todayISO } from '@/lib/dates';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { Button } from '@/components/ui/Button';
import { Segment } from '@/components/ui/Controls';
import { Card, LinkRow, Page, RowGroup, RowIcon, SectionHeader } from '@/components/ui/Blocks';
import { InviteCard } from '@/components/InviteCard';
import { Avatar, AvatarPicker } from '@/components/Avatar';
import { useTour } from '@/components/Tour';

type ThemeChoice = 'system' | 'light' | 'dark';

function readTheme(): ThemeChoice {
  try {
    const stored = localStorage.getItem('bepair-theme');
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return 'system';
  }
}

/*
  Профиль reads top to bottom as three questions: who am I here (photo, name,
  how to address me), who are we (the pair, one tap into it), and how does the
  app behave (grouped settings). Notifications are not here any more — the feed
  is the bell on «Сегодня»; only «what to send» stays, as a setting.
*/
export default function SettingsPage() {
  const { profile, partner, settings, updateProfile, signOut } = useSpaceAuth();
  const tour = useTour();

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

  const partnerName = displayName(partner?.display_name);
  const together = settings?.together_since ? differenceInCalendarDays(parseISO(todayISO()), parseISO(settings.together_since)) + 1 : null;

  return (
    <Page width="form">
      <h1 className="sr-only">Профиль</h1>

      {/* Вы */}
      <section className="flex flex-col items-center pt-2 pb-6">
        <AvatarPicker className="size-24 text-title-1" />
        <form
          className="mt-4 flex w-full max-w-xs items-center justify-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            saveName();
          }}
        >
          <input
            aria-label="Ваше имя"
            autoComplete="given-name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setSavedName(false);
            }}
            onBlur={saveName}
            className="min-w-0 flex-1 rounded-xl bg-transparent px-2 py-1 text-center text-title-2 font-bold text-ink outline-none transition-colors hover:bg-sunken focus:bg-sunken"
          />
        </form>
        <Check
          className={`-mt-1 size-4 text-accent transition-opacity duration-500 ${savedName ? 'opacity-100' : 'opacity-0'}`}
          aria-label={savedName ? 'Сохранено' : undefined}
        />
        <div className="mt-2 w-full max-w-xs">
          <Segment
            legend="Как о вас писать"
            options={[
              { value: 'f' as const, label: 'Она' },
              { value: 'm' as const, label: 'Он' },
            ]}
            value={profile?.gender ?? null}
            onChange={(gender) => updateProfile({ gender })}
          />
        </div>
      </section>

      <div className="space-y-3">
        {/* Вы вдвоём */}
        {partner ? (
          <Link
            href="/couple"
            data-tour="profile-pair"
            className="flex items-center gap-4 rounded-2xl bg-surface p-4 shadow-card transition-colors hover:bg-sunken"
          >
            <span className="flex shrink-0">
              <Avatar path={profile?.avatar_url} name={profile?.display_name ?? ''} who="me" className="size-12 text-headline ring-2 ring-surface" />
              <Avatar path={partner.avatar_url} name={partnerName} who="partner" className="-ml-3 size-12 text-headline ring-2 ring-surface" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-headline font-semibold">Вы и {partnerName}</span>
              <span className="block text-footnote text-ink-faint">
                {together && together > 0 ? `вместе ${together} ${plural(together, 'день', 'дня', 'дней')}` : 'профиль пары, даты, ответы'}
              </span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-line-strong" strokeWidth={2.2} aria-hidden />
          </Link>
        ) : (
          <div data-tour="profile-pair">
            <InviteCard />
          </div>
        )}

        <SectionHeader title="Приложение" />
        <div data-tour="profile-settings" className="space-y-3">
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
          <RowGroup label="Приложение">
            <LinkRow href="/notifications/settings" Icon={Bell} title="Уведомления" />
            <LinkRow href="/settings/widgets" Icon={LayoutGrid} title="Виджеты" />
          </RowGroup>

          <SectionHeader title="Пара и данные" />
          <RowGroup label="Пара и данные">
            <LinkRow href="/settings/paired" Icon={Lock} tone="partner" title="Парные настройки" />
            <LinkRow href="/settings/personal" Icon={UserRound} tone="neutral" title="Личные и данные" />
          </RowGroup>
        </div>

        <div data-tour="profile-tour" className="pt-3">
          <RowGroup label="Помощь">
            <li>
              <button
                type="button"
                onClick={tour.start}
                className="flex min-h-13 w-full items-center gap-3.5 px-4 py-2.5 text-left transition-colors hover:bg-sunken focus-visible:bg-sunken active:bg-sunken"
              >
                <RowIcon Icon={GraduationCap} tone="neutral" />
                <span className="min-w-0 flex-1 text-body text-ink">Обучение</span>
                <ChevronRight className="size-5 shrink-0 text-line-strong" strokeWidth={2.2} aria-hidden />
              </button>
            </li>
          </RowGroup>
        </div>

        <div className="pt-6">
          <Button variant="danger" block onClick={signOut}>
            <LogOut className="size-4" aria-hidden /> Выйти
          </Button>
        </div>
      </div>
    </Page>
  );
}
