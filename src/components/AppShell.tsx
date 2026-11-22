'use client';

import { useEffect } from 'react';
import supabase from '@/lib/supabase';
import { usePathname } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { useNotifications } from '@/hooks/useNotifications';
import { Island } from '@/components/Island';
import { TourProvider } from '@/components/Tour';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { getLang } from '@/lib/i18n';

/*
  No rail, no tab bar, no sub-tabs: the screen belongs to the content, and the
  island at the bottom is the whole of navigation on every breakpoint. «Сегодня»
  is home and gathers what the day needs; every other screen is one tap on the
  island away.
*/
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { unread } = useNotifications();
  const reduce = useReducedMotion();

  /* The server writes push in the reader's language: keep it told which one this phone reads. */
  const { profile, updateProfile } = useSpaceAuth();
  useEffect(() => {
    if (profile && profile.lang !== getLang()) updateProfile({ lang: getLang() });
  }, [profile, updateProfile]);

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
    <TourProvider>
    <div className="min-h-dvh">
      {/* Each screen arrives with a short fade and rise, so a change of section never cuts. */}
      <motion.main
        key={pathname}
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        className="island-clearance"
      >
        {children}
      </motion.main>
      <Island pathname={pathname} unread={unread} />
    </div>
    </TourProvider>
  );
}
