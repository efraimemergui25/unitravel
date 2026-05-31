'use client';

import { useEffect, useState, useCallback, memo } from 'react';
import { motion, AnimatePresence }                 from 'framer-motion';
import { OmniAggregator }                          from '@/services/OmniAggregator';
import { distill }                                 from '@/services/FlightDistillation';
import type { AviationEntity, LayoverCognitiveLoad, LuggagePolicy, CarbonData, PricePrediction } from '@/types/aviation';
import { useZoneStore }                            from '@/store/useZoneStore';

const SPRING     = { type: 'spring', stiffness: 420, damping: 28 } as const;
const SPRING_POP = { type: 'spring', stiffness: 460, damping: 22 } as const;
const COLOR      = '#007AFF';

// ── Sparkline ─────────────────────────────────────────────────────────────────

const Sparkline = memo(({ points, trend }: { points: number[]; trend: 'rising' | 'falling' | 'stable' }) => {
  const W = 120; const H = 36;
  const xs = points.map((_, i) => (i / (points.length - 1)) * W);
  const ys = points.map(p => H - p * H);

  const pathD = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  const areaD = `${pathD} L${W},${H} L0,${H} Z`;

  const trendColor = trend === 'falling' ? '#30D158' : trend === 'rising' ? '#FF453A' : '#FF9F0A';
  const gradId     = `spark-grad-${trend}`;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={trendColor} stopOpacity="0.28" />
          <stop offset="100%" stopColor={trendColor} stopOpacity="0"    />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${gradId})`} />
      <path d={pathD} stroke={trendColor} strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* Current price dot */}
      <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r={3} fill={trendColor} />
    </svg>
  );
});
Sparkline.displayName = 'Sparkline';

// ── CogLoadMeter (semicircle arc gauge) ───────────────────────────────────────

const CogLoadMeter = memo(({ score }: { score: number }) => {
  const R = 28; const CX = 36; const CY = 36;
  const circumference = Math.PI * R;
  const dashOffset    = circumference * (1 - score);

  const arcColor = score < 0.35 ? '#30D158' : score < 0.65 ? '#FF9F0A' : '#FF453A';
  const label    = score < 0.35 ? 'Relaxed' : score < 0.65 ? 'Moderate' : 'Stressful';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width={72} height={44} viewBox="0 0 72 44">
        {/* Track */}
        <path
          d={`M${CX - R},${CY} A${R},${R} 0 0,1 ${CX + R},${CY}`}
          fill="none"
          stroke="rgba(0,0,0,0.08)"
          strokeWidth={6}
          strokeLinecap="round"
        />
        {/* Value arc */}
        <path
          d={`M${CX - R},${CY} A${R},${R} 0 0,1 ${CX + R},${CY}`}
          fill="none"
          stroke={arcColor}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
        />
        {/* Score text */}
        <text x={CX} y={CY - 4} textAnchor="middle" fontSize={11} fontWeight={700} fill={arcColor}>
          {Math.round(score * 100)}
        </text>
      </svg>
      <span style={{ fontSize: 10, fontWeight: 600, color: arcColor, letterSpacing: '-0.01em' }}>{label}</span>
    </div>
  );
});
CogLoadMeter.displayName = 'CogLoadMeter';

// ── LuggageVisual (SVG suitcase to scale) ─────────────────────────────────────

const LuggageVisual = memo(({ policy }: { policy: LuggagePolicy }) => {
  const [L, W] = policy.checkedCm;
  const scale  = 32 / Math.max(L, W);
  const sw     = Math.round(W * scale);
  const sl     = Math.round(L * scale);
  const carry  = policy.carryOnCm;
  const cs     = 18 / Math.max(carry[0], carry[1]);
  const cw     = Math.round(carry[1] * cs);
  const cl     = Math.round(carry[0] * cs);

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
      {/* Checked bag */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        <svg width={sw + 6} height={sl + 14} viewBox={`0 0 ${sw + 6} ${sl + 14}`}>
          {/* Handle */}
          <rect x={sw / 2 - 5} y={0} width={10} height={7} rx={3} fill="none" stroke={COLOR} strokeWidth={1.5} />
          {/* Body */}
          <rect x={3} y={8} width={sw} height={sl} rx={3} fill={`${COLOR}18`} stroke={COLOR} strokeWidth={1.5} />
          {/* Center strip */}
          <line x1={3 + sw / 2} y1={8} x2={3 + sw / 2} y2={8 + sl} stroke={`${COLOR}55`} strokeWidth={1} strokeDasharray="3 2" />
          {/* Wheels */}
          <circle cx={3 + 6} cy={8 + sl - 2} r={2.5} fill={COLOR} />
          <circle cx={3 + sw - 6} cy={8 + sl - 2} r={2.5} fill={COLOR} />
        </svg>
        <span style={{ fontSize: 9, color: '#8E8E93', fontWeight: 600 }}>{policy.checkedKg}kg</span>
      </div>
      {/* Carry-on */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        <svg width={cw + 4} height={cl + 12} viewBox={`0 0 ${cw + 4} ${cl + 12}`}>
          <rect x={cw / 2 - 3} y={0} width={6} height={5} rx={2} fill="none" stroke="#30D158" strokeWidth={1.2} />
          <rect x={2} y={6} width={cw} height={cl} rx={2} fill="rgba(48,209,88,0.12)" stroke="#30D158" strokeWidth={1.2} />
        </svg>
        <span style={{ fontSize: 9, color: '#8E8E93', fontWeight: 600 }}>{policy.carryOnKg}kg</span>
      </div>
    </div>
  );
});
LuggageVisual.displayName = 'LuggageVisual';

// ── CarbonBar ─────────────────────────────────────────────────────────────────

const CarbonBar = memo(({ data }: { data: CarbonData }) => {
  const pct     = Math.min(1, data.vsAverageRoute);
  const overAvg = data.vsAverageRoute > 1;
  const color   = data.vsAverageRoute < 0.88 ? '#30D158' : data.vsAverageRoute < 1.05 ? '#FF9F0A' : '#FF453A';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* Bar track */}
      <div style={{ position: 'relative', height: 8, background: 'rgba(0,0,0,0.06)', borderRadius: 4 }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct * 100}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{ height: '100%', borderRadius: 4, background: color }}
        />
        {/* Average marker */}
        <div style={{ position: 'absolute', top: -2, left: `${(1 / 1.4) * 100}%`, width: 1.5, height: 12, background: 'rgba(0,0,0,0.25)', borderRadius: 1 }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color, fontWeight: 700 }}>
          {data.totalKg.toLocaleString()} kg CO₂
        </span>
        <span style={{ fontSize: 9, color: '#8E8E93', fontWeight: 500 }}>
          {overAvg ? '+' : ''}{Math.round((data.vsAverageRoute - 1) * 100)}% vs avg route
        </span>
      </div>
      <div style={{ fontSize: 9, color: '#AEAEB2', lineHeight: 1.4 }}>
        Offset: ${data.offsetUSD} via Atmosfair
      </div>
    </div>
  );
});
CarbonBar.displayName = 'CarbonBar';

// ── SourceDot matrix ──────────────────────────────────────────────────────────

const SourceMatrix = memo(({ matches, totalCount }: { matches: { engineName: string; price: number; available: boolean }[]; totalCount: number }) => {
  const available = matches.filter(m => m.available);
  const minPrice  = Math.min(...available.map(m => m.price));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        {matches.map(m => (
          <div
            key={m.engineName}
            title={`${m.engineName}: $${m.price.toLocaleString()}`}
            style={{
              width:        8, height: 8, borderRadius: '50%',
              background:   m.available
                ? m.price === minPrice ? COLOR : `${COLOR}66`
                : 'rgba(0,0,0,0.10)',
            }}
          />
        ))}
      </div>
      <span style={{ fontSize: 9, color: '#8E8E93', fontWeight: 500 }}>
        {available.length}/{totalCount} sources agree
      </span>
    </div>
  );
});
SourceMatrix.displayName = 'SourceMatrix';

// ── BENTO CARDS ───────────────────────────────────────────────────────────────

const cardBase: React.CSSProperties = {
  background:   'rgba(255,255,255,0.82)',
  backdropFilter: 'blur(32px) saturate(1.8)',
  WebkitBackdropFilter: 'blur(32px) saturate(1.8)',
  borderRadius: 18,
  border:       '1px solid rgba(255,255,255,0.72)',
  boxShadow:    '0 2px 16px rgba(0,0,0,0.06), 0 1px 0 rgba(255,255,255,0.8) inset',
  padding:      16,
  overflow:     'hidden',
  position:     'relative',
};

// Hero ─────────────────────────────────────────────────────────────────────────

const FlightHeroCard = memo(({ entity }: { entity: AviationEntity }) => {
  const confidencePct = Math.round(entity.aiConfidence * 100);
  const recColor = {
    'book-now': '#30D158',
    'wait':     '#FF9F0A',
    'watch':    COLOR,
    'skip':     '#FF453A',
  }[entity.recommendation];

  return (
    <div style={{ ...cardBase, gridArea: 'hero', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Ambient glow */}
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 20% 30%, ${COLOR}08 0%, transparent 60%)`, pointerEvents: 'none' }} />

      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: COLOR, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 2 }}>
            {entity.alliance}
          </div>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#1C1C1E', letterSpacing: '-0.03em', lineHeight: 1.2 }}>
            {entity.airline}
          </div>
          <div style={{ fontSize: 11, color: '#8E8E93', fontWeight: 500, marginTop: 2 }}>
            {entity.flightNumber}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#1C1C1E', letterSpacing: '-0.04em' }}>
            ${entity.price.toLocaleString()}
          </div>
          <div style={{ fontSize: 10, fontWeight: 600, color: recColor, background: `${recColor}18`, border: `1px solid ${recColor}30`, borderRadius: 6, paddingBlock: 2, paddingInline: 7 }}>
            {entity.recommendation === 'book-now' ? '↗ Book Now' : entity.recommendation === 'wait' ? '⏳ Wait' : entity.recommendation === 'watch' ? '👁 Watch' : '✕ Skip'}
          </div>
        </div>
      </div>

      {/* Route */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.04em', color: '#1C1C1E' }}>{entity.origin.iata}</div>
          <div style={{ fontSize: 10, color: '#8E8E93', fontWeight: 500 }}>{entity.origin.city}</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#3C3C43', marginTop: 2 }}>{entity.departure}</div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <div style={{ fontSize: 9, color: '#AEAEB2', fontWeight: 600 }}>{entity.durationLabel}</div>
          <div style={{ width: '100%', height: 1, background: 'rgba(0,0,0,0.12)', position: 'relative' }}>
            {entity.stops > 0 && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 5, height: 5, borderRadius: '50%', background: '#FF9F0A', border: '1.5px solid white' }} />}
          </div>
          <div style={{ fontSize: 9, color: '#AEAEB2', fontWeight: 500 }}>
            {entity.stops === 0 ? 'Non-stop' : `${entity.stops} stop`}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.04em', color: '#1C1C1E' }}>{entity.destination.iata}</div>
          <div style={{ fontSize: 10, color: '#8E8E93', fontWeight: 500 }}>{entity.destination.city}</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#3C3C43', marginTop: 2 }}>{entity.arrival}</div>
        </div>
      </div>

      {/* AI Confidence */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, height: 4, background: 'rgba(0,0,0,0.06)', borderRadius: 2 }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${confidencePct}%` }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            style={{ height: '100%', borderRadius: 2, background: `linear-gradient(90deg, ${COLOR}, #34C0FF)` }}
          />
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, color: COLOR, minWidth: 36 }}>{confidencePct}% AI</span>
      </div>

      {/* AI summary */}
      <p style={{ fontSize: 11, color: '#636366', lineHeight: 1.5, margin: 0, fontWeight: 500 }}>
        {entity.aiSummary}
      </p>

      {/* Tags */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {entity.tags.map(tag => (
          <span key={tag} style={{ fontSize: 10, fontWeight: 600, color: '#3C3C43', background: 'rgba(0,0,0,0.05)', borderRadius: 5, paddingBlock: 2, paddingInline: 7 }}>
            {tag}
          </span>
        ))}
        {entity.refundable && (
          <span style={{ fontSize: 10, fontWeight: 600, color: '#30D158', background: 'rgba(48,209,88,0.1)', borderRadius: 5, paddingBlock: 2, paddingInline: 7 }}>
            ✓ Refundable
          </span>
        )}
      </div>
    </div>
  );
});
FlightHeroCard.displayName = 'FlightHeroCard';

