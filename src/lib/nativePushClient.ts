import supabase from './supabase';
import { isNative, nativePlatform } from './native';

/*
  Native push inside the iOS/Android shell. Web push does not work in an app's
  web view on either platform, so the shell registers with APNs (iPhone) or
  FCM (Android) and stores the device token next to web subscriptions.
*/

export type NativePushResult = 'subscribed' | 'denied' | 'failed';

export async function nativePushStatus(): Promise<'on' | 'off' | 'denied'> {
  if (!isNative()) return 'off';
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
  const { PushNotifications } = await import('@capacitor/push-notifications');
  let permission = await PushNotifications.checkPermissions();
  if (permission.receive === 'prompt' || permission.receive === 'prompt-with-rationale') {
    permission = await PushNotifications.requestPermissions();
  }
  if (permission.receive !== 'granted') return 'denied';

  const kind = nativePlatform() === 'ios' ? 'apns' : 'fcm';

  if (kind === 'fcm') {
    /* Quiet notices («со звуком» off) land in their own silent channel. */
    await PushNotifications.createChannel({ id: 'default', name: 'Уведомления', importance: 4, sound: 'default' }).catch(() => {});
    await PushNotifications.createChannel({ id: 'quiet', name: 'Без звука', importance: 3 }).catch(() => {});
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
