'use client';

// ExperienceBento.tsx — Spatio-temporal hero cards for the Experiences zone.
// Each card: bg-white/40 backdrop-blur-2xl border-white/70 shadow-xl
// Weather Warning Visualizer: frosted amber badge with AI day suggestion.
// Physical Effort Indicator: icon-based (🚶 Easy Walk → 🧗 Extreme Hike).
// GripHorizontal drag handle: absolute-positioned, triggers placeEntity on drop.
// On placeEntity call: calculatePredictiveBudget fires and FinancialWidget updates.

import { useState, useCallback, memo }  from 'react';
import { motion, AnimatePresence }       from 'framer-motion';
import { GripHorizontal }                from 'lucide-react';
import { useTravelEngine }               from '@/store/useTravelEngine';
import { useLocaleEngine }               from '@/store/useLocaleEngine';
import type { AggregatedActivity }       from '@/services/OmniAggregator';
import { SpatialMap }                    from '@/components/zones/SpatialMap';
import { enrichEntitiesWithWeather }     from '@/utils/WeatherSyncEngine';
import type { LodgingPin }              from '@/components/zones/SpatialMap';
import type { AttractionEntity, ExperienceType, WeatherMatch } from '@/types/attractions';

// ── Design tokens ─────────────────────────────────────────────────────────────

const COLOR  = '#30D158';
const SPRING = { type: 'spring', stiffness: 380, damping: 28 } as const;

const TYPE_COLORS: Record<ExperienceType, { bg: string; fg: string; label: string }> = {
  cultural:  { bg: '#5E5CE618', fg: '#5E5CE6', label: 'Cultural'  },
  outdoor:   { bg: '#30D15818', fg: '#30D158', label: 'Outdoor'   },
  culinary:  { bg: '#FF9F0A18', fg: '#FF9F0A', label: 'Culinary'  },
  adventure: { bg: '#FF453A18', fg: '#FF453A', label: 'Adventure' },
  wellness:  { bg: '#00C7BE18', fg: '#00C7BE', label: 'Wellness'  },
};

// ── Effort indicator ──────────────────────────────────────────────────────────
// Icon-based physical effort visualizer — strictly RTL/LTR via logical properties.

const EFFORT_CONFIG = {
  easy:        { icon: '🚶', label: 'Easy Walk',      color: '#30D158', filled: 1, total: 3 },
  moderate:    { icon: '⛰',  label: 'Moderate Hike',  color: '#FF9F0A', filled: 2, total: 3 },
  challenging: { icon: '🧗', label: 'Extreme Hike',   color: '#FF453A', filled: 3, total: 3 },
};

const EffortIndicator = memo(function EffortIndicator({
  difficulty,
}: { difficulty: AttractionEntity['difficulty'] }) {
  const cfg = EFFORT_CONFIG[difficulty] ?? EFFORT_CONFIG.easy;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{ fontSize: 13 }}>{cfg.icon}</span>
      <span style={{
        fontSize:      10,
        fontWeight:    600,
        color:         cfg.color,
        letterSpacing: '-0.01em',
      }}>
        {cfg.label}
      </span>
      {/* Effort pips */}
      <div style={{ display: 'flex', gap: 2, marginInlineStart: 2 }}>
        {Array.from({ length: cfg.total }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ ...SPRING, delay: 0.05 + i * 0.06 }}
            style={{
              width:        5,
              height:       5,
              borderRadius: '50%',
              background:   i < cfg.filled ? cfg.color : `${cfg.color}28`,
              border:       `1px solid ${cfg.color}40`,
            }}
          />
        ))}
      </div>
    </div>
  );
});

// ── Weather warning badge ─────────────────────────────────────────────────────
// Frosted amber glass — rendered when WeatherSyncEngine detects high rain probability.

