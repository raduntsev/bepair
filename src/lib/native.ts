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
  /* Android: whether this build carries a Firebase project. Without one, registering for push kills the app. */
  pushAvailable(): Promise<{ available: boolean }>;
  /* Android: the quiet «today» line on the lock screen. */
  lockStatus(): Promise<{ enabled: boolean; permitted: boolean }>;
  setLockStatus(options: { enabled: boolean }): Promise<{ enabled: boolean }>;
  /*
    Android: «Где мы». A foreground service sends the phone's point every five
    minutes and redraws the «Карта» widget. requestLocation asks for the
    permission and starts nothing: sharing is switched on in the database
    first, then ensureLocation starts the service — only when permission is
    already there, never with a prompt.
  */
  locationStatus(): Promise<LocationNative>;
  requestLocation(): Promise<LocationNative>;
  ensureLocation(): Promise<LocationNative>;
  stopLocation(): Promise<LocationNative>;
  /* «Allow all the time»: so the service comes back after a reboot. Opens the system screen on Android 11+. */
  requestBackgroundLocation(): Promise<LocationNative>;
}

export interface LocationNative {
  running: boolean;
  /* Location while the app (or its service) is in use. */
  foreground: boolean;
  /* «Allow all the time»: the service may start again after a reboot. */
  background: boolean;
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

/* The Android location service, or null where there is none (browser, iPhone, an older APK). */
export async function nativeLocation(action: 'locationStatus' | 'requestLocation' | 'ensureLocation' | 'stopLocation' | 'requestBackgroundLocation') {
  if (nativePlatform() !== 'android') return null;
  try {
    return await WidgetBridge[action]();
  } catch {
    return null;
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
