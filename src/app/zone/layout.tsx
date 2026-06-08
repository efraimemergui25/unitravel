'use client';

import Link                        from 'next/link';
import { usePathname }             from 'next/navigation';
import { motion }                  from 'framer-motion';
import { ZONE_META, ZoneId }       from '@/lib/zoneEngines';
import { useTravelEngine }         from '@/store/useTravelEngine';
import { ConciergePanel }          from '@/components/ai/ConciergePanel';

const ZONES: ZoneId[] = ['flights', 'lodging', 'dining', 'attractions', 'transit', 'map'];
const SPRING = { type: 'spring', stiffness: 420, damping: 28 } as const;

const MotionLink = motion(Link);

export default function ZoneLayout({ children }: { children: React.ReactNode }) {
  const pathname   = usePathname();
  const activeZone = ZONES.find(z => pathname.includes(`/zone/${z}`));

  const trip = useTravelEngine(s => s.trip);

  return (
    <div
      style={{
        display:    'flex',
        flexDirection: 'row',
        gap:         16,
        width:       '100%',
        height:      '100%',
        fontFamily:  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif",
        overflow:    'hidden',
      }}
    >
      {/* ── 2/3 Workspace glass panel ─────────────────────────────────────── */}
      <div
        className="flex-1 h-full rounded-[2.5rem] bg-white/20 backdrop-blur-2xl border border-white/50 shadow-xl flex flex-col overflow-hidden relative"
      >
        {/* Floating zone-nav pill — docked top-center */}
        <div
          className="absolute top-5 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-full bg-white/40 backdrop-blur-3xl border border-white/60 flex gap-1 z-50"
          style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.95)' }}
        >
          {/* Back to trip */}
          <MotionLink
            href="/"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            transition={SPRING}
            style={{
              display:        'flex',
              alignItems:     'center',
              gap:            4,
              paddingBlock:   5,
              paddingInline:  10,
              borderRadius:   20,
              fontSize:       11,
              fontWeight:     700,
              color:          '#007AFF',
              background:     'rgba(0,122,255,0.10)',
              border:         '1px solid rgba(0,122,255,0.18)',
              textDecoration: 'none',
              flexShrink:     0,
              letterSpacing:  '-0.01em',
            }}
          >
            ← Trip
          </MotionLink>

          <div style={{ width: 1, height: 18, background: 'rgba(0,0,0,0.10)', marginInline: 4, alignSelf: 'center', flexShrink: 0 }} aria-hidden />

          {/* Zone tabs */}
          {ZONES.filter(z => z !== 'map').map(zone => {
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
                  gap:            4,
                  paddingBlock:   5,
                  paddingInline:  10,
                  borderRadius:   20,
                  fontSize:       11,
                  fontWeight:     isActive ? 800 : 500,
                  color:          isActive ? meta.color : '#6E6E73',
                  background:     isActive ? `${meta.color}14` : 'transparent',
                  border:         `1px solid ${isActive ? `${meta.color}30` : 'transparent'}`,
                  textDecoration: 'none',
                  flexShrink:     0,
                  letterSpacing:  '-0.01em',
                  position:       'relative',
                  transition:     'all 0.18s ease',
                }}
              >
                <span style={{ fontSize: 13, lineHeight: 1 }}>{meta.icon}</span>
                <span>{meta.label}</span>
              </MotionLink>
            );
          })}

          {/* Trip label */}
          {trip.title && (
            <>
              <div style={{ width: 1, height: 18, background: 'rgba(0,0,0,0.07)', marginInline: 4, alignSelf: 'center', flexShrink: 0 }} aria-hidden />
              <span style={{ fontSize: 10, fontWeight: 600, color: '#AEAEB2', flexShrink: 0, letterSpacing: '-0.01em', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', alignSelf: 'center' }}>
                {trip.title}
              </span>
            </>
          )}
        </div>

        {/* Zone page content — padded top so content clears the pill */}
        <div style={{ flex: 1, minHeight: 0, paddingBlockStart: 64, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {children}
        </div>
      </div>

      {/* ── 1/3 AI Concierge glass panel ────────────────────────────────── */}
      <div
        className="w-[360px] h-full rounded-[2.5rem] bg-white/30 backdrop-blur-3xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.05)] flex flex-col overflow-hidden"
        style={{ flexShrink: 0 }}
      >
        <ConciergePanel fitParent />
      </div>
    </div>
  );
}
