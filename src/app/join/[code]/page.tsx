'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { INVITE_KEY, useSpaceAuth } from '@/hooks/useSpaceAuth';
import { Centered, ConsentPanel, LoginPanel, Opening, Panel } from '@/components/AuthScreens';
import { Alert } from '@/components/ui/Blocks';
import { LinkButton } from '@/components/ui/Button';
import { tr } from '@/lib/i18n';

/*
  The link a partner taps. Signed out: remember the code, sign in, and the
  gate finishes joining on return. Signed in: join right here.
*/
export default function JoinPage() {
  const params = useParams<{ code: string }>();
  const code = decodeURIComponent(params.code ?? '').trim().toLowerCase();
  const router = useRouter();
  const { isLoading, isAuthenticated, hasSpace, inviteCode, joinSpace, error, needsConsent } = useSpaceAuth();
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (!code) return;
    try {
      localStorage.setItem(INVITE_KEY, code);
    } catch {}
  }, [code]);

  useEffect(() => {
    if (isLoading || !isAuthenticated || hasSpace || needsConsent || started.current || !code) return;
    started.current = true;
    joinSpace(code).then((ok) => {
      if (ok) router.replace('/onboarding');
      else setFailed(true);
    });
  }, [isLoading, isAuthenticated, hasSpace, needsConsent, code, joinSpace, router]);

  if (isLoading) return <Opening />;
  if (isAuthenticated && needsConsent) return <ConsentPanel />;
  if (!isAuthenticated) return <LoginPanel intro={tr('Вас позвали в общее пространство. Войдите — и вы сразу окажетесь внутри.', 'You’ve been invited to a shared space. Sign in and you’ll be right inside.')} />;

  if (hasSpace) {
    const own = inviteCode === code;
    return (
      <Centered>
        <Panel>
          <h1 className="font-semibold">{own ? tr('Это ваше собственное приглашение', 'This is your own invite') : tr('Вы уже в пространстве', 'You’re already in a space')}</h1>
          <p className="mt-2 text-sm text-ink-soft">
            {own
              ? tr('Отправьте эту ссылку партнёру — открыть её должен он.', 'Send this link to your partner — they’re the one to open it.')
              : tr('У одного человека может быть только одно пространство. Чтобы перейти в другое, сначала выйдите из пары — это можно сделать в профиле, в разделе «Аккаунт».', 'One person can have only one space. To move to another, leave your pair first — in Profile → Account.')}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <LinkButton href="/day">{tr('Открыть день', 'Open the day')}</LinkButton>
            {!own && (
              <LinkButton href="/settings/account" variant="secondary">
                {tr('Выйти из пары', 'Leave the pair')}
              </LinkButton>
            )}
          </div>
        </Panel>
      </Centered>
    );
  }

  if (failed) {
    return (
      <Centered>
        <Panel>
          <Alert>{error ?? tr('Не получилось войти по этой ссылке.', 'Couldn’t join with this link.')}</Alert>
          <div className="mt-5">
            <LinkButton href="/day" variant="secondary">
              {tr('Ввести код вручную', 'Enter the code by hand')}
            </LinkButton>
          </div>
        </Panel>
      </Centered>
    );
  }

  return <Opening label={tr('Входим в пространство партнёра…', 'Joining your partner’s space…')} />;
}
