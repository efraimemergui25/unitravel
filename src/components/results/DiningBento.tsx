'use client';

import { useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { GripHorizontal }    from 'lucide-react';
import { SentimentGauge }    from '@/components/results/SentimentGauge';
import { TableSlotGrid }     from '@/components/results/TableSlotGrid';
import { onDragEndWithPhysics } from '@/utils/DropPhysics';
import { useTravelEngine }   from '@/store/useTravelEngine';
import type { MergedRestaurant, TimeSlot } from '@/app/api/dining/route';

// ── Design tokens ─────────────────────────────────────────────────────────────

const COLOR    = '#FF9F0A';
const SPRING   = { type: 'spring', stiffness: 360, damping: 28 } as const;


// ── Props ─────────────────────────────────────────────────────────────────────

export type DiningSearchState = 'idle' | 'loading' | 'results';

export interface DiningBentoProps {
  searchState:  DiningSearchState;
  engineCount:  number;
  results?:     MergedRestaurant[] | null;
  apiStatus?:   'ok' | 'needs_api_key' | 'error' | null;
  apiMessage?:  string | null;
  query?:       { destination: string; date: string; adults: number };
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

  // Click-to-add: dispatches zone-drag-commit so the zone layout global listener handles it
  const handleClick = useCallback(() => {
    if (committed || committing) return;
    document.dispatchEvent(new CustomEvent('unitravel:zone-drag-commit', { detail: payload }));
    setCommitted(true);
    setTimeout(() => setCommitted(false), 2400);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committed, committing, payload.id, payload.title]);

  return (
    <motion.div
      ref={dragRef}
      drag
      dragElastic={0.14}
      dragMomentum={false}
      dragSnapToOrigin={true}
      onDragEnd={(_, info) => handleDragEnd(info)}
      onClick={handleClick}
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
        <GripHorizontal size={13} strokeWidth={2.2} aria-hidden />
        <div>
          <div style={{
            fontSize: 11, fontWeight: 800,
            color: committed ? '#30D158' : COLOR,
            letterSpacing: '-0.01em',
          }}>
            {committed   ? '✓ Added to Timeline' :
             committing  ? 'Adding…' :
             selectedTime ? `Tap or drag · ${selectedTime}` :
             'Tap to add · or drag to a day'}
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
          + ADD
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
        borderRadius:         32,
        overflow:             'hidden',
        background:           'rgba(255,255,255,0.40)',
        backdropFilter:       'blur(40px) saturate(1.9)',
        WebkitBackdropFilter: 'blur(40px) saturate(1.9)',
        border:               '1.5px solid rgba(255,255,255,0.70)',
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
          <StatPill icon="📅" label={restaurant.reservationWindow} color="#8E8E93" />
        </div>

        {/* Compact slot strip (always visible) */}
        <TableSlotGrid
          slots={restaurant.availableSlots}
          dayId={activeDay ?? undefined}
          blockers={[]}
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
                    blockers={[]}
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

        {/* External reservation link — always shown */}
        {restaurant.reservationUrl && (
          <a
            href={restaurant.reservationUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              gap:            6,
              padding:        '8px 14px',
              borderRadius:   11,
              background:     'rgba(255,255,255,0.82)',
              backdropFilter: 'blur(20px)',
              border:         '1px solid rgba(0,0,0,0.09)',
              boxShadow:      '0 2px 8px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.90)',
              fontSize:       11,
              fontWeight:     700,
              color:          '#1D1D1F',
              letterSpacing:  '-0.015em',
              textDecoration: 'none',
              transition:     'box-shadow 0.18s ease',
            }}
            onClick={e => e.stopPropagation()}
          >
            <span style={{ fontSize: 13 }}>📍</span>
            View on Google Maps →
          </a>
        )}
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
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ type: 'spring', stiffness: 340, damping: 28 }}
      style={{
        height: '100%', minHeight: 340, borderRadius: 20, overflow: 'hidden',
        position: 'relative', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(145deg, #FFF8ED 0%, #FFF5E4 35%, #FFF3E0 65%, #FFF0D6 100%)',
        marginTop: 8,
      }}
    >
      {/* Ambient glow orbs */}
      <div aria-hidden style={{ position: 'absolute', top: '-18%', left: '-6%', width: '58%', height: '58%', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(255,159,10,0.14) 0%, transparent 65%)', animation: 'ambient-drift-a 20s ease-in-out infinite', pointerEvents: 'none' }} />
      <div aria-hidden style={{ position: 'absolute', bottom: '-15%', right: '-8%', width: '50%', height: '50%', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(255,69,58,0.09) 0%, transparent 65%)', animation: 'ambient-drift-b 28s ease-in-out infinite', pointerEvents: 'none' }} />

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, paddingInline: 32, textAlign: 'center' }}>
        <motion.div
          animate={{ y: [0, -9, 0], rotate: [0, 2, -1, 0] }}
          transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut' }}
          style={{ fontSize: 56, lineHeight: 1, filter: 'drop-shadow(0 8px 20px rgba(255,159,10,0.28))' }}
          aria-hidden
        >🍽️</motion.div>

        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#1A1200', letterSpacing: '-0.04em', lineHeight: 1.15 }}>
            What are you craving?
          </h2>
          <p style={{ margin: '7px 0 0', fontSize: 13, fontWeight: 500, color: '#48484A', letterSpacing: '-0.012em', lineHeight: 1.6, maxWidth: 320 }}>
            Describe your ideal meal above — Unit merges availability from Michelin, OpenTable, Resy, and 27 more into one perfect recommendation.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', justifyContent: 'center' }}>
          {['🔥 Michelin tracked', '📅 Live reservations', '🗓 Timeline sync'].map(t => (
            <div key={t} style={{
              fontSize: 10.5, fontWeight: 700,
              paddingBlock: 5, paddingInline: 12,
              borderRadius: 99, background: `${COLOR}10`,
              border: `1px solid ${COLOR}28`, color: '#7A3800',
              letterSpacing: '-0.005em',
            }}>
              {t}
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ── Needs API key state ────────────────────────────────────────────────────────

function NeedsApiKeyState({ message }: { message: string | null }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 16, height: '100%', textAlign: 'center', padding: 40,
      }}
    >
      <div style={{ fontSize: 48 }} aria-hidden>🔑</div>
      <div>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.04em' }}>
          Connect Dining API
        </h2>
        <p style={{ margin: '8px 0 0', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', maxWidth: 340, lineHeight: 1.55 }}>
          {message ?? 'Add GOOGLE_PLACES_API_KEY or YELP_API_KEY to .env.local to enable live restaurant search.'}
        </p>
      </div>
      <a
        href="https://console.cloud.google.com/apis/library/places-backend.googleapis.com"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          fontSize: 11, fontWeight: 800, color: COLOR,
          background: `${COLOR}10`, border: `1.5px solid ${COLOR}28`,
          borderRadius: 10, paddingBlock: 8, paddingInline: 16,
          textDecoration: 'none',
        }}
      >
        Get Google Places API Key →
      </a>
    </motion.div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function DiningBento({
  searchState,
  engineCount,
  results,
  apiStatus,
  apiMessage,
}: DiningBentoProps) {
  if (searchState === 'idle')    return <IdleState />;
  if (searchState === 'loading') return <LoadingSkeleton engineCount={engineCount} />;

  if (apiStatus === 'needs_api_key') return <NeedsApiKeyState message={apiMessage ?? null} />;

  if (apiStatus === 'error') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, height: '100%', padding: 40, textAlign: 'center' }}
      >
        <div style={{ fontSize: 40 }} aria-hidden>⚠️</div>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
          {apiMessage ?? 'Search failed. Please try again.'}
        </p>
      </motion.div>
    );
  }

  const restaurants = results ?? [];

  if (restaurants.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, height: '100%', padding: 40, textAlign: 'center' }}
      >
        <div style={{ fontSize: 40 }} aria-hidden>🍽️</div>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
          No restaurants found. Try a different destination or filters.
        </p>
      </motion.div>
    );
  }

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
              Live · Google Places + Yelp · Duplicates merged
            </p>
          </div>
          {restaurants.filter(r => r.sourceCount > 1).length > 0 && (
            <div style={{
              fontSize: 10, fontWeight: 800, color: COLOR,
              background: `${COLOR}10`, border: `1.5px solid ${COLOR}28`,
              borderRadius: 10, paddingBlock: 5, paddingInline: 11,
            }}>
              🔥 {restaurants.filter(r => r.sourceCount > 1).length} deduped
            </div>
          )}
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
