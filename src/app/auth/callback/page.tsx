'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import supabase from '@/lib/supabase';
import { Centered, Opening, Panel } from '@/components/AuthScreens';
import { Button } from '@/components/ui/Button';

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
          <p className="font-medium">Ссылка больше не действует</p>
          <p className="text-sm text-ink-soft">Ссылки живут недолго — так безопаснее. Запросите новую, это займёт минуту.</p>
          <Button className="mt-2" onClick={() => router.replace('/day')}>
            Получить новую ссылку
          </Button>
        </div>
      </Panel>
    </Centered>
  );
}
