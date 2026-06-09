'use client';

import { useMemo, useCallback }    from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles }                from 'lucide-react';
import { useTravelEngine }         from '@/store/useTravelEngine';
import { detectDayGaps, resolveTimezone, utcToLocal } from '@/utils/TimezoneMath';
import type { EngineDay }          from '@/store/useTravelEngine';
import type { TimeGap }            from '@/utils/TimezoneMath';

// ── Constants ─────────────────────────────────────────────────────────────────

const SPRING_POP  = { type: 'spring', stiffness: 500, damping: 24 } as const;
const MIN_GAP_MIN = 180; // 3 hours
const VIOLET      = '#BF5AF2';
const AZURE       = '#5E5CE6';

// ── AI fill gap event ─────────────────────────────────────────────────────────

export interface AIGapFillPayload {
  dayId:        string;
  destination:  string;
  gapMinutes:   number;
  startDisplay: string;
  endDisplay:   string | null;
  suggestedPrompt: string; // pre-written prompt to send to AI concierge
}

// ── Single gap node ───────────────────────────────────────────────────────────

function AIGapNode({ gap, day }: { gap: TimeGap; day: EngineDay }) {
  const timezone = resolveTimezone(day.destination);

  const { startDisplay, endDisplay } = useMemo(() => ({
    startDisplay: utcToLocal(gap.startISO, timezone).displayHHMM,
    endDisplay:   gap.endISO ? utcToLocal(gap.endISO, timezone).displayHHMM : null,
  }), [gap, timezone]);

  const hours = Math.floor(gap.gapMinutes / 60);
  const mins  = gap.gapMinutes % 60;
  const gapLabel = hours > 0
    ? (mins > 0 ? `${hours}h ${mins}m` : `${hours}h`)
    : `${mins}m`;

  const handleClick = useCallback(() => {
    const suggestedPrompt =
      `I see a ${gapLabel} gap in ${day.destination} between ${startDisplay}` +
      (endDisplay ? ` and ${endDisplay}` : '') +
      `. What's a great local experience I could add here? Consider the weather, my travel DNA, and any nearby attractions.`;

    const payload: AIGapFillPayload = {
      dayId:        day.id,
      destination:  day.destination,
      gapMinutes:   gap.gapMinutes,
      startDisplay,
      endDisplay,
      suggestedPrompt,
    };

    document.dispatchEvent(
      new CustomEvent<AIGapFillPayload>('unitravel:ai-fill-gap', { detail: payload, bubbles: true }),
    );
  }, [day, gap, gapLabel, startDisplay, endDisplay]);

  return (
    <motion.button
      onClick={handleClick}
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.90 }}
      whileHover={{ scale: 1.02, y: -1 }}
      whileTap={{ scale: 0.97 }}
      transition={SPRING_POP}
      style={{
        width:         '100%',
        paddingBlock:  11,
        paddingInline: 14,
        borderRadius:  16,
        background:    'rgba(255,255,255,0.08)',
        border:        'none',
        cursor:        'pointer',
        fontFamily:    'inherit',
        display:       'flex',
        alignItems:    'center',
        gap:           10,
        position:      'relative',
        overflow:      'hidden',
      }}
    >
      {/* Animated gradient shimmer background */}
      <motion.div
        animate={{
          background: [
            `radial-gradient(ellipse at 0% 50%, ${VIOLET}10 0%, transparent 70%)`,
            `radial-gradient(ellipse at 100% 50%, ${AZURE}10 0%, transparent 70%)`,
            `radial-gradient(ellipse at 0% 50%, ${VIOLET}10 0%, transparent 70%)`,
          ],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      />

      {/* Dashed top/bottom borders */}
      <div style={{
        position: 'absolute', insetInlineStart: 10, insetInlineEnd: 10, insetBlockStart: 0,
        borderBlockStart: `1.5px dashed ${VIOLET}22`,
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', insetInlineStart: 10, insetInlineEnd: 10, insetBlockEnd: 0,
        borderBlockEnd: `1.5px dashed ${VIOLET}22`,
        pointerEvents: 'none',
      }} />

      {/* Pulsing sparkle icon */}
      <motion.div
        animate={{
          scale:   [1, 1.18, 1],
          opacity: [0.7, 1, 0.7],
          boxShadow: [
            `0 0 0px ${VIOLET}00`,
            `0 0 12px ${VIOLET}60`,
            `0 0 0px ${VIOLET}00`,
          ],
        }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          width:          28,
          height:         28,
          borderRadius:   9,
          background:     `linear-gradient(135deg, ${VIOLET}18, ${AZURE}18)`,
          border:         `1px solid ${VIOLET}30`,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          flexShrink:     0,
          position:       'relative',
        }}
      >
        <Sparkles size={13} color="#5E5CE6" strokeWidth={1.8} />
      </motion.div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0, textAlign: 'start' }}>
        <div style={{
          fontSize:      11,
          fontWeight:    800,
          letterSpacing: '-0.02em',
          lineHeight:    1.2,
          background:    `linear-gradient(90deg, ${VIOLET}, ${AZURE})`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
          AI: Fill {gapLabel} Gap
        </div>
        <div style={{
          fontSize:      9.5,
          fontWeight:    500,
          color:         '#8E8E93',
          letterSpacing: '-0.01em',
          marginBlockStart: 2,
        }}>
          {startDisplay}{endDisplay ? ` – ${endDisplay}` : ''} · Tap to get suggestions
        </div>
      </div>

      {/* Arrow */}
      <motion.span
        animate={{ x: [0, 3, 0] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        style={{ fontSize: 12, color: VIOLET, opacity: 0.65, flexShrink: 0 }}
      >
        →
      </motion.span>
    </motion.button>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function AIGapFiller({ dayId }: { dayId: string }) {
  const days = useTravelEngine(s => s.days);
  const day  = days.find(d => d.id === dayId);

  const gaps = useMemo(() => {
    if (!day || day.entities.length < 2) return [];
    return detectDayGaps(day.entities, day.date, resolveTimezone(day.destination), MIN_GAP_MIN);
  }, [day]);

  if (!day || gaps.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
        style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBlockStart: 4 }}
      >
        {gaps.map(gap => (
          <AIGapNode key={gap.afterEntityId} gap={gap} day={day} />
        ))}
      </motion.div>
    </AnimatePresence>
  );
}
