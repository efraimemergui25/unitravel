'use client';

import { useEffect, useState, useCallback, memo } from 'react';
import { motion, AnimatePresence }                 from 'framer-motion';
import { distillAttractions }                      from '@/services/AttractionsDistillation';
import { ExperienceCard }                          from '@/components/zones/ExperienceCard';
import type { AttractionEntity, ExperienceType }   from '@/types/attractions';
import { useZoneStore }                            from '@/store/useZoneStore';

const COLOR  = '#30D158';
const SPRING = { type: 'spring', stiffness: 420, damping: 28 } as const;

// ── Filter bar ────────────────────────────────────────────────────────────────

type FilterTab = 'all' | ExperienceType;

const FILTER_TABS: { id: FilterTab; label: string; icon: string }[] = [
  { id: 'all',       label: 'All',       icon: '✦' },
  { id: 'outdoor',   label: 'Outdoor',   icon: '🏖' },
  { id: 'cultural',  label: 'Cultural',  icon: '🏛' },
  { id: 'adventure', label: 'Adventure', icon: '⚡' },
  { id: 'culinary',  label: 'Culinary',  icon: '🍳' },
  { id: 'wellness',  label: 'Wellness',  icon: '🧘' },
];

const FilterBar = memo(function FilterBar({
  active, onChange, counts,
}: {
  active:   FilterTab;
  onChange: (t: FilterTab) => void;
  counts:   Record<string, number>;
}) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
      {FILTER_TABS.map(tab => {
        const isActive = tab.id === active;
        const count    = tab.id === 'all' ? Object.values(counts).reduce((a, b) => a + b, 0) : (counts[tab.id] ?? 0);
        return (
          <motion.button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            whileTap={{ scale: 0.95 }}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              paddingBlock: 5, paddingInline: 10,
              borderRadius: 9, border: `1px solid ${isActive ? `${COLOR}30` : 'transparent'}`,
              background: isActive ? `${COLOR}14` : 'rgba(0,0,0,0.04)',
              fontSize: 11, fontWeight: isActive ? 700 : 500,
              color: isActive ? COLOR : '#636366',
              cursor: 'pointer', transition: 'all 0.15s ease',
            }}
          >
            <span style={{ fontSize: 12 }}>{tab.icon}</span>
            {tab.label}
            {count > 0 && (
              <span style={{ fontSize: 9, fontWeight: 700, color: isActive ? COLOR : '#AEAEB2', background: isActive ? `${COLOR}18` : 'rgba(0,0,0,0.06)', borderRadius: 4, paddingBlock: 1, paddingInline: 4 }}>
                {count}
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
});

// ── Weather summary pill ──────────────────────────────────────────────────────

const WeatherSummary = memo(function WeatherSummary({ entities }: { entities: AttractionEntity[] }) {
  const perfect = entities.filter(e => e.weatherMatch?.quality === 'perfect').length;
  if (!perfect) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'linear-gradient(135deg, rgba(255,159,10,0.1), rgba(255,214,10,0.08))',
        border: '1px solid rgba(255,159,10,0.25)',
        borderRadius: 10, paddingBlock: 6, paddingInline: 12, marginBottom: 10,
      }}
    >
      <motion.span
        animate={{ rotate: 360 }}
        transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        style={{ fontSize: 12, display: 'inline-block' }}
      >
        ✦
      </motion.span>
      <span style={{ fontSize: 11, fontWeight: 600, color: '#FF9F0A' }}>
        {perfect} experience{perfect !== 1 ? 's' : ''} perfectly matched to your trip weather
      </span>
    </motion.div>
  );
});

// ── Empty filter state ────────────────────────────────────────────────────────

const EmptyFilter = memo(({ type }: { type: FilterTab }) => (
  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px 0', opacity: 0.5 }}>
    <div style={{ fontSize: 32, marginBottom: 8 }}>
      {FILTER_TABS.find(t => t.id === type)?.icon ?? '🎭'}
    </div>
    <div style={{ fontSize: 13, fontWeight: 600, color: '#3C3C43' }}>No {type} experiences</div>
    <div style={{ fontSize: 11, color: '#8E8E93' }}>Try selecting different engines</div>
  </div>
));

