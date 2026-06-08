'use client';

import {
  useRef, useCallback, useEffect, useState, useId,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { useOmniSync }                           from '@/store/useOmniSync';
import { useLocaleEngine }                       from '@/store/useLocaleEngine';
import type { StopsOption, MultiCityLeg }        from '@/store/useOmniSync';

// ── Constants ─────────────────────────────────────────────────────────────────

const SPRING     = { type: 'spring', stiffness: 420, damping: 28 } as const;
const SPRING_POP = { type: 'spring', stiffness: 500, damping: 24 } as const;
const BLUE       = '#007AFF';

// ── Helpers ───────────────────────────────────────────────────────────────────

function hourToLabel(h: number): string {
  const ampm = h < 12 ? 'AM' : 'PM';
  const disp = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${disp}${ampm}`;
}

// ── Dual-thumb glass slider ───────────────────────────────────────────────────

interface DualThumbSliderProps {
  label:    string;
  value:    [number, number];
  min?:     number;
  max?:     number;
  onChange: (v: [number, number]) => void;
  isRtl?:  boolean;
}

function DualThumbSlider({ label, value, min = 0, max = 23, onChange, isRtl }: DualThumbSliderProps) {
  const trackRef    = useRef<HTMLDivElement>(null);
  const dragging    = useRef<'lo' | 'hi' | null>(null);
  const uid         = useId();

  const pctLo = ((value[0] - min) / (max - min)) * 100;
  const pctHi = ((value[1] - min) / (max - min)) * 100;

  const posFromEvent = useCallback((e: PointerEvent): number => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return min;
    const raw = isRtl
      ? (rect.right - e.clientX) / rect.width
      : (e.clientX - rect.left) / rect.width;
    const clamped = Math.max(0, Math.min(1, raw));
    return Math.round(min + clamped * (max - min));
  }, [min, max, isRtl]);

  const handlePointerDown = useCallback((thumb: 'lo' | 'hi') =>
    (e: ReactPointerEvent<HTMLDivElement>) => {
      dragging.current = thumb;
      (e.target as Element).setPointerCapture(e.pointerId);
    }, []);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!dragging.current) return;
    const v = posFromEvent(e);
    if (dragging.current === 'lo') {
      onChange([Math.min(v, value[1] - 1), value[1]]);
    } else {
      onChange([value[0], Math.max(v, value[0] + 1)]);
    }
  }, [posFromEvent, onChange, value]);

  const handlePointerUp = useCallback(() => { dragging.current = null; }, []);

  useEffect(() => {
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup',   handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup',   handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: 9.5, fontWeight: 800, color: '#6E6E73', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'inherit' }}>
          {label}
        </span>
        <span style={{ fontSize: 10, fontWeight: 700, color: BLUE, fontFamily: 'inherit' }}>
          {hourToLabel(value[0])} — {hourToLabel(value[1])}
        </span>
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        style={{
          position:       'relative',
          height:         20,
          display:        'flex',
          alignItems:     'center',
        }}
        aria-label={`${label} slider`}
      >
        {/* Full track */}
        <div
          className="bg-white/30"
          style={{
            position:     'absolute',
            insetInlineStart: 0, insetInlineEnd: 0,
            height:       6,
            borderRadius: 999,
            backdropFilter: 'blur(4px)',
          }}
        />

        {/* Active range glow */}
        <motion.div
          animate={{
            insetInlineStart: `${pctLo}%`,
            width:   `${pctHi - pctLo}%`,
          }}
          transition={{ ease: 'linear', duration: 0.06 }}
          style={{
            position:     'absolute',
            height:       6,
            borderRadius: 999,
            background:   'rgba(147,197,253,0.55)',
            boxShadow:    `0 0 8px ${BLUE}55`,
            border:       `1px solid rgba(147,197,253,0.70)`,
            backdropFilter: 'blur(4px)',
            pointerEvents: 'none',
          }}
        />

        {/* Lo thumb */}
        <motion.div
          animate={{ insetInlineStart: `calc(${pctLo}% - 10px)` }}
          transition={{ ease: 'linear', duration: 0.06 }}
          onPointerDown={handlePointerDown('lo')}
          style={{
            position:     'absolute',
            width:        20, height: 20,
            borderRadius: '50%',
            background:   'rgba(255,255,255,0.95)',
            border:       '1.5px solid rgba(255,255,255,0.90)',
            boxShadow:    '0 2px 8px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,1)',
            cursor:       'grab',
            touchAction:  'none',
            zIndex:       2,
          }}
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.92 }}
          role="slider"
          aria-valuemin={min}
          aria-valuemax={value[1] - 1}
          aria-valuenow={value[0]}
          aria-label={`${label} start`}
        />

        {/* Hi thumb */}
        <motion.div
          animate={{ insetInlineStart: `calc(${pctHi}% - 10px)` }}
          transition={{ ease: 'linear', duration: 0.06 }}
          onPointerDown={handlePointerDown('hi')}
          style={{
            position:     'absolute',
            width:        20, height: 20,
            borderRadius: '50%',
            background:   'rgba(255,255,255,0.95)',
            border:       '1.5px solid rgba(255,255,255,0.90)',
            boxShadow:    '0 2px 8px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,1)',
            cursor:       'grab',
            touchAction:  'none',
            zIndex:       2,
          }}
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.92 }}
          role="slider"
          aria-valuemin={value[0] + 1}
          aria-valuemax={max}
          aria-valuenow={value[1]}
          aria-label={`${label} end`}
        />
      </div>
    </div>
  );
}

// ── Stops toggle matrix ───────────────────────────────────────────────────────

const STOPS_OPTIONS: { value: StopsOption; label: string; icon: string }[] = [
  { value: 'direct', label: 'Direct Only', icon: '→' },
  { value: '1-stop', label: '1 Stop',      icon: '⟡' },
  { value: '2-plus', label: '2+ Stops',    icon: '⟳' },
];

function StopsMatrix({
  active,
  onToggle,
}: {
  active: StopsOption[];
  onToggle: (s: StopsOption) => void;
}) {
  return (
    <LayoutGroup id="stops-matrix">
      <div style={{ display: 'flex', gap: 8 }}>
        {STOPS_OPTIONS.map(({ value, label, icon }) => {
          const isActive = active.length === 0 || active.includes(value);
          const isSelected = active.includes(value);
          return (
            <motion.button
              key={value}
              layout
              onClick={() => onToggle(value)}
              aria-pressed={isSelected}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.94 }}
              transition={SPRING}
              style={{
                flex:           1,
                paddingBlock:   10,
                paddingInline:  8,
                borderRadius:   14,
                border:         isSelected
                  ? '1.5px solid rgba(147,197,253,0.60)'
                  : '1.5px solid rgba(255,255,255,0.55)',
                background:     isSelected
                  ? 'rgba(147,197,253,0.25)'
                  : 'rgba(255,255,255,0.20)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                boxShadow:      isSelected
                  ? 'inset 0 2px 8px rgba(0,122,255,0.12), inset 0 1px 0 rgba(255,255,255,0.8)'
                  : 'inset 0 1px 0 rgba(255,255,255,0.6)',
                cursor:         'pointer',
                fontFamily:     'inherit',
                display:        'flex',
                flexDirection:  'column',
                alignItems:     'center',
                gap:            4,
                opacity:        active.length > 0 && !isSelected ? 0.5 : 1,
                transition:     'opacity 0.2s',
              }}
            >
              <span style={{
                fontSize: 16, lineHeight: 1,
                color: isSelected ? BLUE : '#8E8E93',
              }}>
                {icon}
              </span>
              <span style={{
                fontSize:     9.5,
                fontWeight:   isSelected ? 800 : 600,
                color:        isSelected ? BLUE : '#6E6E73',
                letterSpacing: '-0.01em',
                whiteSpace:   'nowrap',
              }}>
                {label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

// ── Multi-city node builder ───────────────────────────────────────────────────

function MultiCityBuilder({ legs, onChange }: {
  legs:     MultiCityLeg[];
  onChange: (legs: MultiCityLeg[]) => void;
}) {
  const addLeg = () => {
    if (legs.length >= 5) return;
    const last = legs[legs.length - 1];
    onChange([
      ...legs,
      { id: `leg-${Date.now()}`, from: last?.to ?? '', to: '', date: '' },
    ]);
  };

  const removeLeg = (id: string) => {
    if (legs.length <= 2) return;
    onChange(legs.filter(l => l.id !== id));
  };

  const updateLeg = (id: string, patch: Partial<MultiCityLeg>) => {
    onChange(legs.map(l => l.id === id ? { ...l, ...patch } : l));
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ ...SPRING, duration: 0.3 }}
      style={{ overflow: 'hidden' }}
    >
      <div style={{
        marginBlockStart: 10,
        paddingInline:    4,
        display:          'flex',
        flexDirection:    'column',
        gap:              0,
      }}>
        <AnimatePresence>
          {legs.map((leg, i) => (
            <motion.div
              key={leg.id}
              layout
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12, height: 0 }}
              transition={SPRING}
              style={{ display: 'flex', alignItems: 'stretch', gap: 10 }}
            >
              {/* Connector line */}
              <div style={{
                display:        'flex',
                flexDirection:  'column',
                alignItems:     'center',
                width:          16,
                flexShrink:     0,
              }}>
                {/* Node dot */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={SPRING_POP}
                  style={{
                    width: 10, height: 10,
                    borderRadius: '50%',
                    background: i === 0 ? BLUE : i === legs.length - 1 ? '#30D158' : '#FF9F0A',
                    boxShadow: `0 0 6px ${i === 0 ? BLUE : i === legs.length - 1 ? '#30D158' : '#FF9F0A'}80`,
                    flexShrink: 0,
                    marginBlockStart: 14,
                  }}
                />
                {/* Vertical line between nodes */}
                {i < legs.length - 1 && (
                  <div style={{
                    width: 1.5,
                    flex:  1,
                    background: 'linear-gradient(to bottom, rgba(0,122,255,0.4), rgba(48,209,88,0.4))',
                    marginBlock: 3,
                  }} />
                )}
              </div>

              {/* Leg input row */}
              <div style={{
                flex:         1,
                paddingBlockEnd: i < legs.length - 1 ? 8 : 0,
                display:      'flex',
                gap:          6,
                alignItems:   'center',
              }}>
                {i === 0 ? (
                  // First leg: only the "from" field
                  <LegInput
                    value={leg.from}
                    placeholder="Origin"
                    onChange={v => updateLeg(leg.id, { from: v })}
                  />
                ) : null}
                {i > 0 ? (
                  // Middle and last legs: show "to" field (from = prev leg's to)
                  <LegInput
                    value={leg.to}
                    placeholder={`Destination ${i}`}
                    onChange={v => updateLeg(leg.id, { to: v })}
                  />
                ) : (
                  <LegInput
                    value={leg.to}
                    placeholder="Destination"
                    onChange={v => updateLeg(leg.id, { to: v })}
                  />
                )}
                <input
                  type="date"
                  value={leg.date}
                  onChange={e => updateLeg(leg.id, { date: e.target.value })}
                  style={{
                    width:        110, flexShrink: 0,
                    paddingBlock: 7, paddingInline: 10,
                    borderRadius: 10,
                    border:       '1px solid rgba(255,255,255,0.55)',
                    background:   'rgba(255,255,255,0.25)',
                    backdropFilter: 'blur(8px)',
                    color:        '#1C1C1E', fontSize: 10, fontWeight: 600,
                    outline:      'none', fontFamily: 'inherit',
                  }}
                />
                {legs.length > 2 && i > 0 && (
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => removeLeg(leg.id)}
                    aria-label="Remove leg"
                    style={{
                      width: 24, height: 24, borderRadius: '50%',
                      background: 'rgba(255,69,58,0.12)',
                      border: '1px solid rgba(255,69,58,0.25)',
                      color: '#FF453A', fontSize: 12,
                      cursor: 'pointer', fontFamily: 'inherit',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    ×
                  </motion.button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Add leg */}
        {legs.length < 5 && (
          <motion.button
            layout
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={addLeg}
            style={{
              alignSelf:    'flex-start',
              marginBlockStart: 8,
              marginInlineStart: 26,
              paddingBlock: 5, paddingInline: 14,
              borderRadius: 20,
              border:       '1px dashed rgba(0,122,255,0.40)',
              background:   'rgba(0,122,255,0.05)',
              color:        BLUE, fontSize: 10.5,
              fontWeight:   700, cursor: 'pointer',
              fontFamily:   'inherit', letterSpacing: '-0.01em',
            }}
          >
            + Add city
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

function LegInput({ value, placeholder, onChange }: {
  value: string; placeholder: string; onChange: (v: string) => void;
}) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        flex:         1, minWidth: 0,
        paddingBlock: 7, paddingInline: 10,
        borderRadius: 10,
        border:       '1px solid rgba(255,255,255,0.55)',
        background:   'rgba(255,255,255,0.25)',
        backdropFilter: 'blur(8px)',
        color:        '#1C1C1E', fontSize: 11, fontWeight: 600,
        outline:      'none', fontFamily: 'inherit',
      }}
    />
  );
}

// ── Route type toggle ─────────────────────────────────────────────────────────

const ROUTE_OPTIONS = [
  { value: 'one-way'    as const, label: 'One-Way'    },
  { value: 'round-trip' as const, label: 'Round-Trip' },
  { value: 'multi-city' as const, label: 'Multi-City' },
];

function RouteToggle({
  value,
  onChange,
}: {
  value:    'one-way' | 'round-trip' | 'multi-city';
  onChange: (v: 'one-way' | 'round-trip' | 'multi-city') => void;
}) {
  return (
    <LayoutGroup id="route-type-toggle">
      <div
        role="group"
        aria-label="Route type"
        style={{
          display:    'flex',
          gap:        3,
          padding:    3,
          background: 'rgba(0,0,0,0.04)',
          borderRadius: 12,
          width:      'fit-content',
        }}
      >
        {ROUTE_OPTIONS.map(opt => {
          const isActive = value === opt.value;
          return (
            <motion.button
              key={opt.value}
              role="radio"
              aria-checked={isActive}
              onClick={() => onChange(opt.value)}
              whileTap={{ scale: 0.95 }}
              transition={SPRING}
              style={{
                position:      'relative',
                paddingBlock:  7,
                paddingInline: 14,
                borderRadius:  9,
                border:        'none',
                cursor:        'pointer',
                fontSize:      11,
                fontWeight:    isActive ? 800 : 500,
                color:         isActive ? BLUE : '#6E6E73',
                background:    'none',
                fontFamily:    'inherit',
                letterSpacing: '-0.01em',
                zIndex:        1,
                whiteSpace:    'nowrap',
              }}
            >
              {isActive && (
                <motion.div
                  layoutId="route-pill"
                  style={{
                    position:   'absolute', inset: 0,
                    borderRadius: 9,
                    background: 'rgba(255,255,255,0.92)',
                    boxShadow:  '0 2px 8px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,1)',
                    zIndex:     -1,
                  }}
                  transition={SPRING}
                />
              )}
              {opt.label}
            </motion.button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

// ── AI sync flash indicator ───────────────────────────────────────────────────

function AISyncFlash({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={SPRING_POP}
          style={{
            paddingBlock:   4, paddingInline: 10,
            borderRadius:   20,
            background:     'rgba(0,122,255,0.10)',
            border:         '1px solid rgba(0,122,255,0.25)',
            fontSize:       9.5,
            fontWeight:     700,
            color:          BLUE,
            fontFamily:     'inherit',
            letterSpacing:  '-0.01em',
            flexShrink:     0,
          }}
        >
          ✦ AI synced
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function AviationDeepFilters() {
  const {
    filters,
    setRouteType,
    setDepartureTime,
    setArrivalTime,
    toggleStop,
    setMultiCityLegs,
    lastAISyncAt,
  } = useOmniSync();

  const { profile } = useLocaleEngine();
  const isRtl       = profile.direction === 'rtl';

  const [showAIFlash, setShowAIFlash] = useState(false);

  useEffect(() => {
    if (!lastAISyncAt) return;
    setShowAIFlash(true);
    const t = setTimeout(() => setShowAIFlash(false), 2500);
    return () => clearTimeout(t);
  }, [lastAISyncAt]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING, delay: 0.04 }}
      className="glass-panel mx-4 flex-shrink-0"
      style={{
        direction:     isRtl ? 'rtl' : 'ltr',
        display:       'flex',
        flexDirection: 'column',
        gap:           0,
        overflow:      'hidden',
      }}
    >
      {/* Top bar */}
      <div style={{
        display:         'flex',
        alignItems:      'center',
        gap:             10,
        paddingBlock:    12,
        paddingInline:   16,
        borderBlockEnd:  '1px solid rgba(255,255,255,0.45)',
        flexWrap:        'wrap',
        rowGap:          6,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: `linear-gradient(135deg, ${BLUE} 0%, #5E5CE6 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14,
            boxShadow: `0 4px 12px ${BLUE}40`,
          }}>
            ✈
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              Advanced Filters
            </div>
            <div style={{ fontSize: 9.5, color: '#6E6E73', fontWeight: 500 }}>
              AI-synced · real-time
            </div>
          </div>
        </div>

        <RouteToggle value={filters.routeType} onChange={setRouteType} />

        <div style={{ marginInlineStart: 'auto' }}>
          <AISyncFlash show={showAIFlash} />
        </div>
      </div>

      {/* Multi-city node builder */}
      <AnimatePresence>
        {filters.routeType === 'multi-city' && (
          <div style={{
            paddingInline: 16,
            paddingBlock:  4,
            borderBlockEnd: '1px solid rgba(255,255,255,0.35)',
          }}>
            <MultiCityBuilder
              legs={filters.multiCityLegs}
              onChange={setMultiCityLegs}
            />
          </div>
        )}
      </AnimatePresence>

      {/* Time sliders + stops */}
      <div style={{
        display:       'grid',
        gridTemplateColumns: '1fr 1fr',
        gap:           16,
        paddingInline: 16,
        paddingBlock:  14,
        borderBlockEnd: '1px solid rgba(255,255,255,0.35)',
      }}>
        <DualThumbSlider
          label="Departure"
          value={filters.departureTimeRange}
          onChange={setDepartureTime}
          isRtl={isRtl}
        />
        <DualThumbSlider
          label="Arrival"
          value={filters.arrivalTimeRange}
          onChange={setArrivalTime}
          isRtl={isRtl}
        />
      </div>

      {/* Stops matrix */}
      <div style={{ paddingInline: 16, paddingBlock: 12 }}>
        <p style={{
          margin: 0, marginBlockEnd: 8,
          fontSize: 9.5, fontWeight: 800, color: '#6E6E73',
          textTransform: 'uppercase', letterSpacing: '0.06em',
          fontFamily: 'inherit',
        }}>
          Stops
        </p>
        <StopsMatrix
          active={filters.stopsFilter}
          onToggle={toggleStop}
        />
      </div>
    </motion.div>
  );
}
