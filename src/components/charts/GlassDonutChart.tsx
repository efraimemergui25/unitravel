'use client';

import { useMemo }             from 'react';
import { motion }              from 'framer-motion';

// ── Constants ─────────────────────────────────────────────────────────────────

const CX   = 100;
const CY   = 100;
const R    = 68;
const CIRC = 2 * Math.PI * R;   // ≈ 427.3
const GAP  = 4;                  // gap between segments (degrees → px)

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DonutSegment {
  label:  string;
  value:  number;
  color:  string;
}

export interface GlassDonutChartProps {
  segments:   DonutSegment[];
  size?:      number;       // svg width/height in px, default 200
  innerLabel?: string;      // e.g. "$4,200"
  innerSub?:   string;      // e.g. "total spent"
}

// ── Segment path math ─────────────────────────────────────────────────────────

interface ComputedSegment extends DonutSegment {
  dashLen:    number;
  dashOffset: number;  // negative = start position on circle
}

function computeSegments(segments: DonutSegment[]): ComputedSegment[] {
  const total = segments.reduce((s, d) => s + d.value, 0);
  if (total === 0) return [];

  const gapFraction = GAP / 360;
  const segmentCount = segments.length;
  const usable = 1 - segmentCount * gapFraction;

  const computed: ComputedSegment[] = [];
  let cumulative = 0;

  for (const seg of segments) {
    const fraction = (seg.value / total) * usable;
    const dashLen   = fraction * CIRC;
    // Start at top (−CIRC * 0.25), advance by cumulative + gap spacing
    const gapLen    = gapFraction * CIRC;
    const dashOffset = -(cumulative * CIRC + gapLen * computed.length) + CIRC * 0.25;

    computed.push({ ...seg, dashLen, dashOffset: -dashOffset - CIRC });
    cumulative += fraction;
  }

  return computed;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function GlassDonutChart({
  segments,
  size     = 200,
  innerLabel,
  innerSub,
}: GlassDonutChartProps) {
  const computed = useMemo(() => computeSegments(segments), [segments]);

  const scale = size / 200;

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg
        viewBox="0 0 200 200"
        width={size}
        height={size}
        style={{ overflow: 'visible' }}
      >
        <defs>
          {/* Glow filter — makes strokes look like lit glass tubes */}
          <filter id="donut-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur" />
            <feColorMatrix in="blur" type="matrix"
              values="1 0 0 0 0
                      0 1 0 0 0
                      0 0 1 0 0
                      0 0 0 12 -3"
              result="glow" />
            <feComposite in="glow" in2="SourceGraphic" operator="atop" />
          </filter>

          {/* Segment glow per color */}
          {computed.map((seg) => (
            <filter key={`gf-${seg.label}`} id={`gf-${seg.label.replace(/\s+/g, '-')}`}
              x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="0" stdDeviation="4"
                floodColor={seg.color} floodOpacity="0.55" />
            </filter>
          ))}
        </defs>

        {/* Background track */}
        <circle
          cx={CX} cy={CY} r={R}
          fill="none"
          stroke="rgba(0,0,0,0.05)"
          strokeWidth={12}
        />

        {/* Segments */}
        {computed.map((seg, i) => (
          <motion.circle
            key={seg.label}
            cx={CX}
            cy={CY}
            r={R}
            fill="none"
            stroke={seg.color}
            strokeWidth={12}
            strokeLinecap="round"
            filter={`url(#gf-${seg.label.replace(/\s+/g, '-')})`}
            style={{ opacity: 0.82 }}
            initial={{
              strokeDasharray: `0 ${CIRC}`,
              strokeDashoffset: seg.dashOffset,
            }}
            animate={{
              strokeDasharray:  `${seg.dashLen} ${CIRC}`,
              strokeDashoffset: seg.dashOffset,
            }}
            transition={{
              duration: 1.1,
              delay:    i * 0.12,
              ease:     [0.22, 1, 0.36, 1],
            }}
          />
        ))}

        {/* Inner label */}
        {innerLabel && (
          <text
            x={CX} y={CY - 6}
            textAnchor="middle"
            dominantBaseline="middle"
            style={{
              fontSize:   22,
              fontWeight: 800,
              fill:       '#1C1C1E',
              fontFamily: '-apple-system, "SF Pro Display", Inter, sans-serif',
              letterSpacing: '-0.03em',
            }}
          >
            {innerLabel}
          </text>
        )}
        {innerSub && (
          <text
            x={CX} y={CY + 16}
            textAnchor="middle"
            dominantBaseline="middle"
            style={{
              fontSize:   10,
              fontWeight: 500,
              fill:       '#8E8E93',
              fontFamily: '-apple-system, "SF Pro Display", Inter, sans-serif',
              letterSpacing: '-0.01em',
            }}
          >
            {innerSub}
          </text>
        )}
      </svg>

      {/* Legend below chart */}
      <div style={{
        position:       'absolute',
        insetBlockEnd:  -(segments.length > 4 ? 88 : 72),
        insetInlineStart: '50%',
        transform:      'translateX(-50%)',
        display:        'flex',
        flexWrap:       'wrap',
        justifyContent: 'center',
        gap:            8,
        width:          240,
      }}>
        {computed.map(seg => (
          <div key={seg.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{
              width:        8, height: 8,
              borderRadius: '50%',
              background:   seg.color,
              boxShadow:    `0 0 5px ${seg.color}99`,
              flexShrink:   0,
            }} />
            <span style={{
              fontSize:      10,
              fontWeight:    600,
              color:         '#6E6E73',
              fontFamily:    'inherit',
              letterSpacing: '-0.01em',
              whiteSpace:    'nowrap',
            }}>
              {seg.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
