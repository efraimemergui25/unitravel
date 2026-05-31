'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlanningBoard } from '@/store/usePlanningBoard';
import { ZONE_META, ZoneId } from '@/lib/zoneEngines';

const SPRING      = { type: 'spring', stiffness: 400, damping: 28 } as const;
const SPRING_SOFT = { type: 'spring', stiffness: 380, damping: 32 } as const;

type SearchState = 'idle' | 'loading' | 'results';

// ── Mock result data per zone ─────────────────────────────────────────────────

const MOCK_RESULTS: Record<ZoneId, Array<{ id: string; title: string; subtitle: string; price: number; badge?: string; confidence: number }>> = {
  flights: [
    { id: 'f1', title: 'Aeroméxico · MEX→CUN', subtitle: 'Business · 2h 15m · Non-stop', price: 580,  badge: 'AI Pick',   confidence: 0.96 },
    { id: 'f2', title: 'United · LAX→CUN',     subtitle: 'Economy · 3h 30m · Non-stop', price: 318,  badge: 'Best Price', confidence: 0.91 },
    { id: 'f3', title: 'Delta · JFK→MEX',      subtitle: 'Economy · 5h 10m · 1 stop',   price: 429,  badge: 'Fastest',    confidence: 0.88 },
    { id: 'f4', title: 'Volaris · MEX→TLC',    subtitle: 'Economy · 1h 45m · Non-stop', price: 142,  badge: undefined,    confidence: 0.79 },
    { id: 'f5', title: 'JetBlue · BOS→CUN',    subtitle: 'Mint · 4h 05m · Non-stop',   price: 1140, badge: 'Luxury',     confidence: 0.85 },
    { id: 'f6', title: 'Copa · NYC→MEX',       subtitle: 'Economy · 6h 20m · 1 stop',  price: 387,  badge: undefined,    confidence: 0.82 },
  ],
  lodging: [
    { id: 'h1', title: 'Four Seasons CDMX',   subtitle: 'Deluxe Suite · 4 nights',    price: 3200, badge: 'AI Pick',    confidence: 0.97 },
    { id: 'h2', title: 'Rosewood Mayakoba',   subtitle: 'Lagoon Villa · 5 nights',    price: 5800, badge: 'Top Rated',  confidence: 0.95 },
    { id: 'h3', title: 'Azulik Resort Tulum', subtitle: 'Tree House · 5 nights',      price: 4200, badge: 'Unique',     confidence: 0.92 },
    { id: 'h4', title: 'One&Only Palmilla',   subtitle: 'Ocean Suite · 5 nights',     price: 7100, badge: 'Luxury',     confidence: 0.94 },
    { id: 'h5', title: 'Airbnb · Tulum Eco', subtitle: 'Private Villa · 5 nights',   price: 1900, badge: 'Best Value',  confidence: 0.83 },
    { id: 'h6', title: 'Ritz-Carlton Cancún', subtitle: 'Club Level · 4 nights',      price: 2800, badge: undefined,    confidence: 0.88 },
  ],
  dining: [
    { id: 'd1', title: 'Pujol',         subtitle: 'Contemporary Mexican · CDMX',   price: 240, badge: 'Michelin 2★', confidence: 0.98 },
    { id: 'd2', title: 'Quintonil',     subtitle: 'Modern Mexican · Polanco',       price: 180, badge: 'World 50',    confidence: 0.96 },
    { id: 'd3', title: 'Hartwood',      subtitle: 'Wood-fire · Tulum',             price: 140, badge: 'AI Pick',     confidence: 0.94 },
    { id: 'd4', title: 'Deckman\'s',    subtitle: 'Baja Med · Valle de Guadalupe', price: 95,  badge: undefined,     confidence: 0.87 },
    { id: 'd5', title: 'El Farallon',   subtitle: 'Seafood cliff · Cabo',          price: 160, badge: 'View',        confidence: 0.91 },
    { id: 'd6', title: 'Contramar',     subtitle: 'Seafood · Roma Norte CDMX',     price: 85,  badge: 'Local Fav.',  confidence: 0.90 },
  ],
  attractions: [
    { id: 'a1', title: 'Chichén Itzá Private Tour',  subtitle: 'Sunrise access · 8h', price: 320, badge: 'UNESCO',      confidence: 0.96 },
    { id: 'a2', title: 'Cenote Ik-Kil Snorkel',      subtitle: 'Guided · 3h',         price: 85,  badge: 'AI Pick',     confidence: 0.93 },
    { id: 'a3', title: 'Frida Kahlo Museum',          subtitle: 'CDMX · 2h',           price: 35,  badge: 'Must-do',     confidence: 0.97 },
    { id: 'a4', title: 'Xochimilco Trajinera',        subtitle: 'Sunset boat · 2h',    price: 75,  badge: 'Local Fav.', confidence: 0.89 },
    { id: 'a5', title: 'Teotihuacán Sunrise',         subtitle: 'Balloon flight · 3h', price: 280, badge: 'Unique',      confidence: 0.92 },
    { id: 'a6', title: 'Tulum Ruins at Dawn',         subtitle: 'Private guide · 2h',  price: 65,  badge: 'Scenic',      confidence: 0.91 },
  ],
  transit: [
    { id: 't1', title: 'Airport Transfer MEX→Hotel', subtitle: 'Private SUV · 45min', price: 65,  badge: 'Recommended', confidence: 0.95 },
    { id: 't2', title: 'Uber Black CDMX',             subtitle: 'Day pass · 8h',       price: 180, badge: 'AI Pick',     confidence: 0.91 },
    { id: 't3', title: 'Hertz SUV Rental',            subtitle: '7 days · Full cover',  price: 420, badge: 'Best Value',  confidence: 0.87 },
    { id: 't4', title: 'ADO Bus CDMX→Tulum',         subtitle: 'Luxury class · 5h',   price: 48,  badge: undefined,     confidence: 0.82 },
    { id: 't5', title: 'Private Driver Package',      subtitle: 'Tulum 3-day',          price: 350, badge: 'Premium',     confidence: 0.90 },
    { id: 't6', title: 'LATAM Shuttle Cancún',        subtitle: 'Airport→resort',       price: 32,  badge: undefined,     confidence: 0.79 },
  ],
};

