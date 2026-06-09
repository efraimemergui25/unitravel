'use client';

import { useState, useEffect, useCallback, memo } from 'react';
import { motion, AnimatePresence }                  from 'framer-motion';
import { GripHorizontal }                           from 'lucide-react';
import { useTravelEngine }                          from '@/store/useTravelEngine';
import { useLocaleEngine }                          from '@/store/useLocaleEngine';
import type { RouteOption, TransitQuery, SurgeInfo } from '@/types/transit';
import type { AggregatedResult }                    from '@/services/OmniAggregator';

// ── Constants ─────────────────────────────────────────────────────────────────

const COLOR    = '#BF5AF2';
const GRADIENT = 'linear-gradient(135deg, #BF5AF2 0%, #5E5CE6 100%)';
const SPRING   = { type: 'spring', stiffness: 380, damping: 26 } as const;

const MODE_ICON: Record<string, string> = {
  train: '🚄', rideshare: '🚗', bus: '🚌', walk: '🚶',
  ferry: '⛴', 'car-rental': '🚙', shuttle: '🚐', flight: '✈',
};

const MODE_COLOR: Record<string, string> = {
  train: '#5E5CE6', rideshare: '#48484A', bus: '#FF9F0A',
  walk: '#8E8E93', ferry: '#00C7BE', 'car-rental': '#30D158',
  shuttle: '#FF6B35', flight: '#007AFF',
};

// ── Transit buffer check ──────────────────────────────────────────────────────
// Verifies a new transit entity won't overlap (±30 min) an existing entity.

interface BufferResult {
  safe:         boolean;
  conflictTitle?: string;
}

function checkTransitBuffer(
  entities: Array<{ title: string; time?: string; duration?: string }>,
  departHHMM: string,
  totalMin: number,
): BufferResult {
  const [h, m] = departHHMM.split(':').map(Number);
  const newStart = h * 60 + (m ?? 0);
  const newEnd   = newStart + totalMin;
  const BUFFER   = 30;

  for (const e of entities) {
    if (!e.time) continue;
    const [eh, em] = e.time.split(':').map(Number);
    const eStart   = eh * 60 + (em ?? 0);
    const dur      = e.duration ? parseInt(e.duration) * 60 : 60;
    const eEnd     = eStart + dur;

    if (!(newEnd + BUFFER <= eStart || newStart >= eEnd + BUFFER)) {
      return { safe: false, conflictTitle: e.title };
    }
  }
  return { safe: true };
}

// ── Surge warning badge ───────────────────────────────────────────────────────

const SurgeBadge = memo(function SurgeBadge({
  surge, isHe,
}: { surge: SurgeInfo; isHe: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.88, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={SPRING}
      className="bg-white/60 backdrop-blur-md border border-amber-200/70"
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '10px 14px', borderRadius: 14,
        boxShadow: '0 4px 24px rgba(255,159,10,0.22), inset 0 1px 0 rgba(255,255,255,0.9)',
      }}
    >
      <motion.span
        animate={{ opacity: [1, 0.4, 1] }}
        transition={{ duration: 1.3, repeat: Infinity }}
        style={{ fontSize: 18, flexShrink: 0, lineHeight: 1, marginBlockStart: 1 }}
      >
        ⚡
      </motion.span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 11, fontWeight: 800, color: '#92400E', letterSpacing: '-0.02em', marginBlockEnd: 3,
        }}>
          {isHe
            ? `תעריף שיא פעיל · ${surge.multiplier.toFixed(1)}x`
            : `Surge Pricing Active (${surge.multiplier.toFixed(1)}x)`}
        </div>
        {surge.alternativeLabel && surge.alternativeSavingsUSD !== undefined && (
          <div style={{ fontSize: 10, fontWeight: 600, color: '#1D4ED8', letterSpacing: '-0.01em', lineHeight: 1.5 }}>
            {isHe
              ? `AI ממליץ ${surge.alternativeLabel} לחיסכון של $${surge.alternativeSavingsUSD}`
              : `AI recommends taking the ${surge.alternativeLabel} to save $${surge.alternativeSavingsUSD}`}
          </div>
        )}
        {surge.estimatedMinutesUntilNormal !== undefined && (
          <div style={{ marginBlockStart: 4 }}>
            <span style={{
              fontSize: 9, fontWeight: 700, color: '#FF9F0A',
              background: 'rgba(255,159,10,0.10)', borderRadius: 5,
              paddingBlock: 2, paddingInline: 6,
            }}>
              ⏱ ~{surge.estimatedMinutesUntilNormal}min until normal
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
});

// ── Buffer conflict badge ─────────────────────────────────────────────────────

