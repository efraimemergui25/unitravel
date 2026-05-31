'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';
import type { RouteOption, TransitSegment, ComfortLevel } from '@/types/transit';
import { MODE_COLOR, MODE_ICON } from '@/services/TransitDistillation';

const SPRING = { type: 'spring', stiffness: 380, damping: 30 } as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m > 0 ? `${m}m` : ''}`.trim() : `${m}m`;
}

function fmtCost(mxn: number): string {
  return `MX$${mxn.toLocaleString()}`;
}

const COMFORT_LABELS: Record<ComfortLevel, string> = { 1: '●○○○○', 2: '●●○○○', 3: '●●●○○', 4: '●●●●○', 5: '●●●●●' };

// ── Segment bar ───────────────────────────────────────────────────────────────

const SegmentBar = memo(function SegmentBar({
  seg, widthFrac, delay,
}: {
  seg:       TransitSegment;
  widthFrac: number;
  delay:     number;
}) {
  const color = MODE_COLOR[seg.mode];
  const icon  = MODE_ICON[seg.mode];
  const pct   = `${Math.round(widthFrac * 100)}%`;
  const show  = widthFrac > 0.08;

  return (
    <motion.div
      initial={{ scaleX: 0, opacity: 0.6 }}
      animate={{ scaleX: 1, opacity: 1 }}
      transition={{ ...SPRING, delay }}
      style={{
        transformOrigin: 'left',
        width:           pct,
        minWidth:        6,
        height:          28,
        borderRadius:    6,
        background:      `${color}CC`,
        border:          `1px solid ${color}50`,
        display:         'flex',
        alignItems:      'center',
        paddingInline:   show ? 6 : 0,
        gap:             3,
        overflow:        'hidden',
        flexShrink:      0,
        position:        'relative',
      }}
    >
      {show && (
        <>
          <span style={{ fontSize: 10, flexShrink: 0 }}>{icon}</span>
          <span style={{ fontSize: 8, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {seg.label.split('(')[0].trim()}
          </span>
        </>
      )}
    </motion.div>
  );
});

// ── Route row ─────────────────────────────────────────────────────────────────

const RouteRow = memo(function RouteRow({
  option, maxTotalMin, index, isSelected, onSelect,
}: {
  option:      RouteOption;
  maxTotalMin: number;
  index:       number;
  isSelected:  boolean;
  onSelect:    () => void;
}) {
  const COLOR_REC  = '#007AFF';
  const isRec      = option.isRecommended;
  const isFirst    = index === 0;

  // Each segment's width proportional to its duration relative to the longest route
  const bars = option.segments.map(seg => ({
    seg,
    frac: seg.durationMin / maxTotalMin,
  }));

  // Walk segments omit their bar label if too narrow
  const rowDelay = index * 0.10;

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ ...SPRING, delay: rowDelay }}
      onClick={onSelect}
      style={{
        borderRadius:    14,
        border:          `1.5px solid ${isSelected ? COLOR_REC + '60' : isRec ? COLOR_REC + '25' : 'rgba(0,0,0,0.07)'}`,
        background:      isSelected
          ? `linear-gradient(135deg, rgba(0,122,255,0.06), rgba(0,122,255,0.02))`
          : 'rgba(255,255,255,0.88)',
        backdropFilter:  'blur(20px)',
        padding:         '10px 12px',
        cursor:          'pointer',
        transition:      'border-color 0.2s, background 0.2s',
        position:        'relative',
        overflow:        'hidden',
      }}
    >
      {/* Recommended ribbon */}
      {isRec && (
        <div style={{
          position: 'absolute', top: 8, right: 10,
          fontSize: 8, fontWeight: 800, color: COLOR_REC,
          background: `${COLOR_REC}14`, borderRadius: 5,
          paddingBlock: 2, paddingInline: 6,
          border: `1px solid ${COLOR_REC}30`,
        }}>
          ★ AI Pick
        </div>
      )}
      {option.isFastest && !isRec && (
        <div style={{
          position: 'absolute', top: 8, right: 10,
          fontSize: 8, fontWeight: 800, color: '#30D158',
          background: '#30D15814', borderRadius: 5,
          paddingBlock: 2, paddingInline: 6,
          border: '1px solid #30D15830',
        }}>
          ⚡ Fastest
        </div>
      )}
      {option.isCheapest && !isRec && !option.isFastest && (
        <div style={{
          position: 'absolute', top: 8, right: 10,
          fontSize: 8, fontWeight: 800, color: '#FF9F0A',
          background: '#FF9F0A14', borderRadius: 5,
          paddingBlock: 2, paddingInline: 6,
          border: '1px solid #FF9F0A30',
        }}>
          💰 Cheapest
        </div>
      )}

      {/* Label + stats row */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: '#1C1C1E', letterSpacing: '-0.02em' }}>
          {option.label}
        </span>
      </div>

      {/* Segment bars */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 8, alignItems: 'center' }}>
        {bars.map(({ seg, frac }, i) => (
          <SegmentBar key={i} seg={seg} widthFrac={frac} delay={rowDelay + i * 0.05 + 0.1} />
        ))}
        {/* Remaining whitespace fill */}
        <div style={{ flex: 1 }} />
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 9, color: '#8E8E93' }}>⏱</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#1C1C1E' }}>{fmtDuration(option.totalMin)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 9, color: '#8E8E93' }}>💳</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#1C1C1E' }}>{fmtCost(option.totalCost)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{ fontSize: 8, color: '#8E8E93' }}>comfort</span>
          <span style={{ fontSize: 9, color: '#FF9F0A', letterSpacing: '-1px' }}>{COMFORT_LABELS[option.comfort]}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{ fontSize: 8, color: '#30D158' }}>🌿</span>
          <span style={{ fontSize: 9, color: '#636366' }}>{option.co2Kg} kg CO₂</span>
        </div>

        {/* Tags */}
        {option.tags.slice(0, 2).map(tag => (
          <span key={tag} style={{
            fontSize: 8, fontWeight: 600, color: '#636366',
            background: 'rgba(0,0,0,0.05)', borderRadius: 4,
            paddingBlock: 2, paddingInline: 5,
          }}>
            {tag}
          </span>
        ))}
      </div>
    </motion.div>
  );
});

// ── Mode legend ───────────────────────────────────────────────────────────────

const ModeLegend = memo(function ModeLegend({ modes }: { modes: Set<string> }) {
  const entries = (Object.entries(MODE_COLOR) as [keyof typeof MODE_COLOR, string][])
    .filter(([m]) => modes.has(m));

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
      {entries.map(([mode, color]) => (
        <div key={mode} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
          <span style={{ fontSize: 9, color: '#636366', fontWeight: 600 }}>
            {MODE_ICON[mode]} {mode}
          </span>
        </div>
      ))}
    </div>
  );
});

// ── TransitVisualizer ─────────────────────────────────────────────────────────

export const TransitVisualizer = memo(function TransitVisualizer({
  options,
  selectedId,
  onSelect,
}: {
  options:    RouteOption[];
  selectedId: string | null;
  onSelect:   (id: string) => void;
}) {
  const maxTotalMin = Math.max(...options.map(o => o.totalMin), 1);

  const usedModes = new Set(options.flatMap(o => o.segments.map(s => s.mode)));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <ModeLegend modes={usedModes} />
      {options.map((opt, i) => (
        <RouteRow
          key={opt.id}
          option={opt}
          maxTotalMin={maxTotalMin}
          index={i}
          isSelected={selectedId === opt.id}
          onSelect={() => onSelect(opt.id)}
        />
      ))}
    </div>
  );
});