// ── Idle ──────────────────────────────────────────────────────────────────────

const AttractionsZoneIdle = () => (
  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, opacity: 0.6 }}>
    <motion.div
      animate={{ y: [0, -6, 0] }}
      transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
      style={{ fontSize: 48 }}
    >
      🎭
    </motion.div>
    <div style={{ fontSize: 15, fontWeight: 700, color: '#3C3C43' }}>Experiences Hub</div>
    <div style={{ fontSize: 12, color: '#8E8E93', textAlign: 'center', maxWidth: 240 }}>
      AI matches experiences to your trip's weather forecast and daily schedule
    </div>
    <div style={{ fontSize: 10, color: '#AEAEB2', background: 'rgba(0,0,0,0.04)', borderRadius: 7, paddingBlock: 4, paddingInline: 10, fontWeight: 600 }}>
      Ctrl ⇧ A
    </div>
  </div>
);

// ── Shimmer grid ──────────────────────────────────────────────────────────────

const ShimmerCard = memo(() => (
  <div style={{
    height: 220, borderRadius: 16, overflow: 'hidden',
    background: 'rgba(0,0,0,0.04)',
    border: '1px solid rgba(255,255,255,0.72)',
  }}>
    <div className="shimmer-light" style={{ height: '100%' }} />
  </div>
));
ShimmerCard.displayName = 'ShimmerCard';

// ── AttractionsZone ───────────────────────────────────────────────────────────

type Phase = 'idle' | 'loading' | 'results';

export function AttractionsZone() {
  const [phase,    setPhase]    = useState<Phase>('idle');
  const [entities, setEntities] = useState<AttractionEntity[]>([]);
  const [filter,   setFilter]   = useState<FilterTab>('all');
  const selectedIds = useZoneStore(s => s.selectedIds('attractions'));

  const handleSearch = useCallback(async () => {
    setPhase('loading');
    await new Promise(r => setTimeout(r, 1400)); // brief distillation pause
    setEntities(distillAttractions(selectedIds));
    setPhase('results');
  }, [selectedIds]);

  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent<{ zone: string }>).detail?.zone === 'attractions') handleSearch();
    };
    window.addEventListener('unitravel:zone-search', handler);
    return () => window.removeEventListener('unitravel:zone-search', handler);
  }, [handleSearch]);

  const filtered = filter === 'all' ? entities : entities.filter(e => e.type === filter);

  const counts = entities.reduce<Record<string, number>>((acc, e) => {
    acc[e.type] = (acc[e.type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <AnimatePresence mode="wait">
        {phase === 'idle' && (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ flex: 1, display: 'flex' }}>
            <AttractionsZoneIdle />
          </motion.div>
        )}

        {phase === 'loading' && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ height: 32, width: 240, borderRadius: 8, background: 'rgba(0,0,0,0.05)' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {Array.from({ length: 6 }).map((_, i) => <ShimmerCard key={i} />)}
            </div>
          </motion.div>
        )}

        {phase === 'results' && entities.length > 0 && (
          <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column' }}>

            {/* Header */}
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={SPRING}
              style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: COLOR }}>{entities.length} experiences distilled</span>
              <span style={{ fontSize: 11, color: '#8E8E93' }}>weather & schedule matched</span>
            </motion.div>

            {/* Weather summary */}
            <WeatherSummary entities={entities} />

            {/* Filter tabs */}
            <FilterBar active={filter} onChange={setFilter} counts={counts} />

            {/* Card grid */}
            <AnimatePresence mode="popLayout">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, flex: 1 }}>
                {filtered.length === 0
                  ? <EmptyFilter type={filter} />
                  : filtered.map((entity, i) => (
                      <ExperienceCard key={entity.id} entity={entity} index={i} />
                    ))
                }
              </div>
            </AnimatePresence>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
