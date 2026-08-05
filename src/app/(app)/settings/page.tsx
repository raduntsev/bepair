'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';

type ThemeChoice = 'system' | 'light' | 'dark';

const THEMES: { value: ThemeChoice; label: string; Icon: typeof Sun }[] = [
  { value: 'system', label: 'Как в системе', Icon: Monitor },
  { value: 'light', label: 'Светлая', Icon: Sun },
  { value: 'dark', label: 'Тёмная', Icon: Moon },
];

export default function SettingsPage() {
  const { profile, inviteCode, updateDisplayName, signOut } = useSpaceAuth();

  const [name, setName] = useState('');
  const [savedName, setSavedName] = useState(false);
  const [theme, setTheme] = useState<ThemeChoice>('system');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setName(profile?.display_name ?? '');
  }, [profile?.display_name]);

  useEffect(() => {
    const stored = localStorage.getItem('bepair-theme');
    if (stored === 'light' || stored === 'dark') setTheme(stored);
  }, []);

  const applyTheme = (choice: ThemeChoice) => {
    setTheme(choice);
    if (choice === 'system') {
      localStorage.removeItem('bepair-theme');
      delete document.documentElement.dataset.theme;
    } else {
      localStorage.setItem('bepair-theme', choice);
      document.documentElement.dataset.theme = choice;
    }
  };

  /* Only a real invite code — a space_id here would never resolve on join. */
  const code = inviteCode;

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-7 md:px-8 md:py-10">
      <header className="mb-7">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Настройки</h1>
      </header>

      <div className="space-y-4">
        <section className="rounded-2xl border border-line bg-surface p-6 shadow-card">
          <h2 className="font-semibold">Как вас зовут</h2>
          <p className="mt-1.5 mb-4 text-sm text-ink-soft">Это имя видит партнёр.</p>
          <div className="flex flex-wrap gap-2">
            <input
              aria-label="Имя"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setSavedName(false);
              }}
              className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-sunken px-3.5 text-base outline-none focus:border-accent focus:bg-surface"
            />
            <Button
              variant="secondary"
              disabled={!name.trim() || name === profile?.display_name}
              onClick={async () => {
                await updateDisplayName(name.trim());
                setSavedName(true);
              }}
            >
              {savedName ? <Check className="size-4" aria-hidden /> : null} Сохранить
            </Button>
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-surface p-6 shadow-card">
          <h2 className="font-semibold">Тема</h2>
          <p className="mt-1.5 mb-4 text-sm text-ink-soft">
            Вечером в темноте светлая тема бьёт по глазам — можно переключить.
          </p>
          <div className="flex flex-wrap gap-2">
            {THEMES.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => applyTheme(value)}
                aria-pressed={theme === value}
                className={`tap flex items-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors ${
                  theme === value
                    ? 'border-accent bg-accent-soft text-accent-soft-ink'
                    : 'border-line text-ink-soft hover:border-line-strong hover:text-ink'
                }`}
              >
                <Icon className="size-4" aria-hidden /> {label}
              </button>
            ))}
          </div>
        </section>

        {code && (
          <section className="rounded-2xl border border-line bg-surface p-6 shadow-card">
            <h2 className="font-semibold">Код приглашения</h2>
            <p className="mt-1.5 mb-4 text-sm text-ink-soft">
              Отправьте его партнёру, чтобы он вошёл в ваше пространство.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg bg-sunken px-3.5 py-2.5 text-sm">
                {code}
              </code>
              <Button
                variant="secondary"
                onClick={async () => {
                  await navigator.clipboard.writeText(code);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
                {copied ? 'Скопировано' : 'Копировать'}
              </Button>
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-line bg-surface p-6 shadow-card">
          <h2 className="font-semibold">Аккаунт</h2>
          <p className="mt-1.5 mb-4 text-sm text-ink-soft">
            Выход не удаляет ваши дни — они останутся на месте.
          </p>
          <Button variant="danger" onClick={signOut}>
            Выйти
          </Button>
        </section>
      </div>
    </div>
  );
}
