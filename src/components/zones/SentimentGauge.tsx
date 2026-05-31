'use client';

import { useEffect, useRef, useState, memo } from 'react';
import { motion }                             from 'framer-motion';

interface SentimentInput {
  positive: number;
  neutral:  number;
  negative: number;
  compound: number;
}

export interface SentimentGaugeProps {
  sentiment:   SentimentInput;
  trustScore:  number;   // 0–100
  reviewCount: number;
  sourceCount: number;
}

// ── SVG constants ─────────────────────────────────────────────────────────────

const CX = 70;
const CY = 70;
const R_OUTER = 56;
const R_INNER = 40;
const SIZE    = 140;
const C_OUTER = 2 * Math.PI * R_OUTER;

// ── Arc path helper ───────────────────────────────────────────────────────────

function arcSegment(
  r: number, startFrac: number, endFrac: number,
): { d: string; arcLen: number } {
  const span = endFrac - startFrac;
  if (span < 0.002) return { d: '', arcLen: 0 };
  const a1 = (startFrac * 360 - 90) * (Math.PI / 180);
  const a2 = (endFrac   * 360 - 90) * (Math.PI / 180);
  const sx = CX + r * Math.cos(a1);
  const sy = CY + r * Math.sin(a1);
  const ex = CX + r * Math.cos(a2);
  const ey = CY + r * Math.sin(a2);
  const large = span > 0.5 ? 1 : 0;
  const d = `M ${sx.toFixed(2)} ${sy.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`;
  return { d, arcLen: r * 2 * Math.PI * span };
}

// ── Component ─────────────────────────────────────────────────────────────────

export const SentimentGauge = memo(function SentimentGauge({
  sentiment, trustScore, reviewCount, sourceCount,
}: SentimentGaugeProps) {
  const [displayed, setDisplayed] = useState(0);
  const rafRef = useRef<number | null>(null);

  // Count-up animation via RAF
  useEffect(() => {
    const start    = performance.now();
    const duration = 900;
    const tick = (now: number) => {
      const t    = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setDisplayed(Math.round(trustScore * ease));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [trustScore]);

  const scoreColor = trustScore >= 75 ? '#30D158' : trustScore >= 55 ? '#FF9F0A' : '#FF453A';
  const glowColor  = scoreColor;

  // Inner ring fractions
  const negFrac = Math.max(0, 1 - sentiment.positive - Math.max(0, sentiment.neutral));
  const posEnd  = sentiment.positive;
  const neuEnd  = Math.min(1, posEnd + Math.max(0, sentiment.neutral));

  const posArc = arcSegment(R_INNER, 0,      posEnd);
  const neuArc = arcSegment(R_INNER, posEnd, neuEnd);
  const negArc = arcSegment(R_INNER, neuEnd, neuEnd + negFrac);

  const ROWS: [string, number, string][] = [
    ['Positive', sentiment.positive,           '#30D158'],
    ['Neutral',  Math.max(0, sentiment.neutral), '#FF9F0A'],
    ['Negative', negFrac,                       '#FF453A'],
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>

      {/* Ring */}
      <div style={{ position: 'relative', width: SIZE, height: SIZE }}>
        {/* Ambient glow */}
        <div style={{
          position: 'absolute', inset: 12, borderRadius: '50%',
          background: `radial-gradient(ellipse, ${glowColor}18 0%, transparent 70%)`,
          pointerEvents: 'none',
        }} />

        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ overflow: 'visible' }}>
          {/* Outer track */}
          <circle cx={CX} cy={CY} r={R_OUTER} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth={9} />

          {/* Outer animated trust ring */}
          <motion.circle
            cx={CX} cy={CY} r={R_OUTER}
            fill="none"
            stroke={scoreColor}
            strokeWidth={9}
            strokeLinecap="round"
            strokeDasharray={`${C_OUTER} ${C_OUTER}`}
            initial={{ strokeDashoffset: C_OUTER }}
            animate={{ strokeDashoffset: C_OUTER * (1 - trustScore / 100) }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
            transform={`rotate(-90, ${CX}, ${CY})`}
          />

          {/* Inner track */}
          <circle cx={CX} cy={CY} r={R_INNER} fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth={5} />

          {/* Positive arc (draw animation) */}
          {posArc.d && (
            <motion.path
              d={posArc.d} fill="none" stroke="#30D158" strokeWidth={5} strokeLinecap="round"
              strokeDasharray={`${posArc.arcLen} ${posArc.arcLen}`}
              initial={{ strokeDashoffset: posArc.arcLen }}
              animate={{ strokeDashoffset: 0 }}
              transition={{ duration: 0.7, ease: 'easeOut', delay: 0.35 }}
            />
          )}

          {/* Neutral arc */}
          {neuArc.d && (
            <motion.path
              d={neuArc.d} fill="none" stroke="#FF9F0A" strokeWidth={5} strokeLinecap="round"
              strokeDasharray={`${neuArc.arcLen} ${neuArc.arcLen}`}
              initial={{ strokeDashoffset: neuArc.arcLen }}
              animate={{ strokeDashoffset: 0 }}
              transition={{ duration: 0.7, ease: 'easeOut', delay: 0.5 }}
            />
          )}

          {/* Negative arc */}
          {negArc.d && (
            <motion.path
              d={negArc.d} fill="none" stroke="#FF453A" strokeWidth={5} strokeLinecap="round"
              strokeDasharray={`${negArc.arcLen} ${negArc.arcLen}`}
              initial={{ strokeDashoffset: negArc.arcLen }}
              animate={{ strokeDashoffset: 0 }}
              transition={{ duration: 0.7, ease: 'easeOut', delay: 0.65 }}
            />
          )}

          {/* Score label */}
          <text x={CX} y={CY - 4} textAnchor="middle" fontSize={26} fontWeight={800}
            fill={scoreColor} fontFamily="-apple-system, BlinkMacSystemFont, sans-serif">
            {displayed}
          </text>
          <text x={CX} y={CY + 13} textAnchor="middle" fontSize={8} fontWeight={700}
            fill="#AEAEB2" fontFamily="-apple-system, sans-serif" letterSpacing="0.06em">
            TRUST SCORE
          </text>
        </svg>
      </div>

      {/* Sentiment bars */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 5 }}>
        {ROWS.map(([label, frac, color]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 9, fontWeight: 600, color: '#8E8E93', width: 50 }}>{label}</span>
            <div style={{ flex: 1, height: 4, background: 'rgba(0,0,0,0.06)', borderRadius: 2 }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${frac * 100}%` }}
                transition={{ duration: 0.7, ease: 'easeOut', delay: 0.4 }}
                style={{ height: '100%', borderRadius: 2, background: color }}
              />
            </div>
            <span style={{ fontSize: 9, fontWeight: 700, color, width: 26, textAlign: 'right' }}>
              {Math.round(frac * 100)}%
            </span>
          </div>
        ))}
      </div>

      {/* Meta */}
      <span style={{ fontSize: 9, color: '#AEAEB2', fontWeight: 500 }}>
        {reviewCount.toLocaleString()} reviews · {sourceCount} sources
      </span>
    </div>
  );
});
