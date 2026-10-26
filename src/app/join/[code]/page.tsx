'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { INVITE_KEY, useSpaceAuth } from '@/hooks/useSpaceAuth';
import { Centered, LoginPanel, Opening, Panel } from '@/components/AuthScreens';
import { Alert } from '@/components/ui/Blocks';
import { LinkButton } from '@/components/ui/Button';

/*
  The link a partner taps. Signed out: remember the code, sign in, and the
  gate finishes joining on return. Signed in: join right here.
*/
export default function JoinPage() {
  const params = useParams<{ code: string }>();
  const code = decodeURIComponent(params.code ?? '').trim().toLowerCase();
  const router = useRouter();
  const { isLoading, isAuthenticated, hasSpace, inviteCode, joinSpace, error } = useSpaceAuth();
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (!code) return;
    try {
      localStorage.setItem(INVITE_KEY, code);
    } catch {}
  }, [code]);

  useEffect(() => {
    if (isLoading || !isAuthenticated || hasSpace || started.current || !code) return;
    started.current = true;
    joinSpace(code).then((ok) => {
      if (ok) router.replace('/onboarding');
      else setFailed(true);
    });
  }, [isLoading, isAuthenticated, hasSpace, code, joinSpace, router]);

  if (isLoading) return <Opening />;
  if (!isAuthenticated) return <LoginPanel intro="Вас позвали в общее пространство. Войдите — и вы сразу окажетесь внутри." />;

  if (hasSpace) {
    const own = inviteCode === code;
    return (
      <Centered>
        <Panel>
          <h1 className="font-semibold">{own ? 'Это ваше собственное приглашение' : 'Вы уже в пространстве'}</h1>
          <p className="mt-2 text-sm text-ink-soft">
            {own
              ? 'Отправьте эту ссылку партнёру — открыть её должен он.'
              : 'У одного человека может быть только одно пространство. Чтобы перейти в другое, сначала выйдите из этого.'}
          </p>
          <div className="mt-5">
            <LinkButton href="/day">Открыть день</LinkButton>
          </div>
        </Panel>
      </Centered>
    );
  }

  if (failed) {
    return (
      <Centered>
        <Panel>
          <Alert>{error ?? 'Не получилось войти по этой ссылке.'}</Alert>
          <div className="mt-5">
            <LinkButton href="/day" variant="secondary">
              Ввести код вручную
            </LinkButton>
          </div>
        </Panel>
      </Centered>
    );
  }

  return <Opening label="Входим в пространство партнёра…" />;
}
