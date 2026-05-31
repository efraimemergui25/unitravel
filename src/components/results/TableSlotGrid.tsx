'use client';

import { memo, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTravelEngine }         from '@/store/useTravelEngine';
import type { PlacedEntity }       from '@/store/useTravelEngine';
import type { TimeSlot }           from '@/app/api/dining/route';

// ── Types ─────────────────────────────────────────────────────────────────────

export type SlotStatus = 'available' | 'blocked' | 'perfect' | 'selected' | 'caution';

export interface TimeBlocker {
  time:          string;   // HH:MM
  label:         string;   // "Flight arrival", "Hotel check-in", etc.
  bufferMinutes: number;   // hard-block radius
  cautionMins:   number;   // soft-caution radius (shown but not blocked)
  type:          'flight' | 'hotel' | 'activity' | 'custom';
}

export interface TableSlotGridProps {
  slots:       TimeSlot[];
  dayId?:      string;              // read live entity conflicts from store if provided
  blockers?:   TimeBlocker[];       // static blockers (used by demo / detail view)
  selectedTime?:string;
  onSelect:    (slot: TimeSlot) => void;
  color?:      string;
  compact?:    boolean;
}

// ── Time helpers ──────────────────────────────────────────────────────────────

function parseMinutes(hhmm: string): number {
  const [h = '0', m = '0'] = hhmm.split(':');
  return parseInt(h, 10) * 60 + parseInt(m, 10);
}

