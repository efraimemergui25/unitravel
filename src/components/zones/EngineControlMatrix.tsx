'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, LayoutGroup }                      from 'framer-motion';
import { ZONE_ENGINES, ZONE_META }                  from '@/lib/zoneEngines';
import type { ZoneId, Engine }                      from '@/lib/zoneEngines';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EngineControlMatrixProps {
  zone:        ZoneId;
  selected:    string[];
  onToggle:    (engineId: string) => void;
  onSelectAll?: () => void;
  onClearAll?:  () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SPRING     = { type: 'spring', stiffness: 520, damping: 34 } as const;
const SPRING_POP = { type: 'spring', stiffness: 600, damping: 26 } as const;

const TIER_LABELS: Record<1 | 2 | 3, string> = {
  1: 'Core',
  2: 'Premium',
  3: 'Extended',
};

// ── Engine pill ───────────────────────────────────────────────────────────────
// One shared layoutId ("engine-active-{zone}") slides the glowing backdrop
// across the strip exactly like an iOS segmented control.
// Multi-select: the *last activated* engine owns the shared backdrop.
// Previously activated engines receive a lighter tinted background.

function EnginePill({
  engine,
  isSelected,
  isPrimary,
  color,
  zone,
  onToggle,
}: {
  engine:    Engine;
  isSelected: boolean;
  isPrimary:  boolean;  // owns the shared layoutId backdrop
  color:     string;
  zone:      ZoneId;
  onToggle:  () => void;
}) {
  const LAYOUT_ID = `engine-active-${zone}`;

  return (
    <motion.button
      layout
      onClick={onToggle}
      whileTap={{ scale: 0.90 }}
      transition={SPRING_POP}
      style={{
        position:    'relative',
        display:     'flex',
        alignItems:  'center',
        gap:         5,
        paddingBlock:  7,
        paddingInline: 12,
        borderRadius:  999,
        border:      `1px solid ${
          isPrimary  ? `${color}35` :
          isSelected ? `${color}22` :
          'rgba(255,255,255,0.55)'
        }`,
        cursor:      'pointer',
        flexShrink:  0,
        fontFamily:  'inherit',
        background:  'transparent',
        zIndex:      1,
      }}
      aria-pressed={isSelected}
    >
      {/* ── Shared sliding backdrop (iOS segmented control model) ── */}
      {isPrimary && (
        <motion.span
          layoutId={LAYOUT_ID}
          transition={SPRING}
          style={{
            position:     'absolute',
            inset:        0,
            borderRadius: 999,
            background:   'rgba(255,255,255,0.97)',
            boxShadow:    `0 2px 12px rgba(0,0,0,0.10), 0 0 0 1.5px ${color}28`,
            zIndex:       0,
          }}
          aria-hidden
        />
      )}

      {/* ── Secondary-selected tint (non-primary but active) ── */}
      {isSelected && !isPrimary && (
        <span
          style={{
            position:     'absolute',
            inset:        0,
            borderRadius: 999,
            background:   `${color}10`,
            zIndex:       0,
          }}
          aria-hidden
        />
      )}

      {/* ── Icon ── */}
      <span
        style={{ fontSize: 12, lineHeight: 1, position: 'relative', zIndex: 1 }}
        aria-hidden
      >
        {engine.icon}
      </span>

      {/* ── Label ── */}
      <span
        style={{
          fontSize:      10.5,
          fontWeight:    isSelected ? 800 : 500,
          color:         isPrimary ? color : isSelected ? `${color}CC` : '#6E6E73',
          letterSpacing: '-0.01em',
          position:      'relative',
          zIndex:        1,
          transition:    'color 0.15s',
          whiteSpace:    'nowrap',
        }}
      >
        {engine.name}
      </span>

      {/* ── Live dot (Tier 1 only, pulses when primary) ── */}
      {engine.tier === 1 && (
        <motion.span
          animate={isPrimary ? { scale: [1, 1.4, 1], opacity: [0.7, 1, 0.7] } : {}}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            width:        5,
            height:       5,
            borderRadius: '50%',
            background:   isSelected ? color : 'rgba(0,0,0,0.12)',
            flexShrink:   0,
            position:     'relative',
            zIndex:       1,
            transition:   'background 0.15s',
          }}
          aria-hidden
        />
      )}
    </motion.button>
  );
}

// ── Tier divider ──────────────────────────────────────────────────────────────

function TierDivider({ label, color }: { label: string; color: string }) {
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, paddingInline: 4 }}
      aria-hidden
    >
      <div style={{ width: 1, height: 14, background: 'rgba(0,0,0,0.08)' }} />
      <span style={{
        fontSize:      8.5,
        fontWeight:    700,
        color:         `${color}88`,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        whiteSpace:    'nowrap',
      }}>
        {label}
      </span>
    </div>
  );
}

// ── Bulk controls ─────────────────────────────────────────────────────────────

