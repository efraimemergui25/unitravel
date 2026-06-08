'use client';

// ExperiencesControl.tsx — Horizontal 30-engine glass-pill matrix for the Experiences zone.
// Mirrors CulinaryControl architecture: AI mode picks the top trust platforms,
// God-Mode activates all 30. Pills use bg-white/20 → active bg-white/60 shadow-inset spec.

import { useState, useCallback, memo } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { ZONE_ENGINES } from '@/lib/zoneEngines';

// ── Constants ─────────────────────────────────────────────────────────────────

type Mode = 'ai' | 'god';

const SPRING     = { type: 'spring', stiffness: 400, damping: 25 } as const;
const SPRING_POP = { type: 'spring', stiffness: 480, damping: 22 } as const;
const COLOR      = '#30D158';
const GRADIENT   = 'linear-gradient(135deg, #30D158 0%, #00C7BE 100%)';

const AI_PICKS = new Set([
  'tripadvisor-a', 'viator', 'getyourguide', 'klook', 'tiqets',
  'airbnb-exp', 'musement', 'atlas-obscura', 'culture-trip',
]);

const ENGINES = ZONE_ENGINES['attractions'];

// ── Mode toggle ───────────────────────────────────────────────────────────────

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <LayoutGroup id="exp-mode-strip">
      <div
        role="group"
        aria-label="Engine selection mode"
        style={{
          display:      'flex',
          padding:      3,
          background:   'rgba(0,0,0,0.055)',
          borderRadius: 10,
          gap:          2,
          flexShrink:   0,
        }}
      >
        {(['ai', 'god'] as Mode[]).map(m => {
          const isActive = mode === m;
          return (
            <motion.button
              key={m}
              role="radio"
              aria-checked={isActive}
              onClick={() => onChange(m)}
              whileTap={{ scale: 0.95 }}
              transition={SPRING}
              style={{
                paddingBlock:     7,
                paddingInline:    12,
                borderRadius:     7,
                border:           'none',
                cursor:           'pointer',
                fontSize:         11,
                fontWeight:       isActive ? 800 : 500,
                fontFamily:       'inherit',
                position:         'relative',
                background:       'none',
                color:            isActive ? COLOR : '#6E6E73',
                userSelect:       'none',
                WebkitUserSelect: 'none',
                zIndex:           1,
                letterSpacing:    '-0.01em',
                whiteSpace:       'nowrap',
              }}
            >
              {isActive && (
                <motion.div
                  layoutId="exp-mode-pill-strip"
                  style={{
                    position:     'absolute',
                    inset:        0,
                    borderRadius: 7,
                    background:   'rgba(255,255,255,0.95)',
                    boxShadow:    '0 2px 8px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,1)',
                    zIndex:       -1,
                  }}
                  transition={SPRING}
                />
              )}
              {m === 'ai' ? '✦ AI Concierge' : '⚡ God-Mode'}
            </motion.button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

// ── Glass pill engine button ──────────────────────────────────────────────────

const GlassPill = memo(function GlassPill({
  id, name, icon, isActive, isAIPick, onToggle,
}: {
  id:       string;
  name:     string;
  icon:     string;
  isActive: boolean;
  isAIPick: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.button
      onClick={onToggle}
      aria-pressed={isActive}
      whileHover={{ y: -2, scale: 1.03 }}
      whileTap={{ scale: 0.93 }}
      animate={{
        background: isActive ? 'rgba(255,255,255,0.60)' : 'rgba(255,255,255,0.20)',
        boxShadow:  isActive
          ? `inset 0 0 0 1.5px ${COLOR}55,
             inset 0 0 10px rgba(255,255,255,0.80),
             0 4px 14px ${COLOR}18`
          : 'inset 0 0 0 1px rgba(0,0,0,0.07)',
      }}
      transition={{ ...SPRING, duration: 0.18 }}
      style={{
        display:         'flex',
        alignItems:      'center',
        gap:              5,
        paddingBlock:    7,
        paddingInline:   11,
        borderRadius:    10,
        border:          'none',
        cursor:          'pointer',
        position:        'relative',
        fontFamily:      'inherit',
        flexShrink:      0,
        backdropFilter:  'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      {/* AI-pick indicator dot */}
      {isAIPick && (
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={SPRING_POP}
          style={{
            position:   'absolute',
            top:        3, insetInlineEnd: 3,
            width:      5, height: 5,
            borderRadius: '50%',
            background:  COLOR,
            boxShadow:  `0 0 4px ${COLOR}CC`,
          }}
          aria-hidden
        />
      )}
      <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>{icon}</span>
      <span style={{
        fontSize:      9.5,
        fontWeight:    isActive ? 800 : 500,
        color:         isActive ? COLOR : '#6E6E73',
        letterSpacing: '-0.01em',
        whiteSpace:    'nowrap',
      }}>
        {name}
      </span>
    </motion.button>
  );
});

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ExperiencesControlProps {
  onSearch:    (engineIds: string[]) => void;
  isSearching: boolean;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function ExperiencesControl({ onSearch, isSearching }: ExperiencesControlProps) {
  const [mode,     setMode]     = useState<Mode>('ai');
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(ENGINES.filter(e => AI_PICKS.has(e.id)).map(e => e.id)),
  );

  const toggleEngine = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleModeChange = useCallback((m: Mode) => {
    setMode(m);
    if (m === 'ai') {
      setSelected(new Set(ENGINES.filter(e => AI_PICKS.has(e.id)).map(e => e.id)));
    } else {
      setSelected(new Set(ENGINES.map(e => e.id)));
    }
  }, []);

  const handleSearch = useCallback(() => {
    if (selected.size === 0 || isSearching) return;
    onSearch([...selected]);
  }, [selected, isSearching, onSearch]);

  const count = selected.size;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING, delay: 0.06 }}
      className="glass-panel mx-4 flex-shrink-0 overflow-hidden"
      style={{
        display:        'flex',
        flexDirection:  'column',
        gap:             0,
      }}
    >
      {/* ── Controls bar ── */}
      <div style={{
        display:       'flex',
        alignItems:    'center',
        gap:            10,
        paddingBlock:   10,
        paddingInline:  14,
        borderBlockEnd: '1px solid rgba(255,255,255,0.55)',
        flexWrap:       'wrap',
        rowGap:          6,
      }}>
        {/* Icon + label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: GRADIENT,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14,
            boxShadow: `0 4px 12px ${COLOR}40`,
          }}>
            🎭
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              Experiences Hub
            </div>
            <div style={{ fontSize: 9.5, color: 'var(--text-tertiary)', fontWeight: 500 }}>
              {ENGINES.length} global networks
            </div>
          </div>
        </div>

        {/* Mode toggle */}
        <ModeToggle mode={mode} onChange={handleModeChange} />

        {/* Count badge */}
        <AnimatePresence mode="wait">
          {count > 0 && (
            <motion.span
              key={count}
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.7, opacity: 0 }}
              transition={SPRING_POP}
              style={{
                fontSize:      10,
                fontWeight:    900,
                background:    GRADIENT,
                color:         '#fff',
                borderRadius:  7,
                paddingBlock:  2,
                paddingInline: 8,
                boxShadow:    `0 3px 10px ${COLOR}38`,
                display:      'inline-block',
                flexShrink:   0,
              }}
            >
              {count} active
            </motion.span>
          )}
        </AnimatePresence>

        {/* Search CTA */}
        <motion.button
          onClick={handleSearch}
          disabled={count === 0 || isSearching}
          whileHover={count > 0 && !isSearching ? { scale: 1.03, boxShadow: `0 6px 20px ${COLOR}40` } : {}}
          whileTap={count > 0 && !isSearching ? { scale: 0.97 } : {}}
          transition={SPRING}
          style={{
            display:        'flex',
            alignItems:     'center',
            gap:             6,
            paddingBlock:    8,
            paddingInline:   18,
            borderRadius:    10,
            fontSize:        12,
            fontWeight:      800,
            color:          'white',
            background:      count > 0 ? GRADIENT : 'rgba(0,0,0,0.12)',
            border:         'none',
            cursor:          count > 0 && !isSearching ? 'pointer' : 'default',
            boxShadow:       count > 0 ? `0 3px 12px ${COLOR}38` : 'none',
            letterSpacing:  '-0.01em',
            fontFamily:     'inherit',
            flexShrink:     0,
            whiteSpace:     'nowrap',
            marginInlineStart: 'auto',
          }}
        >
          {isSearching ? (
            <motion.span
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 0.85, repeat: Infinity, ease: 'linear' }}
              style={{ display: 'inline-block', fontSize: 11 }}
              aria-hidden
            >✦</motion.span>
          ) : (
            <motion.span
              animate={{ scale: [1, 1.4, 1], opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 1.6, repeat: Infinity }}
              style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', display: 'inline-block', flexShrink: 0 }}
              aria-hidden
            />
          )}
          {isSearching ? `Scanning ${count}…` : `Search ${count} experience engine${count !== 1 ? 's' : ''}`}
        </motion.button>
      </div>

      {/* ── Glass pills strip ── */}
      <div
        className="flex flex-row overflow-x-auto gap-2 no-scrollbar"
        style={{ paddingInline: 14, paddingBlock: 10 }}
        aria-label="Experience engine selector"
      >
        {ENGINES.map(engine => (
          <GlassPill
            key={engine.id}
            id={engine.id}
            name={engine.name}
            icon={engine.icon}
            isActive={selected.has(engine.id)}
            isAIPick={AI_PICKS.has(engine.id)}
            onToggle={() => toggleEngine(engine.id)}
          />
        ))}
      </div>

      {/* AI caption */}
      <AnimatePresence mode="wait">
        {mode === 'ai' && (
          <motion.p
            key="ai-cap"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              margin:         0,
              fontSize:       10,
              color:          COLOR,
              fontWeight:     500,
              paddingInline:  14,
              paddingBlockEnd: 10,
              lineHeight:     1.6,
            }}
          >
            ✦ AI optimized: {AI_PICKS.size} top-trust experience networks · weather-synced · effort-filtered.
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
