'use client';

import { useState, useCallback }   from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LodgingControl }          from '@/components/zones/LodgingControl';
import { LodgingBento }            from '@/components/results/LodgingBento';
import type { LodgingSearchState } from '@/components/results/LodgingBento';

// ── Constants ─────────────────────────────────────────────────────────────────

const COLOR  = '#00C7BE';
const SPRING = { type: 'spring', stiffness: 400, damping: 28 } as const;

const QUERY = {
  destinations: 'Tulum · Riviera Maya · Cabo · CDMX',
  dates:        'Oct 1 – Oct 21, 2026',
  guests:       '2 Adults — Effi & Nofar',
  roomType:     'Luxury / Villa',
} as const;

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LodgingPage() {
  const [searchState,  setSearchState]  = useState<LodgingSearchState>('idle');
  const [engineCount,  setEngineCount]  = useState(0);
  const [scanProgress, setScanProgress] = useState(0);

  const handleSearch = useCallback((engineIds: string[]) => {
    setEngineCount(engineIds.length);
    setSearchState('loading');
    setScanProgress(0);

    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 11 + 3;
      setScanProgress(Math.min(progress, 96));
      if (progress >= 96) clearInterval(interval);
    }, 80);

    // Hospitality engines are slower — 2.4s scan
    setTimeout(() => {
      clearInterval(interval);
      setScanProgress(100);
      setTimeout(() => setSearchState('results'), 220);
    }, 2400);
  }, []);

  return (
    <div
      style={{
        display:    'flex',
        width:      '100%',
        height:     '100%',
        overflow:   'hidden',
        background: [
          `radial-gradient(ellipse at 0% 0%, ${COLOR}0A 0%, transparent 52%)`,
          'radial-gradient(ellipse at 100% 100%, rgba(255,149,0,0.04) 0%, transparent 48%)',
          '#F2F2F7',
        ].join(', '),
      }}
    >
      {/* ── Left: Lodging Control Console ───────────────────────────── */}
      <LodgingControl onSearch={handleSearch} isSearching={searchState === 'loading'} />

      {/* ── Right: Results workspace ─────────────────────────────────── */}
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
        {/* Query bar */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING, delay: 0.1 }}
          style={{
            display:              'flex',
            alignItems:           'center',
            gap:                  12,
            paddingInline:        24,
            paddingBlock:         13,
            borderBlockEnd:       '1px solid rgba(0,0,0,0.05)',
            background:           'rgba(255,255,255,0.72)',
            backdropFilter:       'blur(32px) saturate(1.8)',
            WebkitBackdropFilter: 'blur(32px) saturate(1.8)',
            flexShrink:           0,
            flexWrap:             'wrap',
            rowGap:               8,
          }}
        >
          <DestTag label={QUERY.destinations} />

          <div
            aria-hidden
            style={{ width: 1, height: 18, background: 'rgba(0,0,0,0.09)', marginInline: 2, flexShrink: 0 }}
          />

          <InfoChip icon="📅" text={QUERY.dates} />
          <InfoChip icon="👤" text={QUERY.guests} />
          <InfoChip icon="🏨" text={QUERY.roomType} />

          {/* Dynamic status pill — right side */}
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
                    style={{
                      width:        6,
                      height:       6,
                      borderRadius: '50%',
                      background:   COLOR,
                      display:      'inline-block',
                      flexShrink:   0,
                    }}
                    aria-hidden
                  />
                  AI aggregation complete
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Results area */}
        <div
          style={{
            flex:           1,
            minHeight:      0,
            overflowY:      'auto',
            overflowX:      'hidden',
            padding:        '20px 24px 32px',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(0,0,0,0.12) transparent',
          }}
        >
          <LodgingBento searchState={searchState} engineCount={engineCount} />
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function DestTag({ label }: { label: string }) {
  return (
    <div
      style={{
        display:       'flex',
        alignItems:    'center',
        gap:           6,
        paddingBlock:  6,
        paddingInline: 10,
        borderRadius:  10,
        background:    `${COLOR}0C`,
        border:        `1px solid ${COLOR}20`,
        flexShrink:    0,
      }}
    >
      <span style={{ fontSize: 13 }} aria-hidden>🌴</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#1D1D1F', letterSpacing: '-0.01em' }}>
        {label}
      </span>
    </div>
  );
}

function InfoChip({ icon, text }: { icon: string; text: string }) {
  return (
    <div
      style={{
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
      }}
    >
      <span aria-hidden>{icon}</span>
      <span>{text}</span>
    </div>
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 138 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: COLOR, letterSpacing: '-0.01em' }}>
          Scanning {engineCount} hospitality engines
        </span>
        <div
          style={{
            height:       3,
            borderRadius: 999,
            background:   `${COLOR}1C`,
            overflow:     'hidden',
          }}
        >
          <motion.div
            animate={{ width: `${clamped}%` }}
            transition={{ ease: 'easeOut', duration: 0.28 }}
            style={{
              height:       '100%',
              background:   `linear-gradient(90deg, ${COLOR}, #007AFF)`,
              borderRadius: 999,
            }}
          />
        </div>
      </div>

      <span
        style={{
          fontSize:    11,
          fontWeight:  800,
          color:       COLOR,
          minWidth:    28,
          textAlign:   'end',
        }}
      >
        {clamped}%
      </span>
    </motion.div>
  );
}