const WeatherWarningBadge = memo(function WeatherWarningBadge({
  match,
  warningText,
  suggestionText,
}: {
  match:          WeatherMatch;
  warningText:    string;
  suggestionText: string | null;
}) {
  const prob = match.precipProbability ?? 70;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING}
      style={{
        display:              'flex',
        alignItems:           'flex-start',
        gap:                   8,
        paddingBlock:          10,
        paddingInline:         12,
        borderRadius:          14,
        background:           'rgba(255,255,255,0.60)',
        backdropFilter:       'blur(20px) saturate(1.8)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.8)',
        border:               '1px solid rgba(255,159,10,0.35)',
        boxShadow:            '0 4px 16px rgba(255,159,10,0.10)',
      }}
    >
      {/* Pulsing rain icon */}
      <motion.span
        animate={{ opacity: [1, 0.5, 1] }}
        transition={{ duration: 1.8, repeat: Infinity }}
        style={{ fontSize: 16, flexShrink: 0, marginBlockStart: 1 }}
      >
        🌧
      </motion.span>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
        <span style={{
          fontSize:      11,
          fontWeight:    800,
          color:         '#FF9F0A',
          letterSpacing: '-0.02em',
        }}>
          {prob}% rain probability on {match.dayLabel}
        </span>
        <span style={{
          fontSize:      10.5,
          fontWeight:    500,
          color:         '#636366',
          lineHeight:    1.4,
        }}>
          {warningText}
        </span>
        {suggestionText && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            style={{
              fontSize:      10,
              fontWeight:    700,
              color:         '#007AFF',
              letterSpacing: '-0.01em',
            }}
          >
            ✦ {suggestionText}
          </motion.span>
        )}
      </div>
    </motion.div>
  );
});

// ── Perfect weather badge ─────────────────────────────────────────────────────

const PerfectWeatherBadge = memo(function PerfectWeatherBadge({
  match,
}: { match: WeatherMatch }) {
  const isPerfect = match.quality === 'perfect';
  return (
    <motion.div
      animate={isPerfect ? {
        boxShadow: [
          '0 0 0px rgba(255,214,10,0)',
          '0 0 16px rgba(255,214,10,0.70)',
          '0 0 0px rgba(255,214,10,0)',
        ],
      } : undefined}
      transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
      style={{
        display:        'flex',
        alignItems:     'center',
        gap:             4,
        paddingBlock:   4,
        paddingInline:  9,
        borderRadius:   8,
        background:     isPerfect
          ? 'linear-gradient(135deg, rgba(255,159,10,0.92), rgba(255,214,10,0.88))'
          : 'linear-gradient(135deg, rgba(48,209,88,0.88), rgba(0,199,190,0.82))',
        backdropFilter: 'blur(12px)',
        border:         '1px solid rgba(255,255,255,0.28)',
        flexShrink:     0,
      }}
    >
      {isPerfect && (
        <motion.span
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          style={{ fontSize: 8, display: 'inline-block' }}
        >✦</motion.span>
      )}
      <span style={{ fontSize: 9, color: '#fff', fontWeight: 700 }}>
        {isPerfect ? `Perfect · ${match.dayLabel}` : match.dayLabel}
      </span>
      <span style={{ fontSize: 9 }}>{match.icon}</span>
      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>
        {match.tempC}°C
      </span>
    </motion.div>
  );
});

// ── Hero bento card ───────────────────────────────────────────────────────────

