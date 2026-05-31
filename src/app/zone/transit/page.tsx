'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TransitControl }    from '@/components/zones/TransitControl';
import { MultiModalGraph }   from '@/components/results/MultiModalGraph';
import { useTravelEngine }   from '@/store/useTravelEngine';
import { useLocaleEngine }   from '@/store/useLocaleEngine';
import { DEMO_TRANSIT_QUERIES } from '@/services/TransitDistillation';
import type { TransitQuery }    from '@/types/transit';

// ── Constants ─────────────────────────────────────────────────────────────────

const COLOR  = '#BF5AF2';
const SPRING = { type: 'spring', stiffness: 400, damping: 28 } as const;

type SearchState = 'idle' | 'loading' | 'results';

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TransitPage() {
  const [searchState,  setSearchState]  = useState<SearchState>('idle');
  const [engineCount,  setEngineCount]  = useState(0);
  const [scanProgress, setScanProgress] = useState(0);
  const [activeQuery,  setActiveQuery]  = useState(0);

  const { days, activeDay } = useTravelEngine(s => ({ days: s.days, activeDay: s.activeDay }));
  const { profile }         = useLocaleEngine();

  const isRtl            = profile.direction === 'rtl';
  const isHe             = profile.locale === 'he-IL';
  const uniqueDests       = [...new Set(days.map(d => d.destination))];
  const hasContext        = uniqueDests.length > 0;

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

    setTimeout(() => {
      clearInterval(interval);
      setScanProgress(100);
      setTimeout(() => setSearchState('results'), 240);
    }, 2800);
  }, []);

  // Use demo queries from TransitDistillation unless AI context provides real ones
  const queries = DEMO_TRANSIT_QUERIES ?? [];

  return (
    <div
      style={{
        display:    'flex',
        width:      '100%',
        height:     '100%',
        overflow:   'hidden',
        background: [
          `radial-gradient(ellipse at 0% 0%, ${COLOR}09 0%, transparent 52%)`,
          'radial-gradient(ellipse at 100% 100%, rgba(94,92,230,0.04) 0%, transparent 48%)',
          '#F2F2F7',
        ].join(', '),
        direction: isRtl ? 'rtl' : 'ltr',
      }}
    >
      {/* Mobility Console */}
      <TransitControl onSearch={handleSearch} isSearching={searchState === 'loading'} />

      {/* Right pane */}
      <div style={{
        flex: 1, minWidth: 0, display: 'flex',
        flexDirection: 'column', height: '100%', overflow: 'hidden',
      }}>
        {/* Query bar */}
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
              <RouteTag destinations={uniqueDests} />
              <div aria-hidden style={{ width: 1, height: 18, background: 'rgba(0,0,0,0.09)', marginInline: 2, flexShrink: 0 }} />
              <InfoChip icon="⚡" text={isHe ? 'ניטור עמלת שיא פעיל' : 'Live surge monitoring'} />
              <InfoChip icon="🗺" text={isHe ? 'ניתוב מולטי-מודאל' : 'Multi-modal routing'} />
            </>
          ) : (
            <EmptyContextHint isHe={isHe} />
          )}

          <div style={{ marginInlineStart: 'auto' }}>
            <AnimatePresence mode="wait">
              {searchState === 'loading' && (
                <ScanPill key="progress" progress={scanProgress} engineCount={engineCount} isHe={isHe} />
              )}
              {searchState === 'results' && (
                <motion.div
                  key="done"
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.85, opacity: 0 }}
                  transition={SPRING}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    paddingBlock: 6, paddingInline: 12,
                    borderRadius: 999, background: `${COLOR}12`,
                    border: `1.5px solid ${COLOR}30`,
                    fontSize: 11.5, fontWeight: 700, color: COLOR, flexShrink: 0,
                  }}
                >
                  <motion.span
                    animate={{ scale: [1, 1.35, 1] }}
                    transition={{ duration: 1.9, repeat: Infinity }}
                    style={{ width: 6, height: 6, borderRadius: '50%', background: COLOR, display: 'inline-block', flexShrink: 0 }}
                    aria-hidden
                  />
                  {isHe ? 'מסלולים מחושבים ומסונכרנים' : 'Routes distilled & surge-checked'}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Results area */}
        <div style={{
          flex: 1, minHeight: 0,
          overflowY: 'auto', overflowX: 'hidden',
          padding: '20px 22px 36px',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(0,0,0,0.12) transparent',
        }}>
          {searchState === 'idle' && (
            <IdleState hasContext={hasContext} isHe={isHe} />
          )}

          {searchState === 'loading' && (
            <LoadingState engineCount={engineCount} isHe={isHe} />
          )}

          {searchState === 'results' && queries.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
              {/* Query tabs */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(queries as TransitQuery[]).map((q, i) => (
                  <motion.button
                    key={q.id}
                    onClick={() => setActiveQuery(i)}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    style={{
                      display:        'flex',
                      alignItems:     'center',
                      gap:            6,
                      paddingBlock:   7,
                      paddingInline:  12,
                      borderRadius:   10,
                      border:         i === activeQuery ? `1.5px solid ${COLOR}50` : '1px solid rgba(0,0,0,0.08)',
                      background:     i === activeQuery ? `${COLOR}0E` : 'rgba(255,255,255,0.82)',
                      backdropFilter: 'blur(16px)',
                      cursor:         'pointer',
                      fontSize:       11,
                      fontWeight:     i === activeQuery ? 800 : 500,
                      color:          i === activeQuery ? COLOR : '#3C3C43',
                      fontFamily:     'inherit',
                      flexShrink:     0,
                    }}
                  >
                    <span>{q.icon}</span>
                    <span>{q.fromLabel.split(',')[0]} → {q.toLabel.split(',')[0]}</span>
                  </motion.button>
                ))}
              </div>

              {/* Active route comparison */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeQuery}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={SPRING}
                  style={{
                    background:           'rgba(255,255,255,0.72)',
                    backdropFilter:       'blur(32px) saturate(1.8)',
                    WebkitBackdropFilter: 'blur(32px) saturate(1.8)',
                    borderRadius:         18,
                    border:               '1px solid rgba(255,255,255,0.8)',
                    boxShadow:            '0 2px 20px rgba(0,0,0,0.06)',
                    padding:              '18px 20px',
                  }}
                >
                  {/* AI summary */}
                  <div style={{
                    display:       'flex',
                    gap:           8,
                    paddingBlock:  10,
                    paddingInline: 12,
                    borderRadius:  10,
                    background:    `${COLOR}08`,
                    border:        `1px solid ${COLOR}20`,
                    marginBottom:  16,
                  }}>
                    <span style={{ fontSize: 13, flexShrink: 0 }}>✦</span>
                    <span style={{
                      fontSize:      10.5,
                      fontWeight:    600,
                      color:         '#3C3C43',
                      lineHeight:    1.5,
                      letterSpacing: '-0.01em',
                    }}>
                      {queries[activeQuery]?.aiSummary}
                    </span>
                  </div>

                  <MultiModalGraph
                    options={queries[activeQuery]?.options ?? []}
                    fromLabel={queries[activeQuery]?.fromLabel ?? ''}
                    toLabel={queries[activeQuery]?.toLabel ?? ''}
                  />
                </motion.div>
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function RouteTag({ destinations }: { destinations: string[] }) {
  const label = destinations.length > 2
    ? `${destinations[0]} · +${destinations.length - 1} more`
    : destinations.join(' · ');
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      paddingBlock: 6, paddingInline: 10, borderRadius: 10,
      background: `${COLOR}0C`, border: `1px solid ${COLOR}20`, flexShrink: 0,
    }}>
      <span style={{ fontSize: 13 }} aria-hidden>🗺</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#1D1D1F', letterSpacing: '-0.01em' }}>
        {label}
      </span>
    </div>
  );
}

