'use client';

import { useState } from 'react';
import { ArrowRight, MailCheck, Plus } from 'lucide-react';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Alert } from '@/components/ui/Blocks';
import { PairLoader } from '@/components/PairLoader';
import { PairMark } from '@/components/PairMark';
import { tr } from '@/lib/i18n';

export function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-5 py-10">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}

export function Panel({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl bg-surface p-6 shadow-card md:p-7">{children}</div>;
}

export function Opening({ label = tr('Открываем пространство…', 'Opening your space…') }: { label?: string }) {
  return (
    <Centered>
      <div role="status" className="flex flex-col items-center gap-4 text-ink-faint">
        <PairLoader className="h-14 w-28" />
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
      {tr('Продолжить с Google', 'Continue with Google')}
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
        <PairMark className="mb-5 size-16" />
        <h1 className="text-3xl font-semibold tracking-tight">{tr('Впаре', 'Bepair')}</h1>
        <p className="mt-2 text-sm text-ink-soft">{intro ?? tr('Общее ежедневное пространство для двоих', 'A shared daily space for two')}</p>
      </div>

      <Panel>
        {sent ? (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <MailCheck className="size-7 text-accent" aria-hidden />
            <p className="font-medium">{tr('Ссылка отправлена', 'Link sent')}</p>
            <p className="text-sm text-ink-soft">{tr(`Откройте письмо на ${email}. Загляните в спам, если его не видно.`, `Open the email sent to ${email}. Check spam if you can’t see it.`)}</p>
            <Button variant="ghost" onClick={() => setSent(false)}>
              {tr('Другой адрес', 'Another address')}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <GoogleButton />
            <div className="flex items-center gap-3 text-xs text-ink-faint" aria-hidden>
              <span className="h-px flex-1 bg-line" />
              {tr('или по ссылке на почту', 'or with a link by email')}
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
                {tr('Почта', 'Email')}
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
                {tr('Войти по ссылке', 'Sign in with a link')} <ArrowRight className="size-4" aria-hidden />
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
        <h1 className="text-2xl font-semibold tracking-tight">{tr('Почти всё', 'Almost there')}</h1>
        <p className="mt-2 text-sm text-ink-soft">{tr('Создайте пространство и позовите партнёра — или войдите по его коду.', 'Create a space and invite your partner — or join with their code.')}</p>
      </div>

      <div className="space-y-4">
        <Panel>
          <h2 className="font-semibold">{tr('Создать пространство', 'Create a space')}</h2>
          <p className="mt-1.5 mb-5 text-sm text-ink-soft">{tr('Вы получите код приглашения, который можно отправить партнёру.', 'You’ll get an invite code to send to your partner.')}</p>
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
            <Plus className="size-5" aria-hidden /> {tr('Создать', 'Create')}
          </Button>
        </Panel>

        <Panel>
          <h2 className="font-semibold">{tr('У меня есть код', 'I have a code')}</h2>
          <p className="mt-1.5 mb-5 text-sm text-ink-soft">{tr('Введите код, который прислал партнёр.', 'Enter the code your partner sent you.')}</p>
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
              aria-label={tr('Код приглашения', 'Invite code')}
              value={code}
              autoCapitalize="none"
              autoCorrect="off"
              onChange={(event) => {
                setCode(event.target.value);
                if (error) clearError();
              }}
              placeholder={tr('Код приглашения', 'Invite code')}
              className="min-w-0 flex-1"
            />
            <Button type="submit" variant="secondary" loading={busy === 'join'} disabled={!code.trim() || busy !== null}>
              {tr('Войти', 'Join')}
            </Button>
          </form>
        </Panel>

        {error && <Alert>{error}</Alert>}

        <div className="flex justify-center">
          <Button variant="ghost" onClick={signOut}>
            {tr('Выйти из аккаунта', 'Sign out')}
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
          Выполните по порядку все файлы из <code className="rounded bg-sunken px-1.5 py-0.5">supabase/migrations</code> в Supabase → SQL
          Editor и обновите страницу. Подробности — в README.
        </p>
      </Panel>
    </Centered>
  );
}

export function ConfigNotice() {
  return (
    <Centered>
      <Panel>
        <h1 className="font-semibold">Приложение не подключено к базе</h1>
        <p className="mt-2 text-sm text-ink-soft">
          В Vercel → Settings → Environment Variables добавьте <code className="rounded bg-sunken px-1.5 py-0.5">NEXT_PUBLIC_SUPABASE_URL</code> и{' '}
          <code className="rounded bg-sunken px-1.5 py-0.5">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> из Supabase → Project Settings → API, затем
          сделайте Redeploy.
        </p>
      </Panel>
    </Centered>
  );
}
