'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { INVITE_KEY, useSpaceAuth } from '@/hooks/useSpaceAuth';
import { Alert } from '@/components/ui/Blocks';
import { Centered, LoginPanel, MigrationNotice, Opening, Panel, SpaceChoice } from '@/components/AuthScreens';
import { Button } from '@/components/ui/Button';

function readInvite() {
  try {
    return localStorage.getItem(INVITE_KEY);
  } catch {
    return null;
  }
}

/*
  Signed in → in a space → answered (or skipped) the eight questions → the app.
  `onboarding` routes pass requireOnboarded={false} so the questions can render.
*/
export function AuthGate({ children, requireOnboarded = true }: { children: React.ReactNode; requireOnboarded?: boolean }) {
  const { isAuthenticated, hasSpace, isLoading, profile, error, needsMigration, joinSpace, refresh } = useSpaceAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [joining, setJoining] = useState(false);
  const tried = useRef(false);

  /* Arrived through /join/<code> before signing in: finish joining now. */
  useEffect(() => {
    if (isLoading || !isAuthenticated || hasSpace || tried.current) return;
    const code = readInvite();
    if (!code) return;
    tried.current = true;
    setJoining(true);
    joinSpace(code).finally(() => setJoining(false));
  }, [isLoading, isAuthenticated, hasSpace, joinSpace]);

  const mustOnboard = requireOnboarded && hasSpace && profile !== null && !profile.onboarded_at;

  useEffect(() => {
    if (mustOnboard && pathname !== '/onboarding') router.replace('/onboarding');
  }, [mustOnboard, pathname, router]);

  if (isLoading) return <Opening />;
  if (needsMigration) return <MigrationNotice />;
  if (!isAuthenticated) return <LoginPanel />;

  if (error && !profile) {
    return (
      <Centered>
        <Panel>
          <Alert>{error}</Alert>
          <div className="mt-4">
            <Button variant="secondary" onClick={refresh}>
              Попробовать снова
            </Button>
          </div>
        </Panel>
      </Centered>
    );
  }

  if (joining) return <Opening label="Входим в пространство партнёра…" />;
  if (!hasSpace) return <SpaceChoice />;
  if (mustOnboard) return <Opening />;

  return <>{children}</>;
}