const HeroCard = memo(function HeroCard({
  entity,
  index,
  onAddToTrip,
  formatPrice,
}: {
  entity:       AttractionEntity & { _weatherEval?: { isAtRisk: boolean; warningText: string | null; suggestionText: string | null } };
  index:        number;
  onAddToTrip:  (entity: AttractionEntity) => void;
  formatPrice:  (usd: number) => string;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [added,      setAdded]      = useState(false);

  const typeStyle = TYPE_COLORS[entity.type] ?? TYPE_COLORS.cultural;
  const isWarning = entity._weatherEval?.isAtRisk ?? entity.weatherMatch?.quality === 'warning';
  const showGood  = !isWarning && (entity.weatherMatch?.quality === 'perfect' || entity.weatherMatch?.quality === 'good');

  const handleAddToTrip = useCallback(() => {
    onAddToTrip(entity);
    setAdded(true);
  }, [entity, onAddToTrip]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...SPRING, delay: index * 0.07 }}
      drag={false}
      style={{
        position:             'relative',
        background:           'rgba(255,255,255,0.40)',
        backdropFilter:       'blur(40px) saturate(1.9)',
        WebkitBackdropFilter: 'blur(40px) saturate(1.9)',
        border:                isWarning
          ? '1.5px solid rgba(255,159,10,0.40)'
          : '1.5px solid rgba(255,255,255,0.70)',
        borderRadius:          28,
        boxShadow:             [
          '0 8px 32px rgba(0,0,0,0.07)',
          'inset 0 1px 0 rgba(255,255,255,1)',
          isWarning ? '0 0 0 1px rgba(255,159,10,0.08)' : '',
        ].filter(Boolean).join(', '),
        overflow:             'hidden',
        display:              'flex',
        flexDirection:        'column',
      }}
    >
      {/* ── Gradient hero strip ── */}
      <div style={{ position: 'relative', height: 130, background: entity.gradient, flexShrink: 0 }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, transparent 30%, rgba(0,0,0,0.40) 100%)',
        }} />

        {/* Type badge */}
        <div style={{
          position:      'absolute', insetBlockEnd: 10, insetInlineStart: 14,
          background:    typeStyle.bg,
          border:        `1px solid ${typeStyle.fg}40`,
          backdropFilter: 'blur(10px)',
          borderRadius:  8, paddingBlock: 3, paddingInline: 9,
          fontSize: 9.5, fontWeight: 700, color: typeStyle.fg,
        }}>
          {typeStyle.label}
        </div>

        {/* Perfect/good weather badge */}
        {showGood && entity.weatherMatch && (
          <div style={{ position: 'absolute', insetBlockStart: 10, insetInlineEnd: 50 }}>
            <PerfectWeatherBadge match={entity.weatherMatch} />
          </div>
        )}

        {/* Instant book */}
        {entity.instantBook && (
          <div style={{
            position: 'absolute', insetBlockStart: 10, insetInlineStart: 14,
            background: 'rgba(0,0,0,0.42)', backdropFilter: 'blur(10px)',
            borderRadius: 6, paddingBlock: 2, paddingInline: 7,
            fontSize: 8.5, fontWeight: 700, color: '#30D158',
          }}>
            ⚡ Instant
          </div>
        )}

        {/* Source count */}
        <div style={{
          position: 'absolute', insetBlockEnd: 10, insetInlineEnd: 14,
          background: 'rgba(0,0,0,0.38)', backdropFilter: 'blur(8px)',
          borderRadius: 6, paddingBlock: 2, paddingInline: 7,
          fontSize: 8, fontWeight: 600, color: 'rgba(255,255,255,0.90)',
        }}>
          {entity.sourceCount} platforms
        </div>

        {/* GripHorizontal drag handle — absolute top-end */}
        <motion.div
          animate={{ opacity: isDragging ? 1 : 0.55 }}
          whileHover={{ opacity: 1, scale: 1.1 }}
          onHoverStart={() => {}}
          style={{
            position:       'absolute',
            insetBlockStart: 10,
            insetInlineEnd:  14,
            width:           28,
            height:          28,
            borderRadius:    8,
            background:     'rgba(255,255,255,0.28)',
            backdropFilter: 'blur(10px)',
            border:         '1px solid rgba(255,255,255,0.45)',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            cursor:         'grab',
          }}
          aria-label="Drag to add to trip timeline"
        >
          <GripHorizontal
            size={13}
            strokeWidth={2.2}
            color="rgba(255,255,255,0.90)"
            aria-hidden
          />
        </motion.div>
      </div>

      {/* ── Card body ── */}
      <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
        {/* Title */}
        <h3 style={{
          margin:        0,
          fontSize:       15,
          fontWeight:     800,
          color:          '#1C1C1E',
          letterSpacing: '-0.025em',
          lineHeight:    1.25,
        }}>
          {entity.title}
        </h3>

        {/* Stats row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Effort indicator */}
          <EffortIndicator difficulty={entity.difficulty} />

          <div aria-hidden style={{ width: 1, height: 12, background: 'rgba(0,0,0,0.09)' }} />

          <span style={{ fontSize: 10, color: '#636366' }}>⏱ {entity.durationHours}h</span>
          <span style={{ fontSize: 10, color: '#636366' }}>👥 max {entity.groupSizeMax}</span>

          {/* Rating */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginInlineStart: 'auto' }}>
            <span style={{ fontSize: 10, color: '#FF9F0A' }}>★</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#1C1C1E', letterSpacing: '-0.01em' }}>
              {entity.rating.toFixed(2)}
            </span>
            <span style={{ fontSize: 9, color: '#AEAEB2' }}>
              ({entity.reviewCount.toLocaleString()})
            </span>
          </div>
        </div>

        {/* AI highlight */}
        <p style={{
          margin:      0,
          fontSize:    11,
          color:       '#636366',
          lineHeight:  1.5,
          display:     '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow:    'hidden',
        }}>
          {entity.aiHighlight}
        </p>

        {/* Weather warning — full-width amber frosted badge */}
        <AnimatePresence>
          {isWarning && entity.weatherMatch && entity._weatherEval?.warningText && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
            >
              <WeatherWarningBadge
                match={entity.weatherMatch}
                warningText={entity._weatherEval.warningText}
                suggestionText={entity._weatherEval.suggestionText}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Provider dots */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {entity.providers.slice(0, 6).map((p, i) => (
            <div
              key={p}
              title={p}
              style={{
                width: 6, height: 6, borderRadius: '50%',
                background: `hsl(${(i * 67 + 200) % 360}, 65%, 55%)`,
                flexShrink: 0,
              }}
            />
          ))}
          {entity.providers.length > 6 && (
            <span style={{ fontSize: 8, color: '#8E8E93' }}>+{entity.providers.length - 6}</span>
          )}
          <span style={{ fontSize: 9, color: '#AEAEB2', marginInlineStart: 3 }}>
            {entity.providers.length} platform{entity.providers.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Price + CTA row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBlockStart: 'auto' }}>
          <div>
            <span style={{ fontSize: 17, fontWeight: 900, color: '#1C1C1E', letterSpacing: '-0.04em' }}>
              {formatPrice(entity.pricePerPerson)}
            </span>
            <span style={{ fontSize: 10, color: '#8E8E93', marginInlineStart: 2 }}>/person</span>
          </div>

          <div style={{ display: 'flex', gap: 7 }}>
            {/* Add to Trip — triggers placeEntity → FinancialWidget deduction */}
            <motion.button
              onClick={handleAddToTrip}
              disabled={added}
              whileHover={!added ? { y: -1, boxShadow: `0 6px 18px ${typeStyle.fg}38` } : {}}
              whileTap={!added ? { scale: 0.96 } : {}}
              transition={SPRING}
              style={{
                display:        'flex',
                alignItems:     'center',
                gap:             5,
                paddingBlock:   9,
                paddingInline:  15,
                borderRadius:   12,
                border:         'none',
                cursor:          added ? 'default' : 'pointer',
                background:      added
                  ? `${COLOR}14`
                  : `linear-gradient(135deg, ${typeStyle.fg}, ${typeStyle.fg}CC)`,
                color:           added ? COLOR : '#fff',
                fontSize:        11,
                fontWeight:      700,
                fontFamily:     'inherit',
                letterSpacing:  '-0.01em',
                boxShadow:       added ? 'none' : `0 3px 12px ${typeStyle.fg}38`,
                transition:     'background 0.2s, box-shadow 0.2s',
              }}
            >
              {added ? '✓ Added' : 'Add to Trip →'}
            </motion.button>

            {/* External view link — Google Maps / Viator */}
            {entity.bookingUrl && (
              <motion.a
                href={entity.bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ y: -1, boxShadow: '0 4px 14px rgba(0,0,0,0.10)' }}
                transition={SPRING}
                onClick={e => e.stopPropagation()}
                style={{
                  display:        'flex',
                  alignItems:     'center',
                  gap:            5,
                  paddingBlock:   9,
                  paddingInline:  12,
                  borderRadius:   12,
                  border:         '1px solid rgba(0,0,0,0.09)',
                  background:     'rgba(255,255,255,0.82)',
                  backdropFilter: 'blur(20px)',
                  color:          '#1D1D1F',
                  fontSize:       11,
                  fontWeight:     600,
                  fontFamily:     'inherit',
                  letterSpacing:  '-0.01em',
                  textDecoration: 'none',
                  boxShadow:      '0 2px 8px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.90)',
                  cursor:         'pointer',
                }}
              >
                📍 View
              </motion.a>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
});

