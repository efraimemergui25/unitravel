'use client';

import { useEffect, useState, useCallback, memo } from 'react';
import { motion, AnimatePresence }                 from 'framer-motion';
import { OmniAggregator }                          from '@/services/OmniAggregator';
import { distillDining }                           from '@/services/DiningDistillation';
import { TableSlotGrid }                           from '@/components/zones/TableSlotGrid';
import type { DiningEntity }                       from '@/types/dining';
import { useZoneStore }                            from '@/store/useZoneStore';

const COLOR  = '#FF9F0A';
const SPRING = { type: 'spring', stiffness: 420, damping: 28 } as const;

const cardBase: React.CSSProperties = {
  background:          'rgba(255,255,255,0.84)',
  backdropFilter:      'blur(32px) saturate(1.8)',
  WebkitBackdropFilter:'blur(32px) saturate(1.8)',
  borderRadius:        18,
  border:              '1px solid rgba(255,255,255,0.72)',
  boxShadow:           '0 2px 16px rgba(0,0,0,0.06), 0 1px 0 rgba(255,255,255,0.8) inset',
  padding:             16,
  overflow:            'hidden',
  position:            'relative',
};

// ── Michelin stars display ────────────────────────────────────────────────────

const MichelinStars = memo(({ stars }: { stars?: number }) => {
  if (!stars) return null;
  return (
    <span style={{ fontSize: 13, letterSpacing: 1 }}>
      {'★'.repeat(stars)}
      <span style={{ fontSize: 10, fontWeight: 700, color: '#E63946', marginLeft: 4 }}>Michelin</span>
    </span>
  );
});
MichelinStars.displayName = 'MichelinStars';

// ── Difficulty badge ──────────────────────────────────────────────────────────

const DIFF_STYLE = {
  easy:       { bg: 'rgba(48,209,88,0.12)',  fg: '#30D158', label: 'Easy booking'     },
  moderate:   { bg: 'rgba(255,159,10,0.12)', fg: '#FF9F0A', label: 'Book 2–3 weeks'   },
  hard:       { bg: 'rgba(255,69,58,0.12)',  fg: '#FF453A', label: 'Book 4–8 weeks'   },
  impossible: { bg: 'rgba(100,100,100,0.12)',fg: '#636366', label: 'Extremely limited' },
} as const;

// ── Hero card ─────────────────────────────────────────────────────────────────

const RestaurantHeroCard = memo(({ entity }: { entity: DiningEntity }) => {
  const confPct = Math.round(entity.aiConfidence * 100);
  const diff    = DIFF_STYLE[entity.reservationDifficulty];

  return (
    <div style={{ ...cardBase, gridArea: 'hero', display: 'flex', flexDirection: 'column', gap: 11 }}>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 20% 20%, ${COLOR}08 0%, transparent 55%)`, pointerEvents: 'none' }} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            {entity.michelinStars ? (
              <span style={{ color: '#E63946', fontSize: 14, letterSpacing: 1 }}>{'★'.repeat(entity.michelinStars)}</span>
            ) : null}
            {entity.bestIn50 && (
              <span style={{ fontSize: 9, fontWeight: 700, color: '#5E5CE6', background: 'rgba(94,92,230,0.1)', borderRadius: 5, paddingBlock: 2, paddingInline: 6 }}>
                #{entity.bestIn50} World&apos;s 50 Best
              </span>
            )}
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1C1C1E', letterSpacing: '-0.03em', margin: 0, lineHeight: 1.2 }}>
            {entity.name}
          </h3>
          <div style={{ fontSize: 11, color: '#8E8E93', fontWeight: 500, marginTop: 3 }}>
            {entity.cuisine} · 📍 {entity.location}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
          <div>
            <span style={{ fontSize: 22, fontWeight: 800, color: '#1C1C1E', letterSpacing: '-0.04em' }}>
              ${entity.pricePerPerson.toLocaleString()}
            </span>
            <span style={{ fontSize: 10, color: '#8E8E93' }}>/pp</span>
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#8E8E93' }}>★ {entity.rating.toFixed(2)}</span>
          <div style={{ fontSize: 9, fontWeight: 700, color: diff.fg, background: diff.bg, borderRadius: 6, paddingBlock: 2, paddingInline: 7 }}>
            {diff.label}
          </div>
        </div>
      </div>

      {/* AI confidence */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, height: 4, background: 'rgba(0,0,0,0.06)', borderRadius: 2 }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${confPct}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            style={{ height: '100%', borderRadius: 2, background: `linear-gradient(90deg, ${COLOR}, #FF6B6B)` }}
          />
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, color: COLOR }}>{confPct}% AI</span>
      </div>

      {/* Recommended day */}
      <div style={{ fontSize: 11, fontWeight: 600, color: '#5E5CE6' }}>
        ✦ Recommended: {entity.recommendedDay}
      </div>

      {/* AI highlight */}
      <p style={{ fontSize: 11, color: '#636366', lineHeight: 1.55, margin: 0, fontWeight: 500 }}>
        {entity.aiHighlight}
      </p>
    </div>
  );
});
RestaurantHeroCard.displayName = 'RestaurantHeroCard';

