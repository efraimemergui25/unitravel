'use client';

import { motion }          from 'framer-motion';
import type { PlacedEntity } from '@/store/useTravelEngine';

// ── Constants ─────────────────────────────────────────────────────────────────

const SPRING = { type: 'spring', stiffness: 380, damping: 28 } as const;

// ── Mode icon map ─────────────────────────────────────────────────────────────

const MODE_META: Record<TransitMode, { icon: string; label: string }> = {
  walk:    { icon: '🚶', label: 'walk'  },
  drive:   { icon: '🚗', label: 'drive' },
  transit: { icon: '🚌', label: 'ride'  },
};

// ── Transit mode inference ────────────────────────────────────────────────────

export type TransitMode = 'walk' | 'drive' | 'transit';

export function inferTransitMode(fromCategory: string, transitMin: number): TransitMode {
  if (fromCategory === 'hotel') return 'drive';
  if (transitMin <= 20)         return 'walk';
  if (transitMin <= 45)         return 'drive';
  return 'transit';
}

// Default transit duration heuristics (real data would come from Google Maps adapter)
export function estimateTransitMin(
  from: PlacedEntity,
  to:   PlacedEntity,
): number {
  if (from.category === 'flight' || to.category === 'flight') return 45;
  if (from.category === 'hotel' || to.category === 'hotel')   return 30;
  return 20;
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface TransitBlockProps {
  from:         PlacedEntity;
  to:           PlacedEntity;
  transitMin?:  number;
  mode?:        TransitMode;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TransitBlock({ from, to, transitMin, mode }: TransitBlockProps) {
  const minutes = transitMin ?? estimateTransitMin(from, to);
  const resolvedMode = mode ?? inferTransitMode(from.category, minutes);
  const { icon, label } = MODE_META[resolvedMode];

  const hours = Math.floor(minutes / 60);
  const mins  = minutes % 60;
  const durationLabel = hours > 0
    ? (mins > 0 ? `${hours}h ${mins}m ${label}` : `${hours}h ${label}`)
    : `${mins}m ${label}`;

  return (
    <motion.div
      initial={{ opacity: 0, scaleX: 0.88 }}
      animate={{ opacity: 1, scaleX: 1 }}
      exit={{ opacity: 0, scaleX: 0.88 }}
      transition={SPRING}
      style={{
        width:                '90%',
        marginInline:         'auto',
        height:               40,
        borderRadius:         999,
        background:           'rgba(255,255,255,0.10)',
        backdropFilter:       'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border:               '1px dashed rgba(255,255,255,0.40)',
        display:              'flex',
        alignItems:           'center',
        justifyContent:       'center',
        gap:                  8,
        flexShrink:           0,
      }}
    >
      {/* Dashed connecting line — left */}
      <div style={{
        flex:          1,
        height:        1,
        borderBlockEnd: '1px dashed rgba(0,0,0,0.10)',
        marginInlineStart: 14,
      }} />

      {/* Icon + label */}
      <span style={{ fontSize: 14, flexShrink: 0, lineHeight: 1 }}>{icon}</span>
      <span style={{
        fontSize:      11,
        fontWeight:    600,
        color:         '#8E8E93',
        letterSpacing: '-0.01em',
        fontFamily:    'inherit',
        whiteSpace:    'nowrap',
        flexShrink:    0,
      }}>
        {durationLabel}
      </span>

      {/* Destination name */}
      {to.title && (
        <>
          <span style={{ fontSize: 10, color: 'rgba(0,0,0,0.20)', flexShrink: 0 }}>·</span>
          <span style={{
            fontSize:      10,
            fontWeight:    600,
            color:         '#AEAEB2',
            letterSpacing: '-0.01em',
            fontFamily:    'inherit',
            whiteSpace:    'nowrap',
            maxWidth:      120,
            overflow:      'hidden',
            textOverflow:  'ellipsis',
            flexShrink:    1,
          }}>
            {to.title}
          </span>
        </>
      )}

      {/* Dashed connecting line — right */}
      <div style={{
        flex:           1,
        height:         1,
        borderBlockEnd: '1px dashed rgba(0,0,0,0.10)',
        marginInlineEnd: 14,
      }} />
    </motion.div>
  );
}
