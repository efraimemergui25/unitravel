'use client';

import { useMemo, useCallback }             from 'react';
import { motion, AnimatePresence }           from 'framer-motion';
import { useTravelEngine }                   from '@/store/useTravelEngine';
import { detectDayGaps, resolveTimezone, utcToLocal } from '@/utils/TimezoneMath';
import type { TimeGap }                     from '@/utils/TimezoneMath';
import type { EngineDay }                   from '@/store/useTravelEngine';

// ── Design tokens ─────────────────────────────────────────────────────────────

const PURPLE = '#BF5AF2';

// ── Gap fill event ────────────────────────────────────────────────────────────

export interface GapFillPayload {
  dayId:          string;
  destination:    string;
  afterEntityId:  string;
  beforeEntityId: string | null;
  gapMinutes:     number;
  startISO:       string;
  endISO:         string | null;
  startDisplay:   string;
  endDisplay:     string | null;
  timezone:       string;
}

// ── Single gap button ─────────────────────────────────────────────────────────

function GapButton({ gap, day }: { gap: TimeGap; day: EngineDay }) {
  const timezone = resolveTimezone(day.destination);

  const { startDisplay, endDisplay } = useMemo(() => ({
    startDisplay: utcToLocal(gap.startISO, timezone).displayHHMM,
    endDisplay:   gap.endISO ? utcToLocal(gap.endISO, timezone).displayHHMM : null,
  }), [gap, timezone]);

  const hours = Math.floor(gap.gapMinutes / 60);
  const mins  = gap.gapMinutes % 60;
  const label = hours > 0
    ? (mins > 0 ? `${hours}h ${mins}m free` : `${hours}h free`)
    : `${mins}m free`;

  const handleClick = useCallback(() => {
    const payload: GapFillPayload = {
      dayId:          day.id,
      destination:    day.destination,
      afterEntityId:  gap.afterEntityId,
      beforeEntityId: gap.beforeEntityId,
      gapMinutes:     gap.gapMinutes,
      startISO:       gap.startISO,
      endISO:         gap.endISO,
      startDisplay,
      endDisplay,
      timezone,
    };
    document.dispatchEvent(
      new CustomEvent<GapFillPayload>('unitravel:fill-gap', { detail: payload, bubbles: true })
    );
  }, [day, gap, startDisplay, endDisplay, timezone]);

  return (
    <motion.button
      onClick={handleClick}
      whileTap={{ scale: 0.97 }}
      animate={{
        boxShadow: [
          `0 0 0 0 ${PURPLE}00, inset 0 0 0 1px rgba(191,90,242,0.14)`,
          `0 0 0 6px ${PURPLE}08, inset 0 0 0 1px rgba(191,90,242,0.30)`,
          `0 0 0 0 ${PURPLE}00, inset 0 0 0 1px rgba(191,90,242,0.14)`,
        ],
      }}
      transition={{ boxShadow: { duration: 2.6, repeat: Infinity, ease: 'easeInOut' } }}
      style={{
        width:         '100%',
        paddingBlock:  10, paddingInline: 12,
        borderRadius:  12,
        background:    `${PURPLE}06`,
        border:        'none',
        cursor:        'pointer',
        fontFamily:    'inherit',
        display:       'flex', alignItems: 'center', gap: 9,
        position:      'relative', overflow: 'hidden',
      }}
    >
      {/* Dashed edge borders */}
      <div style={{
        position: 'absolute', insetInlineStart: 12, insetInlineEnd: 12, top: 0,
        borderTop: `1.5px dashed ${PURPLE}28`,
      }} />
      <div style={{
        position: 'absolute', insetInlineStart: 12, insetInlineEnd: 12, bottom: 0,
        borderBottom: `1.5px dashed ${PURPLE}28`,
      }} />

      {/* Breathing icon */}
      <motion.div
        animate={{ scale: [1, 1.12, 1] }}
        transition={{ duration: 2.0, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          width:          26, height: 26,
          borderRadius:   8, flexShrink: 0,
          background:     `${PURPLE}12`,
          border:         `1px solid ${PURPLE}26`,
          display:        'flex', alignItems: 'center', justifyContent: 'center',
          fontSize:       12, color: PURPLE,
        }}
      >
        ✦
      </motion.div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0, textAlign: 'start' }}>
        <div style={{
          fontSize:      11, fontWeight: 800,
          color:         PURPLE, letterSpacing: '-0.02em', marginBottom: 2,
        }}>
          {label}
        </div>
        <div style={{
          fontSize:  9.5, fontWeight: 500,
          color:     'var(--text-tertiary)', letterSpacing: '-0.01em',
        }}>
          {startDisplay}{endDisplay ? ` – ${endDisplay}` : ''} · AI Concierge can fill this
        </div>
      </div>

      {/* Arrow */}
      <span style={{ fontSize: 11, color: PURPLE, opacity: 0.55, flexShrink: 0 }}>→</span>
    </motion.button>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function GapFiller({ dayId }: { dayId: string }) {
  const days = useTravelEngine(s => s.days);
  const day  = days.find(d => d.id === dayId);

  const gaps = useMemo(() => {
    if (!day || day.entities.length < 2) return [];
    return detectDayGaps(day.entities, day.date, resolveTimezone(day.destination), 180);
  }, [day]);

  if (!day || gaps.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
        style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBlockStart: 5 }}
      >
        {gaps.map(gap => (
          <GapButton key={gap.afterEntityId} gap={gap} day={day} />
        ))}
      </motion.div>
    </AnimatePresence>
  );
}
