'use client';

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  memo,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useZoneStore } from '@/store/useZoneStore';
import { ZONE_ENGINES, ZONE_META, ZoneId, Engine } from '@/lib/zoneEngines';

// ── Spring constants ──────────────────────────────────────────────────────────

const SPRING      = { type: 'spring', stiffness: 420, damping: 28 } as const;
const SPRING_SOFT = { type: 'spring', stiffness: 380, damping: 32 } as const;
const SPRING_POP  = { type: 'spring', stiffness: 460, damping: 22 } as const;

// ── Tier section labels ───────────────────────────────────────────────────────

const TIER_LABELS: Record<number, string> = {
  1: '⭐ Top Tier',
  2: '◉  Core',
  3: '·   Extended',
};

// ── EnginePill ────────────────────────────────────────────────────────────────

interface PillProps {
  engine:     Engine;
  isSelected: boolean;
  onToggle:   () => void;
  color:      string;
}

const EnginePill = memo(function EnginePill({
  engine,
  isSelected,
  onToggle,
  color,
}: PillProps) {
  const [rippleKey, setRippleKey] = useState(0);

  const handleClick = useCallback(() => {
    setRippleKey(k => k + 1);
    onToggle();
  }, [onToggle]);

  return (
    <motion.button
      onClick={handleClick}
      whileHover={{ scale: isSelected ? 1.06 : 1.04, y: -1 }}
      whileTap={{ scale: 0.93 }}
      animate={{
        boxShadow: isSelected
          ? `0 0 0 1.5px ${color}66, 0 4px 14px ${color}1F`
          : '0 0 0 1px rgba(0,0,0,0.08)',
        scale: 1,
      }}
      transition={{ ...SPRING, boxShadow: { duration: 0.22 } }}
      style={{
        position:         'relative',
        overflow:         'hidden',
        display:          'flex',
        alignItems:       'center',
        gap:              5,
        paddingBlock:     7,
        paddingInlineStart: 9,
        paddingInlineEnd: isSelected ? 6 : 10,
        borderRadius:     10,
        border:           'none',
        cursor:           'pointer',
        background:       isSelected ? `${color}16` : 'rgba(0,0,0,0.04)',
        fontSize:         11.5,
        fontWeight:       isSelected ? 700 : 500,
        color:            isSelected ? color : '#3C3C43',
        letterSpacing:    '-0.01em',
        userSelect:       'none',
        WebkitUserSelect: 'none',
        whiteSpace:       'nowrap',
        minWidth:         0,
        transition:       'background 0.18s ease, color 0.18s ease',
        fontFamily:       'inherit',
      }}
    >
      {/* ── Haptic glow ripple — emitted on every toggle ──────────────── */}
      <motion.span
        key={rippleKey}
        initial={{ scale: 0, opacity: 0.65 }}
        animate={{ scale: 5.5, opacity: 0 }}
        transition={{ duration: 0.48, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position:     'absolute',
          inset:        0,
          margin:       'auto',
          width:        '35%',
          aspectRatio:  '1',
          borderRadius: '50%',
          background:   `radial-gradient(circle, ${color}99 0%, ${color}44 40%, transparent 70%)`,
          pointerEvents: 'none',
          zIndex:        0,
        }}
      />

      {/* Engine icon */}
      <span style={{ fontSize: 13, flexShrink: 0, lineHeight: 1, position: 'relative', zIndex: 1 }}>
        {engine.icon}
      </span>

      {/* Engine name */}
      <span
        style={{
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          lineHeight:   1.2,
          position:     'relative',
          zIndex:       1,
          flex:         1,
          minWidth:     0,
        }}
      >
        {engine.name}
      </span>

      {/* Active check badge */}
      <AnimatePresence>
        {isSelected && (
          <motion.span
            key="check"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={SPRING_POP}
            style={{
              position:         'relative',
              zIndex:           1,
              marginInlineStart: 1,
              width:            15,
              height:           15,
              borderRadius:     '50%',
              background:       color,
              display:          'flex',
              alignItems:       'center',
              justifyContent:   'center',
              fontSize:         9,
              fontWeight:       800,
              color:            'white',
              flexShrink:       0,
              lineHeight:       1,
            }}
          >
            ✓
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
});

// ── TierSection ───────────────────────────────────────────────────────────────

function TierSection({
  tier,
  engines,
  zone,
  color,
}: {
  tier:    number;
  engines: Engine[];
  zone:    ZoneId;
  color:   string;
}) {
  const { isSelected, toggleEngine } = useZoneStore();

  return (
    <div style={{ marginBlockEnd: 14 }}>
      <p
        style={{
          fontSize:       9,
          fontWeight:     700,
          color:          '#AEAEB2',
          textTransform:  'uppercase',
          letterSpacing:  '0.07em',
          paddingInline:  4,
          marginBlockEnd: 7,
        }}
      >
        {TIER_LABELS[tier]}
      </p>
      <div
        style={{
          display:             'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(108px, 1fr))',
          gap:                 5,
        }}
      >
        {engines.map(engine => (
          <EnginePill
            key={engine.id}
            engine={engine}
            isSelected={isSelected(zone, engine.id)}
            onToggle={() => toggleEngine(zone, engine.id)}
            color={color}
          />
        ))}
      </div>
    </div>
  );
}

// ── ActionStrip ───────────────────────────────────────────────────────────────

function ActionStrip({ zone, color }: { zone: ZoneId; color: string; gradient: string }) {
  const { selectAll, selectTop5, clearAll, selectedCount } = useZoneStore();
  const count = selectedCount(zone);

  return (
    <div
      style={{
        display:        'flex',
        gap:            6,
        paddingInline:  14,
        paddingBlock:   10,
        borderBlockEnd: '1px solid rgba(0,0,0,0.05)',
        flexShrink:     0,
      }}
    >
      {/* Omni-Search — select all 30 */}
      <motion.button
        onClick={() => selectAll(zone)}
        whileHover={{ scale: 1.03, boxShadow: `0 6px 22px ${color}44` }}
        whileTap={{ scale: 0.97 }}
        transition={SPRING}
        style={{
          flex:           1,
          paddingBlock:   8,
          paddingInline:  10,
          borderRadius:   10,
          fontSize:       11,
          fontWeight:     800,
          color:          'white',
          background:     `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)`,
          border:         'none',
          cursor:         'pointer',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          gap:            5,
          boxShadow:      `0 3px 12px ${color}38`,
          letterSpacing:  '-0.01em',
          whiteSpace:     'nowrap',
          fontFamily:     'inherit',
        }}
      >
        <motion.span
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
          style={{ display: 'inline-block', fontSize: 10, lineHeight: 1 }}
        >
          ✦
        </motion.span>
        Omni-Search
      </motion.button>

      {/* Top 5 — select only tier-1 engines */}
      <motion.button
        onClick={() => selectTop5(zone)}
        whileHover={{ scale: 1.04, boxShadow: '0 4px 14px rgba(0,0,0,0.10)' }}
        whileTap={{ scale: 0.96 }}
        transition={SPRING}
        style={{
          paddingBlock:   8,
          paddingInline:  12,
          borderRadius:   10,
          fontSize:       11,
          fontWeight:     700,
          color:          '#1D1D1F',
          background:     'rgba(0,0,0,0.06)',
          border:         '1px solid rgba(0,0,0,0.09)',
          cursor:         'pointer',
          whiteSpace:     'nowrap',
          fontFamily:     'inherit',
        }}
      >
        Top 5
      </motion.button>

      {/* Clear */}
      <motion.button
        onClick={() => clearAll(zone)}
        whileHover={{ scale: 1.04, background: 'rgba(255,59,48,0.10)', color: '#FF3B30' }}
        whileTap={{ scale: 0.96 }}
        transition={SPRING}
        animate={{
          color:      count > 0 ? '#FF3B30' : '#AEAEB2',
          background: count > 0 ? 'rgba(255,59,48,0.07)' : 'rgba(0,0,0,0.04)',
          borderColor: count > 0 ? 'rgba(255,59,48,0.18)' : 'rgba(0,0,0,0.07)',
        }}
        style={{
          paddingBlock:   8,
          paddingInline:  12,
          borderRadius:   10,
          fontSize:       11,
          fontWeight:     700,
          border:         '1px solid',
          cursor:         'pointer',
          fontFamily:     'inherit',
        }}
      >
        Clear
      </motion.button>
    </div>
  );
}

// ── ConsoleHeader ─────────────────────────────────────────────────────────────

function ConsoleHeader({
  zone,
  totalEngines,
}: {
  zone:         ZoneId;
  totalEngines: number;
}) {
  const { selectedCount } = useZoneStore();
  const count = selectedCount(zone);
  const meta  = ZONE_META[zone];

  return (
    <div
      style={{
        paddingInline:    14,
        paddingBlockStart: 16,
        paddingBlockEnd:   13,
        borderBlockEnd:   '1px solid rgba(0,0,0,0.05)',
        background:       `linear-gradient(180deg, ${meta.color}0A 0%, transparent 100%)`,
        flexShrink:       0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Zone icon — pulsing */}
        <motion.span
          animate={{ scale: [1, 1.12, 1] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
          style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}
        >
          {meta.icon}
        </motion.span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize:      13,
              fontWeight:    800,
              color:         '#1D1D1F',
              letterSpacing: '-0.02em',
              lineHeight:    1.2,
            }}
          >
            Engine Control Console
          </p>
          <p style={{ fontSize: 11, color: '#6E6E73', marginBlockStart: 2 }}>
            {meta.label} · {totalEngines} engines
          </p>
        </div>

        {/* Live count badge */}
        <motion.div
          key={count}
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={SPRING_POP}
          style={{
            display:        'flex',
            alignItems:     'center',
            gap:            4,
            paddingBlock:   4,
            paddingInline:  9,
            borderRadius:   999,
            background:     count > 0 ? `${meta.color}16` : 'rgba(0,0,0,0.05)',
            border:         `1.5px solid ${count > 0 ? `${meta.color}44` : 'rgba(0,0,0,0.09)'}`,
            fontSize:       12,
            fontWeight:     800,
            color:          count > 0 ? meta.color : '#AEAEB2',
            flexShrink:     0,
            transition:     'all 0.22s ease',
          }}
        >
          {count > 0 && (
            <motion.span
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.6, repeat: Infinity }}
              style={{
                display:      'inline-block',
                width:        5,
                height:       5,
                borderRadius: '50%',
                background:   meta.color,
                flexShrink:   0,
              }}
            />
          )}
          <span>{count}/{totalEngines}</span>
        </motion.div>
      </div>
    </div>
  );
}

// ── LaunchButton ──────────────────────────────────────────────────────────────

function LaunchButton({
  zone,
  onSearch,
}: {
  zone:      ZoneId;
  onSearch?: (ids: string[]) => void;
}) {
  const { selectedCount, selectedIds } = useZoneStore();
  const meta  = ZONE_META[zone];
  const count = selectedCount(zone);

  const handleLaunch = useCallback(() => {
    if (count === 0) return;
    const ids = selectedIds(zone);
    onSearch?.(ids);
    if (typeof document !== 'undefined') {
      document.dispatchEvent(
        new CustomEvent('unitravel:zone-search', { detail: { zone, engineIds: ids } }),
      );
    }
  }, [count, zone, selectedIds, onSearch]);

  return (
    <div
      style={{
        paddingInline: 12,
        paddingBlock:  12,
        borderBlockStart: '1px solid rgba(0,0,0,0.05)',
        flexShrink:    0,
      }}
    >
      <motion.button
        onClick={handleLaunch}
        disabled={count === 0}
        whileHover={
          count > 0
            ? { scale: 1.02, boxShadow: `0 8px 28px ${meta.color}4C` }
            : {}
        }
        whileTap={count > 0 ? { scale: 0.98 } : {}}
        animate={{ opacity: count > 0 ? 1 : 0.46 }}
        transition={SPRING}
        style={{
          width:          '100%',
          paddingBlock:   13,
          borderRadius:   14,
          fontSize:       13,
          fontWeight:     800,
          color:          'white',
          background:     count > 0 ? meta.gradient : 'rgba(0,0,0,0.12)',
          border:         'none',
          cursor:         count > 0 ? 'pointer' : 'default',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          gap:            8,
          boxShadow:      count > 0 ? `0 4px 18px ${meta.color}38` : 'none',
          transition:     'background 0.25s ease, box-shadow 0.25s ease',
          letterSpacing:  '-0.01em',
          fontFamily:     'inherit',
        }}
      >
        {count > 0 && (
          <motion.span
            animate={{ scale: [1, 1.5, 1], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 1.6, repeat: Infinity }}
            style={{
              display:      'inline-block',
              width:        7,
              height:       7,
              borderRadius: '50%',
              background:   'rgba(255,255,255,0.9)',
              flexShrink:   0,
            }}
          />
        )}
        {count > 0
          ? `Search with ${count} engine${count !== 1 ? 's' : ''} →`
          : 'Select engines to search'}
      </motion.button>
    </div>
  );
}

// ── OmniSelectorConsole ───────────────────────────────────────────────────────

export interface OmniSelectorConsoleProps {
  zone:      ZoneId;
  onSearch?: (engineIds: string[]) => void;
  className?: string;
}

export function OmniSelectorConsole({
  zone,
  onSearch,
  className,
}: OmniSelectorConsoleProps) {
  const engines    = ZONE_ENGINES[zone];
  const meta       = ZONE_META[zone];
  const tieredGroups: [number, Engine[]][] = [1, 2, 3].map(t => [t, engines.filter(e => e.tier === t)]);

  // Track total engine count for the header badge
  const totalEngines = engines.length;

  // Keyboard shortcut: Ctrl+Shift+A = Omni-Search
  const { selectAll } = useZoneStore();
  const selectAllRef = useRef(selectAll);
  selectAllRef.current = selectAll;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        selectAllRef.current(zone);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zone]);

  return (
    <motion.aside
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={SPRING_SOFT}
      className={className}
      style={{
        width:          380,
        minWidth:       380,
        height:         '100%',
        display:        'flex',
        flexDirection:  'column',
        background:     'rgba(255,255,255,0.88)',
        backdropFilter: 'blur(48px) saturate(2)',
        WebkitBackdropFilter: 'blur(48px) saturate(2)',
        borderInlineEnd: '1px solid rgba(0,0,0,0.06)',
        boxShadow:      '2px 0 20px rgba(0,0,0,0.04)',
        flexShrink:     0,
        position:       'relative',
        zIndex:         10,
      }}
    >
      {/* Ambient glow behind console matching zone color */}
      <div
        style={{
          position:         'absolute',
          insetBlockStart:  -60,
          insetInlineStart: -60,
          width:            280,
          height:           280,
          borderRadius:     '50%',
          background:       `radial-gradient(circle, ${meta.color}10 0%, transparent 70%)`,
          pointerEvents:    'none',
          zIndex:           0,
        }}
      />

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <ConsoleHeader zone={zone} totalEngines={totalEngines} />

        {/* Action strip */}
        <ActionStrip zone={zone} color={meta.color} gradient={meta.gradient} />

        {/* Engine grid — scrollable */}
        <div
          className="flex-1 overflow-y-auto light-scroll"
          style={{ padding: '12px 12px 6px', minHeight: 0 }}
        >
          {tieredGroups.map(([tier, tierEngines]) => (
            <TierSection
              key={tier}
              tier={tier}
              engines={tierEngines}
              zone={zone}
              color={meta.color}
            />
          ))}
        </div>

        {/* Launch CTA */}
        <LaunchButton zone={zone} onSearch={onSearch} />
      </div>
    </motion.aside>
  );
}
