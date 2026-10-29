import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Впаре — общее пространство',
    short_name: 'Впаре',
    description: 'Общее ежедневное пространство для двоих',
    lang: 'ru',
    start_url: '/day',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f5f5fa',
    theme_color: '#f5f5fa',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Весточка', url: '/ping', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
      { name: 'Сегодня', url: '/day', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
    ],
  };
}
