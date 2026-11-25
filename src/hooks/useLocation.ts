'use client';

import { useCallback, useEffect, useState } from 'react';
import supabase from '@/lib/supabase';
import { readBattery, SEND_EVERY_MS, type LocationState } from '@/lib/location';
import { nativeLocation, type LocationNative } from '@/lib/native';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { tr } from '@/lib/i18n';

/*
  «Где мы» for the map screen: both points under the rule, live. The rule
  itself is in SQL (0018) — this only asks bp_location_state and listens.
*/

export async function loadLocationState(): Promise<LocationState | null> {
  const { data, error } = await supabase.rpc('bp_location_state');
  if (error || !data) return null;
  return data as LocationState;
}

/* One fix from the browser (or the WebView). Rejects with the GeolocationPositionError code. */
export function currentPosition(prompt: boolean): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return reject({ code: 2 });
    const run = () =>
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, maximumAge: 60_000, timeout: 20_000 });
    if (prompt || !navigator.permissions) return run();
    /* Without a prompt: only when the person already said yes. */
    navigator.permissions
      .query({ name: 'geolocation' as PermissionName })
      .then((status) => (status.state === 'granted' ? run() : reject({ code: 1 })))
      .catch(() => reject({ code: 1 }));
  });
}

export async function sendPosition(position: GeolocationPosition) {
  const battery = await readBattery();
  const { data } = await supabase.rpc('bp_set_location', {
    la: position.coords.latitude,
    ln: position.coords.longitude,
    acc: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
    at: new Date(position.timestamp).toISOString(),
    batt: battery?.level ?? null,
    chg: battery?.charging ?? null,
  });
  return data === true;
}

let lastSent = 0;

/* The open app sends a point at most every five minutes, without ever prompting. */
export async function reportIfDue(force = false) {
  if (!force && Date.now() - lastSent < SEND_EVERY_MS) return;
  try {
    const position = await currentPosition(false);
    if (await sendPosition(position)) lastSent = Date.now();
  } catch {
    /* no permission or no fix — the next visit tries again */
  }
}

export function useLocation() {
  const { spaceId } = useSpaceAuth();
  const [state, setState] = useState<LocationState | null>(null);
  const [native, setNative] = useState<LocationNative | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const next = await loadLocationState();
    if (next) setState(next);
    else setError((e) => e ?? tr('Не удалось загрузить карту. Проверьте связь.', 'Couldn’t load the map. Check your connection.'));
    setLoading(false);
    return next;
  }, []);

  useEffect(() => {
    load();
    nativeLocation('locationStatus').then(setNative);
  }, [load]);

  /* Live: a new point of either of you re-reads the state (realtime obeys the same rule). */
  useEffect(() => {
    if (!spaceId) return;
    const channel = supabase
      .channel(`locations-${spaceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'locations', filter: `space_id=eq.${spaceId}` }, () => load())
      .subscribe();
    /* The partner switching sharing on or off is a profile change: a slow look covers it. */
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, 60_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [spaceId, load]);

  const setSharing = useCallback(
    async (enabled: boolean) => {
      setBusy(true);
      setError(null);
      try {
        if (enabled) {
          /* Permission first: sharing is not switched on for a phone that cannot share. */
          const service = await nativeLocation('requestLocation');
          if (service) {
            setNative(service);
            if (!service.foreground) {
              setError(tr('Разрешите Впаре доступ к местоположению в настройках телефона.', 'Allow Bepair to use your location in the phone’s settings.'));
              return;
            }
          } else {
            try {
              const position = await currentPosition(true);
              const { data, error: rpcError } = await supabase.rpc('bp_set_location_sharing', { enabled: true });
              if (rpcError) throw rpcError;
              setState(data as LocationState);
              await sendPosition(position);
              lastSent = Date.now();
              await load();
              return;
            } catch (e) {
              const code = (e as { code?: number }).code;
              setError(
                code === 1
                  ? tr('Браузер не дал доступ к местоположению. Разрешите его для этого сайта.', 'The browser blocked location. Allow it for this site.')
                  : tr('Не удалось включить. Попробуйте ещё раз.', 'Couldn’t switch it on. Try again.'),
              );
              return;
            }
          }
        }

        const { data, error: rpcError } = await supabase.rpc('bp_set_location_sharing', { enabled });
        if (rpcError) {
          setError(tr('Не удалось сохранить. Проверьте связь.', 'Couldn’t save. Check your connection.'));
          return;
        }
        setState(data as LocationState);
        if (enabled) {
          /* Switched on in the database: now the service may start and send. */
          setNative(await nativeLocation('ensureLocation'));
        } else {
          setNative(await nativeLocation('stopLocation'));
        }
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  const allowBackground = useCallback(async () => {
    const next = await nativeLocation('requestBackgroundLocation');
    if (next) setNative(next);
  }, []);

  return { state, native, isLoading, busy, error, setSharing, allowBackground, reload: load };
}
