'use client';

import { useState } from 'react';
import { ArrowRight, MailCheck, Plus } from 'lucide-react';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Blocks';
import { PairMark } from '@/components/PairMark';

export function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-5 py-10">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}

export function Panel({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-line bg-surface p-6 shadow-card md:p-7">{children}</div>;
}

export function Opening({ label = 'Открываем пространство…' }: { label?: string }) {
  return (
    <Centered>
      <div role="status" className="flex flex-col items-center gap-4 text-ink-faint">
        <PairMark className="h-12 w-20 animate-pulse" />
        <p className="text-sm">{label}</p>
      </div>
    </Centered>
  );
}

function GoogleButton() {
  const { signInWithGoogle } = useSpaceAuth();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="secondary"
      size="lg"
      block
      loading={busy}
      onClick={async () => {
        setBusy(true);
        await signInWithGoogle();
        setBusy(false);
      }}
    >
      Продолжить с Google
    </Button>
  );
}

export function LoginPanel({ intro }: { intro?: string }) {
  const { sendMagicLink, error, clearError } = useSpaceAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <Centered>
      <div className="mb-8 flex flex-col items-center text-center">
        <PairMark className="mb-5 h-14 w-24" />
        <h1 className="text-3xl font-semibold tracking-tight">Впаре</h1>
        <p className="mt-2 text-sm text-ink-soft">{intro ?? 'Общее ежедневное пространство для двоих'}</p>
      </div>

      <Panel>
        {sent ? (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <MailCheck className="size-7 text-accent" aria-hidden />
            <p className="font-medium">Ссылка отправлена</p>
            <p className="text-sm text-ink-soft">Откройте письмо на {email}. Загляните в спам, если его не видно.</p>
            <Button variant="ghost" onClick={() => setSent(false)}>
              Другой адрес
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <GoogleButton />
            <div className="flex items-center gap-3 text-xs text-ink-faint" aria-hidden>
              <span className="h-px flex-1 bg-line" />
              или по ссылке на почту
              <span className="h-px flex-1 bg-line" />
            </div>
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                setBusy(true);
                const ok = await sendMagicLink(email);
                setBusy(false);
                if (ok) setSent(true);
              }}
              className="space-y-3"
            >
              <label htmlFor="email" className="sr-only">
                Почта
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (error) clearError();
                }}
                placeholder="you@example.com"
              />
              <Button type="submit" size="lg" block loading={busy} disabled={!email}>
                Войти по ссылке <ArrowRight className="size-4" aria-hidden />
              </Button>
            </form>
            {error && <Alert>{error}</Alert>}
          </div>
        )}
      </Panel>
    </Centered>
  );
}

export function SpaceChoice() {
  const { createSpace, joinSpace, signOut, error, clearError } = useSpaceAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);

  return (
    <Centered>
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Почти всё</h1>
        <p className="mt-2 text-sm text-ink-soft">Создайте пространство и позовите партнёра — или войдите по его коду.</p>
      </div>

      <div className="space-y-4">
        <Panel>
          <h2 className="font-semibold">Создать пространство</h2>
          <p className="mt-1.5 mb-5 text-sm text-ink-soft">Вы получите код приглашения, который можно отправить партнёру.</p>
          <Button
            size="lg"
            block
            loading={busy === 'create'}
            disabled={busy !== null}
            onClick={async () => {
              setBusy('create');
              await createSpace();
              setBusy(null);
            }}
          >
            <Plus className="size-5" aria-hidden /> Создать
          </Button>
        </Panel>

        <Panel>
          <h2 className="font-semibold">У меня есть код</h2>
          <p className="mt-1.5 mb-5 text-sm text-ink-soft">Введите код, который прислал партнёр.</p>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy('join');
              await joinSpace(code);
              setBusy(null);
            }}
            className="flex gap-2"
          >
            <Input
              aria-label="Код приглашения"
              value={code}
              autoCapitalize="none"
              autoCorrect="off"
              onChange={(event) => {
                setCode(event.target.value);
                if (error) clearError();
              }}
              placeholder="Код приглашения"
              className="min-w-0 flex-1"
            />
            <Button type="submit" variant="secondary" loading={busy === 'join'} disabled={!code.trim() || busy !== null}>
              Войти
            </Button>
          </form>
        </Panel>

        {error && <Alert>{error}</Alert>}

        <div className="flex justify-center">
          <Button variant="ghost" onClick={signOut}>
            Выйти из аккаунта
          </Button>
        </div>
      </div>
    </Centered>
  );
}

export function MigrationNotice() {
  return (
    <Centered>
      <Panel>
        <h1 className="font-semibold">База данных старше приложения</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Примените миграцию <code className="rounded bg-sunken px-1.5 py-0.5">supabase/migrations/0002_bepair_complete.sql</code>{' '}
          в Supabase → SQL Editor и обновите страницу. Подробности — в README.
        </p>
      </Panel>
    </Centered>
  );
}
