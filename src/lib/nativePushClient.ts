import supabase from './supabase';
import { WidgetBridge, isNative, nativePlatform } from './native';
import { tr } from '@/lib/i18n';

/*
  Native push inside the iOS/Android shell. Web push does not work in an app's
  web view on either platform, so the shell registers with APNs (iPhone) or
  FCM (Android) and stores the device token next to web subscriptions.
*/

export type NativePushResult = 'subscribed' | 'denied' | 'failed' | 'unavailable';

/*
  Android only: ask the shell first whether it has a Firebase project. An APK
  built without one dies inside PushNotifications.register() — natively, past
  any try/catch. An older shell without the check is treated as «no».
*/
export async function nativePushAvailable() {
  if (nativePlatform() !== 'android') return true;
  try {
    return (await WidgetBridge.pushAvailable()).available;
  } catch {
    return false;
  }
}

export async function nativePushStatus(): Promise<'on' | 'off' | 'denied' | 'unavailable'> {
  if (!isNative()) return 'off';
  if (!(await nativePushAvailable())) return 'unavailable';
  const { PushNotifications } = await import('@capacitor/push-notifications');
  const permission = await PushNotifications.checkPermissions();
  if (permission.receive === 'denied') return 'denied';
  if (permission.receive !== 'granted') return 'off';
  try {
    return localStorage.getItem('bepair-native-push') === 'on' ? 'on' : 'off';
  } catch {
    return 'off';
  }
}

export async function subscribeNativePush(userId: string): Promise<NativePushResult> {
  if (!(await nativePushAvailable())) return 'unavailable';
  const { PushNotifications } = await import('@capacitor/push-notifications');
  let permission = await PushNotifications.checkPermissions();
  if (permission.receive === 'prompt' || permission.receive === 'prompt-with-rationale') {
    permission = await PushNotifications.requestPermissions();
  }
  if (permission.receive !== 'granted') return 'denied';

  const kind = nativePlatform() === 'ios' ? 'apns' : 'fcm';

  if (kind === 'fcm') {
    /* Quiet notices («со звуком» off) land in their own silent channel. */
    await PushNotifications.createChannel({ id: 'default', name: tr('Уведомления', 'Notifications'), importance: 4, sound: 'default' }).catch(() => {});
    await PushNotifications.createChannel({ id: 'quiet', name: tr('Без звука', 'Silent'), importance: 3 }).catch(() => {});
  }

  return new Promise<NativePushResult>((resolve) => {
    let settled = false;
    const finish = (result: NativePushResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    PushNotifications.addListener('registration', async ({ value }) => {
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({ user_id: userId, endpoint: value, kind, p256dh: '', auth: '' }, { onConflict: 'endpoint' });
      if (!error) {
        try {
          localStorage.setItem('bepair-native-push', 'on');
          localStorage.setItem('bepair-native-push-token', value);
        } catch {}
      }
      finish(error ? 'failed' : 'subscribed');
    });
    PushNotifications.addListener('registrationError', () => finish('failed'));

    PushNotifications.register().catch(() => finish('failed'));
    setTimeout(() => finish('failed'), 15_000);
  });
}

export async function unsubscribeNativePush() {
  const { PushNotifications } = await import('@capacitor/push-notifications');
  let token: string | null = null;
  try {
    token = localStorage.getItem('bepair-native-push-token');
    localStorage.removeItem('bepair-native-push');
    localStorage.removeItem('bepair-native-push-token');
  } catch {}
  if (token) await supabase.from('push_subscriptions').delete().eq('endpoint', token);
  await PushNotifications.unregister().catch(() => {});
}