// Price Intel ──────────────────────────────────────────────────────────────────

const PriceIntelCard = memo(({ pred }: { pred: PricePrediction }) => (
  <div style={{ ...cardBase, gridArea: 'price', display: 'flex', flexDirection: 'column', gap: 10 }}>
    <div style={{ fontSize: 10, fontWeight: 700, color: '#8E8E93', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
      Price Intelligence
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1C1C1E' }}>${pred.currentPrice.toLocaleString()}</div>
        <div style={{ fontSize: 9, color: '#8E8E93' }}>${pred.priceRange[0].toLocaleString()} – ${pred.priceRange[1].toLocaleString()}</div>
      </div>
      <Sparkline points={pred.sparkline} trend={pred.trend} />
    </div>
    <div style={{ fontSize: 10, color: pred.trend === 'falling' ? '#30D158' : pred.trend === 'rising' ? '#FF453A' : '#FF9F0A', fontWeight: 600 }}>
      {pred.recommendAction}
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ flex: 1, height: 3, background: 'rgba(0,0,0,0.06)', borderRadius: 2 }}>
        <div style={{ height: '100%', borderRadius: 2, background: '#30D158', width: `${pred.dropProbability * 100}%` }} />
      </div>
      <span style={{ fontSize: 9, color: '#8E8E93', fontWeight: 600 }}>{Math.round(pred.dropProbability * 100)}% drop prob.</span>
    </div>
  </div>
));
PriceIntelCard.displayName = 'PriceIntelCard';

