import type { Metadata, Viewport } from 'next';
import { I18nProvider }    from '@/providers/I18nProvider';
import { ConciergePanel }  from '@/components/ai/ConciergePanel';
import { ToastProvider }   from '@/components/ui/Toast';
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
    icon:    [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    apple:   '/favicon.svg',
  },
};

export const viewport: Viewport = {
  width:        'device-width',
  initialScale: 1,
  themeColor:   '#EEF2FF',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      <body
        className="antialiased"
        style={{
          height:        '100dvh',
          width:         '100vw',
          background:    'var(--bg-mesh)',
          overflow:      'hidden',
          display:       'flex',
          flexDirection: 'row',
          padding:       '10px',
          gap:           '10px',
        }}
      >
        <I18nProvider>
        <ToastProvider>

          {/* ── Ambient background — 5 animated blobs ────────────────── */}
          <div
            aria-hidden
            style={{
              position:       'fixed',
              inset:          0,
              zIndex:         0,
              overflow:       'hidden',
              pointerEvents:  'none',
            }}
          >
            {/* Azure — top-left */}
            <div style={{
              position:    'absolute',
              top:         '-14%',
              left:        '-6%',
              width:       '56%',
              height:      '56%',
              borderRadius:'50%',
              background:  'radial-gradient(ellipse, rgba(0,122,255,0.16) 0%, transparent 68%)',
              animation:   'breathe 16s ease-in-out infinite',
            }} />
            {/* Indigo — top-right */}
            <div style={{
              position:    'absolute',
              top:         '-8%',
              right:       '-4%',
              width:       '50%',
              height:      '50%',
              borderRadius:'50%',
              background:  'radial-gradient(ellipse, rgba(94,92,230,0.12) 0%, transparent 68%)',
              animation:   'breathe 20s ease-in-out infinite',
              animationDelay: '5s',
            }} />
            {/* Teal — centre */}
            <div style={{
              position:    'absolute',
              top:         '35%',
              left:        '25%',
              width:       '44%',
              height:      '44%',
              borderRadius:'50%',
              background:  'radial-gradient(ellipse, rgba(90,200,250,0.08) 0%, transparent 68%)',
              animation:   'liquid-drift 24s ease-in-out infinite',
              animationDelay: '10s',
            }} />
            {/* Violet — bottom-right */}
            <div style={{
              position:    'absolute',
              bottom:      '-10%',
              right:       '10%',
              width:       '40%',
              height:      '40%',
              borderRadius:'50%',
              background:  'radial-gradient(ellipse, rgba(191,90,242,0.10) 0%, transparent 68%)',
              animation:   'breathe 18s ease-in-out infinite',
              animationDelay: '3s',
            }} />
            {/* Teal — bottom-left */}
            <div style={{
              position:    'absolute',
              bottom:      '-6%',
              left:        '-4%',
              width:       '38%',
              height:      '38%',
              borderRadius:'50%',
              background:  'radial-gradient(ellipse, rgba(0,199,190,0.08) 0%, transparent 68%)',
              animation:   'liquid-drift 22s ease-in-out infinite',
              animationDelay: '8s',
            }} />
          </div>

          {/* ── 1/3 AI Concierge ─────────────────────────────────────── */}
          <aside
            className="liquid-glass-shimmer"
            style={{
              position:      'relative',
              zIndex:        10,
              width:         '340px',
              height:        '100%',
              borderRadius:  '26px',
              background:    'rgba(255,255,255,0.80)',
              backdropFilter:'blur(56px) saturate(200%)',
              WebkitBackdropFilter: 'blur(56px) saturate(200%)',
              border:        '1px solid rgba(255,255,255,0.90)',
              boxShadow:     `0 8px 40px rgba(0,0,0,0.08),
                              0 2px 8px rgba(0,0,0,0.04),
                              0 0 0 0.5px rgba(255,255,255,0.60),
                              inset 0 1.5px 0 rgba(255,255,255,1)`,
              display:       'flex',
              flexDirection: 'column',
              overflow:      'hidden',
              flexShrink:    0,
            }}
          >
            {/* Specular top line */}
            <div aria-hidden style={{
              position: 'absolute',
              left:     '6%',
              right:    '6%',
              top:      0,
              height:   '1px',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.90) 35%, rgba(255,255,255,0.90) 65%, transparent)',
              zIndex:   2,
              borderRadius: '999px',
            }} />
            <ConciergePanel fitParent />
          </aside>

          {/* ── 2/3 Workspace ────────────────────────────────────────── */}
          <main
            className="liquid-glass-shimmer"
            style={{
              position:      'relative',
              zIndex:        10,
              flex:          1,
              height:        '100%',
              borderRadius:  '26px',
              background:    'rgba(255,255,255,0.50)',
              backdropFilter:'blur(40px) saturate(168%)',
              WebkitBackdropFilter: 'blur(40px) saturate(168%)',
              border:        '1px solid rgba(255,255,255,0.82)',
              boxShadow:     `0 8px 40px rgba(0,0,0,0.06),
                              0 2px 8px rgba(0,0,0,0.03),
                              inset 0 1.5px 0 rgba(255,255,255,0.98)`,
              display:       'flex',
              flexDirection: 'column',
              overflow:      'hidden',
              minWidth:      0,
            }}
          >
            {/* Specular top line */}
            <div aria-hidden style={{
              position: 'absolute',
              left:     '4%',
              right:    '4%',
              top:      0,
              height:   '1px',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.85) 30%, rgba(255,255,255,0.85) 70%, transparent)',
              zIndex:   2,
              borderRadius: '999px',
            }} />
            {children}
          </main>

        </ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