function BulkBtn({ label, onClick, color }: { label: string; onClick: () => void; color: string }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ background: `${color}0C`, borderColor: `${color}28` }}
      whileTap={{ scale: 0.94 }}
      transition={{ duration: 0.13 }}
      style={{
        paddingBlock:  5,
        paddingInline: 10,
        borderRadius:  999,
        border:        '1px solid rgba(0,0,0,0.07)',
        background:    'transparent',
        fontSize:      10,
        fontWeight:    700,
        color:         '#6E6E73',
        cursor:        'pointer',
        fontFamily:    'inherit',
        flexShrink:    0,
        whiteSpace:    'nowrap',
        letterSpacing: '-0.01em',
      }}
    >
      {label}
    </motion.button>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function EngineControlMatrix({
  zone, selected, onToggle, onSelectAll, onClearAll,
}: EngineControlMatrixProps) {
  const engines = ZONE_ENGINES[zone] ?? [];
  const meta    = ZONE_META[zone];
  const color   = meta.color;

  // Track the last engine that was activated — this one owns the shared layoutId backdrop.
  // On first mount, seed it to the first selected engine (if any).
  const [primaryId, setPrimaryId] = useState<string | null>(
    () => selected[0] ?? null,
  );

  const handleToggle = useCallback((id: string) => {
    onToggle(id);
    setPrimaryId(id);
  }, [onToggle]);

  // Drag-to-scroll
  const scrollRef  = useRef<HTMLDivElement>(null);
  const dragging   = useRef(false);
  const startX     = useRef(0);
  const scrollLeft = useRef(0);

  const onMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    dragging.current   = true;
    startX.current     = e.pageX - scrollRef.current.offsetLeft;
    scrollLeft.current = scrollRef.current.scrollLeft;
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current || !scrollRef.current) return;
      e.preventDefault();
      scrollRef.current.scrollLeft = scrollLeft.current - (e.pageX - scrollRef.current.offsetLeft - startX.current);
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  // Group by tier
  const byTier = engines.reduce<Record<number, Engine[]>>((acc, e) => {
    (acc[e.tier] ??= []).push(e);
    return acc;
  }, {});

  const selectedCount = selected.length;
  const totalCount    = engines.length;

  return (
    // LayoutGroup ensures the shared layoutId animation is scoped to this component.
    <LayoutGroup>
      <div
        style={{
          display:              'flex',
          flexDirection:        'column',
          borderRadius:         16,
          background:           'rgba(255,255,255,0.60)',
          backdropFilter:       'blur(40px) saturate(1.85)',
          WebkitBackdropFilter: 'blur(40px) saturate(1.85)',
          border:               '1px solid rgba(255,255,255,0.75)',
          boxShadow:            '0 4px 20px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,1)',
          marginInline:         16,
          overflow:             'hidden',
        }}
      >
        {/* ── Header row ── */}
        <div
          style={{
            display:        'flex',
            alignItems:     'center',
            gap:            8,
            paddingBlock:   10,
            paddingInline:  14,
            borderBlockEnd: '1px solid rgba(0,0,0,0.04)',
            flexShrink:     0,
          }}
        >
          {/* Zone icon */}
          <div
            style={{
              width:          26, height: 26, borderRadius: 8,
              background:     meta.gradient,
              display:        'flex', alignItems: 'center', justifyContent: 'center',
              fontSize:       13, flexShrink: 0,
              boxShadow:      `0 3px 10px ${color}40`,
            }}
            aria-hidden
          >
            {meta.icon}
          </div>

          {/* Label + count */}
          <div>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.02em' }}>
              {meta.label} Engines
            </span>
            <span style={{ fontSize: 9.5, color: '#6E6E73', marginInlineStart: 6 }}>
              {selectedCount}/{totalCount} active
            </span>
          </div>

          {/* Selection progress bar */}
          <div
            style={{
              flex:         1,
              height:       3,
              borderRadius: 999,
              background:   'rgba(0,0,0,0.06)',
              overflow:     'hidden',
              minWidth:     40,
            }}
            aria-hidden
          >
            <motion.div
              animate={{ width: `${(selectedCount / Math.max(totalCount, 1)) * 100}%` }}
              transition={SPRING}
              style={{
                height:       '100%',
                background:   `linear-gradient(90deg, ${color}, ${color}88)`,
                borderRadius: 999,
              }}
            />
          </div>

          {onSelectAll && <BulkBtn label="All"   onClick={onSelectAll} color={color} />}
          {onClearAll  && <BulkBtn label="Clear" onClick={onClearAll}  color={color} />}
        </div>

        {/* ── Scrollable pill strip ── */}
        <div
          ref={scrollRef}
          onMouseDown={onMouseDown}
          style={{
            display:        'flex',
            alignItems:     'center',
            gap:            4,
            paddingBlock:   10,
            paddingInline:  14,
            overflowX:      'auto',
            overflowY:      'visible',
            scrollbarWidth: 'none',
            cursor:         'grab',
            userSelect:     'none',
            background:     'rgba(0,0,0,0.018)',
          }}
          role="group"
          aria-label={`${meta.label} engine selection`}
        >
          {([1, 2, 3] as const).map(tier => {
            const tierEngines = byTier[tier];
            if (!tierEngines?.length) return null;
            return [
              tier > 1 && (
                <TierDivider key={`div-${tier}`} label={TIER_LABELS[tier]} color={color} />
              ),
              ...tierEngines.map(engine => (
                <EnginePill
                  key={engine.id}
                  engine={engine}
                  isSelected={selected.includes(engine.id)}
                  isPrimary={primaryId === engine.id && selected.includes(engine.id)}
                  color={color}
                  zone={zone}
                  onToggle={() => handleToggle(engine.id)}
                />
              )),
            ];
          })}
        </div>
      </div>
    </LayoutGroup>
  );
}
