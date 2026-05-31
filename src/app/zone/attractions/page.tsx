'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AttractionsControl }  from '@/components/zones/AttractionsControl';
import { EffortFilter }        from '@/components/zones/EffortFilter';
import { AttractionsBento }    from '@/components/results/AttractionsBento';
import { useTravelEngine }     from '@/store/useTravelEngine';
import { useLocaleEngine }     from '@/store/useLocaleEngine';
import type { AttractionSearchState } from '@/components/results/AttractionsBento';
import type { EffortLevel }    from '@/components/zones/EffortFilter';

// ── Constants ─────────────────────────────────────────────────────────────────

const COLOR  = '#30D158';
const SPRING = { type: 'spring', stiffness: 400, damping: 28 } as const;

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AttractionsPage() {
  const [searchState,    setSearchState]    = useState<AttractionSearchState>('idle');
  const [engineCount,    setEngineCount]    = useState(0);
  const [scanProgress,   setScanProgress]   = useState(0);
  const [selectedEffort, setSelectedEffort] = useState<EffortLevel[]>([]);

  // Read dynamic trip context from store — never hardcode a destination
  const { days, activeDay } = useTravelEngine(s => ({ days: s.days, activeDay: s.activeDay }));
  const { profile }         = useLocaleEngine();

  // Derive destination from the active day, or from unique destinations in the trip
  const activeDestination = (() => {
    if (activeDay) {
      const day = days.find(d => d.id === activeDay);
      if (day) return day.destination;
    }
    const uniqueDests = [...new Set(days.map(d => d.destination))];
    return uniqueDests.length === 1 ? uniqueDests[0] : uniqueDests[0] ?? null;
  })();

  const uniqueDestinations = [...new Set(days.map(d => d.destination))];
  const hasContext         = uniqueDestinations.length > 0;

  const handleSearch = useCallback((engineIds: string[]) => {
    setEngineCount(engineIds.length);
    setSearchState('loading');
    setScanProgress(0);

    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 9 + 3;
      setScanProgress(Math.min(progress, 96));
      if (progress >= 96) clearInterval(interval);
    }, 80);

    // Experiences + weather sync — slightly longer than dining (weather API call)
    setTimeout(() => {
      clearInterval(interval);
      setScanProgress(100);
      setTimeout(() => setSearchState('results'), 240);
    }, 3100);
  }, []);

  const isRtl = profile.direction === 'rtl';

  return (
    <div
      style={{
        display:    'flex',
        width:      '100%',
        height:     '100%',
        overflow:   'hidden',
        background: [
          `radial-gradient(ellipse at 0% 0%, ${COLOR}09 0%, transparent 52%)`,
          'radial-gradient(ellipse at 100% 100%, rgba(0,199,190,0.04) 0%, transparent 48%)',
          '#F2F2F7',
        ].join(', '),
        direction: isRtl ? 'rtl' : 'ltr',
      }}
    >
      {/* ── Left: Attractions Control Console ─────────────── */}
      <AttractionsControl onSearch={handleSearch} isSearching={searchState === 'loading'} />

      {/* ── Right: Filters + Results ──────────────────────── */}
      <div
        style={{
          flex:          1,
          minWidth:      0,
          display:       'flex',
          flexDirection: 'column',
          height:        '100%',
          overflow:      'hidden',
        }}
      >
        {/* Query / context bar */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING, delay: 0.1 }}
          style={{
            display:              'flex',
            alignItems:           'center',
            gap:                  12,
            paddingInline:        22,
            paddingBlock:         12,
            borderBlockEnd:       '1px solid rgba(0,0,0,0.05)',
            background:           'rgba(255,255,255,0.72)',
            backdropFilter:       'blur(32px) saturate(1.8)',
            WebkitBackdropFilter: 'blur(32px) saturate(1.8)',
            flexShrink:           0,
            flexWrap:             'wrap',
            rowGap:               8,
          }}
        >
          {hasContext ? (
            <>
              {/* Destination pills — generated from store, never hardcoded */}
              <DestTag destinations={uniqueDestinations} />

              <div aria-hidden style={{
                width: 1, height: 18,
                background: 'rgba(0,0,0,0.09)',
                marginInline: 2, flexShrink: 0,
              }} />

              {/* Date range chip */}
              {days.length > 0 && (
                <InfoChip
                  icon="📅"
                  text={`${days[0].date} – ${days[days.length - 1].date}`}
                />
              )}

              {/* Weather sync chip */}
              <InfoChip icon="🌤" text="Live weather sync" />
            </>
          ) : (
            <EmptyContextHint />
          )}

          {/* Scan progress / status pill */}
          <div style={{ marginInlineStart: 'auto' }}>
            <AnimatePresence mode="wait">
              {searchState === 'loading' && (
                <ScanProgressPill
                  key="progress"
                  progress={scanProgress}
                  engineCount={engineCount}
                />
              )}
              {searchState === 'results' && (
                <motion.div
                  key="done"
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.85, opacity: 0 }}
                  transition={SPRING}
                  style={{
                    display:       'flex',
                    alignItems:    'center',
                    gap:           6,
                    paddingBlock:  6,
                    paddingInline: 12,
                    borderRadius:  999,
                    background:    `${COLOR}12`,
                    border:        `1.5px solid ${COLOR}30`,
                    fontSize:      11.5,
                    fontWeight:    700,
                    color:         COLOR,
                    flexShrink:    0,
                  }}
                >
                  <motion.span
                    animate={{ scale: [1, 1.35, 1] }}
                    transition={{ duration: 1.9, repeat: Infinity }}
                    style={{ width: 6, height: 6, borderRadius: '50%', background: COLOR, display: 'inline-block', flexShrink: 0 }}
                    aria-hidden
                  />
                  Weather-synced & deduplicated
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Effort filter bar */}
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
          style={{
            paddingInline:        20,
            paddingBlock:         10,
            background:           'rgba(255,255,255,0.72)',
            backdropFilter:       'blur(32px) saturate(1.9)',
            WebkitBackdropFilter: 'blur(32px) saturate(1.9)',
            borderBlockEnd:       '1px solid rgba(0,0,0,0.05)',
            flexShrink:           0,
          }}
        >
          <EffortFilter selected={selectedEffort} onChange={setSelectedEffort} />
        </motion.div>

        {/* Results area */}
        <div
          style={{
            flex:           1,
            minHeight:      0,
            overflowY:      'auto',
            overflowX:      'hidden',
            padding:        '20px 22px 36px',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(0,0,0,0.12) transparent',
          }}
        >
          <AttractionsBento
            searchState={searchState}
            engineCount={engineCount}
            destination={activeDestination ?? undefined}
          />
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function DestTag({ destinations }: { destinations: string[] }) {
  const label = destinations.length > 2
    ? `${destinations[0]} · +${destinations.length - 1} more`
    : destinations.join(' · ');

  return (
    <div style={{
      display:       'flex',
      alignItems:    'center',
      gap:           6,
      paddingBlock:  6,
      paddingInline: 10,
      borderRadius:  10,
      background:    `${COLOR}0C`,
      border:        `1px solid ${COLOR}20`,
      flexShrink:    0,
    }}>
      <span style={{ fontSize: 13 }} aria-hidden>🎭</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#1D1D1F', letterSpacing: '-0.01em' }}>
        {label}
      </span>
    </div>
  );
}

