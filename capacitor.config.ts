import type { CapacitorConfig } from '@capacitor/cli';

/*
  The native app is a shell around the deployed web app plus what only native
  code can do: home-screen widgets and native push. Set BEPAIR_URL to the
  Vercel address before `npx cap sync`, e.g.
    BEPAIR_URL=https://vpare.vercel.app npx cap sync
*/
const url = process.env.BEPAIR_URL?.replace(/\/+$/, '');

const config: CapacitorConfig = {
  appId: 'app.bepair.vpare',
  appName: 'Впаре',
  webDir: 'native/www',
  server: url
    ? {
        url,
        cleartext: url.startsWith('http://'),
        /* Supabase auth pages open in the system browser, not here. */
        allowNavigation: [new URL(url).host],
        errorPath: 'index.html',
      }
    : undefined,
  ios: {
    contentInset: 'never',
    backgroundColor: '#f5f5fa',
  },
  android: {
    backgroundColor: '#f5f5fa',
  },
  plugins: {
    SystemBars: {
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
