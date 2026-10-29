import type { Metadata, Viewport } from 'next';
import { Onest } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/hooks/useSpaceAuth';
import { ThemeScript } from '@/components/ThemeScript';

const onest = Onest({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-onest',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Впаре — общее пространство',
  description: 'Общее ежедневное пространство для двоих',
  applicationName: 'Впаре',
  appleWebApp: { capable: true, title: 'Впаре', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f5fa' },
    { media: '(prefers-color-scheme: dark)', color: '#0f0f17' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

const DIRECTION_CONTRACT = `<!--
THESIS: A shared daily space whose reciprocity is structural — your partner's day stays
sealed until you record your own. Refuses the mood-tracker arrangement: no score, no
streak, no chart on the surface the couple actually lives in.
OWN-WORLD: Conventional wellness-app language, chosen by the user over a rolled
alternative — rounded cards on a cool near-white ground, Onest throughout, indigo accent
for every action and selection. The green→red mood spectrum is the only saturated family
and is reserved for mood alone, so no control may wear it.
STORY: I mark how today went by colour, say why in a note, and only then does what my
partner left me open.
FIRST VIEWPORT: Today's date, the mood scale at full width with an unset magnifier dot,
the note beneath it, and the partner's card sealed alongside — nav rail left on desktop,
tab bar bottom on mobile.
FORM: Category standard (canon), taken by the user over assigned candidate 6 of 7; seed
key 07c6cf5a.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
-->`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className={`${onest.variable} antialiased`}>
        <div hidden dangerouslySetInnerHTML={{ __html: DIRECTION_CONTRACT }} />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