// ── ShimmerCard ───────────────────────────────────────────────────────────────

function ShimmerCard({ delay }: { delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING_SOFT, delay }}
      style={{
        background:     'rgba(255,255,255,0.72)',
        borderRadius:   16,
        padding:        '14px 16px',
        border:         '1px solid rgba(255,255,255,0.90)',
        boxShadow:      '0 2px 12px rgba(0,0,0,0.05)',
      }}
    >
      <div className="shimmer-light" style={{ height: 14, borderRadius: 7, marginBlockEnd: 8, width: '65%' }} />
      <div className="shimmer-light" style={{ height: 11, borderRadius: 6, marginBlockEnd: 12, width: '45%' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="shimmer-light" style={{ height: 20, borderRadius: 8, width: 72 }} />
        <div className="shimmer-light" style={{ height: 28, borderRadius: 9, width: 80 }} />
      </div>
    </motion.div>
  );
}

// ── ResultCard ────────────────────────────────────────────────────────────────

interface ResultItem {
  id: string; title: string; subtitle: string; price: number; badge?: string; confidence: number;
}

function ResultCard({
  item,
  zoneId,
  delay,
}: {
  item:   ResultItem;
  zoneId: ZoneId;
  delay:  number;
}) {
  const { addToBoard, isStaged } = usePlanningBoard();
  const meta    = ZONE_META[zoneId];
  const staged  = isStaged(item.id);

  const syntheticSource = {
    id:           item.id,
    category:     zoneId === 'flights' ? 'flight'     as const
                : zoneId === 'lodging' ? 'hotel'      as const
                : zoneId === 'dining'  ? 'restaurant' as const
                : zoneId === 'transit' ? 'transport'  as const
                : 'activity'           as const,
    airline:       item.title,
    route:         item.subtitle,
    price:         item.price,
    departure:     '10:00',
    durationMin:   0,
    durationLabel: '',
    stops:         0,
    class:         'Economy' as const,
    aiConfidence:  item.confidence,
    tags:          item.badge ? [item.badge] : [],
    sourceCount:   1,
    sources:       ['OmniSearch'] as string[],
    origin:        '',
    destination:   '',
    arrival:       '',
    carbonKg:      0,
    carbonLabel:   '',
    carbonAlternative: '',
    priceRange:    [item.price, item.price] as [number, number],
    priceDropProbability: 0,
    seats:         0,
    refundable:    false,
    flightNumber:  '',
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ ...SPRING, delay }}
      whileHover={{ y: -2, boxShadow: '0 8px 28px rgba(0,0,0,0.10)' }}
      style={{
        background:     'rgba(255,255,255,0.88)',
        backdropFilter: 'blur(40px)',
        borderRadius:   16,
        padding:        '14px 16px',
        border:         '1px solid rgba(255,255,255,0.92)',
        boxShadow:      '0 2px 12px rgba(0,0,0,0.06)',
        cursor:         'default',
        transition:     'box-shadow 0.2s ease',
      }}
    >
      {/* Title + badge row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBlockEnd: 4 }}>
        <p
          style={{
            fontSize:   13,
            fontWeight: 700,
            color:      '#1D1D1F',
            flex:       1,
            lineHeight: 1.3,
          }}
        >
          {item.title}
        </p>
        {item.badge && (
          <span
            style={{
              paddingBlock:   2,
              paddingInline:  7,
              borderRadius:   999,
              fontSize:       9,
              fontWeight:     800,
              color:          meta.color,
              background:     `${meta.color}14`,
              border:         `1px solid ${meta.color}33`,
              flexShrink:     0,
              letterSpacing:  '0.02em',
              whiteSpace:     'nowrap',
            }}
          >
            {item.badge}
          </span>
        )}
      </div>

      <p style={{ fontSize: 11, color: '#6E6E73', marginBlockEnd: 12 }}>
        {item.subtitle}
      </p>

      {/* Price + confidence + stage row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16, fontWeight: 800, color: '#1D1D1F', flex: 1 }}>
          ${item.price.toLocaleString()}
        </span>

        {/* AI confidence */}
        <span
          style={{
            fontSize:      10,
            fontWeight:    700,
            color:         meta.color,
            background:    `${meta.color}0F`,
            border:        `1px solid ${meta.color}22`,
            borderRadius:  999,
            paddingBlock:  2,
            paddingInline: 6,
          }}
        >
          {Math.round(item.confidence * 100)}%
        </span>

        {/* Stage to Trip */}
        <motion.button
          onClick={() => !staged && addToBoard(syntheticSource as Parameters<typeof addToBoard>[0])}
          disabled={staged}
          whileHover={staged ? {} : { scale: 1.04, boxShadow: `0 4px 14px ${meta.color}44` }}
          whileTap={staged ? {} : { scale: 0.96 }}
          transition={SPRING}
          style={{
            paddingBlock:   7,
            paddingInline:  14,
            borderRadius:   9,
            fontSize:       11,
            fontWeight:     700,
            color:          staged ? '#6E6E73' : 'white',
            background:     staged ? 'rgba(0,0,0,0.07)' : meta.gradient,
            border:         'none',
            cursor:         staged ? 'default' : 'pointer',
            boxShadow:      staged ? 'none' : `0 2px 8px ${meta.color}30`,
            transition:     'background 0.2s',
            flexShrink:     0,
            fontFamily:     'inherit',
          }}
        >
          {staged ? '✓ Staged' : '+ Stage'}
        </motion.button>
      </div>
    </motion.div>
  );
}

