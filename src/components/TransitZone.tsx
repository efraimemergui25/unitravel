'use client';

import { useEffect, useState, useCallback, memo } from 'react';
import { motion, AnimatePresence }                 from 'framer-motion';
import { TransitVisualizer }                       from '@/components/zones/TransitVisualizer';
import type { TransitQuery }                       from '@/types/transit';
import { useZoneStore }                            from '@/store/useZoneStore';

const COLOR  = '#007AFF';
const SPRING = { type: 'spring', stiffness: 420, damping: 28 } as const;

// ── Leg selector ──────────────────────────────────────────────────────────────

const LegTab = memo(function LegTab({
  query, isActive, onClick,
}: {
  query:    TransitQuery;
  isActive: boolean;
  onClick:  () => void;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      style={{
        display:      'flex',
        alignItems:   'center',
        gap:          6,
        paddingBlock: 7,
        paddingInline:11,
        borderRadius: 10,
        border:       `1px solid ${isActive ? `${COLOR}35` : 'transparent'}`,
        background:   isActive ? `${COLOR}12` : 'rgba(0,0,0,0.04)',
        cursor:       'pointer',
        flexShrink:   0,
        transition:   'all 0.15s ease',
      }}
    >
      <span style={{ fontSize: 13 }}>{query.icon}</span>
      <div style={{ textAlign: 'left' }}>
        <div style={{ fontSize: 9, fontWeight: 800, color: isActive ? COLOR : '#3C3C43', letterSpacing: '-0.01em' }}>
          {query.fromLabel.split(',')[0].split('(')[0].trim()}
        </div>
        <div style={{ fontSize: 8, color: isActive ? `${COLOR}90` : '#8E8E93' }}>
          → {query.toLabel.split(',')[0].trim()}
        </div>
      </div>
    </motion.button>
  );
});

// ── Route summary header ──────────────────────────────────────────────────────

const QueryHeader = memo(function QueryHeader({ query }: { query: TransitQuery }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING}
      style={{
        background:    'rgba(255,255,255,0.88)',
        backdropFilter:'blur(20px)',
        borderRadius:  14,
        border:        '1px solid rgba(255,255,255,0.72)',
        padding:       '12px 14px',
        marginBottom:  10,
      }}
    >
      {/* Route A→B */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 14 }}>{query.icon}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: '#1C1C1E', letterSpacing: '-0.02em' }}>
            {query.fromLabel}
          </span>
          <span style={{ fontSize: 12, color: COLOR, fontWeight: 700 }}>→</span>
          <span style={{ fontSize: 12, fontWeight: 800, color: '#1C1C1E', letterSpacing: '-0.02em' }}>
            {query.toLabel}
          </span>
          <span style={{ fontSize: 9, color: '#8E8E93', background: 'rgba(0,0,0,0.05)', borderRadius: 4, paddingBlock: 2, paddingInline: 5 }}>
            {query.distance}
          </span>
        </div>
      </div>

      {/* Trip context */}
      <div style={{
        fontSize: 10, color: '#636366', fontStyle: 'italic',
        paddingBlock: 6, paddingInline: 10,
        background: 'rgba(0,122,255,0.05)', borderRadius: 8,
        border: '1px solid rgba(0,122,255,0.1)',
        marginBottom: 6,
      }}>
        📅 {query.tripContext}
      </div>

      {/* AI summary */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
        <span style={{
          fontSize: 8, fontWeight: 800, color: COLOR,
          background: `${COLOR}14`, borderRadius: 4,
          paddingBlock: 2, paddingInline: 5,
          flexShrink: 0, marginTop: 1,
        }}>
          AI
        </span>
        <p style={{ fontSize: 10, color: '#636366', lineHeight: 1.45, margin: 0 }}>
          {query.aiSummary}
        </p>
      </div>
    </motion.div>
  );
});

// ── Shimmer cards ─────────────────────────────────────────────────────────────

const ShimmerRow = memo(() => (
  <div style={{
    height: 100, borderRadius: 14, overflow: 'hidden',
    background: 'rgba(0,0,0,0.04)',
    border: '1px solid rgba(255,255,255,0.72)',
  }}>
    <div className="shimmer-light" style={{ height: '100%' }} />
  </div>
));
ShimmerRow.displayName = 'ShimmerRow';

// ── Idle ──────────────────────────────────────────────────────────────────────

const TransitZoneIdle = () => (
  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, opacity: 0.6 }}>
    <motion.div
      animate={{ x: [0, 8, 0] }}
      transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
      style={{ fontSize: 48 }}
    >
      🗺
    </motion.div>
    <div style={{ fontSize: 15, fontWeight: 700, color: '#3C3C43' }}>Transit Planner</div>
    <div style={{ fontSize: 12, color: '#8E8E93', textAlign: 'center', maxWidth: 240 }}>
      AI compares every route across all transit engines for your 5 trip legs
    </div>
    <div style={{ fontSize: 10, color: '#AEAEB2', background: 'rgba(0,0,0,0.04)', borderRadius: 7, paddingBlock: 4, paddingInline: 10, fontWeight: 600 }}>
      Ctrl ⇧ T
    </div>
  </div>
);

// ── TransitZone ───────────────────────────────────────────────────────────────

type Phase = 'idle' | 'loading' | 'results';

