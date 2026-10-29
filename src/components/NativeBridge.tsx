'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import { isNative, nativePlatform, pathFromDeepLink, refreshWidgets, WidgetBridge } from '@/lib/native';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';

/*
  Runs only inside the native shell. Gives the home-screen widget its key the
  first time, keeps it fresh when the app comes back to the foreground, and
  routes taps on widgets and notifications to the right screen.
*/
export function NativeBridge() {
  const router = useRouter();
  const { user, spaceId } = useSpaceAuth();

  useEffect(() => {
    if (!isNative() || !user || !spaceId) return;
    let cancelled = false;

    (async () => {
      try {
        const status = await WidgetBridge.status();
        if (status.configured && status.api === window.location.origin) {
          await refreshWidgets();
          return;
        }
        const platform = nativePlatform();
        const { data: token, error } = await supabase.rpc('bp_issue_widget_token', {
          device: platform === 'web' ? 'unknown' : platform,
        });
        if (error || !token || cancelled) return;
        await WidgetBridge.configure({ token: token as string, api: window.location.origin });
      } catch {
        /* the shell predates widgets — the app works the same without them */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, spaceId]);

  useEffect(() => {
    if (!isNative()) return;
    const handles: { remove: () => Promise<void> }[] = [];

    (async () => {
      const { App } = await import('@capacitor/app');
      handles.push(
        await App.addListener('appUrlOpen', ({ url }) => {
          const path = pathFromDeepLink(url);
          if (path) router.push(path);
        }),
      );
      /* Coming back to the app: the partner may have marked their day meanwhile. */
      handles.push(
        await App.addListener('resume', () => {
          refreshWidgets();
        }),
      );

      const { PushNotifications } = await import('@capacitor/push-notifications');
      handles.push(
        await PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
          const url = (notification.data as { url?: string } | undefined)?.url;
          if (url) router.push(url.startsWith('/') ? url : (pathFromDeepLink(url) ?? '/day'));
        }),
      );
      handles.push(
        await PushNotifications.addListener('pushNotificationReceived', () => {
          refreshWidgets();
        }),
      );
    })();

    return () => {
      handles.forEach((handle) => handle.remove());
    };
  }, [router]);

  return null;
}