// ── IdleState ─────────────────────────────────────────────────────────────────

function IdleState({ zone }: { zone: ZoneId }) {
  const meta = ZONE_META[zone];
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING_SOFT}
      style={{
        flex:           1,
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            16,
        padding:        40,
        textAlign:      'center',
      }}
    >
      <motion.div
        animate={{ scale: [1, 1.08, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          width:          88,
          height:         88,
          borderRadius:   24,
          background:     `linear-gradient(135deg, ${meta.color}16, ${meta.color}08)`,
          border:         `1px solid ${meta.color}28`,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          fontSize:       40,
          boxShadow:      `0 8px 32px ${meta.color}18`,
        }}
      >
        {meta.icon}
      </motion.div>

      <div>
        <h3
          style={{
            fontSize:      18,
            fontWeight:    800,
            color:         '#1D1D1F',
            letterSpacing: '-0.02em',
            marginBlockEnd: 6,
          }}
        >
          {meta.label} Search
        </h3>
        <p style={{ fontSize: 13, color: '#6E6E73', lineHeight: 1.5, maxWidth: 280 }}>
          Select your engines in the console, then hit{' '}
          <strong style={{ color: meta.color }}>Search</strong> to activate
          the Omni pipeline.
        </p>
      </div>

      {/* Keyboard hint */}
      <div
        style={{
          display:       'flex',
          alignItems:    'center',
          gap:           6,
          paddingBlock:  6,
          paddingInline: 12,
          borderRadius:  10,
          background:    'rgba(0,0,0,0.04)',
          border:        '1px solid rgba(0,0,0,0.07)',
          fontSize:      11,
          color:         '#6E6E73',
          fontWeight:    500,
        }}
      >
        <kbd
          style={{
            paddingBlock:   2,
            paddingInline:  6,
            borderRadius:   5,
            background:     'rgba(0,0,0,0.07)',
            border:         '1px solid rgba(0,0,0,0.10)',
            fontSize:       10,
            fontFamily:     'monospace',
            fontWeight:     700,
          }}
        >
          Ctrl⇧A
        </kbd>
        <span>to select all engines instantly</span>
      </div>
    </motion.div>
  );
}

