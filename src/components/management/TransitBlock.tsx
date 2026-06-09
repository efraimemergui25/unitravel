'use client';

import { motion }            from 'framer-motion';
import { Footprints, Car, Bus } from 'lucide-react';
import type { PlacedEntity } from '@/store/useTravelEngine';

// ── Constants ─────────────────────────────────────────────────────────────────

const SPRING = { type: 'spring', stiffness: 380, damping: 28 } as const;

type LucideComp = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

// ── Mode icon map ─────────────────────────────────────────────────────────────

const MODE_META: Record<TransitMode, { icon: LucideComp; label: string }> = {
  walk:    { icon: Footprints, label: 'walk'  },
  drive:   { icon: Car,        label: 'drive' },
  transit: { icon: Bus,        label: 'ride'  },
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
  const { icon: ModeIcon, label } = MODE_META[resolvedMode];

  const hours = Math.floor(minutes / 60);
  const mins  = minutes % 60;
  const durationLabel = hours > 0
    ? (mins > 0 ? `${hours}h ${mins}m ${label}` : `${hours}h ${label}`)
    : `${mins}m ${label}`;

  const isTight = minutes <= 20;
  const accentColor = isTight ? '#FF9F0A' : '#8E8E93';

  return (
    <motion.div
      initial={{ opacity: 0, scaleX: 0.88 }}
      animate={{ opacity: 1, scaleX: 1 }}
      exit={{ opacity: 0, scaleX: 0.88 }}
      transition={SPRING}
      title={`Travel time: ${durationLabel}${isTight ? ' — tight connection' : ''}`}
      style={{
        width: '92%', marginInline: 'auto',
        height: 34, borderRadius: 999,
        background: isTight ? 'rgba(255,159,10,0.06)' : 'rgba(255,255,255,0.08)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        border: `1px dashed ${isTight ? 'rgba(255,159,10,0.35)' : 'rgba(0,0,0,0.10)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 7, flexShrink: 0, cursor: 'default',
      }}
    >
      {/* Line left */}
      <div style={{ flex: 1, height: 1, borderBlockEnd: `1px dashed ${isTight ? 'rgba(255,159,10,0.25)' : 'rgba(0,0,0,0.08)'}`, marginInlineStart: 12 }} />

      {/* Mode icon */}
      <ModeIcon size={12} color={accentColor} strokeWidth={1.75} />

      {/* Duration pill */}
      <span style={{
        fontSize: 10, fontWeight: 700, color: accentColor,
        background: isTight ? 'rgba(255,159,10,0.10)' : 'rgba(0,0,0,0.05)',
        borderRadius: 6, padding: '2px 7px', letterSpacing: '-0.01em',
        fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0,
      }}>
        {durationLabel}{isTight ? ' ⚠' : ''}
      </span>

      {/* Destination (truncated) */}
      {to.title && (
        <span style={{
          fontSize: 9.5, fontWeight: 600, color: '#AEAEB2',
          letterSpacing: '-0.01em', fontFamily: 'inherit',
          whiteSpace: 'nowrap', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 1,
        }}>→ {to.title}</span>
      )}

      {/* Line right */}
      <div style={{ flex: 1, height: 1, borderBlockEnd: `1px dashed ${isTight ? 'rgba(255,159,10,0.25)' : 'rgba(0,0,0,0.08)'}`, marginInlineEnd: 12 }} />
    </motion.div>
  );
}
