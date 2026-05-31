'use client';

import { motion }           from 'framer-motion';
import { LiquidTimeline }   from '@/components/management/LiquidTimeline';
import { FinancialWidget }  from '@/components/management/FinancialWidget';
import { useTravelEngine }  from '@/store/useTravelEngine';

const SPRING = { type: 'spring', stiffness: 320, damping: 28 } as const;

export default function ManagementPage() {
  const trip = useTravelEngine(s => s.trip);
  const days = useTravelEngine(s => s.days);
  const totalEntities = days.reduce((sum, d) => sum + d.entities.length, 0);

  return (
    <div style={{
      display:    'flex',
      width:      '100%',
      height:     '100%',
      overflow:   'hidden',
      background: 'var(--surface-base)',
    }}>
      {/* ── Timeline column ─────────────────────────────────────────────── */}
      <div style={{
        flex:       1,
        minWidth:   0,
        overflowY:  'auto',
        overflowX:  'hidden',
        paddingBlock:   'clamp(20px, 3vw, 36px)',
        paddingInline:  'clamp(16px, 3vw, 32px)',
      }}>
        {/* Page header */}
        <motion.div
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING, delay: 0.05 }}
          style={{ marginBottom: 24 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h1 style={{
              margin:        0,
              fontSize:      'clamp(1.35rem, 2.1vw, 1.8rem)',
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
                  background:    'rgba(0,122,255,0.1)',
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
          <p style={{
            margin:        0,
            fontSize:      13, fontWeight: 500,
            color:         'var(--text-secondary)',
            letterSpacing: '-0.01em',
          }}>
            {trip.travelers.join(' & ')} · {trip.title.split('·').pop()?.trim()} ·{' '}
            {new Date(trip.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            {' – '}
            {new Date(trip.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        </motion.div>

        {/* Timeline */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          <LiquidTimeline />
        </motion.div>
      </div>

      {/* ── Financial sidebar ────────────────────────────────────────────── */}
      <motion.aside
        initial={{ opacity: 0, x: 28 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ ...SPRING, delay: 0.2 }}
        style={{
          width:             274,
          flexShrink:        0,
          paddingBlock:      'clamp(20px, 3vw, 36px)',
          paddingInline:     'clamp(14px, 2.5vw, 24px)',
          borderInlineStart: '1px solid rgba(0,0,0,0.06)',
          display:           'flex',
          flexDirection:     'column',
          gap:               16,
          overflowY:         'auto',
        }}
      >
        <div style={{
          fontSize:      10, fontWeight: 700,
          letterSpacing: '0.07em',
          color:         'var(--text-tertiary)',
          textTransform: 'uppercase',
          paddingBlock:  '2px 4px',
        }}>
          Financial Intelligence
        </div>

        <FinancialWidget />

        {/* Quick tip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          style={{
            fontSize:      11, fontWeight: 500,
            color:         'var(--text-tertiary)',
            letterSpacing: '-0.01em',
            lineHeight:    1.5,
            paddingInline: 2,
          }}
        >
          Click any day to make it active, then add items from any zone panel.
        </motion.div>
      </motion.aside>
    </div>
  );
}
