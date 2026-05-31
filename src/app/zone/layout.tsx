'use client';

import Link                    from 'next/link';
import { usePathname }         from 'next/navigation';
import { motion }              from 'framer-motion';
import { ZONE_META, ZoneId }   from '@/lib/zoneEngines';

const ZONES: ZoneId[] = ['flights', 'lodging', 'dining', 'attractions', 'transit'];
const SPRING = { type: 'spring', stiffness: 420, damping: 28 } as const;

const MotionLink = motion(Link);

export default function ZoneLayout({ children }: { children: React.ReactNode }) {
  const pathname   = usePathname();
  const activeZone = ZONES.find(z => pathname.includes(`/zone/${z}`));

  return (
    <div
      style={{
        display:        'flex',
        flexDirection:  'column',
        height:         '100dvh',
        width:          '100vw',
        overflow:       'hidden',
        background:     '#F2F2F7',
        fontFamily:     "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif",
      }}
    >
      {/* ── Top Navigation Bar ──────────────────────────────────────────── */}
      <nav
        style={{
          height:           54,
          display:          'flex',
          alignItems:       'center',
          paddingInline:    14,
          gap:              6,
          background:       'rgba(255,255,255,0.88)',
          backdropFilter:   'blur(40px) saturate(2)',
          WebkitBackdropFilter: 'blur(40px) saturate(2)',
          borderBlockEnd:   '1px solid rgba(0,0,0,0.07)',
          flexShrink:       0,
          zIndex:           100,
          boxShadow:        '0 1px 0 rgba(0,0,0,0.05)',
        }}
      >
        {/* Back to main trip */}
        <MotionLink
          href="/"
          whileHover={{ scale: 1.04, boxShadow: '0 3px 12px rgba(0,122,255,0.18)' }}
          whileTap={{ scale: 0.96 }}
          transition={SPRING}
          style={{
            display:        'flex',
            alignItems:     'center',
            gap:            4,
            paddingBlock:   6,
            paddingInline:  11,
            borderRadius:   10,
            fontSize:       12,
            fontWeight:     700,
            color:          '#007AFF',
            background:     'rgba(0,122,255,0.08)',
            border:         '1px solid rgba(0,122,255,0.14)',
            textDecoration: 'none',
            flexShrink:     0,
            letterSpacing:  '-0.01em',
          }}
        >
          ← Trip
        </MotionLink>

        {/* Divider */}
        <div
          style={{
            width:         1,
            height:        18,
            background:    'rgba(0,0,0,0.10)',
            marginInline:  6,
            flexShrink:    0,
          }}
        />

        {/* Zone tabs */}
        <div style={{ display: 'flex', gap: 3, alignItems: 'center', flex: 1, overflowX: 'auto' }}>
          {ZONES.map(zone => {
            const meta     = ZONE_META[zone];
            const isActive = activeZone === zone;

            return (
              <MotionLink
                key={zone}
                href={`/zone/${zone}`}
                whileHover={isActive ? {} : { scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                transition={SPRING}
                style={{
                  display:        'flex',
                  alignItems:     'center',
                  gap:            5,
                  paddingBlock:   6,
                  paddingInline:  12,
                  borderRadius:   10,
                  fontSize:       12,
                  fontWeight:     isActive ? 800 : 500,
                  color:          isActive ? meta.color : '#6E6E73',
                  background:     isActive ? `${meta.color}12` : 'transparent',
                  border:         `1px solid ${isActive ? `${meta.color}28` : 'transparent'}`,
                  textDecoration: 'none',
                  flexShrink:     0,
                  letterSpacing:  '-0.01em',
                  transition:     'all 0.18s ease',
                  position:       'relative',
                }}
              >
                <span style={{ fontSize: 14, lineHeight: 1 }}>{meta.icon}</span>
                <span>{meta.label}</span>

                {/* Active indicator dot */}
                {isActive && (
                  <motion.span
                    layoutId="zone-nav-dot"
                    style={{
                      position:         'absolute',
                      insetBlockEnd:    -3,
                      insetInlineStart: '50%',
                      x:                '-50%',
                      width:            4,
                      height:           4,
                      borderRadius:     '50%',
                      background:       meta.color,
                      boxShadow:        `0 0 6px ${meta.color}88`,
                    }}
                    transition={{ type: 'spring', stiffness: 450, damping: 30 }}
                  />
                )}
              </MotionLink>
            );
          })}
        </div>

        {/* Trip title — right aligned */}
        <span
          style={{
            fontSize:      11,
            fontWeight:    600,
            color:         '#AEAEB2',
            flexShrink:    0,
            letterSpacing: '-0.01em',
            paddingInlineStart: 8,
          }}
        >
          Effi & Nofar · Mexico 2026
        </span>
      </nav>

      {/* ── Zone content ────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}
