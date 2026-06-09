'use client';

import { useState, useCallback, memo } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { ZONE_ENGINES, resolveStatus, type EngineStatus } from '@/lib/zoneEngines';

// ── Constants ─────────────────────────────────────────────────────────────────

type Mode = 'ai' | 'god';

const SPRING     = { type: 'spring', stiffness: 400, damping: 25 } as const;
const SPRING_POP = { type: 'spring', stiffness: 480, damping: 22 } as const;
const COLOR      = '#007AFF';
const GRADIENT   = 'linear-gradient(135deg, #007AFF 0%, #5E5CE6 100%)';

const AI_PICKS = new Set([
  'amadeus', 'google-flights', 'kayak', 'skyscanner', 'kiwi',
  'aeromexico', 'united', 'american', 'copa', 'latam', 'expedia-f',
]);

const ENGINES = ZONE_ENGINES['flights'];

// ── Mode toggle ───────────────────────────────────────────────────────────────

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <LayoutGroup id="avi-mode-strip">
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
                  layoutId="avi-mode-pill-strip"
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
              {m === 'ai' ? '✦ AI Pick' : '⚡ God Mode'}
            </motion.button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

// ── Status indicator ──────────────────────────────────────────────────────────

const STATUS_META: Record<EngineStatus, { dot: string; label: string; title: string }> = {
  'live':       { dot: '#30D158', label: 'Live',    title: 'Live — no API key needed'         },
  'needs-key':  { dot: '#FF9F0A', label: 'Key',     title: 'Requires API credentials to use'  },
  'aggregated': { dot: '#5AC8FA', label: 'Agg',     title: 'Aggregated via Amadeus GDS layer' },
  'ui-only':    { dot: '#C7C7CC', label: '',         title: 'UI chip — direct API coming soon' },
};

// ── Glass Pill engine button ───────────────────────────────────────────────────

const GlassPill = memo(function GlassPill({
  id, name, icon, status, isActive, isAIPick, onToggle,
}: {
  id: string; name: string; icon: string; status: EngineStatus;
  isActive: boolean; isAIPick: boolean;
  onToggle: () => void;
}) {
  const sm = STATUS_META[status];
  const isUiOnly = status === 'ui-only';

  return (
    <motion.button
      onClick={onToggle}
      aria-pressed={isActive}
      title={sm.title}
      whileHover={{ scale: 1.06, y: -1 }}
      whileTap={{ scale: 0.94 }}
      animate={isActive ? {
        boxShadow: `inset 0 0 10px rgba(255,255,255,0.8), 0 4px 14px rgba(0,122,255,0.16)`,
      } : {
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7)',
      }}
      transition={{ ...SPRING_POP, boxShadow: { duration: 0.18 } }}
      style={{
        display:          'flex',
        alignItems:       'center',
        gap:              5,
        padding:          '6px 11px 6px 9px',
        borderRadius:     100,
        border:           `1px solid ${isActive ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.56)'}`,
        background:       isActive ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.32)',
        backdropFilter:   'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        fontSize:         10.5,
        fontWeight:       isActive ? 700 : 500,
        color:            isActive ? COLOR : isUiOnly ? '#8E8E93' : '#3C3C43',
        cursor:           'pointer',
        fontFamily:       'inherit',
        userSelect:       'none',
        WebkitUserSelect: 'none',
        whiteSpace:       'nowrap',
        flexShrink:       0,
        opacity:          isUiOnly && !isActive ? 0.75 : 1,
      }}
    >
      {/* AI pick star */}
      {isAIPick && (
        <motion.span
          animate={{ color: isActive ? COLOR : 'rgba(174,174,178,0.7)', scale: isActive ? 1 : 0.8 }}
          transition={SPRING}
          style={{ fontSize: 7, lineHeight: 1, display: 'inline-block' }}
          aria-hidden
        >
          ✦
        </motion.span>
      )}

      {/* Engine icon */}
      <span style={{ fontSize: 12, lineHeight: 1 }} aria-hidden>{icon}</span>

      {/* Name */}
      <span>{name}</span>

      {/* Status dot — only show for non-ui-only */}
      {status !== 'ui-only' && (
        <span style={{
          width:        5,
          height:       5,
          borderRadius: '50%',
          background:   sm.dot,
          flexShrink:   0,
          boxShadow:    `0 0 5px ${sm.dot}88`,
        }} aria-hidden />
      )}

      {/* Active check */}
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
              background:     GRADIENT,
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              fontSize:       8,
              fontWeight:     900,
              color:          'white',
              flexShrink:     0,
              lineHeight:     1,
              boxShadow:      `0 2px 6px ${COLOR}44`,
            }}
          >
            ✓
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
});

// ── AviationControl — horizontal strip ───────────────────────────────────────

export interface AviationControlProps {
  onSearch:    (engineIds: string[]) => void;
  isSearching: boolean;
}

