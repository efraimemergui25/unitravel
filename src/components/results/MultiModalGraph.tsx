'use client';

import { useState, memo, useCallback }    from 'react';
import { motion, AnimatePresence }        from 'framer-motion';
import { useLocaleEngine }                from '@/store/useLocaleEngine';
import { MODE_COLOR, MODE_ICON }          from '@/services/TransitDistillation';
import type { RouteOption, TransitSegment, SurgeInfo, WalkEffort } from '@/types/transit';

// ── Constants ─────────────────────────────────────────────────────────────────

const SPRING     = { type: 'spring', stiffness: 380, damping: 28 } as const;
const SPRING_POP = { type: 'spring', stiffness: 460, damping: 22 } as const;

// Overrides for the two headline modes the brief calls out:
// train → calm indigo, rideshare → premium near-black silver
const MODE_GLOW: Record<string, string> = {
  train:       '#5E5CE6',
  rideshare:   '#48484A',
  'car-rental':'#30D158',
  bus:         '#FF9F0A',
  walk:        '#8E8E93',
  ferry:       '#00C7BE',
  shuttle:     '#FF6B35',
  flight:      '#007AFF',
};

// ── Walk effort labels (bilingual) ────────────────────────────────────────────

const WALK_EFFORT_EN: Record<WalkEffort, { label: string; icon: string; color: string }> = {
  flat:     { label: 'Easy Walk',     icon: '🚶', color: '#30D158' },
  gentle:   { label: 'Gentle Slope',  icon: '🚶', color: '#30D158' },
  moderate: { label: 'Moderate Hill', icon: '🧗', color: '#FF9F0A' },
  steep:    { label: 'Steep Incline', icon: '⛰',  color: '#FF453A' },
};

const WALK_EFFORT_HE: Record<WalkEffort, string> = {
  flat:     'הליכה קלה',
  gentle:   'שיפוע עדין',
  moderate: 'גבעה מתונה',
  steep:    'עלייה תלולה',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0) return `${h}h ${m > 0 ? `${m}m` : ''}`.trim();
  return `${m}m`;
}

