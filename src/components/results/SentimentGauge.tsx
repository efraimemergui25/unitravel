'use client';

import { motion } from 'framer-motion';
import type { SentimentScore } from '@/services/OmniAggregator';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SentimentGaugeProps {
  sources:         string[];
  sourceCount:     number;
  bestPriceSource: string;
  bestPrice:       number;
  bestTrustSource: string;
  trustScore:      number;
  sentiment:       SentimentScore;
  aiConfidence:    number;
  compact?:        boolean;
  color?:          string;
}

// ── SVG Arc Gauge ─────────────────────────────────────────────────────────────
// Semicircle arc from left to right, animates from 0 to confidence value.

function ConfidenceArc({ confidence, color }: { confidence: number; color: string }) {
  return (
    <svg width={64} height={38} viewBox="0 0 64 38" aria-label={`AI confidence ${Math.round(confidence * 100)}%`}>
      {/* Track */}
      <path
        d="M 7 34 A 25 25 0 0 1 57 34"
        fill="none"
        stroke="rgba(0,0,0,0.07)"
        strokeWidth={5}
        strokeLinecap="round"
      />
      {/* Animated fill */}
      <motion.path
        d="M 7 34 A 25 25 0 0 1 57 34"
        fill="none"
        stroke={color}
        strokeWidth={5}
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray="1"
        initial={{ strokeDashoffset: 1 }}
        animate={{ strokeDashoffset: 1 - confidence }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
      />
      {/* Center label */}
      <text
        x={32} y={30}
        textAnchor="middle"
        fontSize={11}
        fontWeight={800}
        fill="#1D1D1F"
        fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif"
      >
        {Math.round(confidence * 100)}%
      </text>
    </svg>
  );
}

// ── Sentiment bars ────────────────────────────────────────────────────────────

function SentimentBars({ sentiment, compact }: { sentiment: SentimentScore; compact: boolean }) {
  const bars = [
    { label: 'Positive', value: sentiment.positive, color: '#30D158' },
    { label: 'Neutral',  value: sentiment.neutral,  color: '#AEAEB2' },
    { label: 'Negative', value: sentiment.negative, color: '#FF453A' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 4 : 6 }}>
      {bars.map(bar => (
        <div key={bar.label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{
            fontSize:      compact ? 9 : 10, fontWeight: 600,
            color:         '#6E6E73', letterSpacing: '-0.01em',
            width:         compact ? 44 : 52, flexShrink: 0,
          }}>
            {bar.label}
          </span>
          <div style={{
            flex:         1, height: compact ? 3 : 4,
            background:   'rgba(0,0,0,0.06)', borderRadius: 2, overflow: 'hidden',
          }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${bar.value * 100}%` }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
              style={{ height: '100%', background: bar.color, borderRadius: 2 }}
            />
          </div>
          <span style={{
            fontSize: compact ? 9 : 10, fontWeight: 700,
            color: bar.color, width: 28, textAlign: 'end', flexShrink: 0,
          }}>
            {Math.round(bar.value * 100)}%
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Source bubbles ────────────────────────────────────────────────────────────

function SourceBubbles({ sources, maxVisible = 5, color }: { sources: string[]; maxVisible?: number; color: string }) {
  const visible  = sources.slice(0, maxVisible);
  const overflow = sources.length - maxVisible;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {visible.map((s, i) => (
        <motion.span
          key={s}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.04, type: 'spring', stiffness: 400, damping: 24 }}
          style={{
            fontSize:      9, fontWeight: 600,
            paddingBlock:  2, paddingInline: 7,
            borderRadius:  999,
            background:    `${color}0E`,
            border:        `1px solid ${color}28`,
            color:         '#3C3C43',
            whiteSpace:    'nowrap',
          }}
        >
          {s}
        </motion.span>
      ))}
      {overflow > 0 && (
        <span style={{
          fontSize: 9, fontWeight: 700,
          paddingBlock: 2, paddingInline: 7,
          borderRadius: 999,
          background: 'rgba(0,0,0,0.05)',
          border: '1px solid rgba(0,0,0,0.08)',
          color: '#6E6E73',
        }}>
          +{overflow}
        </span>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function SentimentGauge({
  sources,
  sourceCount,
  bestPriceSource,
  bestPrice,
  bestTrustSource,
  trustScore,
  sentiment,
  aiConfidence,
  compact = false,
  color   = '#00C7BE',
}: SentimentGaugeProps) {

  if (compact) {
    // ── Compact variant: single-row pill for bento card ──────────────────────
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        style={{
          display:              'flex',
          flexDirection:        'column',
          gap:                  8,
          padding:              '10px 12px',
          borderRadius:         12,
          background:           `${color}08`,
          border:               `1px solid ${color}1A`,
          backdropFilter:       'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
      >
        {/* Dedup row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <motion.span
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{ width: 5, height: 5, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }}
              aria-hidden
            />
            <span style={{ fontSize: 10, fontWeight: 700, color: '#1D1D1F', letterSpacing: '-0.01em' }}>
              {sourceCount} sources merged
            </span>
          </div>
          <span style={{
            fontSize: 9, fontWeight: 800, color,
            background: `${color}12`, border: `1px solid ${color}28`,
            borderRadius: 6, paddingBlock: 2, paddingInline: 6,
            letterSpacing: '-0.01em',
          }}>
            {Math.round(aiConfidence * 100)}% AI confidence
          </span>
        </div>

        {/* Attribution row */}
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 8, fontWeight: 600, color: '#AEAEB2', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Best price
            </span>
            <p style={{ fontSize: 11, fontWeight: 800, color: '#1D1D1F', marginBlockStart: 2, letterSpacing: '-0.01em' }}>
              {bestPriceSource}
              <span style={{ fontSize: 10, fontWeight: 600, color, marginInlineStart: 4 }}>
                ${bestPrice.toLocaleString()}/n
              </span>
            </p>
          </div>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 8, fontWeight: 600, color: '#AEAEB2', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Highest trust
            </span>
            <p style={{ fontSize: 11, fontWeight: 800, color: '#1D1D1F', marginBlockStart: 2, letterSpacing: '-0.01em' }}>
              {bestTrustSource.split(' ').slice(-1)[0]}
              <span style={{ fontSize: 10, fontWeight: 600, color: '#30D158', marginInlineStart: 4 }}>
                {trustScore} / 10
              </span>
            </p>
          </div>
        </div>

        {/* Sentiment mini bars */}
        <SentimentBars sentiment={sentiment} compact />
      </motion.div>
    );
  }

  // ── Full variant: detail overlay panel ─────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      style={{
        display:              'flex',
        flexDirection:        'column',
        gap:                  16,
        padding:              '16px 18px',
        borderRadius:         16,
        background:           'rgba(0,0,0,0.025)',
        border:               '1px solid rgba(0,0,0,0.06)',
      }}
    >
      {/* Header row: arc + dedup badge */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <ConfidenceArc confidence={aiConfidence} color={color} />
          <span style={{ fontSize: 8, color: '#AEAEB2', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            AI Score
          </span>
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBlockEnd: 6 }}>
            <motion.span
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.8, repeat: Infinity }}
              style={{ width: 5, height: 5, borderRadius: '50%', background: '#30D158', display: 'inline-block' }}
              aria-hidden
            />
            <span style={{ fontSize: 11, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.01em' }}>
              {sourceCount} sources deduplicated
            </span>
          </div>
          <p style={{ fontSize: 10, color: '#6E6E73', lineHeight: 1.55 }}>
            Found this property across {sourceCount} platforms.
            All duplicates merged — one true price, zero cognitive overload.
          </p>
        </div>
      </div>

      {/* Source bubbles */}
      <div>
        <p style={{ fontSize: 9, fontWeight: 700, color: '#AEAEB2', textTransform: 'uppercase', letterSpacing: '0.08em', marginBlockEnd: 7 }}>
          Detected on
        </p>
        <SourceBubbles sources={sources} maxVisible={6} color={color} />
      </div>

      {/* Best price / trust attribution */}
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{
          flex: 1, padding: '12px 14px', borderRadius: 12,
          background: `${color}08`, border: `1px solid ${color}1A`,
        }}>
          <span style={{ fontSize: 9, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Best price found via
          </span>
          <p style={{ fontSize: 14, fontWeight: 900, color: '#1D1D1F', marginBlockStart: 4, letterSpacing: '-0.02em' }}>
            {bestPriceSource}
          </p>
          <p style={{ fontSize: 13, fontWeight: 800, color, marginBlockStart: 2 }}>
            ${bestPrice.toLocaleString()}<span style={{ fontSize: 10, fontWeight: 500 }}>/night</span>
          </p>
        </div>
        <div style={{
          flex: 1, padding: '12px 14px', borderRadius: 12,
          background: 'rgba(48,209,88,0.06)', border: '1px solid rgba(48,209,88,0.16)',
        }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: '#30D158', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Highest trust score
          </span>
          <p style={{ fontSize: 12, fontWeight: 900, color: '#1D1D1F', marginBlockStart: 4, letterSpacing: '-0.02em', lineHeight: 1.3 }}>
            {bestTrustSource}
          </p>
          <p style={{ fontSize: 13, fontWeight: 800, color: '#30D158', marginBlockStart: 2 }}>
            {trustScore}<span style={{ fontSize: 10, fontWeight: 500 }}>/10</span>
          </p>
        </div>
      </div>

      {/* Full sentiment bars */}
      <div>
        <p style={{ fontSize: 9, fontWeight: 700, color: '#AEAEB2', textTransform: 'uppercase', letterSpacing: '0.08em', marginBlockEnd: 8 }}>
          Guest Sentiment · {(sentiment.positive * 100).toFixed(0)}% positive
        </p>
        <SentimentBars sentiment={sentiment} compact={false} />
      </div>
    </motion.div>
  );
}

// ── Scanning / loading state ──────────────────────────────────────────────────

export function SentimentGaugeScanning({ engineCount = 4, color = '#00C7BE' }: { engineCount?: number; color?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            18,
        paddingBlock:   28,
        paddingInline:  20,
        borderRadius:   20,
        background:     `${color}06`,
        border:         `1px solid ${color}18`,
        position:       'relative',
        overflow:       'hidden',
      }}
    >
      {/* Ambient background glow */}
      <motion.div
        animate={{ scale: [1, 1.3, 1], opacity: [0.12, 0.28, 0.12] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden
        style={{
          position:     'absolute',
          width:        180,
          height:       180,
          borderRadius: '50%',
          background:   `radial-gradient(circle, ${color}50 0%, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      {/* Pulsating glass orb */}
      <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
        {/* Outer glow ring */}
        <motion.div
          animate={{ scale: [1, 1.25, 1], opacity: [0.3, 0.65, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          aria-hidden
          style={{
            position:             'absolute',
            inset:                -8,
            borderRadius:         '50%',
            background:           `radial-gradient(circle, ${color}40 0%, transparent 70%)`,
          }}
        />
        {/* Glass circle */}
        <motion.div
          animate={{ scale: [1, 1.04, 1] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position:             'absolute',
            inset:                0,
            borderRadius:         '50%',
            background:           `rgba(255,255,255,0.55)`,
            backdropFilter:       'blur(24px) saturate(1.8)',
            WebkitBackdropFilter: 'blur(24px) saturate(1.8)',
            border:               `1.5px solid ${color}40`,
            boxShadow:            `0 0 32px ${color}30, inset 0 1px 0 rgba(255,255,255,0.9)`,
            display:              'flex',
            alignItems:           'center',
            justifyContent:       'center',
          }}
        >
          {/* Rotating ring */}
          <motion.svg
            width={36}
            height={36}
            viewBox="0 0 36 36"
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
            aria-hidden
          >
            <circle
              cx={18} cy={18} r={14}
              fill="none"
              stroke={color}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeDasharray="28 60"
              opacity={0.9}
            />
          </motion.svg>
        </motion.div>
      </div>

      {/* Text block */}
      <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <motion.p
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 1.8, repeat: Infinity }}
          style={{
            fontSize:      12,
            fontWeight:    700,
            color:         color,
            letterSpacing: '-0.01em',
            lineHeight:    1.4,
            margin:        0,
          }}
        >
          Aggregating {engineCount} providers
        </motion.p>
        <motion.p
          animate={{ opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 1.8, repeat: Infinity, delay: 0.3 }}
          style={{
            fontSize:      10,
            fontWeight:    500,
            color:         'var(--text-secondary)',
            letterSpacing: '-0.01em',
            lineHeight:    1.5,
            margin:        '4px 0 0',
          }}
        >
          Stripping hidden fees · normalizing sentiment
        </motion.p>

        {/* Animated dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginBlockStart: 10 }}>
          {[0, 1, 2].map(i => (
            <motion.span
              key={i}
              animate={{ scale: [1, 1.6, 1], opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.22, ease: 'easeInOut' }}
              aria-hidden
              style={{
                width:        5,
                height:       5,
                borderRadius: '50%',
                background:   color,
                display:      'inline-block',
              }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