function InfoChip({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      paddingBlock: 5, paddingInline: 9, borderRadius: 8,
      background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.07)',
      fontSize: 11.5, fontWeight: 500, color: '#3C3C43',
      letterSpacing: '-0.01em', flexShrink: 0, whiteSpace: 'nowrap',
    }}>
      <span aria-hidden>{icon}</span>
      <span>{text}</span>
    </div>
  );
}

function EmptyContextHint({ isHe }: { isHe: boolean }) {
  return (
    <motion.div
      animate={{ opacity: [0.6, 1, 0.6] }}
      transition={{ duration: 2.4, repeat: Infinity }}
      style={{
        display: 'flex', alignItems: 'center', gap: 7,
        paddingBlock: 6, paddingInline: 12, borderRadius: 10,
        background: 'rgba(0,0,0,0.03)', border: '1px dashed rgba(0,0,0,0.12)',
        fontSize: 11, fontWeight: 500, color: '#AEAEB2',
      }}
    >
      <span>💬</span>
      <span>
        {isHe ? 'ספר לAI Concierge על היעד שלך כדי להתחיל' : 'Tell the AI Concierge your destination to begin'}
      </span>
    </motion.div>
  );
}

function IdleState({ hasContext, isHe }: { hasContext: boolean; isHe: boolean }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 16, height: '100%', minHeight: 280,
    }}>
      <motion.div
        animate={{ scale: [1, 1.06, 1], opacity: [0.55, 1, 0.55] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        style={{ fontSize: 44 }}
      >
        🗺
      </motion.div>
      <div style={{ textAlign: 'center', maxWidth: 280 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 6 }}>
          {isHe ? 'מוכן לתכנון תנועה' : 'Ready for routing'}
        </div>
        <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
          {isHe
            ? 'בחר מנועי ניידות ולחץ על חיפוש. AI ישווה אפשרויות, יזהה עמלת שיא ויגן מפני התנגשויות.'
            : 'Select mobility engines and hit Route — AI will compare options, detect surge pricing, and guard against timeline collisions.'}
        </div>
      </div>
    </div>
  );
}

