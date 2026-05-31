'use client';

import { useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { SentimentGauge }    from '@/components/results/SentimentGauge';
import { TableSlotGrid }     from '@/components/results/TableSlotGrid';
import { onDragEndWithPhysics } from '@/utils/DropPhysics';
import { useTravelEngine }   from '@/store/useTravelEngine';
import type { MergedRestaurant, TimeSlot } from '@/app/api/dining/route';
import type { TimeBlocker }  from '@/components/results/TableSlotGrid';

// ── Design tokens ─────────────────────────────────────────────────────────────

const COLOR    = '#FF9F0A';
const SPRING   = { type: 'spring', stiffness: 360, damping: 28 } as const;

// ── Demo flight blocker: flight arriving 18:00 on Day 1 ──────────────────────
// This populates the TableSlotGrid cross-reference demo without needing
// real entities in the store. Production: pass the day's entities via dayId prop.

const DEMO_BLOCKER: TimeBlocker = {
  time:          '18:00',
  label:         'Flight arrival — settling in',
  bufferMinutes: 90,
  cautionMins:   135,
  type:          'flight',
};

// ── Mock restaurants ──────────────────────────────────────────────────────────
// These represent the deduplicated, merged output from /api/dining.
// Hartwood  → OpenTable only (single source)
// Expendio  → Resy + Michelin (merged: sourceCount=2)
// Manta     → Tock only
// Catch Miami → OpenTable + Resy (DEDUP DEMO: slots from both engines, sourceCount=2)

const MOCK_RESTAURANTS: MergedRestaurant[] = [
  {
    id:               'hartwood-tulum',
    name:             'Hartwood',
    cuisine:          'Mexican Wood-Fire',
    location:         'Tulum, Quintana Roo',
    destination:      'Tulum',
    pricePerPerson:   120,
    rating:           9.4,
    michelinStars:    undefined,
    sources:          ['opentable'],
    sourceCount:      1,
    aiConfidence:     0.94,
    availableSlots: [
      { time: '18:00', label: '6:00 PM',  source: 'opentable', party: 2 },
      { time: '18:30', label: '6:30 PM',  source: 'opentable', party: 2 },
      { time: '19:00', label: '7:00 PM',  source: 'opentable', party: 2 },
      { time: '19:30', label: '7:30 PM',  source: 'opentable', party: 2 },
      { time: '20:00', label: '8:00 PM',  source: 'opentable', party: 2 },
      { time: '20:30', label: '8:30 PM',  source: 'opentable', party: 2 },
      { time: '21:00', label: '9:00 PM',  source: 'opentable', party: 2 },
    ],
    sentiment: { positive: 0.91, neutral: 0.07, negative: 0.02, compound: 0.94 },
    uberMinutes: 12, uberCost: 8,
    aiHighlight: 'Open-fire kitchen in the jungle — no electricity, no freezers. One of Mexico\'s most unique dining experiences.',
    reservationWindow: '90 days',
    tags: ['romantic', 'outdoor', 'wood-fire', 'honeymoon', 'tulum'],
    imageGradient: 'linear-gradient(160deg, #6B4226 0%, #2D4A1E 45%, #1A2E10 100%)',
  },
  {
    id:               'expendio-maiz-cdmx',
    name:             'Expendio de Maíz',
    cuisine:          'Contemporary Mexican Tasting',
    location:         'Colonia Doctores, Mexico City',
    destination:      'Mexico City',
    pricePerPerson:   87,
    rating:           9.2,
    michelinStars:    undefined,
    bestIn50:         undefined,
    sources:          ['resy', 'michelin'],
    sourceCount:      2,
    aiConfidence:     0.91,
    availableSlots: [
      { time: '19:00', label: '7:00 PM',  source: 'resy+michelin', party: 2 },
      { time: '20:00', label: '8:00 PM',  source: 'resy',          party: 2 },
      { time: '21:00', label: '9:00 PM',  source: 'resy',          party: 2 },
    ],
    sentiment: { positive: 0.88, neutral: 0.09, negative: 0.03, compound: 0.91 },
    uberMinutes: 18, uberCost: 6,
    aiHighlight: '10-course corn-origin tasting menu. Location changes weekly — AI tracks it. Michelin Bib Gourmand 2024.',
    reservationWindow: '14 days',
    tags: ['intimate', 'tasting-menu', 'cdmx', 'hidden', 'michelin-bib'],
    imageGradient: 'linear-gradient(160deg, #7B3F00 0%, #C8860C 45%, #4A2511 100%)',
  },
  {
    id:               'manta-los-cabos',
    name:             'Manta Los Cabos',
    cuisine:          'Pacific Rim & Mexican Seafood',
    location:         'The Cape, A Thompson Hotel',
    destination:      'Los Cabos',
    pricePerPerson:   140,
    rating:           9.0,
    sources:          ['tock'],
    sourceCount:      1,
    aiConfidence:     0.89,
    availableSlots: [
      { time: '17:30', label: '5:30 PM',  source: 'tock', party: 2 },
      { time: '18:00', label: '6:00 PM',  source: 'tock', party: 2 },
      { time: '18:30', label: '6:30 PM',  source: 'tock', party: 2 },
      { time: '19:00', label: '7:00 PM',  source: 'tock', party: 2 },
      { time: '19:30', label: '7:30 PM',  source: 'tock', party: 2 },
      { time: '20:00', label: '8:00 PM',  source: 'tock', party: 2 },
      { time: '20:30', label: '8:30 PM',  source: 'tock', party: 2 },
    ],
    sentiment: { positive: 0.86, neutral: 0.11, negative: 0.03, compound: 0.90 },
    uberMinutes: 5, uberCost: 12,
    aiHighlight: 'Best sunset dining in Cabo. Tasting menu changes with Pacific season — book 60 days ahead.',
    reservationWindow: '60 days',
    tags: ['romantic', 'ocean-view', 'seafood', 'sunset', 'honeymoon', 'cabo'],
    imageGradient: 'linear-gradient(160deg, #0D47A1 0%, #00838F 45%, #B2EBF2 100%)',
  },
  {
    id:               'catch-miami-beach',
    name:             'Catch Miami',
    cuisine:          'Global Bites & Seafood',
    location:         'Collins Ave, Miami Beach',
    destination:      'Miami',
    pricePerPerson:   95,
    rating:           8.7,
    sources:          ['opentable', 'resy'],
    sourceCount:      2,
    aiConfidence:     0.88,
    availableSlots: [
      // OpenTable + Resy slots MERGED and DEDUPED by the backend
      // 8:30 PM appears on both engines → merged into one pill with source "opentable+resy"
      { time: '19:00', label: '7:00 PM',  source: 'opentable',      party: 2 },
      { time: '19:30', label: '7:30 PM',  source: 'resy',           party: 2 },
      { time: '20:00', label: '8:00 PM',  source: 'opentable',      party: 2 },
      { time: '20:30', label: '8:30 PM',  source: 'opentable+resy', party: 2 },  // MERGED
      { time: '21:00', label: '9:00 PM',  source: 'opentable+resy', party: 2 },  // MERGED
      { time: '21:30', label: '9:30 PM',  source: 'resy',           party: 2 },
      { time: '22:00', label: '10:00 PM', source: 'opentable',      party: 2 },
    ],
    sentiment: { positive: 0.82, neutral: 0.14, negative: 0.04, compound: 0.87 },
    uberMinutes: 8, uberCost: 14,
    aiHighlight: 'Signature aerial display. OpenTable + Resy merged — 7 unified slots. Reserve the rooftop for sunset over the bay.',
    reservationWindow: '30 days',
    tags: ['party', 'rooftop', 'seafood', 'miami', 'high-energy'],
    imageGradient: 'linear-gradient(160deg, #AD1457 0%, #F06292 45%, #FFB74D 100%)',
  },
];

// ── Props ─────────────────────────────────────────────────────────────────────

export type DiningSearchState = 'idle' | 'loading' | 'results';

export interface DiningBentoProps {
  searchState:  DiningSearchState;
  engineCount:  number;
  restaurants?: MergedRestaurant[];
}

// ── Drag handle ───────────────────────────────────────────────────────────────

function DragHandle({
  restaurant,
  selectedTime,
  dragRef,
}: {
  restaurant:   MergedRestaurant;
  selectedTime: string | undefined;
  dragRef:      React.RefObject<HTMLDivElement | null>;
}) {
  const activeDay = useTravelEngine(s => s.activeDay);
  const days      = useTravelEngine(s => s.days);
  const [committing, setCommitting] = useState(false);
  const [committed, setCommitted]   = useState(false);

  const payload = {
    id:         restaurant.id,
    type:       'restaurant' as const,
    title:      restaurant.name,
    subtitle:   `${restaurant.cuisine}${selectedTime ? ` · ${selectedTime}` : ''}`,
    price:      restaurant.pricePerPerson * 2,
    currency:   'USD',
    icon:       '🍽',
    sourceZone: 'dining',
  };

  const handleDragEnd = useCallback(async (
    event: { point: { x: number; y: number } }
  ) => {
    setCommitting(true);
    const result = await onDragEndWithPhysics(
      event,
      dragRef.current,
      payload,
      selectedTime,
    );
    setCommitting(false);
    if (result.committed) {
      setCommitted(true);
      setTimeout(() => setCommitted(false), 2400);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTime, activeDay, days]);

  return (
    <motion.div
      ref={dragRef}
      drag
      dragElastic={0.14}
      dragMomentum={false}
      dragSnapToOrigin={true}
      onDragEnd={(_, info) => handleDragEnd(info)}
      whileDrag={{
        scale:     1.06,
        boxShadow: `0 16px 48px ${COLOR}3C, 0 0 0 2px ${COLOR}`,
        zIndex:    100,
        cursor:    'grabbing',
      }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      animate={{
        background: committed
          ? 'rgba(48,209,88,0.12)'
          : `${COLOR}10`,
        border: committed
          ? '1.5px solid rgba(48,209,88,0.30)'
          : `1.5px solid ${COLOR}28`,
      }}
      style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        gap:            10,
        paddingBlock:   10,
        paddingInline:  14,
        borderRadius:   12,
        cursor:         'grab',
        userSelect:     'none',
        WebkitUserSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ fontSize: 14 }} aria-hidden>⠿</span>
        <div>
          <div style={{
            fontSize: 11, fontWeight: 800,
            color: committed ? '#30D158' : COLOR,
            letterSpacing: '-0.01em',
          }}>
            {committed   ? '✓ Added to Timeline' :
             committing  ? 'Committing…' :
             selectedTime ? `Drag to timeline · ${selectedTime}` :
             'Select a slot, then drag'}
          </div>
          {!committed && !committing && (
            <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 1 }}>
              ${(restaurant.pricePerPerson * 2).toLocaleString()} for 2 · reduces budget
            </div>
          )}
        </div>
      </div>
      {!committed && (
        <div style={{
          fontSize: 9, fontWeight: 800, color: COLOR,
          background: `${COLOR}14`, border: `1px solid ${COLOR}28`,
          borderRadius: 6, paddingBlock: 3, paddingInline: 7,
        }}>
          AUTO-RESERVE AI
        </div>
      )}
    </motion.div>
  );
}