// Carbon ───────────────────────────────────────────────────────────────────────

const CarbonCard = memo(({ data }: { data: CarbonData }) => (
  <div style={{ ...cardBase, gridArea: 'carbon', display: 'flex', flexDirection: 'column', gap: 10 }}>
    <div style={{ fontSize: 10, fontWeight: 700, color: '#8E8E93', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
      Carbon Impact
    </div>
    <CarbonBar data={data} />
  </div>
));
CarbonCard.displayName = 'CarbonCard';

// Luggage ──────────────────────────────────────────────────────────────────────

const LuggageCard = memo(({ policy }: { policy: LuggagePolicy }) => (
  <div style={{ ...cardBase, gridArea: 'luggage', display: 'flex', flexDirection: 'column', gap: 10 }}>
    <div style={{ fontSize: 10, fontWeight: 700, color: '#8E8E93', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
      Baggage
    </div>
    <LuggageVisual policy={policy} />
    <div style={{ fontSize: 9, color: policy.included ? '#30D158' : '#FF9F0A', fontWeight: 600 }}>
      {policy.included ? '✓ Checked bag included' : `+$${policy.extraFeeUSD} per bag`}
    </div>
    <div style={{ fontSize: 9, color: '#AEAEB2' }}>
      {policy.checkedCm[0]}×{policy.checkedCm[1]}×{policy.checkedCm[2]} cm · {policy.checkedKg}kg max
    </div>
  </div>
));
LuggageCard.displayName = 'LuggageCard';

// Layover ──────────────────────────────────────────────────────────────────────

const LayoverCard = memo(({ load }: { load: LayoverCognitiveLoad | null }) => {
  if (!load) return (
    <div style={{ ...cardBase, gridArea: 'layover', display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center', alignItems: 'center' }}>
      <span style={{ fontSize: 22 }}>✈</span>
      <span style={{ fontSize: 10, fontWeight: 600, color: '#30D158' }}>Non-stop</span>
    </div>
  );

  return (
    <div style={{ ...cardBase, gridArea: 'layover', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#8E8E93', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        Layover Stress
      </div>
      <CogLoadMeter score={load.score} />
      <div style={{ fontSize: 9, color: '#636366', fontWeight: 500 }}>
        {load.airport.iata} · {Math.floor(load.durationMin / 60)}h{load.durationMin % 60}m
      </div>
      {load.factors.slice(0, 2).map(f => (
        <div key={f} style={{ fontSize: 9, color: '#8E8E93' }}>· {f}</div>
      ))}
    </div>
  );
});
LayoverCard.displayName = 'LayoverCard';

// Source Matrix ────────────────────────────────────────────────────────────────

const SourceMatrixCard = memo(({ entity }: { entity: AviationEntity }) => (
  <div style={{ ...cardBase, gridArea: 'source', display: 'flex', flexDirection: 'column', gap: 10 }}>
    <div style={{ fontSize: 10, fontWeight: 700, color: '#8E8E93', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
      Source Agreement
    </div>
    <SourceMatrix matches={entity.sourceMatches} totalCount={entity.sourceCount} />
    <div style={{ fontSize: 9, color: '#8E8E93' }}>
      Min price: ${Math.min(...entity.sourceMatches.filter(m => m.available).map(m => m.price)).toLocaleString()}
    </div>
  </div>
));
SourceMatrixCard.displayName = 'SourceMatrixCard';

// ── Bento Grid ────────────────────────────────────────────────────────────────

const FlightBentoBox = memo(({ entity, index }: { entity: AviationEntity; index: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 24 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ ...SPRING, delay: index * 0.08 }}
    style={{
      display: 'grid',
      gridTemplateAreas: '"hero hero price" "hero hero carbon" "luggage layover source"',
      gridTemplateColumns: '1fr 1fr 1fr',
      gridTemplateRows:    'auto auto auto',
      gap:     10,
      width:   '100%',
    }}
  >
    <FlightHeroCard    entity={entity} />
    <PriceIntelCard    pred={entity.pricePrediction} />
    <CarbonCard        data={entity.carbon} />
    <LuggageCard       policy={entity.luggage} />
    <LayoverCard       load={entity.layoverLoad} />
    <SourceMatrixCard  entity={entity} />
  </motion.div>
));
FlightBentoBox.displayName = 'FlightBentoBox';

// ── Idle State ────────────────────────────────────────────────────────────────

const FlightZoneIdle = () => (
  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, opacity: 0.6 }}>
    <motion.div
      animate={{ y: [0, -6, 0] }}
      transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
      style={{ fontSize: 48 }}
    >
      ✈️
    </motion.div>
    <div style={{ fontSize: 15, fontWeight: 700, color: '#3C3C43', letterSpacing: '-0.02em' }}>Aviation Hub</div>
    <div style={{ fontSize: 12, color: '#8E8E93', textAlign: 'center', maxWidth: 220 }}>
      Select engines and press Omni-Search to distil the best flights
    </div>
    <div style={{ fontSize: 10, color: '#AEAEB2', background: 'rgba(0,0,0,0.04)', borderRadius: 7, paddingBlock: 4, paddingInline: 10, fontWeight: 600 }}>
      Ctrl ⇧ A
    </div>
  </div>
);

// ── Shimmer ───────────────────────────────────────────────────────────────────

const ShimmerBento = () => (
  <div style={{ display: 'grid', gridTemplateAreas: '"hero hero price" "hero hero carbon" "luggage layover source"', gridTemplateColumns: '1fr 1fr 1fr', gridTemplateRows: 'auto auto auto', gap: 10, width: '100%' }}>
    {['hero', 'price', 'carbon', 'luggage', 'layover', 'source'].map(area => (
      <div key={area} style={{ ...cardBase, gridArea: area, minHeight: area === 'hero' ? 220 : 100, background: 'rgba(0,0,0,0.04)' }}>
        <div className="shimmer-light" style={{ height: '100%', borderRadius: 10 }} />
      </div>
    ))}
  </div>
);

// ── FlightZone ────────────────────────────────────────────────────────────────

type Phase = 'idle' | 'loading' | 'results';

export function FlightZone() {
  const [phase,    setPhase]    = useState<Phase>('idle');
  const [entities, setEntities] = useState<AviationEntity[]>([]);
  const selectedIds = useZoneStore(s => s.selectedIds('flights'));

  const handleSearch = useCallback(async () => {
    setPhase('loading');
    const batch = await OmniAggregator.aggregate();
    const distilled = distill(batch.flights, selectedIds);
    setEntities(distilled);
    setPhase('results');
  }, [selectedIds]);

  useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ zone: string }>;
      if (ev.detail?.zone === 'flights') handleSearch();
    };
    window.addEventListener('unitravel:zone-search', handler);
    return () => window.removeEventListener('unitravel:zone-search', handler);
  }, [handleSearch]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <AnimatePresence mode="wait">
        {phase === 'idle' && (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ flex: 1, display: 'flex' }}>
            <FlightZoneIdle />
          </motion.div>
        )}

        {phase === 'loading' && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[0, 1, 2].map(i => <ShimmerBento key={i} />)}
          </motion.div>
        )}

        {phase === 'results' && entities.length > 0 && (
          <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Results header */}
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={SPRING_POP}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: COLOR }}>
                {entities.length} routes distilled
              </span>
              <span style={{ fontSize: 11, color: '#8E8E93' }}>
                from {entities[0]?.sourceCount ?? 0} sources · AI ranked
              </span>
            </motion.div>

            {entities.map((entity, i) => (
              <FlightBentoBox key={entity.id} entity={entity} index={i} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
