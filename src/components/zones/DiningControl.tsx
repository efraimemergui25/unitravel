'use client';

import { useState, useCallback, memo } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { ZONE_ENGINES } from '@/lib/zoneEngines';

// ── Constants ─────────────────────────────────────────────────────────────────

type Mode = 'ai' | 'god';

const SPRING     = { type: 'spring', stiffness: 400, damping: 25 } as const;
const SPRING_POP = { type: 'spring', stiffness: 460, damping: 22 } as const;
const COLOR      = '#FF9F0A';
const GRADIENT   = 'linear-gradient(135deg, #FF9F0A 0%, #FF453A 100%)';

// AI curated for romantic honeymoon dining across Mexico, Miami, Bahamas
const AI_PICKS = new Set([
  'michelin', 'opentable', 'resy', 'worlds50best', 'infatuation',
  'eater', 'tock', 'zagat', 'tripadvisor-d',
]);

const ENGINES    = ZONE_ENGINES['dining'];

const TIER_LABELS: Record<1 | 2 | 3, string> = {
  1: '⭐ Reservation Platforms',
  2: '◉ Editorial & Discovery',
  3: '·  Local & Niche',
};

// ── Mode toggle ───────────────────────────────────────────────────────────────

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <LayoutGroup id="dining-mode">
      <div
        role="group"
        aria-label="Engine selection mode"
        style={{
          display:      'flex',
          padding:      3,
          background:   'rgba(0,0,0,0.065)',
          borderRadius: 12,
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
              whileTap={{ scale: 0.96 }}
              transition={SPRING}
              style={{
                flex: 1, paddingBlock: 8, paddingInline: 10,
                borderRadius: 9, border: 'none', cursor: 'pointer',
                fontSize: 11, fontWeight: isActive ? 800 : 500,
                fontFamily: 'inherit', position: 'relative',
                background: 'none',
                color: isActive ? COLOR : '#6E6E73',
                userSelect: 'none', WebkitUserSelect: 'none',
                zIndex: 1, letterSpacing: '-0.01em',
              }}
            >
              {isActive && (
                <motion.div
                  layoutId="dining-mode-pill"
                  style={{
                    position: 'absolute', inset: 0, borderRadius: 9,
                    background: 'rgba(255,255,255,0.95)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,1)',
                    zIndex: -1,
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

// ── Engine button ─────────────────────────────────────────────────────────────

const EngineButton = memo(function EngineButton({
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
      whileHover={{ scale: 1.05, y: -1 }}
      whileTap={{ scale: 0.93 }}
      animate={{
        background: isActive ? `${COLOR}14` : 'rgba(0,0,0,0.04)',
        boxShadow: isActive
          ? `inset 0 0 0 1.5px ${COLOR}58,
             inset 0 1px 0 rgba(255,255,255,0.88),
             0 0 15px rgba(255,255,255,0.60),
             0 4px 18px ${COLOR}22`
          : 'inset 0 0 0 1px rgba(0,0,0,0.07)',
      }}
      transition={{ ...SPRING, duration: 0.2 }}
      style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        gap:            5,
        paddingBlock:   9,
        paddingInline:  7,
        borderRadius:   12,
        border:         'none',
        cursor:         'pointer',
        position:       'relative',
        fontFamily:     'inherit',
        minWidth:       0,
      }}
    >
      {/* AI Pick spark */}
      {isAIPick && (
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={SPRING_POP}
          style={{
            position:   'absolute',
            top:        4,
            insetInlineEnd: 4,
            width:      7,
            height:     7,
            borderRadius: '50%',
            background: COLOR,
            boxShadow:  `0 0 5px ${COLOR}`,
          }}
          aria-hidden
        />
      )}
      <span style={{ fontSize: 20, lineHeight: 1 }}>{icon}</span>
      <span style={{
        fontSize:      8.5,
        fontWeight:    isActive ? 800 : 500,
        color:         isActive ? COLOR : '#6E6E73',
        letterSpacing: '-0.01em',
        textAlign:     'center',
        lineHeight:    1.2,
        whiteSpace:    'nowrap',
        overflow:      'hidden',
        textOverflow:  'ellipsis',
        maxWidth:      58,
      }}>
        {name}
      </span>
    </motion.button>
  );
});

// ── Props ─────────────────────────────────────────────────────────────────────

export interface DiningControlProps {
  onSearch:    (engineIds: string[]) => void;
  isSearching: boolean;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function DiningControl({ onSearch, isSearching }: DiningControlProps) {
  const [mode,     setMode]     = useState<Mode>('ai');
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(ENGINES.filter(e => AI_PICKS.has(e.id)).map(e => e.id))
  );

  const toggle = useCallback((id: string) => {
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
  const byTier = [1, 2, 3] as const;

  return (
    <motion.aside
      initial={{ x: -24, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28, delay: 0.08 }}
      style={{
        width:                360,
        flexShrink:           0,
        height:               '100%',
        display:              'flex',
        flexDirection:        'column',
        background:           'rgba(255,255,255,0.82)',
        backdropFilter:       'blur(48px) saturate(1.9)',
        WebkitBackdropFilter: 'blur(48px) saturate(1.9)',
        borderInlineEnd:      '1px solid rgba(0,0,0,0.06)',
        boxShadow:            'inset -1px 0 0 rgba(255,255,255,1)',
        overflow:             'hidden',
      }}
    >
      {/* Specular highlight */}
      <div aria-hidden style={{
        position: 'absolute', insetInlineStart: 0, insetInlineEnd: 0, top: 0,
        height: 1,
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent)',
        zIndex: 2,
      }} />

      {/* ── Header ──────────────────────────────────────────── */}
      <div style={{ padding: '22px 18px 14px', flexShrink: 0 }}>
        {/* Logo row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 11,
            background: GRADIENT,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18,
            boxShadow: `0 6px 22px ${COLOR}40`,
            flexShrink: 0,
          }}>
            🍽️
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
              Culinary Intel
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 500, letterSpacing: '-0.01em' }}>
              {ENGINES.length} culinary networks
            </div>
          </div>
          <div style={{ marginInlineStart: 'auto', flexShrink: 0 }}>
            <AnimatePresence mode="wait">
              {count > 0 && (
                <motion.span
                  key={count}
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.7, opacity: 0 }}
                  transition={SPRING_POP}
                  style={{
                    fontSize: 10, fontWeight: 900,
                    background: GRADIENT, color: '#fff',
                    borderRadius: 8, paddingBlock: 3, paddingInline: 9,
                    boxShadow: `0 3px 10px ${COLOR}40`,
                    display: 'inline-block',
                  }}
                >
                  {count}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Caption */}
        <p style={{
          fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)',
          letterSpacing: '-0.01em', lineHeight: 1.5, marginBottom: 14,
        }}>
          Curated for romantic dining · Tulum · Riviera Maya · Cabo · CDMX · Miami
        </p>

        <ModeToggle mode={mode} onChange={handleModeChange} />
      </div>

      {/* ── Engine grid ─────────────────────────────────────── */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '4px 14px 12px',
        scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,0,0,0.08) transparent',
      }}>
        {byTier.map(tier => {
          const engines = ENGINES.filter(e => e.tier === tier);
          return (
            <div key={tier} style={{ marginBottom: 16 }}>
              <div style={{
                fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)',
                letterSpacing: '0.06em', textTransform: 'uppercase',
                paddingBlock: '6px 8px', paddingInline: 4,
              }}>
                {TIER_LABELS[tier]}
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 6,
              }}>
                {engines.map(engine => (
                  <EngineButton
                    key={engine.id}
                    id={engine.id}
                    name={engine.name}
                    icon={engine.icon}
                    isActive={selected.has(engine.id)}
                    isAIPick={AI_PICKS.has(engine.id)}
                    onToggle={() => toggle(engine.id)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Search CTA ──────────────────────────────────────── */}
      <div style={{
        padding: '12px 16px 20px', flexShrink: 0,
        borderBlockStart: '1px solid rgba(0,0,0,0.05)',
        background: 'rgba(255,255,255,0.6)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}>
        <motion.button
          onClick={handleSearch}
          disabled={count === 0 || isSearching}
          whileHover={count > 0 && !isSearching ? { scale: 1.02, boxShadow: `0 8px 28px ${COLOR}4C` } : {}}
          whileTap={count > 0 && !isSearching ? { scale: 0.98 } : {}}
          style={{
            width:         '100%',
            paddingBlock:  14,
            paddingInline: 20,
            borderRadius:  14,
            border:        'none',
            cursor:        count > 0 && !isSearching ? 'pointer' : 'not-allowed',
            background:    count > 0 ? GRADIENT : 'rgba(0,0,0,0.06)',
            color:         count > 0 ? '#fff' : '#AEAEB2',
            fontSize:      13,
            fontWeight:    900,
            fontFamily:    'inherit',
            letterSpacing: '-0.02em',
            display:       'flex',
            alignItems:    'center',
            justifyContent:'center',
            gap:           8,
            boxShadow:     count > 0 ? `0 6px 22px ${COLOR}38` : 'none',
            transition:    'background 0.2s, box-shadow 0.2s',
          }}
        >
          {isSearching ? (
            <>
              <motion.span
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                style={{ display: 'inline-block', fontSize: 14 }}
                aria-hidden
              >
                ✦
              </motion.span>
              Scanning {count} engines…
            </>
          ) : (
            <>
              <span aria-hidden>🔍</span>
              {count === 0 ? 'Select engines' : `Search ${count} culinary engine${count !== 1 ? 's' : ''}`}
            </>
          )}
        </motion.button>
      </div>
    </motion.aside>
  );
}