function fmtUSD(usd: number): string {
  return usd === 0 ? 'Free' : `$${usd.toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
}

// ── Surge warning badge ───────────────────────────────────────────────────────

const SurgeWarningBadge = memo(function SurgeWarningBadge({
  surge, isHe,
}: {
  surge: SurgeInfo;
  isHe:  boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.88 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={SPRING_POP}
      style={{
        display:              'flex',
        alignItems:           'center',
        gap:                  7,
        paddingBlock:         8,
        paddingInline:        12,
        borderRadius:         11,
        background:           'rgba(255,255,255,0.60)',
        backdropFilter:       'blur(20px) saturate(1.8)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.8)',
        border:               '1px solid rgba(255,159,10,0.35)',
        boxShadow:            '0 4px 22px rgba(255,159,10,0.18), inset 0 1px 0 rgba(255,255,255,0.8)',
        flexShrink:           0,
      }}
    >
      <motion.span
        animate={{ opacity: [1, 0.5, 1] }}
        transition={{ duration: 1.4, repeat: Infinity }}
        style={{ fontSize: 14, flexShrink: 0 }}
      >
        ⚡
      </motion.span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 10.5, fontWeight: 800, color: '#FF9F0A', letterSpacing: '-0.02em' }}>
          {isHe
            ? `תעריף שיא פעיל · ${surge.multiplier.toFixed(1)}x`
            : `Surge Pricing Active · ${surge.multiplier.toFixed(1)}×`}
        </span>
        {surge.alternativeLabel && surge.alternativeSavingsUSD !== undefined && (
          <span style={{ fontSize: 9.5, fontWeight: 600, color: '#636366', letterSpacing: '-0.01em' }}>
            {isHe
              ? `AI ממליץ ${surge.alternativeLabel} לחיסכון של $${surge.alternativeSavingsUSD}`
              : `AI recommends ${surge.alternativeLabel} to save $${surge.alternativeSavingsUSD}`}
          </span>
        )}
      </div>
      {surge.estimatedMinutesUntilNormal !== undefined && (
        <span style={{
          fontSize: 9, fontWeight: 700, color: '#FF9F0A',
          background: 'rgba(255,159,10,0.10)', borderRadius: 6,
          paddingBlock: 2, paddingInline: 6, flexShrink: 0,
        }}>
          ~{surge.estimatedMinutesUntilNormal}m
        </span>
      )}
    </motion.div>
  );
});

// ── Walk effort badge ─────────────────────────────────────────────────────────

const WalkEffortBadge = memo(function WalkEffortBadge({
  effort, isHe,
}: {
  effort: WalkEffort;
  isHe:   boolean;
}) {
  const meta = WALK_EFFORT_EN[effort];
  return (
    <div style={{
      display:       'inline-flex',
      alignItems:    'center',
      gap:           3,
      fontSize:      8,
      fontWeight:    700,
      color:         meta.color,
      background:    `${meta.color}14`,
      border:        `1px solid ${meta.color}30`,
      borderRadius:  5,
      paddingBlock:  2,
      paddingInline: 5,
      flexShrink:    0,
    }}>
      <span>{meta.icon}</span>
      <span>{isHe ? WALK_EFFORT_HE[effort] : meta.label}</span>
    </div>
  );
});

// ── Single segment tile in the timeline lane ─────────────────────────────────

const SegmentTile = memo(function SegmentTile({
  seg, widthPct, delay, isRtl, hasSurge, isHe,
}: {
  seg:      TransitSegment;
  widthPct: number;
  delay:    number;
  isRtl:    boolean;
  hasSurge: boolean;
  isHe:     boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const color   = MODE_GLOW[seg.mode] ?? MODE_COLOR[seg.mode] ?? '#8E8E93';
  const icon    = MODE_ICON[seg.mode] ?? '•';
  const show    = widthPct > 8;
  const isSurge = hasSurge && seg.mode === 'rideshare';

  return (
    <div style={{ position: 'relative', flexShrink: 0, width: `${widthPct}%`, minWidth: 8 }}>
      <motion.div
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{ ...SPRING, delay }}
        onHoverStart={() => setHovered(true)}
        onHoverEnd={() => setHovered(false)}
        style={{
          transformOrigin: isRtl ? 'right' : 'left',
          height:          36,
          borderRadius:    7,
          background:      isSurge
            ? `linear-gradient(${isRtl ? '225deg' : '45deg'}, rgba(255,159,10,0.18), ${color}22)`
            : `${color}20`,
          border:          isSurge
            ? '1px solid rgba(255,159,10,0.45)'
            : `1px solid ${color}38`,
          boxShadow:       `0 0 8px ${color}22`,
          display:         'flex',
          alignItems:      'center',
          paddingInline:   show ? 8 : 0,
          gap:             5,
          overflow:        'hidden',
          cursor:          'default',
          position:        'relative',
        }}
      >
        {/* Inner glow sweep */}
        <motion.div
          animate={{ x: isRtl ? [0, -200] : [0, 200] }}
          transition={{ duration: 3.6, repeat: Infinity, ease: 'linear', delay: delay + 0.5 }}
          style={{
            position:   'absolute',
            insetBlock:  0,
            insetInlineStart: '-30%',
            width:      '28%',
            background: `linear-gradient(${isRtl ? '270deg' : '90deg'}, transparent, ${color}28, transparent)`,
            borderRadius: 'inherit',
            pointerEvents: 'none',
          }}
          aria-hidden
        />

        {show && (
          <>
            <span style={{ fontSize: 12, flexShrink: 0, zIndex: 1 }}>{icon}</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0, zIndex: 1 }}>
              <span style={{
                fontSize:     8.5,
                fontWeight:   700,
                color:        '#1C1C1E',
                whiteSpace:   'nowrap',
                overflow:     'hidden',
                textOverflow: 'ellipsis',
              }}>
                {seg.label.split('(')[0].trim()}
              </span>
              {seg.walkEffort && <WalkEffortBadge effort={seg.walkEffort} isHe={isHe} />}
            </div>
          </>
        )}
      </motion.div>

      {/* Hover tooltip */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            style={{
              position:   'absolute',
              bottom:     '110%',
              insetInlineStart: '50%',
              transform:  'translateX(-50%)',
              background: 'rgba(28,28,30,0.88)',
              color:      '#fff',
              fontSize:   9,
              fontWeight: 600,
              paddingBlock: 5,
              paddingInline: 8,
              borderRadius: 8,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              zIndex:     20,
            }}
          >
            <div>{seg.provider} · {fmtMin(seg.durationMin)}</div>
            {seg.cost > 0 && <div>{fmtUSD(seg.cost)}</div>}
            {isSurge && <div style={{ color: '#FF9F0A' }}>⚡ Surge active</div>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

// ── Lane badges (top-right corner) ────────────────────────────────────────────

function LaneBadge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <div style={{
      fontSize: 8, fontWeight: 800, color,
      background: bg, borderRadius: 5,
      paddingBlock: 2, paddingInline: 6,
      border: `1px solid ${color}30`,
      flexShrink: 0,
    }}>
      {label}
    </div>
  );
}

// ── Time axis tick ─────────────────────────────────────────────────────────────

function TimeAxis({ options, maxMin, isRtl }: { options: RouteOption[]; maxMin: number; isRtl: boolean }) {
  const ticks = [0, 0.25, 0.5, 0.75, 1.0].map(frac => Math.round(frac * maxMin));
  return (
    <div style={{
      display:         'flex',
      justifyContent:  'space-between',
      paddingInline:   2,
      direction:       isRtl ? 'rtl' : 'ltr',
    }}>
      {ticks.map(t => (
        <span key={t} style={{ fontSize: 8, fontWeight: 500, color: '#AEAEB2' }}>
          {fmtMin(t)}
        </span>
      ))}
    </div>
  );
}

// ── Route lane ────────────────────────────────────────────────────────────────

const RouteLane = memo(function RouteLane({
  option, maxTotalMin, index, isSelected, isRtl, isHe, onSelect,
}: {
  option:      RouteOption;
  maxTotalMin: number;
  index:       number;
  isSelected:  boolean;
  isRtl:       boolean;
  isHe:        boolean;
  onSelect:    () => void;
}) {
  const hasSurge = !!option.surgeInfo?.active;
  const delay    = index * 0.09;

  // Proportional widths for each segment (relative to slowest route total)
  const segWidths = option.segments.map(s => (s.durationMin / maxTotalMin) * 100);

  // The leading mode determines the lane accent color
  const leadMode  = option.segments.reduce((a, b) => (b.durationMin > a.durationMin ? b : a), option.segments[0]);
  const accentColor = leadMode ? (MODE_GLOW[leadMode.mode] ?? '#8E8E93') : '#8E8E93';

  return (
    <motion.div
      initial={{ opacity: 0, x: isRtl ? 16 : -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ ...SPRING, delay }}
      onClick={onSelect}
      style={{
        borderRadius:    16,
        border:          isSelected
          ? `2px solid ${accentColor}55`
          : hasSurge
            ? '1.5px solid rgba(255,159,10,0.32)'
            : '1.5px solid rgba(0,0,0,0.07)',
        background:      isSelected
          ? `rgba(255,255,255,0.96)`
          : 'rgba(255,255,255,0.84)',
        backdropFilter:  'blur(24px) saturate(1.7)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.7)',
        boxShadow:       isSelected
          ? `0 4px 24px ${accentColor}20, inset 0 1px 0 rgba(255,255,255,0.9)`
          : '0 1px 8px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.7)',
        padding:         '12px 14px',
        cursor:          'pointer',
        position:        'relative',
        overflow:        'hidden',
        direction:       isRtl ? 'rtl' : 'ltr',
        transition:      'border 0.2s, box-shadow 0.2s',
      }}
    >
      {/* Accent glow strip at leading edge */}
      <div style={{
        position:         'absolute',
        insetBlock:        0,
        [isRtl ? 'insetInlineEnd' : 'insetInlineStart']: 0,
        width:            3,
        background:       hasSurge ? '#FF9F0A' : accentColor,
        borderRadius:     isRtl ? '0 8px 8px 0' : '8px 0 0 8px',
        opacity:          isSelected ? 1 : 0.5,
      }} aria-hidden />

      {/* Header row */}
      <div style={{
        display:        'flex',
        alignItems:     'center',
        gap:            8,
        marginBottom:   10,
        paddingInlineStart: 4,
      }}>
        <span style={{
          fontSize:      12.5,
          fontWeight:    900,
          color:         '#1C1C1E',
          letterSpacing: '-0.025em',
          flex:          1,
        }}>
          {option.label}
        </span>

        {/* Badge stack */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {option.isRecommended && <LaneBadge label={isHe ? '★ AI בחר' : '★ AI Pick'} color="#007AFF" bg="#007AFF14" />}
          {option.isFastest     && !option.isRecommended && <LaneBadge label={isHe ? '⚡ מהיר ביותר' : '⚡ Fastest'} color="#30D158" bg="#30D15814" />}
          {option.isCheapest    && !option.isRecommended && !option.isFastest && <LaneBadge label={isHe ? '💰 זול ביותר' : '💰 Cheapest'} color="#FF9F0A" bg="#FF9F0A14" />}
        </div>
      </div>

      {/* Segment timeline lane */}
      <div style={{
        display:         'flex',
        gap:             3,
        alignItems:      'center',
        direction:       isRtl ? 'rtl' : 'ltr',
        marginBottom:    8,
      }}>
        {option.segments.map((seg, si) => (
          <SegmentTile
            key={si}
            seg={seg}
            widthPct={segWidths[si] ?? 10}
            delay={delay + si * 0.05 + 0.08}
            isRtl={isRtl}
            hasSurge={hasSurge}
            isHe={isHe}
          />
        ))}
        {/* Remaining whitespace — pad to fill 100% */}
        <div style={{ flex: 1 }} />
      </div>

      {/* Stats row */}
      <div style={{
        display:           'flex',
        gap:               14,
        alignItems:        'center',
        flexWrap:          'wrap',
        paddingInlineStart: 4,
      }}>
        <StatChip icon="⏱" value={fmtMin(option.totalMin)} accent={accentColor} />
        <StatChip icon="💳" value={fmtUSD(option.totalCost)} accent={accentColor} />
        <StatChip icon="🌿" value={`${option.co2Kg}kg CO₂`} accent="#30D158" />
        <ComfortBar level={option.comfort} />
      </div>

      {/* Surge warning — expands beneath stats */}
      <AnimatePresence>
        {hasSurge && option.surgeInfo && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            style={{ marginTop: 10 }}
          >
            <SurgeWarningBadge surge={option.surgeInfo} isHe={isHe} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

// ── Stat chip ─────────────────────────────────────────────────────────────────

function StatChip({ icon, value, accent }: { icon: string; value: string; accent: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 9, color: '#AEAEB2' }}>{icon}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#1C1C1E', letterSpacing: '-0.01em' }}>{value}</span>
    </div>
  );
}

// ── Comfort indicator ─────────────────────────────────────────────────────────

function ComfortBar({ level }: { level: 1 | 2 | 3 | 4 | 5 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      <span style={{ fontSize: 8, color: '#AEAEB2', letterSpacing: '-0.01em' }}>comfort</span>
      <div style={{ display: 'flex', gap: 2 }}>
        {[1,2,3,4,5].map(i => (
          <div key={i} style={{
            width: 5, height: 5, borderRadius: '50%',
            background: i <= level ? '#FF9F0A' : 'rgba(0,0,0,0.10)',
          }} />
        ))}
      </div>
    </div>
  );
}

// ── Summary legend ────────────────────────────────────────────────────────────

function ModeLegend({ options, isRtl }: { options: RouteOption[]; isRtl: boolean }) {
  const usedModes = new Set(options.flatMap(o => o.segments.map(s => s.mode)));
  return (
    <div style={{
      display:         'flex',
      gap:             10,
      flexWrap:        'wrap',
      direction:       isRtl ? 'rtl' : 'ltr',
    }}>
      {(Array.from(usedModes) as Array<keyof typeof MODE_COLOR>).map(mode => (
        <div key={mode} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: MODE_GLOW[mode] ?? MODE_COLOR[mode], flexShrink: 0 }} />
          <span style={{ fontSize: 9, color: '#636366', fontWeight: 600 }}>
            {MODE_ICON[mode]} {mode}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export interface MultiModalGraphProps {
  options:     RouteOption[];
  fromLabel:   string;
  toLabel:     string;
  selectedId?: string;
  onSelect?:   (id: string) => void;
}

export const MultiModalGraph = memo(function MultiModalGraph({
  options, fromLabel, toLabel, selectedId, onSelect,
}: MultiModalGraphProps) {
  const { profile } = useLocaleEngine();
  const isRtl       = profile.direction === 'rtl';
  const isHe        = profile.locale === 'he-IL';

  const [internalSelected, setInternalSelected] = useState<string | null>(
    options.find(o => o.isRecommended)?.id ?? options[0]?.id ?? null,
  );
  const active    = selectedId ?? internalSelected;
  const maxTotalMin = Math.max(...options.map(o => o.totalMin), 1);

  const handleSelect = useCallback((id: string) => {
    setInternalSelected(id);
    onSelect?.(id);
  }, [onSelect]);

  if (!options.length) return null;

  return (
    <div
      style={{
        display:       'flex',
        flexDirection: 'column',
        gap:           10,
        direction:     isRtl ? 'rtl' : 'ltr',
      }}
    >
      {/* Route header */}
      <div style={{
        display:     'flex',
        alignItems:  'center',
        gap:         8,
        paddingBlock: 2,
      }}>
        <span style={{
          fontSize:      11,
          fontWeight:    700,
          color:         'var(--text-secondary)',
          letterSpacing: '-0.01em',
        }}>
          {isRtl ? `${toLabel} → ${fromLabel}` : `${fromLabel} → ${toLabel}`}
        </span>
        <div style={{
          flex: 1,
          height: 1,
          background: 'rgba(0,0,0,0.07)',
        }} aria-hidden />
        <span style={{
          fontSize:  9,
          fontWeight: 600,
          color:     '#AEAEB2',
        }}>
          {options.length} option{options.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Mode legend */}
      <ModeLegend options={options} isRtl={isRtl} />

      {/* Route lanes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {options.map((opt, i) => (
          <RouteLane
            key={opt.id}
            option={opt}
            maxTotalMin={maxTotalMin}
            index={i}
            isSelected={opt.id === active}
            isRtl={isRtl}
            isHe={isHe}
            onSelect={() => handleSelect(opt.id)}
          />
        ))}
      </div>

      {/* Time axis */}
      <TimeAxis options={options} maxMin={maxTotalMin} isRtl={isRtl} />
    </div>
  );
});
