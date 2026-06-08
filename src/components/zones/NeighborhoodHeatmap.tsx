'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence }       from 'framer-motion';
import { useLodgingSync }                from '@/store/useLodgingSync';
import { useLocaleEngine }               from '@/store/useLocaleEngine';
import type { VibeZone }                 from '@/store/useLodgingSync';

// ── Constants ─────────────────────────────────────────────────────────────────

const SPRING     = { type: 'spring', stiffness: 380, damping: 28 } as const;
const SPRING_POP = { type: 'spring', stiffness: 480, damping: 24 } as const;

// ── Vibe zone definitions (spatial layout as pct of map canvas) ───────────────

interface ZoneDef {
  color:   string;
  cx:      number; // 0–100 pct of map width
  cy:      number; // 0–100 pct of map height
  rx:      number; // horizontal radius pct
  ry:      number; // vertical radius pct
  label:   string;
  icon:    string;
}

const ZONE_DEFS: Record<VibeZone, ZoneDef> = {
  culinary:  { color: 'rgba(255,159,10,', cx: 38, cy: 48, rx: 22, ry: 18, label: 'Culinary Quarter', icon: '🍽' },
  nightlife: { color: 'rgba(191,90,242,', cx: 65, cy: 35, rx: 18, ry: 15, label: 'Nightlife District', icon: '🎵' },
  quiet:     { color: 'rgba(0,199,190,',  cx: 22, cy: 65, rx: 20, ry: 16, label: 'Quiet Residential', icon: '🌿' },
  family:    { color: 'rgba(48,209,88,',  cx: 72, cy: 68, rx: 16, ry: 14, label: 'Family Friendly',   icon: '👨‍👩‍👧' },
  business:  { color: 'rgba(0,122,255,',  cx: 50, cy: 25, rx: 14, ry: 12, label: 'Business Core',     icon: '💼' },
};

// ── City street grid (SVG) ────────────────────────────────────────────────────

function CityGrid() {
  const lines = [];
  // Horizontal streets
  for (let y = 10; y < 100; y += 12) {
    lines.push(
      <line key={`h${y}`} x1="0" y1={`${y}%`} x2="100%" y2={`${y}%`}
        stroke="rgba(255,255,255,0.22)" strokeWidth={y % 36 === 10 ? 1.5 : 0.8} />
    );
  }
  // Vertical streets
  for (let x = 8; x < 100; x += 14) {
    lines.push(
      <line key={`v${x}`} x1={`${x}%`} y1="0" x2={`${x}%`} y2="100%"
        stroke="rgba(255,255,255,0.22)" strokeWidth={x % 42 === 8 ? 1.5 : 0.8} />
    );
  }
  // City blocks — small filled rectangles
  const blocks = [];
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 8; c++) {
      if (Math.abs((r * 7 + c * 13) % 17) > 5) continue;
      blocks.push(
        <rect key={`b${r}-${c}`}
          x={`${8 + c * 12}%`} y={`${14 + r * 13}%`}
          width="9%" height="8%"
          fill="rgba(255,255,255,0.06)"
          rx="2"
        />
      );
    }
  }
  return (
    <svg
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      preserveAspectRatio="xMidYMid slice"
    >
      {blocks}
      {lines}
      {/* City center marker */}
      <circle cx="50%" cy="50%" r="3" fill="rgba(255,255,255,0.50)" />
      <circle cx="50%" cy="50%" r="6" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
    </svg>
  );
}

// ── Heatmap blob ──────────────────────────────────────────────────────────────

function HeatBlob({ zone, def, isActive, isFocused }: {
  zone:     VibeZone;
  def:      ZoneDef;
  isActive: boolean;
  isFocused: boolean;
}) {
  const opacity = isFocused ? 0.60 : isActive ? 0.42 : 0.18;
  const scale   = isFocused ? 1.15 : isActive ? 1.05 : 1;

  return (
    <motion.div
      animate={{ opacity, scale }}
      transition={{ ...SPRING, duration: 0.5 }}
      style={{
        position:        'absolute',
        insetInlineStart: `${def.cx - def.rx}%`,
        insetBlockStart:  `${def.cy - def.ry}%`,
        width:           `${def.rx * 2}%`,
        height:          `${def.ry * 2}%`,
        borderRadius:    '50%',
        background:      `radial-gradient(ellipse at center, ${def.color}0.90), ${def.color}0.50) 40%, ${def.color}0) 70%)`,
        filter:          'blur(22px)',
        pointerEvents:   'none',
        transformOrigin: 'center',
      }}
    />
  );
}