function InfoChip({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{
      display:       'flex',
      alignItems:    'center',
      gap:           5,
      paddingBlock:  5,
      paddingInline: 9,
      borderRadius:  8,
      background:    'rgba(0,0,0,0.04)',
      border:        '1px solid rgba(0,0,0,0.07)',
      fontSize:      11.5,
      fontWeight:    500,
      color:         '#3C3C43',
      letterSpacing: '-0.01em',
      flexShrink:    0,
      whiteSpace:    'nowrap',
    }}>
      <span aria-hidden>{icon}</span>
      <span>{text}</span>
    </div>
  );
}

function EmptyContextHint() {
  return (
    <motion.div
      animate={{ opacity: [0.6, 1, 0.6] }}
      transition={{ duration: 2.4, repeat: Infinity }}
      style={{
        display:       'flex',
        alignItems:    'center',
        gap:           7,
        paddingBlock:  6,
        paddingInline: 12,
        borderRadius:  10,
        background:    'rgba(0,0,0,0.03)',
        border:        '1px dashed rgba(0,0,0,0.12)',
        fontSize:      11, fontWeight: 500, color: '#AEAEB2',
      }}
    >
      <span>💬</span>
      <span>Tell the AI Concierge your destination to begin</span>
    </motion.div>
  );
}

function ScanProgressPill({ progress, engineCount }: { progress: number; engineCount: number }) {
  const clamped = Math.min(100, Math.round(progress));
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={SPRING}
      style={{
        display:       'flex',
        alignItems:    'center',
        gap:           10,
        paddingBlock:  7,
        paddingInline: 14,
        borderRadius:  999,
        background:    `${COLOR}0D`,
        border:        `1.5px solid ${COLOR}28`,
        flexShrink:    0,
      }}
    >
      <motion.span
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 0.85, repeat: Infinity, ease: 'linear' }}
        style={{ fontSize: 11, color: COLOR, display: 'inline-block' }}
        aria-hidden
      >
        ✦
      </motion.span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 158 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: COLOR, letterSpacing: '-0.01em' }}>
          Scanning {engineCount} experience networks
        </span>
        <div style={{ height: 3, borderRadius: 999, background: `${COLOR}1C`, overflow: 'hidden' }}>
          <motion.div
            animate={{ width: `${clamped}%` }}
            transition={{ ease: 'easeOut', duration: 0.28 }}
            style={{
              height:     '100%',
              background: `linear-gradient(90deg, ${COLOR}, #00C7BE)`,
              borderRadius: 999,
            }}
          />
        </div>
      </div>
      <span style={{ fontSize: 11, fontWeight: 800, color: COLOR, minWidth: 28, textAlign: 'end' }}>
        {clamped}%
      </span>
    </motion.div>
  );
}