// ── Types ─────────────────────────────────────────────────────────────────────

export type ExperienceSearchState = 'idle' | 'loading' | 'results';

export interface ExperienceBentoProps {
  searchState:  ExperienceSearchState;
  engineCount:  number;
  destination?: string;
  results?:     AttractionEntity[] | null;
  apiStatus?:   'ok' | 'needs_api_key' | 'error' | null;
  apiMessage?:  string | null;
}

// Default lodging pin — overridden by store data when hotel is booked
const FALLBACK_LODGING: LodgingPin = {
  name: 'AI-selected hotel',
  lat:  0,
  lon:  0,
};

// ── Main export ───────────────────────────────────────────────────────────────

export const ExperienceBento = memo(function ExperienceBento({
  searchState,
  engineCount,
  destination,
  results,
  apiStatus,
  apiMessage,
}: ExperienceBentoProps) {
  const days        = useTravelEngine(s => s.days);
  const placeEntity = useTravelEngine(s => s.placeEntity);
  const { formatPrice } = useLocaleEngine();

  // Derive lodging GPS from booked hotel entities in the trip
  const lodgingPin: LodgingPin = (() => {
    for (const day of days) {
      const hotel = day.entities.find(e => e.category === 'hotel');
      if (hotel?.details && 'lat' in hotel.details && typeof hotel.details.lat === 'number') {
        return { name: hotel.title, lat: hotel.details.lat as number, lon: hotel.details.lon as number };
      }
    }
    return FALLBACK_LODGING;
  })();

  // Enrich with WeatherSyncEngine (client-side evaluation)
  const enriched = results
    ? enrichEntitiesWithWeather(results, days)
    : null;

  const handleAddToTrip = useCallback((entity: AttractionEntity) => {
    const targetDay = days.find(d => d.destination.toLowerCase() === (destination ?? '').toLowerCase())
      ?? days[0];
    if (!targetDay) return;

    const aggregated: AggregatedActivity = {
      id:            entity.id,
      category:      'activity',
      sources:       ['experiences-hub'],
      sourceCount:   1,
      aiConfidence:  entity.aiConfidence ?? 0.85,
      title:         entity.title,
      location:      entity.destination,
      destination:   entity.destination,
      type:          entity.type,
      durationHours: entity.durationHours,
      pricePerPerson: entity.pricePerPerson,
      rating:        entity.rating,
      difficulty:    entity.difficulty,
      bestTimeOfDay: entity.bestTimeOfDay,
      aiHighlight:   entity.aiHighlight,
      tags:          entity.tags ?? [],
    };
    placeEntity(targetDay.id, aggregated);
  }, [days, destination, placeEntity]);

  // ── Idle state ──────────────────────────────────────────────────────────────
  if (searchState === 'idle') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={SPRING}
        style={{
          height: '100%', minHeight: 340, borderRadius: 20, overflow: 'hidden',
          position: 'relative', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(145deg, #EDFFF4 0%, #F0FFF6 35%, #EDFAF4 65%, #E8FFF0 100%)',
          marginTop: 8,
        }}
      >
        {/* Ambient glow orbs */}
        <div aria-hidden style={{ position: 'absolute', top: '-18%', right: '-6%', width: '55%', height: '55%', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(48,209,88,0.14) 0%, transparent 65%)', animation: 'ambient-drift-a 22s ease-in-out infinite', pointerEvents: 'none' }} />
        <div aria-hidden style={{ position: 'absolute', bottom: '-15%', left: '-5%', width: '48%', height: '48%', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(0,199,190,0.10) 0%, transparent 65%)', animation: 'ambient-drift-b 30s ease-in-out infinite', pointerEvents: 'none' }} />

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, paddingInline: 32, textAlign: 'center' }}>
          <motion.div
            animate={{ y: [0, -10, 0], rotate: [0, 5, -3, 0] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
            style={{ fontSize: 56, lineHeight: 1, filter: 'drop-shadow(0 8px 20px rgba(48,209,88,0.28))' }}
            aria-hidden
          >🎭</motion.div>

          <div>
            <p style={{ fontSize: 22, fontWeight: 900, color: '#0A1F0F', letterSpacing: '-0.04em', lineHeight: 1.15, margin: 0 }}>
              {destination ? `Explore ${destination}` : 'What do you want to experience?'}
            </p>
            <p style={{ fontSize: 13, color: '#48484A', marginTop: 7, letterSpacing: '-0.012em', lineHeight: 1.6, maxWidth: 320 }}>
              {destination
                ? `Describe what you want to do — Unit finds tours, activities, and hidden gems across 30 global experience platforms.`
                : 'Add a destination to your trip, then search for tours, activities, and authentic local experiences.'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', justifyContent: 'center' }}>
            {['🌍 30 platforms', '🎯 AI curated', '📍 Local gems'].map(f => (
              <div key={f} style={{ fontSize: 10.5, fontWeight: 700, paddingBlock: 5, paddingInline: 11, borderRadius: 99, background: 'rgba(48,209,88,0.10)', border: '1px solid rgba(48,209,88,0.24)', color: '#1A5C2A', letterSpacing: '-0.005em' }}>
                {f}
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    );
  }

  // ── Loading state ───────────────────────────────────────────────────────────
  if (searchState === 'loading') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '20px 0' }}>
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            animate={{ opacity: [0.4, 0.75, 0.4] }}
            transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.2 }}
            style={{
              background:     'rgba(255,255,255,0.40)',
              backdropFilter: 'blur(40px)',
              border:         '1.5px solid rgba(255,255,255,0.70)',
              borderRadius:    28,
              height:          280,
            }}
          />
        ))}
      </div>
    );
  }

  // ── Needs API key ───────────────────────────────────────────────────────────
  if (apiStatus === 'needs_api_key') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING}
        style={{
          background:     'rgba(255,255,255,0.40)',
          backdropFilter: 'blur(40px)',
          border:         '1.5px solid rgba(255,255,255,0.70)',
          borderRadius:    24,
          padding:        '40px 30px',
          textAlign:      'center',
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          gap:             12,
        }}
      >
        <span style={{ fontSize: 32 }}>🔑</span>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.025em' }}>
          Connect Experience Engines
        </h3>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, maxWidth: 280 }}>
          {apiMessage ?? 'Add GETYOURGUIDE_API_KEY or VIATOR_API_KEY to .env.local'}
        </p>
      </motion.div>
    );
  }

  // ── Empty results ───────────────────────────────────────────────────────────
  if (!enriched || enriched.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
          No experiences found — try different engines or a broader destination.
        </p>
      </div>
    );
  }

  const hasCoords     = enriched.some(e => e.lat !== undefined && e.lon !== undefined);
  const warningCount  = enriched.filter(e => e._weatherEval?.isAtRisk).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Weather summary pill */}
      <AnimatePresence>
        {warningCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={SPRING}
            style={{
              display:       'flex',
              alignItems:    'center',
              gap:            7,
              paddingBlock:   8,
              paddingInline:  13,
              borderRadius:   12,
              background:    'rgba(255,159,10,0.08)',
              border:        '1px solid rgba(255,159,10,0.22)',
              alignSelf:     'flex-start',
            }}
          >
            <span style={{ fontSize: 13 }}>🌧</span>
            <span style={{ fontSize: 10.5, fontWeight: 600, color: '#FF9F0A', letterSpacing: '-0.01em' }}>
              {warningCount} experience{warningCount !== 1 ? 's' : ''} flagged — AI has suggested safer days
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero cards grid */}
      <div style={{
        display:             'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap:                  16,
      }}>
        {enriched.map((entity, i) => (
          <HeroCard
            key={entity.id}
            entity={entity}
            index={i}
            onAddToTrip={handleAddToTrip}
            formatPrice={formatPrice}
          />
        ))}
      </div>

      {/* Spatial map — rendered below the bento cards */}
      {hasCoords && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING, delay: enriched.length * 0.06 + 0.1 }}
          style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>
              SPATIAL MAP — PROXIMITY TO LODGING
            </p>
            <div style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.06)' }} />
            {warningCount > 0 && (
              <span style={{ fontSize: 9, color: '#FF9F0A', fontWeight: 600 }}>
                {warningCount} weather alert{warningCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div style={{ height: 280, borderRadius: 20, overflow: 'hidden' }}>
            {lodgingPin.lat !== 0 || lodgingPin.lon !== 0 ? (
              <SpatialMap
                lodging={lodgingPin}
                attractions={enriched}
              />
            ) : (
              <div style={{
                height: '100%',
                background: 'rgba(255,255,255,0.40)',
                backdropFilter: 'blur(40px) saturate(1.9)',
                border: '1.5px solid rgba(255,255,255,0.70)',
                borderRadius: 20,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 8,
              }}>
                <span style={{ fontSize: 24 }}>🗺</span>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>
                  Book a hotel to enable proximity map
                </span>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
});
