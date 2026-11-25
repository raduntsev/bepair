'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, MailCheck, Plus } from 'lucide-react';
import { CONSENT_PENDING_KEY, useSpaceAuth } from '@/hooks/useSpaceAuth';
import { CONSENT_VERSION, MIN_AGE } from '@/lib/legal';
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
        <PairLoader className="h-20 w-40" />
        <p className="text-sm" suppressHydrationWarning>
          {label}
        </p>
      </div>
    </Centered>
  );
}

/* An iPhone web app opened from its home-screen icon: storage of its own, apart from Safari. */
function isIosHomeScreenApp() {
  if (typeof window === 'undefined') return false;
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function GoogleButton({ disabled }: { disabled: boolean }) {
  const { signInWithGoogle } = useSpaceAuth();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="secondary"
      size="lg"
      block
      loading={busy}
      disabled={disabled}
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

const docLink = 'font-medium text-accent underline-offset-2 hover:underline';

/*
  The consent is its own act, apart from signing in (ч. 1 ст. 9 152-ФЗ): an
  unticked box, the document one tap away, and nothing goes anywhere until it
  is ticked. The policy is linked beside it, not folded into it.
*/
function ConsentCheck({ checked, onChange }: { checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <div className="space-y-2">
      <label className="flex cursor-pointer items-start gap-3 rounded-xl p-1 -m-1 text-sm text-ink">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-0.5 size-5 shrink-0 cursor-pointer accent-[var(--c-accent)]"
        />
        <span>
          {tr('Я даю ', 'I give my ')}
          <Link href="/consent" target="_blank" className={docLink}>
            {tr('согласие на обработку персональных данных', 'consent to the processing of personal data')}
          </Link>
          {tr(` и подтверждаю, что мне есть ${MIN_AGE} лет`, ` and confirm I am ${MIN_AGE} or older`)}
        </span>
      </label>
      <p className="pl-8 text-xs text-ink-faint">
        {tr('Как мы обращаемся с данными — в ', 'How we handle data — see the ')}
        <Link href="/privacy" target="_blank" className={docLink}>
          {tr('политике', 'policy')}
        </Link>
        .
      </p>
    </div>
  );
}

function rememberConsent() {
  try {
    localStorage.setItem(CONSENT_PENDING_KEY, CONSENT_VERSION);
  } catch {}
}

/* Signed in before the consent existed, or on a device where it was not ticked. */
export function ConsentPanel() {
  const { giveConsent, signOut } = useSpaceAuth();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <Centered>
      <Panel>
        <h1 className="text-xl font-semibold">{tr('Согласие на обработку данных', 'Consent to data processing')}</h1>
        <p className="mt-2 text-sm text-ink-soft">
          {tr(
            'Чтобы продолжить, нужно ваше согласие. Это отдельный документ — его можно прочитать целиком по ссылке.',
            'To go on, we need your consent. It is a separate document — you can read it in full via the link.',
          )}
        </p>
        <div className="mt-5">
          <ConsentCheck checked={checked} onChange={setChecked} />
        </div>
        {failed && (
          <div className="mt-4">
            <Alert>{tr('Не получилось сохранить. Проверьте связь и попробуйте ещё раз.', 'Couldn’t save. Check your connection and try again.')}</Alert>
          </div>
        )}
        <div className="mt-5 space-y-2">
          <Button
            size="lg"
            block
            loading={busy}
            disabled={!checked}
            onClick={async () => {
              setBusy(true);
              setFailed(false);
              const ok = await giveConsent('personal');
              if (!ok) setFailed(true);
              setBusy(false);
            }}
          >
            {tr('Продолжить', 'Continue')}
          </Button>
          <Button variant="ghost" block onClick={signOut}>
            {tr('Выйти', 'Sign out')}
          </Button>
        </div>
      </Panel>
    </Centered>
  );
}

export function LoginPanel({ intro }: { intro?: string }) {
  const { sendMagicLink, verifyEmailCode, error, clearError } = useSpaceAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [homeScreenApp] = useState(isIosHomeScreenApp);
  const [agreed, setAgreed] = useState(false);

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
            <p className="font-medium">{tr('Письмо отправлено', 'Email sent')}</p>
            <p className="text-sm text-ink-soft">
              {homeScreenApp
                ? tr(`В письме на ${email} есть код — введите его здесь. Ссылка из письма откроется в Safari, а не в этом приложении.`, `The email sent to ${email} has a code — enter it here. The link in it opens in Safari, not in this app.`)
                : tr(`Введите код из письма на ${email} или нажмите ссылку в нём. Писем несколько — берите самое новое. Загляните в спам, если письма не видно.`, `Enter the code from the email sent to ${email}, or tap the link in it. Got several — use the newest. Check spam if you can’t see it.`)}
            </p>
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                setChecking(true);
                await verifyEmailCode(email, code);
                setChecking(false);
              }}
              className="mt-1 w-full space-y-3"
            >
              <Input
                aria-label={tr('Код из письма', 'Code from the email')}
                value={code}
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={10}
                onChange={(event) => {
                  setCode(event.target.value.replace(/\D+/g, ''));
                  if (error) clearError();
                }}
                placeholder={tr('Код из письма', 'Code from the email')}
                className="text-center text-lg tracking-[0.3em]"
              />
              <Button type="submit" size="lg" block loading={checking} disabled={code.length < 6}>
                {tr('Войти', 'Sign in')}
              </Button>
            </form>
            {error && <Alert>{error}</Alert>}
            <Button
              variant="ghost"
              onClick={() => {
                setSent(false);
                setCode('');
                clearError();
              }}
            >
              {tr('Другой адрес', 'Another address')}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <ConsentCheck
              checked={agreed}
              onChange={(next) => {
                setAgreed(next);
                if (next) rememberConsent();
              }}
            />
            <GoogleButton disabled={!agreed} />
            <div className="flex items-center gap-3 text-xs text-ink-faint" aria-hidden>
              <span className="h-px flex-1 bg-line" />
              {tr('или по коду на почту', 'or with a code by email')}
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
              <Button type="submit" size="lg" block loading={busy} disabled={!email || !agreed}>
                {tr('Получить код на почту', 'Email me a code')} <ArrowRight className="size-4" aria-hidden />
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