// ── Zone label pin ────────────────────────────────────────────────────────────

function ZonePin({ zone, def, isActive, onClick }: {
  zone:     VibeZone;
  def:      ZoneDef;
  isActive: boolean;
  onClick:  () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      style={{
        position:        'absolute',
        insetInlineStart: `${def.cx}%`,
        insetBlockStart:  `${def.cy}%`,
        transform:       'translate(-50%, -50%)',
        display:         'flex',
        flexDirection:   'column',
        alignItems:      'center',
        gap:             3,
        cursor:          'pointer',
        background:      'none',
        border:          'none',
        zIndex:          4,
      }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      transition={SPRING}
    >
      {/* Pulsing dot */}
      <div style={{ position: 'relative', width: 14, height: 14 }}>
        {isActive && (
          <motion.div
            animate={{ scale: [1, 2.2, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{
              position: 'absolute', inset: 0,
              borderRadius: '50%',
              background: def.color + '0.50)',
            }}
          />
        )}
        <motion.div
          animate={{ scale: isActive ? 1.2 : 1 }}
          transition={SPRING}
          style={{
            width: 14, height: 14,
            borderRadius: '50%',
            background:   def.color + (isActive ? '1)' : '0.70)'),
            border:       '2px solid rgba(255,255,255,0.85)',
            boxShadow:    `0 0 8px ${def.color}0.60)`,
            position:     'relative', zIndex: 1,
          }}
        />
      </div>

      {/* Label pill */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -2, scale: 0.9 }}
            transition={SPRING_POP}
            style={{
              paddingBlock:   4, paddingInline: 8,
              borderRadius:   10,
              background:     'rgba(255,255,255,0.72)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border:         '1px solid rgba(255,255,255,0.85)',
              boxShadow:      'inset 0 1px 0 rgba(255,255,255,1), 0 3px 12px rgba(0,0,0,0.10)',
              display:        'flex',
              alignItems:     'center',
              gap:            4,
              whiteSpace:     'nowrap',
            }}
          >
            <span style={{ fontSize: 11 }}>{def.icon}</span>
            <span style={{ fontSize: 9.5, fontWeight: 800, color: '#1C1C1E', letterSpacing: '-0.01em', fontFamily: 'inherit' }}>
              {def.label}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

// ── Lodging pin (top 3 results) ───────────────────────────────────────────────

function LodgingPin({ x, y, label, price, color, delay }: {
  x: number; y: number; label: string; price: number; color: string; delay: number;
}) {
  const [hover, setHover] = useState(false);

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ ...SPRING_POP, delay }}
      style={{
        position:        'absolute',
        insetInlineStart: `${x}%`,
        insetBlockStart:  `${y}%`,
        transform:       'translate(-50%, -100%)',
        zIndex:          5,
      }}
      onHoverStart={() => setHover(true)}
      onHoverEnd={() => setHover(false)}
    >
      <motion.div
        whileHover={{ y: -3, scale: 1.05 }}
        transition={SPRING}
        style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
      >
        {/* Price bubble */}
        <motion.div
          animate={{ boxShadow: hover ? `0 6px 20px ${color}50` : `0 3px 10px ${color}30` }}
          style={{
            paddingBlock:   5, paddingInline: 10,
            borderRadius:   10,
            background:     'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border:         `1.5px solid ${color}40`,
            boxShadow:      `inset 0 1px 0 rgba(255,255,255,1)`,
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 900, color, fontFamily: 'inherit', letterSpacing: '-0.02em' }}>
            ${price}
          </span>
          <AnimatePresence>
            {hover && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={{ overflow: 'hidden' }}
              >
                <span style={{ fontSize: 9, fontWeight: 600, color: '#6E6E73', display: 'block', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
                  {label}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Pin stem */}
        <div style={{ width: 2, height: 8, background: `${color}80`, borderRadius: 999 }} />
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}99` }} />
      </motion.div>
    </motion.div>
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────

function HeatmapLegend({ activeZones, onToggle }: {
  activeZones: VibeZone[];
  onToggle:    (z: VibeZone) => void;
}) {
  return (
    <div style={{
      position:       'absolute',
      insetBlockEnd:  12,
      insetInlineStart: 12,
      display:        'flex',
      flexWrap:       'wrap',
      gap:            5,
      zIndex:         6,
    }}>
      {(Object.entries(ZONE_DEFS) as [VibeZone, ZoneDef][]).map(([zone, def]) => {
        const isActive = activeZones.includes(zone);
        return (
          <motion.button
            key={zone}
            onClick={() => onToggle(zone)}
            aria-pressed={isActive}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            style={{
              display:        'flex',
              alignItems:     'center',
              gap:            5,
              paddingBlock:   4, paddingInline: 8,
              borderRadius:   10,
              border:         `1px solid ${def.color}${isActive ? '0.50)' : '0.25)'}`,
              background:     `${def.color}${isActive ? '0.25)' : '0.08)'}`,
              backdropFilter: 'blur(8px)',
              cursor:         'pointer',
              fontFamily:     'inherit',
            }}
          >
            <span style={{ fontSize: 10 }}>{def.icon}</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: def.color + '1)', letterSpacing: '-0.01em' }}>
              {def.label.split(' ')[0]}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface NeighborhoodHeatmapProps {
  hotelPins?: Array<{ x: number; y: number; label: string; price: number }>;
  cityName?:  string;
  height?:    number;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function NeighborhoodHeatmap({
  hotelPins = [],
  cityName  = 'City Center',
  height    = 320,
}: NeighborhoodHeatmapProps) {
  const { filters, toggleVibeZone, setFocusedZone } = useLodgingSync();
  const { profile } = useLocaleEngine();
  const isRtl = profile.direction === 'rtl';

  const PIN_COLORS = ['#007AFF', '#30D158', '#FF9F0A'];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      style={{
        position:         'relative',
        height,
        borderRadius:     20,
        overflow:         'hidden',
        background:       'linear-gradient(160deg, #c8d9e8 0%, #b8c9da 50%, #c2d4e5 100%)',
        direction:        isRtl ? 'rtl' : 'ltr',
        border:           '1.5px solid rgba(255,255,255,0.55)',
        boxShadow:        'inset 0 1px 0 rgba(255,255,255,0.8), 0 8px 32px rgba(0,0,0,0.06)',
      }}
    >
      {/* City street grid */}
      <CityGrid />

      {/* Heatmap blobs (sorted: inactive under active) */}
      {(Object.entries(ZONE_DEFS) as [VibeZone, ZoneDef][]).map(([zone, def]) => (
        <HeatBlob
          key={zone}
          zone={zone}
          def={def}
          isActive={filters.vibeZones.includes(zone)}
          isFocused={filters.focusedZone === zone}
        />
      ))}

      {/* Zone pins */}
      {(Object.entries(ZONE_DEFS) as [VibeZone, ZoneDef][]).map(([zone, def]) => (
        <ZonePin
          key={zone}
          zone={zone}
          def={def}
          isActive={filters.vibeZones.includes(zone) || filters.focusedZone === zone}
          onClick={() => {
            toggleVibeZone(zone);
            setFocusedZone(filters.focusedZone === zone ? null : zone);
          }}
        />
      ))}

      {/* Hotel result pins */}
      {hotelPins.slice(0, 3).map((pin, i) => (
        <LodgingPin
          key={i}
          x={pin.x} y={pin.y}
          label={pin.label}
          price={pin.price}
          color={PIN_COLORS[i] ?? '#007AFF'}
          delay={0.3 + i * 0.12}
        />
      ))}

      {/* City name label */}
      <div style={{
        position:        'absolute',
        insetBlockStart: 12,
        insetInlineStart: 12,
        paddingBlock:    5, paddingInline: 12,
        borderRadius:    20,
        background:      'rgba(255,255,255,0.60)',
        backdropFilter:  'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border:          '1px solid rgba(255,255,255,0.75)',
        boxShadow:       'inset 0 1px 0 rgba(255,255,255,1)',
        fontSize:        11, fontWeight: 800,
        color:           '#1C1C1E',
        letterSpacing:   '-0.02em',
        fontFamily:      'inherit',
        zIndex:          6,
      }}>
        📍 {cityName}
      </div>

      {/* Legend */}
      <HeatmapLegend
        activeZones={filters.vibeZones}
        onToggle={toggleVibeZone}
      />
    </motion.div>
  );
}
