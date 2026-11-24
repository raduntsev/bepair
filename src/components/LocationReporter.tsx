'use client';

import { useEffect } from 'react';
import { SEND_EVERY_MS } from '@/lib/location';
import { nativeLocation } from '@/lib/native';
import { loadLocationState, reportIfDue } from '@/hooks/useLocation';

/*
  Keeps «Где мы» honest while the app is open, on every screen. Never asks for
  permission: that happens once, on the map screen, when sharing is switched on.

  On Android the native service does the sending; here it is only kept in step
  with the switch in the database (started after a reinstall, stopped when
  sharing was switched off on another phone). In a browser the open app sends
  a point every five minutes.
*/
export function LocationReporter() {
  useEffect(() => {
    let cancelled = false;

    const tick = async (force = false) => {
      if (document.visibilityState !== 'visible') return;
      const state = await loadLocationState();
      if (cancelled || !state) return;

      const service = await nativeLocation(state.sharing ? 'ensureLocation' : 'locationStatus');
      if (!state.sharing) {
        if (service?.running) await nativeLocation('stopLocation');
        return;
      }
      /* The Android service sends on its own; an older APK or a browser sends from here. */
      if (!service?.running) await reportIfDue(force);
    };

    tick(true);
    const timer = setInterval(() => tick(), SEND_EVERY_MS);
    const onVisible = () => tick();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return null;
}