// ── Hero card ─────────────────────────────────────────────────────────────────

function RestaurantCard({ restaurant }: { restaurant: MergedRestaurant }) {
  const [expanded, setExpanded]       = useState(false);
  const [selectedTime, setSelectedTime] = useState<string | undefined>();
  const dragRef = useRef<HTMLDivElement | null>(null);

  const activeDay = useTravelEngine(s => s.activeDay);

  const handleSlotSelect = useCallback((slot: TimeSlot) => {
    setSelectedTime(prev => prev === slot.time ? undefined : slot.time);
  }, []);

  const michelinBadge = restaurant.michelinStars
    ? '⭐'.repeat(restaurant.michelinStars)
    : null;

  return (
    <motion.div
      layoutId={`dining-card-${restaurant.id}`}
      layout
      style={{
        borderRadius:         18,
        overflow:             'hidden',
        background:           'rgba(255,255,255,0.92)',
        backdropFilter:       'blur(40px) saturate(1.9)',
        WebkitBackdropFilter: 'blur(40px) saturate(1.9)',
        border:               '1px solid rgba(0,0,0,0.07)',
        boxShadow:            '0 4px 24px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,1)',
      }}
    >
      {/* Photo header */}
      <div
        style={{
          height:     148,
          background: restaurant.imageGradient,
          position:   'relative',
          cursor:     'pointer',
        }}
        onClick={() => setExpanded(v => !v)}
      >
        {/* Scrim */}
        <div style={{
          position:   'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.56) 0%, transparent 60%)',
        }} />

        {/* Dedup badge — shown only when sourceCount > 1 */}
        {restaurant.sourceCount > 1 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={SPRING}
            style={{
              position:      'absolute', top: 10, insetInlineStart: 12,
              display:       'flex', alignItems: 'center', gap: 5,
              paddingBlock:  4, paddingInline: 9, borderRadius: 99,
              background:    'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border:        '1px solid rgba(255,255,255,0.18)',
            }}
          >
            <motion.span
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.8, repeat: Infinity }}
              style={{ width: 5, height: 5, borderRadius: '50%', background: '#30D158' }}
              aria-hidden
            />
            <span style={{ fontSize: 9, fontWeight: 700, color: '#fff' }}>
              {restaurant.sourceCount} sources merged
            </span>
          </motion.div>
        )}

        {/* Michelin badge */}
        {michelinBadge && (
          <div style={{
            position:      'absolute', top: 10, insetInlineEnd: 12,
            fontSize: 9, fontWeight: 800,
            paddingBlock: 3, paddingInline: 8, borderRadius: 7,
            background: 'rgba(220,30,30,0.88)',
            color: '#fff', letterSpacing: '0.02em',
          }}>
            {michelinBadge} MICHELIN
          </div>
        )}

        {/* Bottom meta */}
        <div style={{
          position: 'absolute', bottom: 12, insetInlineStart: 14, insetInlineEnd: 14,
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
              {restaurant.name}
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.82)', marginTop: 2, letterSpacing: '-0.01em' }}>
              {restaurant.cuisine} · {restaurant.location}
            </div>
          </div>
          <div style={{ textAlign: 'end' }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em' }}>
              ${restaurant.pricePerPerson}
            </div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.70)' }}>per person</div>
          </div>
        </div>

        {/* Expand indicator */}
        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={SPRING}
          style={{
            position:  'absolute', top: 10,
            insetInlineStart: restaurant.sourceCount > 1 ? undefined : 12,
            insetInlineEnd: restaurant.sourceCount > 1 ? 12 : undefined,
            width: 24, height: 24, borderRadius: '50%',
            background: 'rgba(0,0,0,0.40)',
            backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, color: '#fff',
            cursor: 'pointer',
          }}
          aria-hidden
        >
          ↓
        </motion.div>
      </div>

      {/* Card body */}
      <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* AI highlight */}
        <p style={{
          fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)',
          lineHeight: 1.55, letterSpacing: '-0.01em', margin: 0,
        }}>
          {restaurant.aiHighlight}
        </p>

        {/* Quick stats row */}
        <div style={{ display: 'flex', gap: 8 }}>
          <StatPill icon="⭐" label={`${restaurant.rating} / 10`} color={COLOR} />
          <StatPill icon="🚗" label={`${restaurant.uberMinutes}min Uber`} color="#8E8E93" />
          <StatPill icon="📅" label={restaurant.reservationWindow} color="#8E8E93" />
        </div>

        {/* Compact slot strip (always visible) */}
        <TableSlotGrid
          slots={restaurant.availableSlots}
          dayId={activeDay ?? undefined}
          blockers={[DEMO_BLOCKER]}
          selectedTime={selectedTime}
          onSelect={handleSlotSelect}
          color={COLOR}
          compact
        />

        {/* Expanded detail */}
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              key="expanded"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 4 }}>
                {/* Full slot grid */}
                <div>
                  <p style={{ fontSize: 9, fontWeight: 700, color: '#AEAEB2', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                    Full Availability
                  </p>
                  <TableSlotGrid
                    slots={restaurant.availableSlots}
                    dayId={activeDay ?? undefined}
                    blockers={[DEMO_BLOCKER]}
                    selectedTime={selectedTime}
                    onSelect={handleSlotSelect}
                    color={COLOR}
                  />
                </div>

                {/* Sentiment */}
                <SentimentGauge
                  sources={restaurant.sources}
                  sourceCount={restaurant.sourceCount}
                  bestPriceSource={restaurant.sources[0] ?? 'OpenTable'}
                  bestPrice={restaurant.pricePerPerson}
                  bestTrustSource={restaurant.sources[0] ?? 'Michelin'}
                  trustScore={parseFloat(restaurant.rating.toFixed(1))}
                  sentiment={restaurant.sentiment}
                  aiConfidence={restaurant.aiConfidence}
                  compact={false}
                  color={COLOR}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Drag-to-reserve */}
        <DragHandle
          restaurant={restaurant}
          selectedTime={selectedTime}
          dragRef={dragRef}
        />
      </div>
    </motion.div>
  );
}

