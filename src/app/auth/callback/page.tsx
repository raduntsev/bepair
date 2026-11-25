'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import supabase from '@/lib/supabase';
import { Centered, Opening, Panel } from '@/components/AuthScreens';
import { Button } from '@/components/ui/Button';
import { tr } from '@/lib/i18n';

export default function AuthCallback() {
  const router = useRouter();
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    let mounted = true;
    const params = new URLSearchParams(window.location.hash.slice(1) || window.location.search.slice(1));
    if (params.get('error') || params.get('error_description')) {
      setExpired(true);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && mounted) router.replace('/day');
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && mounted) router.replace('/day');
    });

    /* A link that never produces a session is as good as expired. */
    const timeout = window.setTimeout(() => mounted && setExpired(true), 12_000);

    return () => {
      mounted = false;
      window.clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [router]);

  if (!expired) return <Opening />;

  return (
    <Centered>
      <Panel>
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertCircle className="size-7 text-danger" aria-hidden />
          <p className="font-medium">{tr('Ссылка больше не действует', 'This link no longer works')}</p>
          <p className="text-sm text-ink-soft">{tr('Ссылка работает один раз, час и только из самого нового письма. Надёжнее войти по коду: запросите письмо ещё раз и введите код из него.', 'A link works once, for an hour, and only from the newest email. The code is more reliable: ask for a new email and type the code from it.')}</p>
          <Button className="mt-2" onClick={() => router.replace('/day')}>
            {tr('Войти по коду', 'Sign in with a code')}
          </Button>
        </div>
      </Panel>
    </Centered>
  );
}
