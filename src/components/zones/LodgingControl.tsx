'use client';

import { useState, useCallback, memo } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { ZONE_ENGINES } from '@/lib/zoneEngines';

// ── Constants ─────────────────────────────────────────────────────────────────

type Mode = 'ai' | 'god';

const SPRING     = { type: 'spring', stiffness: 400, damping: 25 } as const;
const SPRING_POP = { type: 'spring', stiffness: 460, damping: 22 } as const;
const COLOR      = '#00C7BE';
const GRADIENT   = 'linear-gradient(135deg, #00C7BE 0%, #007AFF 100%)';

// AI curated for Tulum · Riviera Maya · Cabo · CDMX luxury honeymoon
const AI_PICKS = new Set([
  'booking', 'airbnb', 'hotels-com', 'expedia-h', 'marriott',
  'four-seasons', 'rosewood', 'one-only', 'mr-mrs-smith', 'design-hotels',
]);

const ENGINES    = ZONE_ENGINES['lodging'];

const TIER_LABELS: Record<1 | 2 | 3, string> = {
  1: '⭐ Global Leaders',
  2: '◉ Luxury & Boutique',
  3: '·  Extended Network',
};

// ── Mode toggle ───────────────────────────────────────────────────────────────

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <LayoutGroup id="lodg-mode">
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
                flex:             1,
                paddingBlock:     8,
                paddingInline:    10,
                borderRadius:     9,
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
              }}
            >
              {isActive && (
                <motion.div
                  layoutId="lodg-mode-pill"
                  style={{
                    position:     'absolute',
                    inset:        0,
                    borderRadius: 9,
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
        color:      isActive ? COLOR : '#3C3C43',
        fontWeight: isActive ? 700 : 500,
      }}
      transition={{ ...SPRING, boxShadow: { duration: 0.22 } }}
      style={{
        position:           'relative',
        display:            'flex',
        alignItems:         'center',
        gap:                4,
        paddingBlock:       7,
        paddingInlineStart: 7,
        paddingInlineEnd:   isActive ? 5 : 8,
        borderRadius:       9,
        border:             'none',
        cursor:             'pointer',
        fontSize:           11,
        letterSpacing:      '-0.01em',
        userSelect:         'none',
        WebkitUserSelect:   'none',
        whiteSpace:         'nowrap',
        fontFamily:         'inherit',
        overflow:           'hidden',
        minWidth:           0,
      }}
    >
      {isAIPick && (
        <motion.span
          animate={{ color: isActive ? COLOR : '#C7C7CC' }}
          style={{ fontSize: 7, flexShrink: 0, lineHeight: 1 }}
          aria-hidden
        >
          ✦
        </motion.span>
      )}
      <span style={{ fontSize: 12, lineHeight: 1, flexShrink: 0 }} aria-hidden>{icon}</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{name}</span>

      <AnimatePresence>
        {isActive && (
          <motion.span
            key="check"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={SPRING_POP}
            aria-hidden
            style={{
              width:          14,
              height:         14,
              borderRadius:   '50%',
              background:     COLOR,
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              fontSize:       8,
              fontWeight:     900,
              color:          'white',
              flexShrink:     0,
              lineHeight:     1,
            }}
          >
            ✓
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
});

// ── LodgingControl ────────────────────────────────────────────────────────────

export interface LodgingControlProps {
  onSearch:    (engineIds: string[]) => void;
  isSearching: boolean;
}

export function LodgingControl({ onSearch, isSearching }: LodgingControlProps) {
  const [mode,     setMode]     = useState<Mode>('ai');
  const [selected, setSelected] = useState<Set<string>>(new Set(AI_PICKS));

  const toggleEngine = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleModeChange = useCallback((m: Mode) => {
    setMode(m);
    if (m === 'ai') setSelected(new Set(AI_PICKS));
  }, []);

  const handleSearch = useCallback(() => {
    if (selected.size === 0 || isSearching) return;
    onSearch([...selected]);
  }, [selected, isSearching, onSearch]);

  const count = selected.size;

  return (
    <motion.aside
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ ...SPRING, delay: 0.05 }}
      style={{
        width:                360,
        minWidth:             360,
        height:               '100%',
        display:              'flex',
        flexDirection:        'column',
        background:           'rgba(255,255,255,0.90)',
        backdropFilter:       'blur(48px) saturate(2)',
        WebkitBackdropFilter: 'blur(48px) saturate(2)',
        borderInlineEnd:      '1px solid rgba(0,0,0,0.06)',
        boxShadow:            '2px 0 24px rgba(0,0,0,0.04)',
        flexShrink:           0,
        zIndex:               10,
        position:             'relative',
        overflow:             'hidden',
      }}
    >
      {/* Ambient zone glow */}
      <div
        aria-hidden
        style={{
          position:         'absolute',
          insetBlockStart:  -60,
          insetInlineStart: -60,
          width:            260,
          height:           260,
          borderRadius:     '50%',
          background:       `radial-gradient(circle, ${COLOR}10 0%, transparent 70%)`,
          pointerEvents:    'none',
        }}
      />

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>

        {/* ── Header ────────────────────────────────────────────────── */}
        <div
          style={{
            paddingInline:     16,
            paddingBlockStart: 16,
            paddingBlockEnd:   14,
            borderBlockEnd:    '1px solid rgba(0,0,0,0.05)',
            background:        `linear-gradient(180deg, ${COLOR}09 0%, transparent 100%)`,
            flexShrink:        0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBlockEnd: 14 }}>
            <motion.span
              animate={{ scale: [1, 1.10, 1] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
              style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}
              aria-hidden
            >
              🏨
            </motion.span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                Hospitality Matrix
              </p>
              <p style={{ fontSize: 11, color: '#6E6E73', marginBlockStart: 2 }}>
                30 global lodging engines · AI dedup
              </p>
            </div>

            {/* Live count */}
            <motion.div
              key={count}
              initial={{ scale: 0.82 }}
              animate={{ scale: 1 }}
              transition={SPRING_POP}
              style={{
                display:       'flex',
                alignItems:    'center',
                gap:           4,
                paddingBlock:  4,
                paddingInline: 9,
                borderRadius:  999,
                background:    count > 0 ? `${COLOR}16` : 'rgba(0,0,0,0.05)',
                border:        `1.5px solid ${count > 0 ? `${COLOR}44` : 'rgba(0,0,0,0.09)'}`,
                fontSize:      12,
                fontWeight:    800,
                color:         count > 0 ? COLOR : '#AEAEB2',
                flexShrink:    0,
                transition:    'all 0.22s ease',
              }}
              aria-live="polite"
            >
              {count > 0 && (
                <motion.span
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.6, repeat: Infinity }}
                  style={{ width: 5, height: 5, borderRadius: '50%', background: COLOR, display: 'inline-block', flexShrink: 0 }}
                  aria-hidden
                />
              )}
              {count}/30
            </motion.div>
          </div>

          <ModeToggle mode={mode} onChange={handleModeChange} />

          <AnimatePresence mode="wait">
            {mode === 'ai' ? (
              <motion.p
                key="ai"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
                style={{ fontSize: 10.5, color: COLOR, lineHeight: 1.5, marginBlockStart: 10, fontWeight: 500 }}
              >
                ✦ Curated for Tulum · Riviera Maya · Cabo · CDMX luxury stays.
                10 highest-trust engines selected. Duplicates auto-merged.
              </motion.p>
            ) : (
              <motion.p
                key="god"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
                style={{ fontSize: 10.5, color: '#6E6E73', lineHeight: 1.5, marginBlockStart: 10 }}
              >
                Full manual control. Toggle any of the 30 global hospitality engines.
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* ── Action strip ────────────────────────────────────────── */}
        <div
          style={{
            display:        'flex',
            gap:            5,
            paddingInline:  12,
            paddingBlock:   9,
            borderBlockEnd: '1px solid rgba(0,0,0,0.05)',
            flexShrink:     0,
          }}
        >
          <motion.button
            onClick={() => setSelected(new Set(ENGINES.map(e => e.id)))}
            whileHover={{ scale: 1.03, boxShadow: `0 5px 18px ${COLOR}44` }}
            whileTap={{ scale: 0.97 }}
            transition={SPRING}
            style={{
              flex:           1,
              paddingBlock:   7,
              paddingInline:  10,
              borderRadius:   9,
              fontSize:       11,
              fontWeight:     800,
              color:          'white',
              background:     GRADIENT,
              border:         'none',
              cursor:         'pointer',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              gap:            5,
              boxShadow:      `0 3px 10px ${COLOR}38`,
              letterSpacing:  '-0.01em',
              fontFamily:     'inherit',
            }}
          >
            <motion.span
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
              style={{ display: 'inline-block', fontSize: 10 }}
              aria-hidden
            >
              ✦
            </motion.span>
            Omni-Search
          </motion.button>

          <motion.button
            onClick={() => { setMode('ai'); setSelected(new Set(AI_PICKS)); }}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            transition={SPRING}
            style={{
              paddingBlock:  7,
              paddingInline: 10,
              borderRadius:  9,
              fontSize:      11,
              fontWeight:    700,
              color:         '#1D1D1F',
              background:    'rgba(0,0,0,0.05)',
              border:        '1px solid rgba(0,0,0,0.08)',
              cursor:        'pointer',
              fontFamily:    'inherit',
              whiteSpace:    'nowrap',
            }}
          >
            AI Pick
          </motion.button>

          <motion.button
            onClick={() => setSelected(new Set())}
            whileHover={{ scale: 1.04, background: 'rgba(255,59,48,0.10)', color: '#FF3B30' }}
            whileTap={{ scale: 0.96 }}
            transition={SPRING}
            animate={{
              color:      count > 0 ? '#FF3B30' : '#AEAEB2',
              background: count > 0 ? 'rgba(255,59,48,0.07)' : 'rgba(0,0,0,0.04)',
            }}
            style={{
              paddingBlock:  7,
              paddingInline: 10,
              borderRadius:  9,
              fontSize:      11,
              fontWeight:    700,
              border:        `1px solid ${count > 0 ? 'rgba(255,59,48,0.18)' : 'rgba(0,0,0,0.08)'}`,
              cursor:        'pointer',
              fontFamily:    'inherit',
            }}
          >
            Clear
          </motion.button>
        </div>

        {/* ── Engine grid ─────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 11px 6px', minHeight: 0 }}>
          {([1, 2, 3] as const).map(tier => {
            const tierEngines = ENGINES.filter(e => e.tier === tier);
            return (
              <div key={tier} style={{ marginBlockEnd: 12 }}>
                <p
                  style={{
                    fontSize:       9,
                    fontWeight:     700,
                    color:          '#AEAEB2',
                    textTransform:  'uppercase',
                    letterSpacing:  '0.07em',
                    paddingInline:  3,
                    marginBlockEnd: 6,
                  }}
                >
                  {TIER_LABELS[tier]}
                </p>
                <div
                  style={{
                    display:             'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(108px, 1fr))',
                    gap:                 4,
                  }}
                >
                  {tierEngines.map(engine => (
                    <EngineButton
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
              </div>
            );
          })}
        </div>

        {/* ── Launch CTA ───────────────────────────────────────────── */}
        <div
          style={{
            paddingInline:    12,
            paddingBlock:     12,
            borderBlockStart: '1px solid rgba(0,0,0,0.05)',
            flexShrink:       0,
          }}
        >
          <motion.button
            onClick={handleSearch}
            disabled={count === 0 || isSearching}
            whileHover={count > 0 && !isSearching ? { scale: 1.02, boxShadow: `0 8px 28px ${COLOR}4C` } : {}}
            whileTap={count > 0 && !isSearching ? { scale: 0.98 } : {}}
            animate={{ opacity: count > 0 ? 1 : 0.46 }}
            transition={SPRING}
            style={{
              width:          '100%',
              paddingBlock:   14,
              borderRadius:   14,
              fontSize:       13,
              fontWeight:     800,
              color:          'white',
              background:     count > 0 ? GRADIENT : 'rgba(0,0,0,0.12)',
              border:         'none',
              cursor:         count > 0 && !isSearching ? 'pointer' : 'default',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              gap:            8,
              boxShadow:      count > 0 ? `0 4px 18px ${COLOR}38` : 'none',
              letterSpacing:  '-0.01em',
              fontFamily:     'inherit',
              transition:     'background 0.25s ease',
            }}
          >
            {isSearching ? (
              <>
                <motion.span
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 0.85, repeat: Infinity, ease: 'linear' }}
                  style={{ display: 'inline-block', fontSize: 12 }}
                  aria-hidden
                >
                  ✦
                </motion.span>
                Scanning {count} engines…
              </>
            ) : count > 0 ? (
              <>
                <motion.span
                  animate={{ scale: [1, 1.5, 1], opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 1.6, repeat: Infinity }}
                  style={{ width: 7, height: 7, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', display: 'inline-block', flexShrink: 0 }}
                  aria-hidden
                />
                Search {count} engines →
              </>
            ) : (
              'Select engines to search'
            )}
          </motion.button>
        </div>
      </div>
    </motion.aside>
  );
}
