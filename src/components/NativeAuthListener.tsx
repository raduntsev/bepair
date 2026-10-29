'use client';

import { useEffect } from 'react';
import supabase, { isNativeShell, NATIVE_AUTH_CALLBACK } from '@/lib/supabase';

/*
  Finishes sign-in in the native app: Google or the mail link sends the person
  back to vpare://auth-callback?code=…, and the code is exchanged here using
  the PKCE verifier this app stored when sign-in began. Mounted at the root,
  because nobody is signed in yet when it is needed.
*/
export function NativeAuthListener() {
  useEffect(() => {
    if (!isNativeShell()) return;
    let handle: { remove: () => Promise<void> } | null = null;

    const finish = async (url: string | undefined) => {
      if (!url || !url.startsWith(NATIVE_AUTH_CALLBACK)) return;
      const params = new URL(url).searchParams;
      const code = params.get('code');
      const { Browser } = await import('@capacitor/browser');
      await Browser.close().catch(() => {});
      if (code) await supabase.auth.exchangeCodeForSession(code);
    };

    (async () => {
      const { App } = await import('@capacitor/app');
      const launch = await App.getLaunchUrl();
      await finish(launch?.url);
      handle = await App.addListener('appUrlOpen', ({ url }) => finish(url));
    })();

    return () => {
      handle?.remove();
    };
  }, []);

  return null;
}