function StatPill({ icon, label, color }: { icon: string; label: string; color: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4,
      paddingBlock: 4, paddingInline: 8, borderRadius: 7,
      background: `${color}0C`, border: `1px solid ${color}1A`,
    }}>
      <span style={{ fontSize: 11 }} aria-hidden>{icon}</span>
      <span style={{ fontSize: 10, fontWeight: 600, color, letterSpacing: '-0.01em' }}>{label}</span>
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton({ engineCount }: { engineCount: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          paddingBlock: 12, paddingInline: 16, borderRadius: 14,
          background: `${COLOR}08`, border: `1px solid ${COLOR}18`,
        }}
      >
        <motion.span
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 0.85, repeat: Infinity, ease: 'linear' }}
          style={{ fontSize: 16, color: COLOR, display: 'inline-block' }}
          aria-hidden
        >
          ✦
        </motion.span>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: COLOR, letterSpacing: '-0.01em' }}>
            Scanning {engineCount} culinary engines…
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
            Deduplicating restaurants · Merging reservation slots
          </div>
        </div>
      </motion.div>
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 0.55, y: 0 }}
          transition={{ delay: i * 0.1 }}
          style={{
            height: 260, borderRadius: 18,
            background: 'rgba(0,0,0,0.04)',
            border: '1px solid rgba(0,0,0,0.06)',
          }}
        />
      ))}
    </div>
  );
}