function BufferConflictBadge({ conflictTitle, isHe }: { conflictTitle: string; isHe: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white/60 backdrop-blur-md border border-red-200/60"
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px', borderRadius: 12,
        boxShadow: '0 2px 12px rgba(255,69,58,0.15)',
      }}
    >
      <span style={{ fontSize: 14 }}>⚠️</span>
      <span style={{ fontSize: 10, fontWeight: 700, color: '#DC2626', letterSpacing: '-0.01em' }}>
        {isHe
          ? `התנגשות עם "${conflictTitle}" · נדרש מרווח 30 דק׳`
          : `30-min buffer conflict with "${conflictTitle}"`}
      </span>
    </motion.div>
  );
}

// ── Segment chip row ──────────────────────────────────────────────────────────

function SegmentChips({ option }: { option: RouteOption }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
      {option.segments.map((seg, i) => {
        const color = MODE_COLOR[seg.mode] ?? '#8E8E93';
        const icon  = MODE_ICON[seg.mode] ?? '•';
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 4,
              paddingBlock: 3, paddingInline: 8, borderRadius: 20,
              background: `${color}14`, border: `1px solid ${color}30`,
              fontSize: 9.5, fontWeight: 700, color,
            }}>
              <span style={{ fontSize: 11 }}>{icon}</span>
              <span>{seg.label.split('(')[0].trim()}</span>
              <span style={{ opacity: 0.7 }}>
                {seg.durationMin < 60 ? `${seg.durationMin}m` : `${Math.floor(seg.durationMin / 60)}h${seg.durationMin % 60 > 0 ? ` ${seg.durationMin % 60}m` : ''}`}
              </span>
            </div>
            {i < option.segments.length - 1 && (
              <span style={{ fontSize: 8, color: '#AEAEB2', flexShrink: 0 }}>→</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Stat pill ─────────────────────────────────────────────────────────────────

function StatPill({ icon, value, label, color = '#3C3C43' }: {
  icon: string; value: string; label: string; color?: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 52 }}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      <span style={{ fontSize: 12, fontWeight: 800, color, letterSpacing: '-0.02em' }}>{value}</span>
      <span style={{ fontSize: 8, fontWeight: 500, color: '#AEAEB2', letterSpacing: '-0.01em' }}>{label}</span>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface TransitBentoProps {
  option:      RouteOption;
  query:       TransitQuery;
  destination?: string;
}

// ── Main export ───────────────────────────────────────────────────────────────

export const TransitBento = memo(function TransitBento({
  option, query, destination,
}: TransitBentoProps) {
  const { profile } = useLocaleEngine();
  const isHe  = profile.locale === 'he-IL';
  const isRtl = profile.direction === 'rtl';

  const days        = useTravelEngine(s => s.days);
  const placeEntity = useTravelEngine(s => s.placeEntity);

  const [liveSurge,    setLiveSurge]    = useState<SurgeInfo | null>(option.surgeInfo ?? null);
  const [bufferResult, setBufferResult] = useState<BufferResult | null>(null);
  const [isDragging,   setIsDragging]   = useState(false);
  const [addedToTrip,  setAddedToTrip]  = useState(false);

  // Poll live surge if this option has a rideshare segment
  useEffect(() => {
    const hasRideshare = option.segments.some(s => s.mode === 'rideshare');
    if (!hasRideshare) return;

    const controller = new AbortController();
    (async () => {
      try {
        const params = new URLSearchParams({
          providers:   'uber,lyft',
          startLat:    '0', startLon: '0',
          endLat:      '0', endLon:   '0',
        });
        const res  = await fetch(`/api/transit/surge?${params}`, { signal: controller.signal });
        if (!res.ok) return;
        const data = await res.json() as {
          surgeDetected: boolean;
          maxMultiplier: number;
          providers: SurgeInfo[];
          aiSuggestion: string | null;
        };
        if (data.surgeDetected) {
          const worst = data.providers.reduce((a, b) => (b.multiplier > a.multiplier ? b : a), data.providers[0]);
          if (worst) setLiveSurge(worst);
        }
      } catch {
        // Surge polling is best-effort
      }
    })();
    return () => controller.abort();
  }, [option]);

  const hasSurge = (liveSurge?.active && (liveSurge.multiplier ?? 0) >= 1.5) ?? false;

  const handleAddToTrip = useCallback(() => {
    const targetDay = days.find(d =>
      d.destination.toLowerCase() === (destination ?? '').toLowerCase()
    ) ?? days[0];
    if (!targetDay) return;

    // Determine depart time from first segment
    const departTime = option.segments[0]?.departTime ?? '10:00';

    // TransitBuffer check
    const check = checkTransitBuffer(targetDay.entities, departTime, option.totalMin);
    setBufferResult(check);
    if (!check.safe) return;

    const aggregated: AggregatedResult = {
      id:           `transit-${option.id}`,
      category:     'activity' as const,
      sources:      option.segments.map(s => s.provider),
      sourceCount:  option.segments.length,
      aiConfidence: option.isRecommended ? 0.95 : 0.80,
      title:        option.label,
      location:     query.toLabel,
      destination:  destination ?? query.toLabel,
      type:         option.segments[0]?.mode ?? 'transit',
      durationHours: Math.round(option.totalMin / 60 * 10) / 10,
      pricePerPerson: option.totalCost,
      rating:        option.comfort * 2,
      difficulty:    'easy',
      bestTimeOfDay: parseInt(departTime.split(':')[0] ?? '10') < 12 ? 'morning' : 'afternoon',
      aiHighlight:   query.aiSummary,
      tags:          option.tags,
    };

    placeEntity(targetDay.id, aggregated);
    setAddedToTrip(true);
    setTimeout(() => setAddedToTrip(false), 2400);
  }, [days, destination, option, query, placeEntity]);

  const totalHours = Math.floor(option.totalMin / 60);
  const totalMins  = option.totalMin % 60;
  const durationLabel = totalHours > 0
    ? `${totalHours}h ${totalMins > 0 ? `${totalMins}m` : ''}`.trim()
    : `${totalMins}m`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...SPRING, delay: 0.1 }}
      drag
      dragElastic={0.14}
      dragMomentum={false}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={() => {
        setIsDragging(false);
        handleAddToTrip();
      }}
      style={{
        position:             'relative',
        background:           'rgba(255,255,255,0.40)',
        backdropFilter:       'blur(40px) saturate(1.9)',
        WebkitBackdropFilter: 'blur(40px) saturate(1.9)',
        border:               `1.5px solid ${hasSurge ? 'rgba(255,159,10,0.40)' : 'rgba(255,255,255,0.70)'}`,
        borderRadius:         28,
        boxShadow:            hasSurge
          ? '0 8px 32px rgba(255,159,10,0.14), inset 0 1px 0 rgba(255,255,255,1)'
          : '0 8px 32px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,1)',
        padding:              '20px 20px 18px',
        direction:            isRtl ? 'rtl' : 'ltr',
        cursor:               isDragging ? 'grabbing' : 'default',
        overflow:             'hidden',
      }}
    >
      {/* Gradient sweep */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0,
        background: hasSurge
          ? 'radial-gradient(ellipse at 80% 20%, rgba(255,159,10,0.06) 0%, transparent 60%)'
          : `radial-gradient(ellipse at 80% 20%, ${COLOR}08 0%, transparent 60%)`,
        pointerEvents: 'none', borderRadius: 'inherit',
      }} />

      {/* Grip handle — absolute top-right */}
      <motion.div
        whileHover={{ scale: 1.2, opacity: 1 }}
        style={{
          position:             'absolute',
          insetBlockStart:      10,
          insetInlineEnd:       14,
          zIndex:               10,
          background:           'rgba(255,255,255,0.55)',
          backdropFilter:       'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border:               '1px solid rgba(0,0,0,0.07)',
          borderRadius:         8,
          padding:              '4px 6px',
          cursor:               'grab',
          display:              'flex',
          alignItems:           'center',
          opacity:              0.65,
        }}
        title={isHe ? 'גרור לציר הזמן' : 'Drag to timeline'}
      >
        <GripHorizontal size={13} color="#6E6E73" />
      </motion.div>

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBlockEnd: 14 }}>
        {/* Mode icon + label */}
        <div style={{
          width: 44, height: 44, borderRadius: 13,
          background: GRADIENT, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, boxShadow: `0 4px 14px ${COLOR}3C`,
        }}>
          {MODE_ICON[option.segments[0]?.mode ?? 'train'] ?? '🗺'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 15, fontWeight: 900, color: 'var(--text-primary)',
            letterSpacing: '-0.03em', lineHeight: 1.2, marginBlockEnd: 4,
          }}>
            {option.label}
          </div>
          <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-secondary)', letterSpacing: '-0.01em' }}>
            {query.fromLabel.split(',')[0]} → {query.toLabel.split(',')[0]}
          </div>
        </div>

        {/* AI badge */}
        {option.isRecommended && (
          <div style={{
            paddingBlock: 4, paddingInline: 10,
            borderRadius: 8, background: 'rgba(0,122,255,0.10)',
            border: '1px solid rgba(0,122,255,0.20)',
            fontSize: 9, fontWeight: 800, color: '#007AFF',
            flexShrink: 0, alignSelf: 'flex-start',
          }}>
            ★ AI Pick
          </div>
        )}
        {option.isFastest && !option.isRecommended && (
          <div style={{
            paddingBlock: 4, paddingInline: 10,
            borderRadius: 8, background: 'rgba(48,209,88,0.10)',
            border: '1px solid rgba(48,209,88,0.22)',
            fontSize: 9, fontWeight: 800, color: '#30D158',
            flexShrink: 0, alignSelf: 'flex-start',
          }}>
            ⚡ Fastest
          </div>
        )}
      </div>

      {/* Segment chips */}
      <div style={{ marginBlockEnd: 14 }}>
        <SegmentChips option={option} />
      </div>

      {/* Stats row */}
      <div style={{
        display: 'flex', gap: 0,
        background: 'rgba(0,0,0,0.03)', borderRadius: 16,
        border: '1px solid rgba(0,0,0,0.05)',
        padding: '10px 8px', marginBlockEnd: hasSurge ? 14 : 0,
        justifyContent: 'space-around',
      }}>
        <StatPill icon="⏱" value={durationLabel} label={isHe ? 'משך' : 'Duration'} color={COLOR} />
        <div style={{ width: 1, background: 'rgba(0,0,0,0.07)', alignSelf: 'stretch' }} aria-hidden />
        <StatPill
          icon="💳"
          value={option.totalCost === 0 ? (isHe ? 'חינם' : 'Free') : `$${option.totalCost}`}
          label={isHe ? 'עלות' : 'Cost'}
          color={hasSurge ? '#FF9F0A' : '#3C3C43'}
        />
        <div style={{ width: 1, background: 'rgba(0,0,0,0.07)', alignSelf: 'stretch' }} aria-hidden />
        <StatPill icon="🌿" value={`${option.co2Kg}kg`} label="CO₂" color="#30D158" />
        <div style={{ width: 1, background: 'rgba(0,0,0,0.07)', alignSelf: 'stretch' }} aria-hidden />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 52 }}>
          <div style={{ display: 'flex', gap: 2 }}>
            {[1,2,3,4,5].map(i => (
              <div key={i} style={{
                width: 5, height: 5, borderRadius: '50%',
                background: i <= option.comfort ? '#FF9F0A' : 'rgba(0,0,0,0.10)',
              }} />
            ))}
          </div>
          <span style={{ fontSize: 8, fontWeight: 500, color: '#AEAEB2', letterSpacing: '-0.01em' }}>
            {isHe ? 'נוחות' : 'Comfort'}
          </span>
        </div>
      </div>

      {/* Surge warning */}
      <AnimatePresence>
        {hasSurge && liveSurge && (
          <motion.div
            key="surge"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            style={{ marginBlockStart: 10 }}
          >
            <SurgeBadge surge={liveSurge} isHe={isHe} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Buffer conflict warning */}
      <AnimatePresence>
        {bufferResult && !bufferResult.safe && bufferResult.conflictTitle && (
          <motion.div
            key="buffer"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            style={{ marginBlockStart: 10 }}
          >
            <BufferConflictBadge conflictTitle={bufferResult.conflictTitle} isHe={isHe} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* CTA buttons */}
      <div style={{ marginBlockStart: 14, display: 'flex', gap: 8 }}>
        <motion.button
          onClick={handleAddToTrip}
          whileHover={{ scale: 1.02, boxShadow: `0 6px 20px ${COLOR}38` }}
          whileTap={{ scale: 0.98 }}
          transition={SPRING}
          style={{
            flex: 1, paddingBlock: 11, paddingInline: 20,
            borderRadius: 14, border: 'none', cursor: 'pointer',
            background: addedToTrip ? '#30D158' : GRADIENT,
            color: '#fff', fontSize: 12, fontWeight: 800,
            fontFamily: 'inherit', letterSpacing: '-0.01em',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: addedToTrip ? '0 4px 14px rgba(48,209,88,0.38)' : `0 4px 14px ${COLOR}38`,
            transition: 'background 0.3s, box-shadow 0.3s',
          }}
        >
          {addedToTrip ? (
            <>✓ {isHe ? 'נוסף לציר הזמן' : 'Added to Timeline'}</>
          ) : (
            <>
              <span aria-hidden>＋</span>
              {isHe ? 'הוסף לציר הזמן' : 'Add to Timeline'}
            </>
          )}
        </motion.button>

        {/* Navigate — opens Google Maps Directions */}
        {option.directionsUrl && (
          <motion.a
            href={option.directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.04, boxShadow: '0 4px 14px rgba(0,0,0,0.10)' }}
            transition={SPRING}
            onClick={e => e.stopPropagation()}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              paddingBlock: 11, paddingInline: 14,
              borderRadius: 14, border: '1px solid rgba(0,0,0,0.09)',
              background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)',
              color: '#1D1D1F', fontSize: 11, fontWeight: 700,
              fontFamily: 'inherit', letterSpacing: '-0.01em',
              textDecoration: 'none',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.90)',
              flexShrink: 0,
            }}
          >
            🗺 {isHe ? 'נווט' : 'Navigate'}
          </motion.a>
        )}
      </div>
    </motion.div>
  );
});