function formatLabel(hhmm: string): string {
  const mins = parseMinutes(hhmm);
  const h    = Math.floor(mins / 60) % 24;
  const m    = mins % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12  = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

// ── Build blockers from Zustand entities ──────────────────────────────────────
// Each entity on the active day that has a `time` field creates a temporal blocker.
// Flights get a larger buffer than other entity types.

function entitiesToBlockers(entities: PlacedEntity[]): TimeBlocker[] {
  return entities
    .filter(e => !!e.time)
    .map(e => ({
      time:          e.time!,
      label:         e.category === 'flight' ? 'Flight on timeline' : e.title,
      bufferMinutes: e.category === 'flight' ? 120 : 60,
      cautionMins:   e.category === 'flight' ? 150 : 90,
      type:          e.category as TimeBlocker['type'],
    }));
}

// ── Slot status resolver ──────────────────────────────────────────────────────

function resolveStatus(
  slot:         TimeSlot,
  blockers:     TimeBlocker[],
  selectedTime: string | undefined,
): { status: SlotStatus; blockerLabel?: string } {

  if (slot.time === selectedTime) return { status: 'selected' };

  const slotMins = parseMinutes(slot.time);

  for (const b of blockers) {
    const blockerMins = parseMinutes(b.time);
    const diff        = Math.abs(slotMins - blockerMins);

    if (diff < b.bufferMinutes) {
      return { status: 'blocked', blockerLabel: b.label };
    }
    if (diff < b.cautionMins) {
      return { status: 'caution', blockerLabel: b.label };
    }
  }

  // Perfect window: slot is 150+ minutes from every blocker
  const isPerfect = blockers.length > 0 && blockers.every(b =>
    Math.abs(slotMins - parseMinutes(b.time)) >= 150
  );

  return { status: isPerfect ? 'perfect' : 'available' };
}

// ── Source badge ──────────────────────────────────────────────────────────────

function SourceBadge({ source, compact }: { source: string; compact: boolean }) {
  const parts     = source.split('+');
  const hasMulti  = parts.length > 1;
  const label     = hasMulti ? `${parts.length} sources` : source;
  return (
    <span style={{
      fontSize:      compact ? 7 : 8,
      fontWeight:    700,
      color:         hasMulti ? '#30D158' : '#AEAEB2',
      letterSpacing: '-0.01em',
    }}>
      {label}
    </span>
  );
}

// ── Slot pill ─────────────────────────────────────────────────────────────────

const SlotPill = memo(function SlotPill({
  slot, status, blockerLabel, color, compact, onSelect,
}: {
  slot:         TimeSlot;
  status:       SlotStatus;
  blockerLabel?: string;
  color:        string;
  compact:      boolean;
  onSelect:     (s: TimeSlot) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const isBlocked  = status === 'blocked';
  const isPerfect  = status === 'perfect';
  const isCaution  = status === 'caution';
  const isSelected = status === 'selected';

  const bg =
    isSelected ? color :
    isPerfect  ? 'rgba(48,209,88,0.12)' :
    isCaution  ? 'rgba(255,159,10,0.10)' :
    isBlocked  ? 'rgba(0,0,0,0.04)' :
    'rgba(255,255,255,0.82)';

  const border =
    isSelected ? `1.5px solid ${color}` :
    isPerfect  ? '1.5px solid rgba(48,209,88,0.38)' :
    isCaution  ? '1px solid rgba(255,159,10,0.28)' :
    isBlocked  ? '1px solid rgba(0,0,0,0.06)' :
    `1px solid ${color}28`;

  const textColor =
    isSelected ? '#fff' :
    isPerfect  ? '#30D158' :
    isCaution  ? '#FF9F0A' :
    isBlocked  ? '#C7C7CC' :
    color;

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <motion.button
        onClick={() => !isBlocked && onSelect(slot)}
        disabled={isBlocked}
        onHoverStart={() => setHovered(true)}
        onHoverEnd={() => setHovered(false)}
        whileHover={!isBlocked ? { scale: 1.06, y: -2 } : {}}
        whileTap={!isBlocked ? { scale: 0.95 } : {}}
        animate={{
          background: bg,
          opacity: isBlocked ? 0.38 : 1,
          filter: isBlocked ? 'blur(0.4px) grayscale(0.3)' : 'none',
        }}
        transition={{ duration: 0.18 }}
        style={{
          display:       'flex',
          flexDirection: 'column',
          alignItems:    'center',
          gap:           2,
          paddingBlock:  compact ? 5 : 7,
          paddingInline: compact ? 8 : 10,
          borderRadius:  10,
          border,
          cursor:        isBlocked ? 'not-allowed' : 'pointer',
          fontFamily:    'inherit',
          minWidth:      compact ? 52 : 60,
          position:      'relative',
          overflow:      'hidden',
        }}
      >
        {/* Perfect glow animation */}
        {isPerfect && (
          <motion.div
            animate={{ opacity: [0, 0.18, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              position:     'absolute',
              inset:        -2,
              borderRadius: 12,
              background:   'radial-gradient(ellipse, rgba(48,209,88,0.35) 0%, transparent 70%)',
              pointerEvents: 'none',
            }}
            aria-hidden
          />
        )}

        <span style={{ fontSize: compact ? 10 : 11.5, fontWeight: 800, color: textColor, letterSpacing: '-0.02em' }}>
          {formatLabel(slot.time)}
        </span>
        <SourceBadge source={slot.source} compact={compact} />

        {/* Status icon */}
        {isPerfect  && <span style={{ fontSize: 8, color: '#30D158' }} aria-hidden>✦ ideal</span>}
        {isCaution  && <span style={{ fontSize: 8, color: '#FF9F0A' }} aria-hidden>⚡ tight</span>}
        {isBlocked  && <span style={{ fontSize: 8, color: '#C7C7CC' }} aria-hidden>✕ conflict</span>}
        {isSelected && <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.8)' }} aria-hidden>✓</span>}
      </motion.button>

      {/* Tooltip on hover when blocked */}
      <AnimatePresence>
        {hovered && isBlocked && blockerLabel && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            style={{
              position:   'absolute',
              bottom:     '110%',
              insetInlineStart: '50%',
              transform:  'translateX(-50%)',
              background: 'rgba(0,0,0,0.82)',
              color:      '#fff',
              fontSize:   9,
              fontWeight: 600,
              paddingBlock: 4,
              paddingInline: 8,
              borderRadius: 7,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              zIndex:     20,
            }}
          >
            {blockerLabel}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

// ── Legend ────────────────────────────────────────────────────────────────────

function SlotLegend({ hasBlockers }: { hasBlockers: boolean }) {
  if (!hasBlockers) return null;
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', paddingInline: 2 }}>
      {[
        { color: '#30D158', label: 'Perfect window' },
        { color: '#FF9F0A', label: 'Tight timing' },
        { color: '#C7C7CC', label: 'Conflict' },
      ].map(({ color, label }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} aria-hidden />
          <span style={{ fontSize: 9, fontWeight: 600, color: '#8E8E93', letterSpacing: '-0.01em' }}>{label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function TableSlotGrid({
  slots,
  dayId,
  blockers: staticBlockers = [],
  selectedTime,
  onSelect,
  color  = '#FF9F0A',
  compact = false,
}: TableSlotGridProps) {

  // Live cross-reference: read entities from active day in Zustand
  const dayEntities = useTravelEngine(s =>
    dayId ? s.days.find(d => d.id === dayId)?.entities ?? [] : []
  );

  const allBlockers: TimeBlocker[] = useMemo(() => [
    ...staticBlockers,
    ...entitiesToBlockers(dayEntities),
  ], [staticBlockers, dayEntities]);

  const sortedSlots = useMemo(() =>
    [...slots].sort((a, b) => parseMinutes(a.time) - parseMinutes(b.time)),
    [slots]
  );

  const perfects = sortedSlots.filter(s =>
    resolveStatus(s, allBlockers, selectedTime).status === 'perfect'
  );

  if (sortedSlots.length === 0) {
    return (
      <div style={{
        padding: '10px 4px',
        fontSize: 11, fontWeight: 500, color: '#AEAEB2',
        textAlign: 'center',
      }}>
        No availability for this date.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 6 : 8 }}>
      {/* Header */}
      {!compact && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{
            fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)',
            textTransform: 'uppercase', letterSpacing: '0.07em',
          }}>
            Availability · {sortedSlots.length} slots
          </span>
          {allBlockers.length > 0 && perfects.length > 0 && (
            <motion.span
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{
                fontSize: 9, fontWeight: 800, color: '#30D158',
                background: 'rgba(48,209,88,0.10)',
                border: '1px solid rgba(48,209,88,0.24)',
                borderRadius: 6, paddingBlock: 2, paddingInline: 7,
              }}
            >
              ✦ {perfects.length} ideal window{perfects.length !== 1 ? 's' : ''}
            </motion.span>
          )}
        </div>
      )}

      {/* Slot pills */}
      <div style={{
        display:         'flex',
        gap:             compact ? 5 : 7,
        overflowX:       'auto',
        paddingBlock:    compact ? 2 : 4,
        paddingInline:   2,
        scrollbarWidth:  'none',
        msOverflowStyle: 'none' as React.CSSProperties['msOverflowStyle'],
      } as React.CSSProperties}>
        {sortedSlots.map(slot => {
          const { status, blockerLabel } = resolveStatus(slot, allBlockers, selectedTime);
          return (
            <SlotPill
              key={`${slot.time}-${slot.source}`}
              slot={slot}
              status={status}
              blockerLabel={blockerLabel}
              color={color}
              compact={compact}
              onSelect={onSelect}
            />
          );
        })}
      </div>

      {/* Legend */}
      {!compact && <SlotLegend hasBlockers={allBlockers.length > 0} />}

      {/* Timeline conflict summary */}
      <AnimatePresence>
        {allBlockers.length > 0 && !compact && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              display:       'flex',
              alignItems:    'center',
              gap:           6,
              paddingBlock:  6,
              paddingInline: 10,
              borderRadius:  9,
              background:    'rgba(0,0,0,0.03)',
              border:        '1px solid rgba(0,0,0,0.06)',
            }}
          >
            <span style={{ fontSize: 11 }} aria-hidden>🗓</span>
            <span style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '-0.01em' }}>
              Cross-referenced with your LiquidTimeline — {allBlockers.length} event{allBlockers.length !== 1 ? 's' : ''} on this day
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
