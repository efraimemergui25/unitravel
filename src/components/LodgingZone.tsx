'use client';

import { useEffect, useState, useCallback, memo } from 'react';
import { motion, AnimatePresence }                 from 'framer-motion';
import { OmniAggregator }                          from '@/services/OmniAggregator';
import { distillLodging }                          from '@/services/LodgingDistillation';
import { SentimentGauge }                          from '@/components/zones/SentimentGauge';
import type { LodgingEntity, HiddenFee, PhotoSlide, LodgingSourcePrice } from '@/types/lodging';
import { useZoneStore }                            from '@/store/useZoneStore';

const COLOR  = '#00C7BE';
const SPRING = { type: 'spring', stiffness: 420, damping: 28 } as const;

// ── Shared card base ──────────────────────────────────────────────────────────

const cardBase: React.CSSProperties = {
  background:   'rgba(255,255,255,0.84)',
  backdropFilter: 'blur(32px) saturate(1.8)',
  WebkitBackdropFilter: 'blur(32px) saturate(1.8)',
  borderRadius: 18,
  border:       '1px solid rgba(255,255,255,0.72)',
  boxShadow:    '0 2px 16px rgba(0,0,0,0.06), 0 1px 0 rgba(255,255,255,0.8) inset',
  padding:      16,
  overflow:     'hidden',
  position:     'relative',
};

// ── Tier badge ────────────────────────────────────────────────────────────────

const TIER_STYLES: Record<string, { bg: string; fg: string }> = {
  'Ultra-Luxury': { bg: 'linear-gradient(135deg, #B8860B, #FFD700)', fg: '#fff' },
  '5★':           { bg: 'linear-gradient(135deg, #5E5CE6, #BF5AF2)', fg: '#fff' },
  '4★':           { bg: `linear-gradient(135deg, ${COLOR}, #007AFF)`, fg: '#fff' },
  '3★':           { bg: 'rgba(142,142,147,0.18)',                      fg: '#636366' },
};

const TierBadge = memo(({ tier }: { tier: string }) => {
  const s = TIER_STYLES[tier] ?? TIER_STYLES['3★'];
  return (
    <span style={{
      fontSize: 10, fontWeight: 800, color: s.fg,
      background: s.bg, borderRadius: 7,
      paddingBlock: 2, paddingInline: 8,
      letterSpacing: '-0.01em',
    }}>
      {tier}
    </span>
  );
});
TierBadge.displayName = 'TierBadge';

// ── Star rating ───────────────────────────────────────────────────────────────

const StarRating = memo(({ value }: { value: number }) => (
  <span style={{ fontSize: 11, fontWeight: 700, color: '#FF9F0A' }}>
    ★ {value.toFixed(2)}
  </span>
));
StarRating.displayName = 'StarRating';

// ── Hero Card ─────────────────────────────────────────────────────────────────

