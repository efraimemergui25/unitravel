import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { I18nProvider } from '@/providers/I18nProvider';
import './globals.css';

const inter = Inter({
  subsets:  ['latin', 'latin-ext'],
  variable: '--font-inter',
  weight:   ['300', '400', '500', '600', '700', '800', '900'],
  display:  'swap',
});

export const metadata: Metadata = {
  title:       'Unitravel — AI Travel Operating System',
  description: 'The world\'s travel engines, unified in one intelligence.',
  icons:       { icon: '/favicon.ico' },
};

export const viewport: Viewport = {
  width:        'device-width',
  initialScale: 1,
  themeColor:   '#F5F5F7',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" className={inter.variable}>
      <body
        className="antialiased overflow-hidden"
        style={{
          background: 'var(--surface-base)',
          color:      'var(--text-primary)',
          height:     '100dvh',
          width:      '100vw',
        }}
      >
        <I18nProvider>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
