'use client';

import { useState, useRef, useCallback, useId } from 'react';
import { motion, AnimatePresence }               from 'framer-motion';

// ── Design tokens ─────────────────────────────────────────────────────────────

const SPRING = { type: 'spring', stiffness: 420, damping: 28 } as const;

const TRAVELER_COLORS = [
  '#007AFF', '#BF5AF2', '#30D158', '#FF9F0A', '#FF453A', '#00C7BE',
];

// ── Props ─────────────────────────────────────────────────────────────────────

export interface FinancialSplitterProps {
  travelers:   string[];
  totalAmount: number;
  onChange?:   (shares: Record<string, number>) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FinancialSplitter({
  travelers,
  totalAmount,
  onChange,
}: FinancialSplitterProps) {
  const id       = useId();
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  // splitPct = User A's percentage with 2-decimal precision.
  // Stored as a float e.g. 62.45, not an integer.
  const [splitPct, setSplitPct] = useState<number>(50.00);

  const userA  = travelers[0] ?? 'You';
  const userB  = travelers[1] ?? 'Partner';
  const colorA = TRAVELER_COLORS[0]!;
  const colorB = TRAVELER_COLORS[1]!;

  // Dollar amounts: User A exact, User B is remainder (avoids rounding drift)
  const shareA = parseFloat((totalAmount * splitPct / 100).toFixed(2));
  const shareB = parseFloat((totalAmount - shareA).toFixed(2));

  // ── Pointer drag — 2-decimal precision ────────────────────────────────

  const computePct = useCallback((clientX: number) => {
    const track = trackRef.current;
    if (!track) return;
    const rect    = track.getBoundingClientRect();
    const raw     = (clientX - rect.left) / rect.width;
    const clamped = Math.max(0.05, Math.min(0.95, raw));

    // Two-decimal float (e.g. 62.47, not 62)
    const pct = parseFloat((clamped * 100).toFixed(2));
    setSplitPct(pct);

    if (onChange) {
      const a = parseFloat((totalAmount * pct / 100).toFixed(2));
      const b = parseFloat((totalAmount - a).toFixed(2));
      onChange({ [userA]: a, [userB]: b });
    }
  }, [onChange, totalAmount, userA, userB]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    computePct(e.clientX);
  }, [computePct]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    computePct(e.clientX);
  }, [computePct]);

  const onPointerUp = useCallback(() => { dragging.current = false; }, []);

  if (travelers.length < 2) return null;

  const thumbPctStr = `${splitPct}%`;
  const pctB        = parseFloat((100 - splitPct).toFixed(2));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Traveler labels with live share amounts ──────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>

        {/* User A */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: `${colorA}18`, border: `1.5px solid ${colorA}50`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 800, color: colorA,
            }}>
              {userA.charAt(0).toUpperCase()}
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#1C1C1E', letterSpacing: '-0.01em' }}>
              {userA}
            </span>
          </div>
          <motion.span
            key={shareA}
            initial={{ opacity: 0.6, y: -2 }}
            animate={{ opacity: 1,   y:  0 }}
            transition={SPRING}
            style={{ fontSize: 18, fontWeight: 900, color: colorA, letterSpacing: '-0.04em', lineHeight: 1 }}
          >
            ${shareA.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </motion.span>
          {/* 2-decimal percentage */}
          <AnimatePresence mode="wait">
            <motion.span
              key={splitPct.toFixed(2)}
              initial={{ opacity: 0, y: -3 }}
              animate={{ opacity: 1,  y: 0 }}
              exit={{    opacity: 0,  y:  3 }}
              transition={{ duration: 0.12 }}
              style={{ fontSize: 9.5, fontWeight: 700, color: colorA, letterSpacing: '-0.01em' }}
            >
              {splitPct.toFixed(2)}%
            </motion.span>
          </AnimatePresence>
        </div>

        {/* Split label pill — 2-decimal precision */}
        <AnimatePresence mode="wait">
          <motion.div
            key={splitPct.toFixed(2)}
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1   }}
            exit={{    opacity: 0, scale: 0.88 }}
            transition={SPRING}
            style={{
              paddingBlock:         5,
              paddingInline:        12,
              borderRadius:         999,
              background:           'rgba(255,255,255,0.55)',
              backdropFilter:       'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border:               '1.5px solid rgba(255,255,255,0.80)',
              boxShadow:            '0 2px 12px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.9)',
              fontSize:             11, fontWeight: 800,
              color:                '#48484A', letterSpacing: '-0.01em',
              whiteSpace:           'nowrap',
              fontVariantNumeric:   'tabular-nums',
            }}
          >
            {splitPct.toFixed(2)} / {pctB.toFixed(2)}
          </motion.div>
        </AnimatePresence>

        {/* User B */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#1C1C1E', letterSpacing: '-0.01em' }}>
              {userB}
            </span>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: `${colorB}18`, border: `1.5px solid ${colorB}50`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 800, color: colorB,
            }}>
              {userB.charAt(0).toUpperCase()}
            </div>
          </div>
          <motion.span
            key={shareB}
            initial={{ opacity: 0.6, y: -2 }}
            animate={{ opacity: 1,   y:  0 }}
            transition={SPRING}
            style={{ fontSize: 18, fontWeight: 900, color: colorB, letterSpacing: '-0.04em', lineHeight: 1, textAlign: 'end' }}
          >
            ${shareB.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </motion.span>
          <AnimatePresence mode="wait">
            <motion.span
              key={pctB.toFixed(2)}
              initial={{ opacity: 0, y: -3 }}
              animate={{ opacity: 1,  y: 0 }}
              exit={{    opacity: 0,  y:  3 }}
              transition={{ duration: 0.12 }}
              style={{ fontSize: 9.5, fontWeight: 700, color: colorB, letterSpacing: '-0.01em' }}
            >
              {pctB.toFixed(2)}%
            </motion.span>
          </AnimatePresence>
        </div>
      </div>

      {/* ── Drag track ──────────────────────────────────────────────── */}
      <div
        ref={trackRef}
        id={id}
        role="slider"
        aria-valuemin={5}
        aria-valuemax={95}
        aria-valuenow={splitPct}
        aria-label="Cost split ratio"
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={e => {
          // Arrow key precision: 0.1 step for fine control
          if (e.key === 'ArrowLeft')  setSplitPct(p => parseFloat(Math.max(5.00,  p - 0.1).toFixed(2)));
          if (e.key === 'ArrowRight') setSplitPct(p => parseFloat(Math.min(95.00, p + 0.1).toFixed(2)));
        }}
        style={{
          position:             'relative',
          height:               36,
          borderRadius:         18,
          background:           'rgba(0,0,0,0.04)',
          border:               '1.5px solid rgba(255,255,255,0.60)',
          backdropFilter:       'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          boxShadow:            'inset 0 2px 6px rgba(0,0,0,0.05), 0 1px 0 rgba(255,255,255,0.9)',
          cursor:               'ew-resize',
          userSelect:           'none',
          overflow:             'hidden',
        }}
      >
        {/* User A fill */}
        <motion.div
          animate={{ width: thumbPctStr }}
          transition={{ type: 'spring', stiffness: 600, damping: 36 }}
          style={{
            position:     'absolute',
            left: 0, top: 0, bottom: 0,
            background:   `linear-gradient(90deg, ${colorA}55, ${colorA}30)`,
            borderRadius: '18px 0 0 18px',
          }}
        />

        {/* User B fill */}
        <motion.div
          animate={{ width: `${pctB}%` }}
          transition={{ type: 'spring', stiffness: 600, damping: 36 }}
          style={{
            position:     'absolute',
            right: 0, top: 0, bottom: 0,
            background:   `linear-gradient(270deg, ${colorB}55, ${colorB}30)`,
            borderRadius: '0 18px 18px 0',
          }}
        />

        {/* Glass thumb */}
        <motion.div
          animate={{ left: thumbPctStr }}
          transition={{ type: 'spring', stiffness: 600, damping: 36 }}
          style={{
            position:             'absolute',
            top:                  '50%',
            transform:            'translate(-50%, -50%)',
            width:                28, height: 28,
            borderRadius:         '50%',
            background:           'rgba(255,255,255,0.92)',
            backdropFilter:       'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border:               '1.5px solid rgba(255,255,255,0.95)',
            boxShadow:            '0 4px 16px rgba(0,0,0,0.14), 0 1px 4px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,1)',
            display:              'flex', alignItems: 'center', justifyContent: 'center', gap: 2,
            zIndex:               2, cursor: 'ew-resize',
          }}
        >
          {[0, 1, 2].map(i => (
            <div key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(0,0,0,0.22)', flexShrink: 0 }} />
          ))}
        </motion.div>

        {/* 50% center divider */}
        <div style={{
          position: 'absolute', left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 1, height: 14, background: 'rgba(0,0,0,0.08)',
          pointerEvents: 'none',
        }} />
      </div>

      {/* ── Summary ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: '#AEAEB2', letterSpacing: '-0.01em' }}>
          Drag · ← → keys for 0.1% precision
        </span>
        <span style={{
          fontSize: 11, fontWeight: 800, color: '#48484A',
          letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums',
        }}>
          Total: ${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>
    </div>
  );
}