// ── Details card ──────────────────────────────────────────────────────────────

const RestaurantDetailsCard = memo(({ entity }: { entity: DiningEntity }) => (
  <div style={{ ...cardBase, gridArea: 'details', display: 'flex', flexDirection: 'column', gap: 10 }}>
    <div style={{ fontSize: 10, fontWeight: 700, color: '#8E8E93', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
      Essentials
    </div>

    {[
      ['Dress Code', entity.dressCode],
      ['Seating', entity.outdoorSeating ? 'Outdoor & Indoor' : 'Indoor only'],
      ['Reservation', entity.reservationWindow],
      ['Chef Table', entity.chefTable ? 'Available on request' : 'Not available'],
    ].map(([label, value]) => (
      <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#3C3C43' }}>{value}</span>
      </div>
    ))}

    <div style={{ height: 1, background: 'rgba(0,0,0,0.07)' }} />
    <div style={{ fontSize: 9, fontWeight: 700, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Wine Program</div>
    <p style={{ fontSize: 10, color: '#636366', lineHeight: 1.5, margin: 0 }}>{entity.wineProgram}</p>
  </div>
));
RestaurantDetailsCard.displayName = 'RestaurantDetailsCard';

// ── Slot card (wraps TableSlotGrid) ──────────────────────────────────────────

const SlotCard = memo(({ entity }: { entity: DiningEntity }) => (
  <div style={{ ...cardBase, gridArea: 'slots', padding: '14px 16px' }}>
    <TableSlotGrid engines={entity.engineAvailability} restaurantName={entity.name} />
  </div>
));
SlotCard.displayName = 'SlotCard';

// ── Meta card (awards) ────────────────────────────────────────────────────────

const MetaCard = memo(({ entity }: { entity: DiningEntity }) => (
  <div style={{ ...cardBase, gridArea: 'meta', display: 'flex', flexDirection: 'column', gap: 8 }}>
    <div style={{ fontSize: 10, fontWeight: 700, color: '#8E8E93', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
      Awards
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {entity.michelinStars && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: '#E63946', fontSize: 13 }}>{'★'.repeat(entity.michelinStars)}</span>
          <span style={{ fontSize: 10, fontWeight: 600, color: '#3C3C43' }}>Michelin {entity.michelinStars === 1 ? 'Star' : 'Stars'}</span>
        </div>
      )}
      {entity.bestIn50 && (
        <div style={{ fontSize: 10, fontWeight: 600, color: '#5E5CE6' }}>
          #{entity.bestIn50} World's 50 Best
        </div>
      )}
      <div style={{ fontSize: 10, color: '#8E8E93' }}>
        {entity.sourceCount} sources · ★ {entity.rating.toFixed(2)}
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {entity.tags.filter(Boolean).map(t => (
          <span key={t} style={{ fontSize: 9, fontWeight: 600, color: '#636366', background: 'rgba(0,0,0,0.05)', borderRadius: 5, paddingBlock: 2, paddingInline: 6 }}>
            {t}
          </span>
        ))}
      </div>
    </div>
  </div>
));
MetaCard.displayName = 'MetaCard';

// ── Uber card ─────────────────────────────────────────────────────────────────

const UberCard = memo(({ entity }: { entity: DiningEntity }) => (
  <div style={{ ...cardBase, gridArea: 'uber', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
    <div style={{ fontSize: 10, fontWeight: 700, color: '#8E8E93', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
      Transit
    </div>
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 28, marginBottom: 4 }}>🚗</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#1C1C1E', letterSpacing: '-0.03em' }}>
        {entity.uberMinutes} min
      </div>
      <div style={{ fontSize: 11, color: '#636366' }}>${entity.uberCost} Uber Black</div>
    </div>
    <div style={{ fontSize: 9, color: '#8E8E93', textAlign: 'center' }}>
      From your hotel · Estimated
    </div>
  </div>
));
UberCard.displayName = 'UberCard';

// ── Source card ───────────────────────────────────────────────────────────────

const SourceCard = memo(({ entity }: { entity: DiningEntity }) => {
  const compound = entity.sentiment.compound;
  const sentColor = compound > 0.5 ? '#30D158' : compound > 0 ? '#FF9F0A' : '#FF453A';

  return (
    <div style={{ ...cardBase, gridArea: 'source', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#8E8E93', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        Sentiment
      </div>
      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        {entity.sources.slice(0, 10).map(s => (
          <div key={s} title={s} style={{ width: 8, height: 8, borderRadius: '50%', background: `${sentColor}88`, flexShrink: 0 }} />
        ))}
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: sentColor }}>
        {Math.round(entity.sentiment.positive * 100)}% positive
      </div>
      <div style={{ fontSize: 9, color: '#8E8E93' }}>
        {entity.sourceCount} sources verified
      </div>
    </div>
  );
});
SourceCard.displayName = 'SourceCard';

// ── Bento grid ────────────────────────────────────────────────────────────────

const DiningBentoBox = memo(({ entity, index }: { entity: DiningEntity; index: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 24 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ ...SPRING, delay: index * 0.09 }}
    style={{
      display: 'grid',
      gridTemplateAreas: '"hero hero details" "slots slots slots" "meta uber source"',
      gridTemplateColumns: '1fr 1fr 1fr',
      gridTemplateRows:    'auto auto auto',
      gap: 10, width: '100%',
    }}
  >
    <RestaurantHeroCard    entity={entity} />
    <RestaurantDetailsCard entity={entity} />
    <SlotCard              entity={entity} />
    <MetaCard              entity={entity} />
    <UberCard              entity={entity} />
    <SourceCard            entity={entity} />
  </motion.div>
));
DiningBentoBox.displayName = 'DiningBentoBox';

// ── Idle ──────────────────────────────────────────────────────────────────────

const DiningZoneIdle = () => (
  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, opacity: 0.6 }}>
    <motion.div
      animate={{ y: [0, -5, 0] }}
      transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
      style={{ fontSize: 48 }}
    >
      🍽
    </motion.div>
    <div style={{ fontSize: 15, fontWeight: 700, color: '#3C3C43' }}>Culinary Hub</div>
    <div style={{ fontSize: 12, color: '#8E8E93', textAlign: 'center', maxWidth: 240 }}>
      Select engines to check live table availability across all platforms simultaneously
    </div>
    <div style={{ fontSize: 10, color: '#AEAEB2', background: 'rgba(0,0,0,0.04)', borderRadius: 7, paddingBlock: 4, paddingInline: 10, fontWeight: 600 }}>
      Ctrl ⇧ A
    </div>
  </div>
);

// ── Shimmer ───────────────────────────────────────────────────────────────────

const ShimmerBento = () => (
  <div style={{ display: 'grid', gridTemplateAreas: '"hero hero details" "slots slots slots" "meta uber source"', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
    {['hero','details','slots','meta','uber','source'].map(a => (
      <div key={a} style={{ ...cardBase, gridArea: a, minHeight: a === 'slots' ? 140 : a === 'hero' ? 160 : 90, background: 'rgba(0,0,0,0.04)' }}>
        <div className="shimmer-light" style={{ height: '100%', borderRadius: 10 }} />
      </div>
    ))}
  </div>
);

// ── DiningZone ────────────────────────────────────────────────────────────────

type Phase = 'idle' | 'loading' | 'results';

export function DiningZone() {
  const [phase,    setPhase]    = useState<Phase>('idle');
  const [entities, setEntities] = useState<DiningEntity[]>([]);
  const selectedIds = useZoneStore(s => s.selectedIds('dining'));

  const handleSearch = useCallback(async () => {
    setPhase('loading');
    const batch = await OmniAggregator.aggregate();
    setEntities(distillDining(batch.dining, selectedIds));
    setPhase('results');
  }, [selectedIds]);

  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent<{ zone: string }>).detail?.zone === 'dining') handleSearch();
    };
    window.addEventListener('unitravel:zone-search', handler);
    return () => window.removeEventListener('unitravel:zone-search', handler);
  }, [handleSearch]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <AnimatePresence mode="wait">
        {phase === 'idle' && (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ flex: 1, display: 'flex' }}>
            <DiningZoneIdle />
          </motion.div>
        )}
        {phase === 'loading' && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[0,1,2].map(i => <ShimmerBento key={i} />)}
          </motion.div>
        )}
        {phase === 'results' && entities.length > 0 && (
          <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={SPRING}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: COLOR }}>{entities.length} restaurants</span>
              <span style={{ fontSize: 11, color: '#8E8E93' }}>live table availability · AI-ranked</span>
            </motion.div>
            {entities.map((e, i) => <DiningBentoBox key={e.id} entity={e} index={i} />)}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
