'use client';

import { motion }           from 'framer-motion';
import { LiquidTimeline }   from '@/components/management/LiquidTimeline';
import { FinancialWidget }  from '@/components/management/FinancialWidget';
import { useTravelEngine }  from '@/store/useTravelEngine';

const SPRING = { type: 'spring', stiffness: 320, damping: 28 } as const;

export default function ManagementPage() {
  const trip          = useTravelEngine(s => s.trip);
  const days          = useTravelEngine(s => s.days);
  const totalEntities = days.reduce((sum, d) => sum + d.entities.length, 0);

  const dateRange = trip.startDate
    ? `${new Date(trip.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(trip.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    : null;

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

      {/* ── Floating financial pill ────────────────────────────────────────── */}
      <FinancialWidget />

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...SPRING, delay: 0.05 }}
        style={{
          paddingTop:    68,
          paddingInline: 20,
          paddingBottom: 12,
          flexShrink:    0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <h1 style={{
            margin:        0,
            fontSize:      'clamp(1.2rem, 2vw, 1.6rem)',
            fontWeight:    800,
            letterSpacing: '-0.04em',
            color:         'var(--text-primary)',
            lineHeight:    1.1,
          }}>
            Trip Timeline
          </h1>
          {totalEntities > 0 && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={SPRING}
              style={{
                fontSize:      10, fontWeight: 800,
                background:    'rgba(0,122,255,0.10)',
                border:        '1px solid rgba(0,122,255,0.22)',
                color:         '#007AFF',
                borderRadius:  8,
                paddingBlock:  3, paddingInline: 8,
                letterSpacing: '-0.01em',
              }}
            >
              {totalEntities} item{totalEntities !== 1 ? 's' : ''}
            </motion.span>
          )}
        </div>

        {(trip.travelers.length > 0 || trip.title) && (
          <p style={{
            margin:        0,
            fontSize:      12, fontWeight: 500,
            color:         'var(--text-secondary)',
            letterSpacing: '-0.01em',
          }}>
            {trip.travelers.join(' & ')}
            {trip.title && ` · ${trip.title.split('·').pop()?.trim()}`}
            {dateRange && ` · ${dateRange}`}
          </p>
        )}
      </motion.div>

      {/* ── Scrollable timeline ────────────────────────────────────────────── */}
      <div
        className="no-scrollbar"
        style={{
          flex:       1,
          overflowY:  'auto',
          overflowX:  'hidden',
          paddingInline: 16,
          paddingBottom: 80,
        }}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          <LiquidTimeline />
        </motion.div>
      </div>
    </div>
  );
}