export function AviationControl({ onSearch, isSearching }: AviationControlProps) {
  const [mode,     setMode]     = useState<Mode>('ai');
  const [selected, setSelected] = useState<Set<string>>(new Set(AI_PICKS));

  const toggleEngine = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
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
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING, delay: 0.08 }}
      className="glass-panel mx-4 flex-shrink-0 overflow-hidden"
    >
      {/* ── Controls bar ────────────────────────────────────────── */}
      <div
        style={{
          display:        'flex',
          alignItems:     'center',
          gap:            8,
          paddingInline:  14,
          paddingBlock:   10,
          borderBlockEnd: '1px solid rgba(0,0,0,0.05)',
          flexWrap:       'wrap',
          rowGap:         8,
        }}
      >
        {/* Mode toggle */}
        <ModeToggle mode={mode} onChange={handleModeChange} />

        {/* Count badge */}
        <motion.div
          key={count}
          initial={{ scale: 0.82 }}
          animate={{ scale: 1 }}
          transition={SPRING_POP}
          aria-live="polite"
          style={{
            display:       'flex',
            alignItems:    'center',
            gap:           4,
            paddingBlock:  4,
            paddingInline: 9,
            borderRadius:  999,
            background:    count > 0 ? `${COLOR}14` : 'rgba(0,0,0,0.05)',
            border:        `1.5px solid ${count > 0 ? `${COLOR}40` : 'rgba(0,0,0,0.08)'}`,
            fontSize:      11,
            fontWeight:    800,
            color:         count > 0 ? COLOR : '#AEAEB2',
            flexShrink:    0,
          }}
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

        <div aria-hidden style={{ flex: 1 }} />

        {/* AI Pick shortcut */}
        <motion.button
          onClick={() => { setMode('ai'); setSelected(new Set(AI_PICKS)); }}
          whileHover={{ scale: 1.04, background: `${COLOR}10` }}
          whileTap={{ scale: 0.96 }}
          transition={SPRING}
          style={{
            paddingBlock:  6, paddingInline: 11, borderRadius: 8,
            fontSize: 11, fontWeight: 700, color: COLOR,
            background: `${COLOR}0A`, border: `1px solid ${COLOR}22`,
            cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0,
          }}
        >
          ✦ AI Pick
        </motion.button>

        {/* Omni-Search — all 30 */}
        <motion.button
          onClick={() => setSelected(new Set(ENGINES.map(e => e.id)))}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          transition={SPRING}
          style={{
            paddingBlock:  6, paddingInline: 11, borderRadius: 8,
            fontSize: 11, fontWeight: 700, color: '#3C3C43',
            background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.08)',
            cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0,
          }}
        >
          All 30
        </motion.button>

        {/* Clear */}
        <motion.button
          onClick={() => setSelected(new Set())}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          animate={{ color: count > 0 ? '#FF3B30' : '#AEAEB2', background: count > 0 ? 'rgba(255,59,48,0.07)' : 'rgba(0,0,0,0.04)' }}
          transition={SPRING}
          style={{
            paddingBlock:  6, paddingInline: 11, borderRadius: 8,
            fontSize: 11, fontWeight: 700,
            border: `1px solid ${count > 0 ? 'rgba(255,59,48,0.18)' : 'rgba(0,0,0,0.07)'}`,
            cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
          }}
        >
          Clear
        </motion.button>

        {/* ── Launch search ── */}
        <motion.button
          onClick={handleSearch}
          disabled={count === 0 || isSearching}
          whileHover={count > 0 && !isSearching ? { scale: 1.04, boxShadow: `0 6px 20px ${COLOR}44` } : {}}
          whileTap={count > 0 && !isSearching ? { scale: 0.97 } : {}}
          animate={{ opacity: count > 0 ? 1 : 0.42 }}
          transition={SPRING}
          style={{
            display:        'flex',
            alignItems:     'center',
            gap:            6,
            paddingBlock:   8,
            paddingInline:  18,
            borderRadius:   10,
            fontSize:       12,
            fontWeight:     800,
            color:          'white',
            background:     count > 0 ? GRADIENT : 'rgba(0,0,0,0.12)',
            border:         'none',
            cursor:         count > 0 && !isSearching ? 'pointer' : 'default',
            boxShadow:      count > 0 ? `0 3px 12px ${COLOR}38` : 'none',
            letterSpacing:  '-0.01em',
            fontFamily:     'inherit',
            flexShrink:     0,
            whiteSpace:     'nowrap',
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
              style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', display: 'inline-block', flexShrink: 0 }}
              aria-hidden
            />
          )}
          {isSearching ? `Scanning ${count}…` : `Search ${count} engines`}
        </motion.button>
      </div>

      {/* ── Glass pills strip ───────────────────────────────────── */}
      <div
        className="flex flex-row overflow-x-auto gap-2 no-scrollbar"
        style={{ paddingInline: 14, paddingBlock: 10 }}
        aria-label="Flight engine selector"
      >
        {ENGINES.map(engine => (
          <GlassPill
            key={engine.id}
            id={engine.id}
            name={engine.name}
            icon={engine.icon}
            status={resolveStatus(engine)}
            isActive={selected.has(engine.id)}
            isAIPick={AI_PICKS.has(engine.id)}
            onToggle={() => toggleEngine(engine.id)}
          />
        ))}
      </div>

      {/* Footer: AI caption + status legend */}
      <div style={{
        display:     'flex',
        alignItems:  'center',
        justifyContent: 'space-between',
        paddingInline: 14,
        paddingBlockEnd: 10,
        flexWrap:    'wrap',
        gap:         6,
      }}>
        <AnimatePresence mode="wait">
          {mode === 'ai' ? (
            <motion.p
              key="ai-cap"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ fontSize: 10, color: COLOR, fontWeight: 500, lineHeight: 1.6, margin: 0 }}
            >
              ✦ AI optimized: {AI_PICKS.size} engines for best global coverage.
            </motion.p>
          ) : (
            <motion.p
              key="god-cap"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ fontSize: 10, color: '#6E6E73', fontWeight: 500, lineHeight: 1.6, margin: 0 }}
            >
              {selected.size} of 30 engines active — search all simultaneously.
            </motion.p>
          )}
        </AnimatePresence>

        {/* Status legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
          {([
            { dot: '#FF9F0A', label: 'Needs key' },
            { dot: '#5AC8FA', label: 'Aggregated' },
          ] as { dot: string; label: string }[]).map(({ dot, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: dot, boxShadow: `0 0 4px ${dot}88` }} />
              <span style={{ fontSize: 9, fontWeight: 500, color: '#8E8E93', letterSpacing: '-0.005em' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
