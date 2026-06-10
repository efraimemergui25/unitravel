import type { Metadata, Viewport } from 'next';
import { I18nProvider }  from '@/providers/I18nProvider';
import { ToastProvider } from '@/components/ui/Toast';
import './globals.css';

export const metadata: Metadata = {
  title:       'Unitravel — AI Travel Operating System',
  description: 'The world\'s travel engines, unified in one intelligence. 151+ live search engines, zero hidden fees, one AI that plans your perfect trip.',
  keywords:    ['travel', 'AI travel planner', 'flight search', 'trip planning', 'travel concierge'],
  openGraph: {
    title:       'Unitravel — AI Travel Operating System',
    description: '151+ search engines. Zero hidden fees. One AI.',
    type:        'website',
  },
  icons: {
    icon:  [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    apple: '/favicon.svg',
  },
};

export const viewport: Viewport = {
  width:        'device-width',
  initialScale: 1,
  themeColor:   '#F5F5F7',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      <body
        className="antialiased"
        style={{
          height:     '100dvh',
          width:      '100vw',
          background: 'var(--bg-mesh)',
          overflow:   'hidden',
        }}
      >
        <I18nProvider>
          <ToastProvider>

            {/* ── Ambient background — 5 animated blobs ──────────────────── */}
            <div
              aria-hidden
              style={{
                position:      'fixed',
                inset:         0,
                zIndex:        0,
                overflow:      'hidden',
                pointerEvents: 'none',
              }}
            >
              {/* Azure — top-left */}
              <div style={{
                position: 'absolute', top: '-14%', left: '-6%',
                width: '56%', height: '56%', borderRadius: '50%',
                background: 'radial-gradient(ellipse, rgba(0,122,255,0.14) 0%, transparent 68%)',
                animation: 'breathe 16s ease-in-out infinite',
              }} />
              {/* Indigo — top-right */}
              <div style={{
                position: 'absolute', top: '-8%', right: '-4%',
                width: '50%', height: '50%', borderRadius: '50%',
                background: 'radial-gradient(ellipse, rgba(88,86,214,0.10) 0%, transparent 68%)',
                animation: 'breathe 20s ease-in-out infinite',
                animationDelay: '5s',
              }} />
              {/* Teal — centre */}
              <div style={{
                position: 'absolute', top: '35%', left: '25%',
                width: '44%', height: '44%', borderRadius: '50%',
                background: 'radial-gradient(ellipse, rgba(90,200,250,0.07) 0%, transparent 68%)',
                animation: 'liquid-drift 24s ease-in-out infinite',
                animationDelay: '10s',
              }} />
              {/* Violet — bottom-right */}
              <div style={{
                position: 'absolute', bottom: '-10%', right: '10%',
                width: '40%', height: '40%', borderRadius: '50%',
                background: 'radial-gradient(ellipse, rgba(191,90,242,0.08) 0%, transparent 68%)',
                animation: 'breathe 18s ease-in-out infinite',
                animationDelay: '3s',
              }} />
              {/* Teal — bottom-left */}
              <div style={{
                position: 'absolute', bottom: '-6%', left: '-4%',
                width: '38%', height: '38%', borderRadius: '50%',
                background: 'radial-gradient(ellipse, rgba(0,199,190,0.07) 0%, transparent 68%)',
                animation: 'liquid-drift 22s ease-in-out infinite',
                animationDelay: '8s',
              }} />
            </div>

            {/* ── Full-width workspace ────────────────────────────────────── */}
            {/* ConciergePanel is embedded per-zone in zone/layout.tsx        */}
            <main
              style={{
                position:      'relative',
                zIndex:        10,
                width:         '100%',
                height:        '100%',
                display:       'flex',
                flexDirection: 'column',
                overflow:      'hidden',
              }}
            >
              {children}
            </main>

          </ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
