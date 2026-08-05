'use client';

import { useState } from 'react';
import { ArrowRight, Loader2, MailCheck, Plus } from 'lucide-react';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { Button } from '@/components/ui/Button';

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas p-6">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-7 shadow-card">{children}</div>
  );
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, hasSpace, isLoading, error, sendMagicLink, createSpace, joinSpace, signOut } =
    useSpaceAuth();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  if (isLoading) {
    return (
      <Centered>
        <div className="flex flex-col items-center gap-3 text-ink-faint">
          <Loader2 className="size-6 animate-spin" aria-hidden />
          <p className="text-sm">Открываем пространство…</p>
        </div>
      </Centered>
    );
  }

  if (!isAuthenticated) {
    return (
      <Centered>
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Впаре</h1>
          <p className="mt-2 text-sm text-ink-soft">Общее ежедневное пространство для двоих</p>
        </div>

        <Panel>
          {sent ? (
            <div className="flex flex-col items-center gap-3 py-2 text-center">
              <MailCheck className="size-7 text-accent" aria-hidden />
              <p className="font-medium">Ссылка отправлена</p>
              <p className="text-sm text-ink-soft">
                Откройте письмо на {email}. Загляните в спам, если его не видно.
              </p>
              <button
                type="button"
                onClick={() => setSent(false)}
                className="tap mt-1 text-sm font-medium text-accent hover:underline"
              >
                Другой адрес
              </button>
            </div>
          ) : (
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                setBusy(true);
                const ok = await sendMagicLink(email);
                setBusy(false);
                if (ok) setSent(true);
              }}
              className="space-y-4"
            >
              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-medium">
                  Почта
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="h-11 w-full rounded-lg border border-line bg-sunken px-3.5 text-base outline-none transition-colors placeholder:text-ink-faint focus:border-accent focus:bg-surface"
                />
              </div>

              <Button type="submit" size="lg" block loading={busy} disabled={!email}>
                Войти по ссылке <ArrowRight className="size-4" aria-hidden />
              </Button>

              {error && <p className="text-sm text-danger">{error}</p>}
            </form>
          )}
        </Panel>
      </Centered>
    );
  }

  if (!hasSpace) {
    return (
      <Centered>
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Почти всё</h1>
          <p className="mt-2 text-sm text-ink-soft">
            Создайте пространство и позовите партнёра — или войдите по его коду.
          </p>
        </div>

        <div className="space-y-4">
          <Panel>
            <h2 className="font-semibold">Создать пространство</h2>
            <p className="mt-1.5 mb-5 text-sm text-ink-soft">
              Вы получите код приглашения, который можно отправить партнёру.
            </p>
            <Button
              size="lg"
              block
              loading={busy}
              onClick={async () => {
                setBusy(true);
                await createSpace();
                setBusy(false);
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
                setBusy(true);
                await joinSpace(code);
                setBusy(false);
              }}
              className="flex gap-2"
            >
              <input
                aria-label="Код приглашения"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="Код приглашения"
                className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-sunken px-3.5 text-base outline-none transition-colors placeholder:text-ink-faint focus:border-accent focus:bg-surface"
              />
              <Button type="submit" variant="secondary" disabled={!code.trim()}>
                Войти
              </Button>
            </form>
            {error && <p className="mt-3 text-sm text-danger">{error}</p>}
          </Panel>

          <button
            type="button"
            onClick={signOut}
            className="tap mx-auto block px-4 text-sm font-medium text-ink-faint transition-colors hover:text-ink"
          >
            Выйти из аккаунта
          </button>
        </div>
      </Centered>
    );
  }

  return <>{children}</>;
}
