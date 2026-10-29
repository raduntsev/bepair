import { createClient } from '@supabase/supabase-js';

/*
  Missing env vars must not break the build (Vercel prerenders pages without a
  session). The client is created against a placeholder and the app shows a
  plain «не настроено» screen instead of failing deep inside supabase-js.
*/
export const isSupabaseConfigured = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://not-configured.supabase.co';
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'not-configured';

const isBrowser = typeof window !== 'undefined';

/*
  Inside the native shell, sign-in leaves the app (system browser for Google,
  the mail app for a link) and comes back through vpare://auth-callback with a
  one-time code. That is the PKCE flow: the verifier stays in the app's own
  storage, so only this app can finish the sign-in. In a browser the implicit
  flow keeps magic links working across devices, as before.
*/
const inNativeShell =
  isBrowser && !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    persistSession: isBrowser,
    autoRefreshToken: isBrowser,
    detectSessionInUrl: isBrowser,
    flowType: inNativeShell ? 'pkce' : 'implicit',
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
  global: {
    headers: { 'x-app-name': 'bepair' },
  },
});

export const NATIVE_AUTH_CALLBACK = 'vpare://auth-callback';
export const isNativeShell = () => inNativeShell;

export default supabase;