const HotelHeroCard = memo(({ entity }: { entity: LodgingEntity }) => {
  const confPct = Math.round(entity.aiConfidence * 100);
  const recColor = { 'book-now': '#30D158', compare: COLOR, watch: '#FF9F0A', skip: '#FF453A' }[entity.recommendation];
  const recLabel = { 'book-now': '↗ Book Now', compare: '⇄ Compare', watch: '👁 Watch', skip: '✕ Skip' }[entity.recommendation];

  return (
    <div style={{ ...cardBase, gridArea: 'hero', display: 'flex', flexDirection: 'column', gap: 11 }}>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 15% 20%, ${COLOR}09 0%, transparent 55%)`, pointerEvents: 'none' }} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <TierBadge tier={entity.tier} />
            <StarRating value={entity.rating} />
            <span style={{ fontSize: 9, color: '#8E8E93' }}>({entity.reviewCount.toLocaleString()})</span>
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1C1C1E', letterSpacing: '-0.03em', margin: 0, lineHeight: 1.2 }}>
            {entity.name}
          </h3>
          <span style={{ fontSize: 11, color: '#8E8E93', fontWeight: 500 }}>
            📍 {entity.location} · {entity.destination}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
          <div>
            <span style={{ fontSize: 22, fontWeight: 800, color: '#1C1C1E', letterSpacing: '-0.04em' }}>
              ${entity.pricePerNight.toLocaleString()}
            </span>
            <span style={{ fontSize: 11, color: '#8E8E93', fontWeight: 500 }}>/night</span>
          </div>
          <span style={{ fontSize: 11, color: '#636366' }}>{entity.nights} nights · {entity.roomType}</span>
          <span style={{
            fontSize: 10, fontWeight: 600, color: recColor,
            background: `${recColor}18`, border: `1px solid ${recColor}30`,
            borderRadius: 6, paddingBlock: 2, paddingInline: 7,
          }}>
            {recLabel}
          </span>
        </div>
      </div>

      {/* AI confidence */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, height: 4, background: 'rgba(0,0,0,0.06)', borderRadius: 2 }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${confPct}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            style={{ height: '100%', borderRadius: 2, background: `linear-gradient(90deg, ${COLOR}, #007AFF)` }}
          />
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, color: COLOR, minWidth: 38 }}>{confPct}% AI</span>
      </div>

      {/* AI highlight */}
      <p style={{ fontSize: 11, color: '#636366', lineHeight: 1.55, margin: 0, fontWeight: 500 }}>
        {entity.aiHighlight}
      </p>

      {/* Tags */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {entity.tags.map(tag => (
          <span key={tag} style={{ fontSize: 10, fontWeight: 600, color: '#3C3C43', background: 'rgba(0,0,0,0.05)', borderRadius: 5, paddingBlock: 2, paddingInline: 7 }}>
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
});
HotelHeroCard.displayName = 'HotelHeroCard';

// ── Trust Card ────────────────────────────────────────────────────────────────

const TrustCard = memo(({ entity }: { entity: LodgingEntity }) => (
  <div style={{ ...cardBase, gridArea: 'trust', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
    <div style={{ fontSize: 10, fontWeight: 700, color: '#8E8E93', letterSpacing: '0.05em', textTransform: 'uppercase', alignSelf: 'flex-start' }}>
      AI Sentiment Analysis
    </div>
    <SentimentGauge
      sentiment={entity.sentiment}
      trustScore={entity.trustScore}
      reviewCount={entity.reviewCount}
      sourceCount={entity.sourceCount}
    />
  </div>
));
TrustCard.displayName = 'TrustCard';

// ── Photo Carousel ────────────────────────────────────────────────────────────

const PhotoCarousel = memo(({ photos }: { photos: PhotoSlide[] }) => {
  const [current, setCurrent] = useState(0);
  const [dir, setDir] = useState(1);

  const go = (delta: number) => {
    setDir(delta);
    setCurrent(i => (i + delta + photos.length) % photos.length);
  };

  return (
    <div style={{ ...cardBase, gridArea: 'gallery', padding: 0, overflow: 'hidden', minHeight: 140 }}>
      {/* Photo slide */}
      <div style={{ position: 'relative', height: 140, overflow: 'hidden' }}>
        <AnimatePresence initial={false} custom={dir}>
          <motion.div
            key={current}
            custom={dir}
            variants={{
              enter:  (d: number) => ({ x: d * 60, opacity: 0 }),
              center: { x: 0, opacity: 1 },
              exit:   (d: number) => ({ x: d * -60, opacity: 0 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.32, ease: 'easeInOut' }}
            style={{ position: 'absolute', inset: 0, background: photos[current].gradient }}
          />
        </AnimatePresence>

        {/* Label pill */}
        <div style={{
          position: 'absolute', insetBlockEnd: 10, insetInlineStart: 12,
          background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(12px)',
          borderRadius: 9, paddingBlock: 4, paddingInline: 10,
          border: '1px solid rgba(255,255,255,0.15)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{photos[current].label}</div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.65)', fontWeight: 500 }}>{photos[current].sublabel}</div>
        </div>

        {/* Counter */}
        <div style={{
          position: 'absolute', insetBlockStart: 10, insetInlineEnd: 12,
          background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(8px)',
          borderRadius: 6, paddingBlock: 3, paddingInline: 8,
          fontSize: 9, fontWeight: 700, color: '#fff',
        }}>
          {current + 1} / {photos.length}
        </div>

        {/* Nav arrows */}
        {(['prev', 'next'] as const).map(d => (
          <button key={d}
            onClick={() => go(d === 'prev' ? -1 : 1)}
            style={{
              position: 'absolute', top: '50%', transform: 'translateY(-50%)',
              [d === 'prev' ? 'left' : 'right']: 10,
              width: 28, height: 28, borderRadius: '50%',
              background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff', fontSize: 12, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {d === 'prev' ? '‹' : '›'}
          </button>
        ))}
      </div>

      {/* Dot indicators */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 4, padding: '8px 0' }}>
        {photos.map((_, i) => (
          <button key={i}
            onClick={() => { setDir(i > current ? 1 : -1); setCurrent(i); }}
            style={{
              width: i === current ? 16 : 5, height: 5,
              borderRadius: 3, border: 'none', cursor: 'pointer',
              background: i === current ? COLOR : 'rgba(0,0,0,0.15)',
              transition: 'width 0.25s ease, background 0.2s',
              padding: 0,
            }}
          />
        ))}
      </div>
    </div>
  );
});
PhotoCarousel.displayName = 'PhotoCarousel';

// ── Amenity Card ──────────────────────────────────────────────────────────────

const AMENITY_ICONS: Record<string, string> = {
  'Spa': '💆', 'Pool': '🏊', 'Restaurant': '🍽', 'Beach': '🏖', 'Gym': '🏋',
  'Butler': '🤵', 'WiFi': '📶', 'Bar': '🍸', 'Concierge': '🎩', 'Transfer': '🚗',
  'Lounge': '🛋', 'Rooftop': '🌆', 'Yoga': '🧘', 'Tennis': '🎾', 'Golf': '⛳',
  'Cenote': '💧', 'Treehouse': '🌳', 'Dock': '⛵', 'Kids': '👶',
};

const amenityIcon = (name: string) => {
  for (const [k, v] of Object.entries(AMENITY_ICONS)) {
    if (name.toLowerCase().includes(k.toLowerCase())) return v;
  }
  return '✨';
};

const AmenityCard = memo(({ amenities }: { amenities: string[] }) => (
  <div style={{ ...cardBase, gridArea: 'amenity', display: 'flex', flexDirection: 'column', gap: 10 }}>
    <div style={{ fontSize: 10, fontWeight: 700, color: '#8E8E93', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
      Amenities
    </div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
      {amenities.map((a, i) => (
        <motion.div
          key={a}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ ...SPRING, delay: i * 0.04 }}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: `${COLOR}12`, border: `1px solid ${COLOR}28`,
            borderRadius: 8, paddingBlock: 4, paddingInline: 8,
            fontSize: 10, fontWeight: 600, color: '#1C1C1E',
          }}
        >
          <span style={{ fontSize: 11 }}>{amenityIcon(a)}</span>
          <span>{a}</span>
        </motion.div>
      ))}
    </div>
  </div>
));
AmenityCard.displayName = 'AmenityCard';

// ── Pricing Card ──────────────────────────────────────────────────────────────

const PricingCard = memo(({ entity }: { entity: LodgingEntity }) => {
  const estTax = Math.round(entity.totalPrice * 0.13);

  return (
    <div style={{ ...cardBase, gridArea: 'pricing', display: 'flex', flexDirection: 'column', gap: 9 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#8E8E93', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        Pricing Breakdown
      </div>

      {[
        [`$${entity.pricePerNight.toLocaleString()} × ${entity.nights} nights`, `$${entity.totalPrice.toLocaleString()}`, false],
        ['Est. taxes (13%)',                                                       `$${estTax.toLocaleString()}`,           false],
        ['Hidden fees (AI detected)',                                              `+$${entity.feeTotal.toLocaleString()}`, true],
      ].map(([label, val, warn]) => (
        <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: warn ? '#FF9F0A' : '#636366', fontWeight: warn ? 600 : 400 }}>{label}</span>
          <span style={{ fontSize: 11, color: warn ? '#FF9F0A' : '#3C3C43', fontWeight: 600 }}>{val}</span>
        </div>
      ))}

      <div style={{ height: 1, background: 'rgba(0,0,0,0.08)', marginBlock: 2 }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#1C1C1E' }}>Total (est.)</span>
        <span style={{ fontSize: 20, fontWeight: 800, color: '#1C1C1E', letterSpacing: '-0.03em' }}>
          ${(entity.totalPrice + estTax + entity.feeTotal).toLocaleString()}
        </span>
      </div>
      <div style={{ fontSize: 9, color: '#8E8E93' }}>
        ~${Math.round((entity.totalPrice + estTax + entity.feeTotal) / entity.nights / 2).toLocaleString()}/person/night
      </div>
    </div>
  );
});
PricingCard.displayName = 'PricingCard';

// ── Source Price Card ─────────────────────────────────────────────────────────

const SourcePriceCard = memo(({ prices }: { prices: LodgingSourcePrice[] }) => {
  const avail   = prices.filter(p => p.available);
  if (avail.length === 0) return null;
  const minPPN  = Math.min(...avail.map(p => p.pricePerNight));
  const maxPPN  = Math.max(...avail.map(p => p.pricePerNight));
  const range   = maxPPN - minPPN || 1;

  return (
    <div style={{ ...cardBase, gridArea: 'source', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#8E8E93', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        Price Comparison
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {avail.slice(0, 6).map(p => {
          const isBest = p.pricePerNight === minPPN;
          const barPct = ((p.pricePerNight - minPPN) / range) * 80 + 20;
          return (
            <div key={p.engineName} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 9, color: isBest ? COLOR : '#8E8E93', fontWeight: isBest ? 700 : 500, width: 80, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.engineName}
              </span>
              <div style={{ flex: 1, height: 4, background: 'rgba(0,0,0,0.06)', borderRadius: 2 }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${barPct}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  style={{ height: '100%', borderRadius: 2, background: isBest ? COLOR : 'rgba(0,0,0,0.20)' }}
                />
              </div>
              <span style={{ fontSize: 9, fontWeight: isBest ? 700 : 500, color: isBest ? COLOR : '#636366', width: 38, textAlign: 'right', flexShrink: 0 }}>
                ${p.pricePerNight.toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 9, color: '#8E8E93' }}>
        Best: ${minPPN.toLocaleString()}/night · {avail.length}/{prices.length} sources available
      </div>
    </div>
  );
});
SourcePriceCard.displayName = 'SourcePriceCard';

// ── Hidden Fees Card ──────────────────────────────────────────────────────────

const SEV_COLOR: Record<HiddenFee['severity'], string> = {
  high: '#FF453A', medium: '#FF9F0A', low: '#8E8E93',
};

const HiddenFeesCard = memo(({ fees, nights }: { fees: HiddenFee[]; nights: number }) => {
  const total = fees.reduce((s, f) => s + (f.perNight ? f.amount * nights : f.amount), 0);

  return (
    <div style={{ ...cardBase, gridArea: 'fees', display: 'flex', flexDirection: 'column', gap: 9 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#8E8E93', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Hidden Fees
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#FF9F0A', background: 'rgba(255,159,10,0.12)', borderRadius: 5, paddingBlock: 2, paddingInline: 6 }}>
          ⚠ {fees.length} found
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {fees.map((fee, i) => (
          <motion.div
            key={fee.name}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: i * 0.07 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 2 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: '#1C1C1E' }}>{fee.name}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: SEV_COLOR[fee.severity] }}>
                ${fee.amount}{fee.perNight ? '/night' : ''}
              </span>
            </div>
            <span style={{ fontSize: 8, color: '#AEAEB2' }}>
              Found on: {fee.sources.slice(0, 2).join(', ')}
            </span>
          </motion.div>
        ))}
      </div>

      <div style={{ height: 1, background: 'rgba(255,159,10,0.2)', marginBlock: 2 }} />

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, color: '#8E8E93', fontWeight: 500 }}>Total hidden ({nights}n)</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: '#FF9F0A' }}>+${total.toLocaleString()}</span>
      </div>
    </div>
  );
});
HiddenFeesCard.displayName = 'HiddenFeesCard';

// ── Bento Grid ────────────────────────────────────────────────────────────────

const LodgingBentoBox = memo(({ entity, index }: { entity: LodgingEntity; index: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 24 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ ...SPRING, delay: index * 0.09 }}
    style={{
      display: 'grid',
      gridTemplateAreas: '"hero    hero    trust  " "gallery gallery amenity" "pricing source  fees   "',
      gridTemplateColumns: '1fr 1fr 1fr',
      gridTemplateRows:    'auto auto auto',
      gap:  10,
      width: '100%',
    }}
  >
    <HotelHeroCard    entity={entity} />
    <TrustCard        entity={entity} />
    <PhotoCarousel    photos={entity.photos} />
    <AmenityCard      amenities={entity.amenities} />
    <PricingCard      entity={entity} />
    <SourcePriceCard  prices={entity.sourcePrices} />
    <HiddenFeesCard   fees={entity.hiddenFees} nights={entity.nights} />
  </motion.div>
));
LodgingBentoBox.displayName = 'LodgingBentoBox';

// ── Idle ──────────────────────────────────────────────────────────────────────

const LodgingZoneIdle = () => (
  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, opacity: 0.6 }}>
    <motion.div
      animate={{ y: [0, -6, 0] }}
      transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
      style={{ fontSize: 48 }}
    >
      🏨
    </motion.div>
    <div style={{ fontSize: 15, fontWeight: 700, color: '#3C3C43', letterSpacing: '-0.02em' }}>Hospitality Hub</div>
    <div style={{ fontSize: 12, color: '#8E8E93', textAlign: 'center', maxWidth: 240 }}>
      Select engines and press Omni-Search to distil AI-verified hotels, resorts & villas
    </div>
    <div style={{ fontSize: 10, color: '#AEAEB2', background: 'rgba(0,0,0,0.04)', borderRadius: 7, paddingBlock: 4, paddingInline: 10, fontWeight: 600 }}>
      Ctrl ⇧ A
    </div>
  </div>
);

// ── Shimmer ───────────────────────────────────────────────────────────────────

const ShimmerBento = () => (
  <div style={{ display: 'grid', gridTemplateAreas: '"hero hero trust" "gallery gallery amenity" "pricing source fees"', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
    {['hero', 'trust', 'gallery', 'amenity', 'pricing', 'source', 'fees'].map(a => (
      <div key={a} style={{ ...cardBase, gridArea: a, minHeight: a === 'hero' ? 180 : a === 'gallery' ? 160 : 100, background: 'rgba(0,0,0,0.04)' }}>
        <div className="shimmer-light" style={{ height: '100%', borderRadius: 10 }} />
      </div>
    ))}
  </div>
);

// ── LodgingZone ───────────────────────────────────────────────────────────────

type Phase = 'idle' | 'loading' | 'results';

export function LodgingZone() {
  const [phase,    setPhase]    = useState<Phase>('idle');
  const [entities, setEntities] = useState<LodgingEntity[]>([]);
  const selectedIds = useZoneStore(s => s.selectedIds('lodging'));

  const handleSearch = useCallback(async () => {
    setPhase('loading');
    const batch    = await OmniAggregator.aggregate();
    const filtered = batch.lodging.filter(h =>
      selectedIds.length === 0 ||
      h.sources.some(src => {
        const id = src.toLowerCase().replace(/[\s&.]/g, '-');
        return selectedIds.some(sel => id.includes(sel) || sel.includes(id.split('-')[0]));
      }),
    );
    setEntities(distillLodging(filtered.length ? filtered : batch.lodging));
    setPhase('results');
  }, [selectedIds]);

  useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ zone: string }>;
      if (ev.detail?.zone === 'lodging') handleSearch();
    };
    window.addEventListener('unitravel:zone-search', handler);
    return () => window.removeEventListener('unitravel:zone-search', handler);
  }, [handleSearch]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <AnimatePresence mode="wait">
        {phase === 'idle' && (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ flex: 1, display: 'flex' }}>
            <LodgingZoneIdle />
          </motion.div>
        )}

        {phase === 'loading' && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[0, 1, 2, 3].map(i => <ShimmerBento key={i} />)}
          </motion.div>
        )}

        {phase === 'results' && entities.length > 0 && (
          <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>

            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={SPRING}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: COLOR }}>{entities.length} properties distilled</span>
              <span style={{ fontSize: 11, color: '#8E8E93' }}>AI-ranked · hidden fees disclosed</span>
            </motion.div>

            {entities.map((entity, i) => (
              <LodgingBentoBox key={entity.id} entity={entity} index={i} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
