import { Capacitor, registerPlugin } from '@capacitor/core';

/*
  The same web app runs in a browser, as an installed PWA, and inside the
  native iOS/Android shell (Capacitor). Only the shell has home-screen widgets
  and native push; everything here is a no-op elsewhere.
*/

interface WidgetBridgePlugin {
  /* Hand the widget its read-only key and the server to ask. */
  configure(options: { token: string; api: string }): Promise<void>;
  /* Ask the system to redraw widgets now (after marking a day, etc.). */
  refresh(): Promise<void>;
  /* Forget the key: on sign-out or when revoked. */
  clear(): Promise<void>;
  status(): Promise<{ configured: boolean; api?: string }>;
}

export const WidgetBridge = registerPlugin<WidgetBridgePlugin>('WidgetBridge');

export const isNative = () => Capacitor.isNativePlatform();
export const nativePlatform = () => Capacitor.getPlatform() as 'ios' | 'android' | 'web';

export async function refreshWidgets() {
  if (!isNative()) return;
  try {
    await WidgetBridge.refresh();
  } catch {
    /* an older shell without the plugin — nothing to redraw */
  }
}

export async function clearWidgets() {
  if (!isNative()) return;
  try {
    await WidgetBridge.clear();
  } catch {}
}

/* vpare://day, vpare://ping, vpare://letters → in-app paths. */
export function pathFromDeepLink(raw: string) {
  try {
    const url = new URL(raw);
    if (url.protocol === 'vpare:') {
      /* Sign-in returns are handled by NativeAuthListener, not routed. */
      if (url.host === 'auth-callback') return null;
      const path = `/${url.host}${url.pathname}`.replace(/\/+$/, '') || '/day';
      return path + url.search;
    }
    if (url.origin === window.location.origin) return url.pathname + url.search;
  } catch {}
  return null;
}
