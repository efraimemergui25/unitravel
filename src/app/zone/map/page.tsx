'use client';

import { motion } from 'framer-motion';
import { Map } from 'lucide-react';
import { useTravelEngine } from '@/store/useTravelEngine';

const COLOR  = '#5E5CE6';
const SPRING = { type: 'spring', stiffness: 400, damping: 28 } as const;

export default function MapPage() {
  const trip = useTravelEngine(s => s.trip);
  const days = useTravelEngine(s => s.days);

  const uniqueDests = [...new Set(days.map(d => d.destination))].filter(Boolean);
  const hasTrip     = uniqueDests.length > 0 || !!trip.title;

  return (
    <div
      style={{
        display:        'flex',
        flexDirection:  'column',
        width:          '100%',
        height:         '100%',
        overflow:       'hidden',
        background: [
          `radial-gradient(ellipse at 30% 20%, ${COLOR}0A 0%, transparent 52%)`,
          'radial-gradient(ellipse at 80% 80%, rgba(0,199,190,0.05) 0%, transparent 48%)',
          '#F2F2F7',
        ].join(', '),
      }}
    >
      {/* Header bar */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...SPRING, delay: 0.05 }}
        style={{
          display:              'flex',
          alignItems:           'center',
          gap:                  12,
          paddingInline:        22,
          paddingBlock:         14,
          borderBlockEnd:       '1px solid rgba(0,0,0,0.05)',
          background:           'rgba(255,255,255,0.72)',
          backdropFilter:       'blur(32px) saturate(1.8)',
          WebkitBackdropFilter: 'blur(32px) saturate(1.8)',
          flexShrink:           0,
        }}
      >
        <Map size={16} color="#5E5CE6" strokeWidth={1.8} aria-hidden />
        <div>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.02em' }}>
            Spatial View
          </span>
          {hasTrip && (
            <span style={{ fontSize: 11, fontWeight: 500, color: '#6E6E73', marginInlineStart: 10 }}>
              {uniqueDests.join(' · ') || trip.title}
            </span>
          )}
        </div>
        <div style={{ marginInlineStart: 'auto' }}>
          <span style={{
            fontSize: 10, fontWeight: 700,
            paddingBlock: 4, paddingInline: 10,
            borderRadius: 99,
            background: `${COLOR}0E`, border: `1px solid ${COLOR}28`,
            color: COLOR,
          }}>
            Phase D — Coming Soon
          </span>
        </div>
      </motion.div>

      {/* Content */}
      <div
        style={{
          flex:           1,
          minHeight:      0,
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'center',
          gap:            24,
          padding:        40,
          textAlign:      'center',
        }}
      >
        <motion.div
          animate={{ scale: [1, 1.04, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
          style={{ width: 80, height: 80, borderRadius: 24, background: 'rgba(94,92,230,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          aria-hidden
        >
          <Map size={36} color="#5E5CE6" strokeWidth={1.5} />
        </motion.div>

        <div>
          <h1 style={{
            margin: 0, fontSize: 24, fontWeight: 900,
            color: '#1D1D1F', letterSpacing: '-0.04em',
          }}>
            Map Zone
          </h1>
          <p style={{
            margin: '10px 0 0', fontSize: 13, fontWeight: 500,
            color: '#6E6E73', maxWidth: 400, lineHeight: 1.6,
            letterSpacing: '-0.01em',
          }}>
            A spatial view of all your placed itinerary entities — hotels,
            restaurants, and experiences pinned on a live map with proximity
            lines and walking routes.
          </p>
        </div>

        {/* Roadmap chips */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {[
            'All itinerary pins',
            'Walking distance lines',
            'Hotel proximity rings',
            'Weather overlay',
            'Transit routes',
          ].map(label => (
            <div key={label} style={{
              fontSize: 10, fontWeight: 700,
              paddingBlock: 5, paddingInline: 12,
              borderRadius: 99,
              background: `${COLOR}0E`, border: `1px solid ${COLOR}22`,
              color: COLOR,
            }}>
              {label}
            </div>
          ))}
        </div>

        {hasTrip && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, ...SPRING }}
            style={{
              paddingBlock:   12,
              paddingInline:  20,
              borderRadius:   14,
              background:     'rgba(255,255,255,0.88)',
              border:         '1px solid rgba(0,0,0,0.07)',
              boxShadow:      '0 4px 20px rgba(0,0,0,0.06)',
              backdropFilter: 'blur(20px)',
              fontSize:       12,
              fontWeight:     600,
              color:          '#3C3C43',
              maxWidth:       380,
            }}
          >
            <span style={{ color: COLOR }}>✦</span>{' '}
            Your trip to{' '}
            <strong>{uniqueDests.join(', ') || trip.title}</strong>{' '}
            will be mapped here. Add GOOGLE_MAPS_API_KEY or MAPBOX_TOKEN to
            .env.local to enable the live map.
          </motion.div>
        )}
      </div>
    </div>
  );
}