// ── ZoneResultsArea ───────────────────────────────────────────────────────────

export function ZoneResultsArea({ zone }: { zone: ZoneId }) {
  const [searchState, setSearchState] = useState<SearchState>('idle');
  const [engineCount, setEngineCount]  = useState(0);
  const meta = ZONE_META[zone];

  const handleSearch = useCallback((detail: { zone: ZoneId; engineIds: string[] }) => {
    if (detail.zone !== zone) return;
    setEngineCount(detail.engineIds.length);
    setSearchState('loading');
    setTimeout(() => setSearchState('results'), 2200 + Math.random() * 800);
  }, [zone]);

  useEffect(() => {
    const listener = (e: Event) => {
      handleSearch((e as CustomEvent).detail);
    };
    document.addEventListener('unitravel:zone-search', listener);
    return () => document.removeEventListener('unitravel:zone-search', listener);
  }, [handleSearch]);

  const results = MOCK_RESULTS[zone];

  return (
    <div
      style={{
        flex:          1,
        height:        '100%',
        display:       'flex',
        flexDirection: 'column',
        overflow:      'hidden',
        minWidth:      0,
      }}
    >
      {/* Results header bar */}
      <AnimatePresence mode="wait">
        {searchState !== 'idle' && (
          <motion.div
            key="results-header"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={SPRING_SOFT}
            style={{
              paddingInline:  20,
              paddingBlock:   12,
              borderBlockEnd: '1px solid rgba(0,0,0,0.06)',
              background:     'rgba(255,255,255,0.72)',
              backdropFilter: 'blur(20px)',
              display:        'flex',
              alignItems:     'center',
              gap:            10,
              flexShrink:     0,
            }}
          >
            {searchState === 'loading' ? (
              <>
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                  style={{ fontSize: 14, lineHeight: 1 }}
                >
                  ✦
                </motion.span>
                <span style={{ fontSize: 12, fontWeight: 600, color: meta.color }}>
                  Scanning {engineCount} engine{engineCount !== 1 ? 's' : ''}...
                </span>
              </>
            ) : (
              <>
                <span style={{ fontSize: 14 }}>✓</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#1D1D1F' }}>
                  {results.length} results found
                </span>
                <span style={{ fontSize: 11, color: '#6E6E73', marginInlineStart: 4 }}>
                  via {engineCount} engine{engineCount !== 1 ? 's' : ''}
                </span>
                <motion.button
                  onClick={() => setSearchState('idle')}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  transition={SPRING}
                  style={{
                    marginInlineStart: 'auto',
                    paddingBlock:      4,
                    paddingInline:     10,
                    borderRadius:      8,
                    fontSize:          10,
                    fontWeight:        600,
                    color:             '#6E6E73',
                    background:        'rgba(0,0,0,0.05)',
                    border:            'none',
                    cursor:            'pointer',
                    fontFamily:        'inherit',
                  }}
                >
                  Clear
                </motion.button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <div className="flex-1 overflow-y-auto light-scroll" style={{ padding: '16px 20px', minHeight: 0 }}>
        <AnimatePresence mode="wait">
          {searchState === 'idle' && (
            <IdleState key="idle" zone={zone} />
          )}

          {searchState === 'loading' && (
            <motion.div
              key="loading"
              style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {Array.from({ length: 6 }, (_, i) => (
                <ShimmerCard key={i} delay={i * 0.06} />
              ))}
            </motion.div>
          )}

          {searchState === 'results' && (
            <motion.div
              key="results"
              style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {results.map((item, i) => (
                <ResultCard key={item.id} item={item} zoneId={zone} delay={i * 0.05} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