export function TransitZone() {
  const [phase,      setPhase]      = useState<Phase>('idle');
  const [queries,    setQueries]    = useState<TransitQuery[]>([]);
  const [activeLeg,  setActiveLeg]  = useState(0);
  const [selectedIds, setSelectedIds] = useState<Record<string, string>>({});
  const engineIds = useZoneStore(s => s.selectedIds('transit'));

  const handleSearch = useCallback(async (origin?: string, destination?: string, adults = 2) => {
    if (!origin || !destination) {
      setPhase('idle');
      return;
    }
    setPhase('loading');
    try {
      const res = await fetch('/api/transit', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ origin, destination, adults, engines: engineIds }),
      });
      const data = await res.json() as { status: string; results: TransitQuery[] };
      if (data.status !== 'ok' || !data.results?.length) {
        setPhase('idle');
        return;
      }
      const preSelected: Record<string, string> = {};
      data.results.forEach(q => {
        const rec = q.options.find(o => o.isRecommended) ?? q.options[0];
        if (rec) preSelected[q.id] = rec.id;
      });
      setQueries(data.results);
      setSelectedIds(preSelected);
      setActiveLeg(0);
      setPhase('results');
    } catch {
      setPhase('idle');
    }
  }, [engineIds]);

  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent<{ zone: string }>).detail?.zone === 'transit') handleSearch();
    };
    window.addEventListener('unitravel:zone-search', handler);
    return () => window.removeEventListener('unitravel:zone-search', handler);
  }, [handleSearch]);

  const activeQuery = queries[activeLeg];

  const totalCost = queries.reduce((sum, q) => {
    const selId = selectedIds[q.id];
    const opt   = q.options.find(o => o.id === selId) ?? q.options[0];
    return sum + (opt?.totalCost ?? 0);
  }, 0);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <AnimatePresence mode="wait">

        {phase === 'idle' && (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ flex: 1, display: 'flex' }}>
            <TransitZoneIdle />
          </motion.div>
        )}

        {phase === 'loading' && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ height: 40, width: '100%', borderRadius: 12, background: 'rgba(0,0,0,0.05)' }} />
            {Array.from({ length: 4 }).map((_, i) => <ShimmerRow key={i} />)}
          </motion.div>
        )}

        {phase === 'results' && queries.length > 0 && (
          <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column' }}>

            {/* Header */}
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={SPRING}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: COLOR }}>
                {queries.length} trip legs analysed
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, color: '#8E8E93' }}>selection total</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#1C1C1E', letterSpacing: '-0.03em' }}>
                  MX${totalCost.toLocaleString()}
                </span>
              </div>
            </motion.div>

            {/* Leg tab strip */}
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, marginBottom: 10, scrollbarWidth: 'none' }}>
              {queries.map((q, i) => (
                <LegTab key={q.id} query={q} isActive={activeLeg === i} onClick={() => setActiveLeg(i)} />
              ))}
            </div>

            {/* Active query */}
            <AnimatePresence mode="wait">
              {activeQuery && (
                <motion.div key={activeQuery.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={SPRING}>
                  <QueryHeader query={activeQuery} />

                  {/* Route comparison */}
                  <TransitVisualizer
                    options={activeQuery.options}
                    selectedId={selectedIds[activeQuery.id] ?? null}
                    onSelect={id => setSelectedIds(prev => ({ ...prev, [activeQuery.id]: id }))}
                  />

                  {/* Selected route detail */}
                  {selectedIds[activeQuery.id] && (() => {
                    const sel = activeQuery.options.find(o => o.id === selectedIds[activeQuery.id]);
                    if (!sel) return null;
                    return (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ ...SPRING, delay: 0.15 }}
                        style={{
                          marginTop: 10,
                          background: 'rgba(255,255,255,0.7)',
                          backdropFilter: 'blur(20px)',
                          borderRadius: 12,
                          border: '1px solid rgba(0,122,255,0.15)',
                          padding: '10px 14px',
                        }}
                      >
                        <div style={{ fontSize: 10, fontWeight: 700, color: COLOR, marginBottom: 6 }}>
                          Segment breakdown — {sel.label}
                        </div>
                        {sel.segments.map((seg, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBlock: 3, borderBottom: i < sel.segments.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                            <span style={{ fontSize: 12 }}>{['🗺','TransitDistillation'].includes(seg.mode) ? '🗺' : seg.mode === 'flight' ? '✈' : seg.mode === 'train' ? '🚄' : seg.mode === 'bus' ? '🚌' : seg.mode === 'rideshare' ? '🚗' : seg.mode === 'car-rental' ? '🚙' : seg.mode === 'ferry' ? '⛴' : '🚶'}</span>
                            <span style={{ fontSize: 10, fontWeight: 600, color: '#1C1C1E', flex: 1 }}>{seg.label}</span>
                            {seg.departTime && <span style={{ fontSize: 9, color: '#8E8E93' }}>{seg.departTime}</span>}
                            {seg.departTime && seg.arriveTime && <span style={{ fontSize: 9, color: '#AEAEB2' }}>→</span>}
                            {seg.arriveTime && <span style={{ fontSize: 9, color: '#8E8E93' }}>{seg.arriveTime}</span>}
                            <span style={{ fontSize: 9, fontWeight: 700, color: '#1C1C1E' }}>
                              {seg.durationMin}m
                            </span>
                            {seg.cost > 0 && (
                              <span style={{ fontSize: 9, color: '#636366' }}>MX${seg.cost}</span>
                            )}
                          </div>
                        ))}
                      </motion.div>
                    );
                  })()}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