// ── Idle state ────────────────────────────────────────────────────────────────

function IdleState() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            16,
        height:         '100%',
        textAlign:      'center',
        padding:        40,
      }}
    >
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        style={{ fontSize: 56 }}
        aria-hidden
      >
        🍽️
      </motion.div>
      <div>
        <h2 style={{
          margin: 0, fontSize: 20, fontWeight: 900,
          color: 'var(--text-primary)', letterSpacing: '-0.04em',
        }}>
          Culinary Intelligence
        </h2>
        <p style={{
          margin: '8px 0 0', fontSize: 13, fontWeight: 500,
          color: 'var(--text-secondary)', letterSpacing: '-0.01em',
          lineHeight: 1.55, maxWidth: 340,
        }}>
          Select your vibe, dietary preferences, and dining engines — then search.
          The AI merges availability from OpenTable, Resy, and 28 other platforms
          into a single, conflict-free time grid.
        </p>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        {['🔥 Michelin tracking', '📅 Live slot merge', '🗓 Timeline sync'].map(t => (
          <div key={t} style={{
            fontSize: 10, fontWeight: 700,
            paddingBlock: 5, paddingInline: 12,
            borderRadius: 99, background: `${COLOR}0E`,
            border: `1px solid ${COLOR}22`, color: COLOR,
          }}>
            {t}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function DiningBento({
  searchState,
  engineCount,
  restaurants = MOCK_RESTAURANTS,
}: DiningBentoProps) {
  if (searchState === 'idle')    return <IdleState />;
  if (searchState === 'loading') return <LoadingSkeleton engineCount={engineCount} />;

  return (
    <LayoutGroup>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
      >
        {/* Results header */}
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING}
          style={{ display: 'flex', alignItems: 'center', gap: 10 }}
        >
          <div style={{ flex: 1 }}>
            <h2 style={{
              margin: 0, fontSize: 18, fontWeight: 900,
              color: 'var(--text-primary)', letterSpacing: '-0.04em',
            }}>
              {restaurants.length} Restaurants
            </h2>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--text-tertiary)', letterSpacing: '-0.01em' }}>
              AI-distilled · Duplicates merged · Slots cross-referenced with your timeline
            </p>
          </div>
          <div style={{
            fontSize: 10, fontWeight: 800, color: COLOR,
            background: `${COLOR}10`, border: `1.5px solid ${COLOR}28`,
            borderRadius: 10, paddingBlock: 5, paddingInline: 11,
          }}>
            🔥 {restaurants.filter(r => r.sourceCount > 1).length} deduped
          </div>
        </motion.div>

        {/* Cards */}
        {restaurants.map((r, i) => (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING, delay: i * 0.07 }}
          >
            <RestaurantCard restaurant={r} />
          </motion.div>
        ))}
      </motion.div>
    </LayoutGroup>
  );
}