function LoadingState({ engineCount, isHe }: { engineCount: number; isHe: boolean }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 14, height: '100%', minHeight: 280,
    }}>
      <motion.span
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
        style={{ fontSize: 32, display: 'inline-block' }}
      >
        ✦
      </motion.span>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
        {isHe ? `סורק ${engineCount} רשתות תנועה` : `Scanning ${engineCount} networks`}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 500, maxWidth: 240, textAlign: 'center', lineHeight: 1.5 }}>
        {isHe ? 'בודק עמלות שיא · מחשב מסלולים · בונה ציר זמן' : 'Checking surge · Calculating routes · Validating timeline'}
      </div>
    </div>
  );
}

function ScanPill({ progress, engineCount, isHe }: { progress: number; engineCount: number; isHe: boolean }) {
  const clamped = Math.min(100, Math.round(progress));
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={SPRING}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        paddingBlock: 7, paddingInline: 14,
        borderRadius: 999, background: `${COLOR}0D`,
        border: `1.5px solid ${COLOR}28`, flexShrink: 0,
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 160 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: COLOR, letterSpacing: '-0.01em' }}>
          {isHe ? `סורק ${engineCount} רשתות` : `Routing ${engineCount} networks`}
        </span>
        <div style={{ height: 3, borderRadius: 999, background: `${COLOR}1C`, overflow: 'hidden' }}>
          <motion.div
            animate={{ width: `${clamped}%` }}
            transition={{ ease: 'easeOut', duration: 0.28 }}
            style={{
              height: '100%',
              background: `linear-gradient(90deg, ${COLOR}, #5E5CE6)`,
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
