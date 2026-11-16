'use client';

import { useEffect } from 'react';
import supabase from '@/lib/supabase';
import { usePathname } from 'next/navigation';
import { useNotifications } from '@/hooks/useNotifications';
import { Island } from '@/components/Island';

/*
  No rail, no tab bar, no sub-tabs: the screen belongs to the content, and the
  island at the bottom is the whole of navigation on every breakpoint. «Сегодня»
  is home and gathers what the day needs; every other screen is one tap on the
  island away.
*/
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { unread } = useNotifications();

  /* «Заходил(а)» in the partner's profile: on open and on coming back. Throttled in SQL. */
  useEffect(() => {
    const touch = () => {
      if (document.visibilityState === 'visible') supabase.rpc('bp_touch').then(() => undefined);
    };
    touch();
    document.addEventListener('visibilitychange', touch);
    return () => document.removeEventListener('visibilitychange', touch);
  }, []);

  return (
    <div className="min-h-dvh">
      <main className="island-clearance">{children}</main>
      <Island pathname={pathname} unread={unread} />
    </div>
  );
}
