'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence }         from 'framer-motion';
import Link                                from 'next/link';
import { useTravelEngine }                 from '@/store/useTravelEngine';
import type { PlacedEntity, EngineDay }    from '@/store/useTravelEngine';
import { ShareableTrip }                   from '@/components/export/ShareableTrip';
import { triggerICSExport }                from '@/utils/OmniSyncEngine';

// ── Design tokens ─────────────────────────────────────────────────────────────

const EMERALD = '#30D158';
const AZURE   = '#007AFF';
const AMBER   = '#FF9F0A';
const RED     = '#FF453A';
const SPRING  = { type: 'spring', stiffness: 380, damping: 28 } as const;

const CATEGORY_ICON: Record<string, string> = {
  flight:     '✈️',
  hotel:      '🏨',
  restaurant: '🍽️',
  activity:   '🎭',
  transport:  '🚗',
};

const CATEGORY_COLOR: Record<string, string> = {
  flight:     AZURE,
  hotel:      '#5E5CE6',
  restaurant: AMBER,
  activity:   EMERALD,
  transport:  '#00C7BE',
};

// ── Types ─────────────────────────────────────────────────────────────────────

type BookingStatus = 'idle' | 'pending' | 'confirmed' | 'failed';

interface EntityRow {
  entity: PlacedEntity;
  day:    EngineDay;
  ref:    string;
}

// ── SVG Progress Ring ─────────────────────────────────────────────────────────
// Ring fills as each entity commits to the timeline.
// Status drives color: pending → azure, confirmed → emerald glow, failed → red.

function ProgressRing({ status }: { status: BookingStatus }) {
  const R    = 14;
  const circ = 2 * Math.PI * R;

  const fillFraction = status === 'confirmed' || status === 'failed' ? 1
                     : status === 'pending' ? 0.82
                     : 0;

  const strokeColor = status === 'confirmed' ? EMERALD
                    : status === 'failed'    ? RED
                    : status === 'pending'   ? AZURE
                    : 'transparent';

  const glowFilter = status === 'confirmed'
    ? 'drop-shadow(0px 0px 7px rgba(48,209,88,0.65))'
    : 'none';

  return (
    <motion.svg
      width={40}
      height={40}
      viewBox="0 0 32 32"
      style={{ flexShrink: 0, overflow: 'visible', transform: 'rotate(-90deg)' }}
      animate={{ filter: glowFilter }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Track */}
      <circle
        cx={16} cy={16} r={R}
        fill="none"
        stroke="rgba(0,0,0,0.07)"
        strokeWidth={2.5}
      />
      {/* Fill */}
      <motion.circle
        cx={16} cy={16} r={R}
        fill="none"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeDasharray={circ}
        animate={{
          stroke:          strokeColor,
          strokeDashoffset: circ * (1 - fillFraction),
        }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      />
    </motion.svg>
  );
}

// ── Entity row ────────────────────────────────────────────────────────────────

function EntityRow({
  row,
  status,
  isLast,
}: {
  row:    EntityRow;
  status: BookingStatus;
  isLast: boolean;
}) {
  const { entity } = row;
  const color = CATEGORY_COLOR[entity.category] ?? AZURE;

  return (
    <motion.div
      animate={{
        background: status === 'confirmed'
          ? 'rgba(48,209,88,0.04)'
          : 'transparent',
        boxShadow: status === 'confirmed'
          ? 'inset 0 0 0 1px rgba(48,209,88,0.14)'
          : 'none',
      }}
      transition={{ duration: 0.5 }}
      style={{
        display:        'flex',
        flexDirection:  'row',
        alignItems:     'center',
        justifyContent: 'space-between',
        gap:            12,
        padding:        16,
        borderBlockEnd: isLast ? 'none' : '1px solid rgba(255,255,255,0.48)',
      }}
    >
      {/* Ring + icon */}
      <div style={{ position: 'relative', flexShrink: 0, width: 40, height: 40 }}>
        {/* Category icon badge */}
        <div style={{
          position:       'absolute',
          inset:          4,
          borderRadius:   8,
          background:     `${color}12`,
          border:         `1px solid ${color}20`,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          fontSize:       14,
          zIndex:         1,
        }}>
          {CATEGORY_ICON[entity.category] ?? '📍'}
        </div>
        {/* Ring overlaid */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 2 }}>
          <ProgressRing status={status} />
        </div>
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize:      12,
          fontWeight:    700,
          color:         'var(--text-primary)',
          letterSpacing: '-0.02em',
          whiteSpace:    'nowrap',
          overflow:      'hidden',
          textOverflow:  'ellipsis',
        }}>
          {entity.title}
        </div>
        <div style={{
          fontSize:      10.5,
          fontWeight:    500,
          color:         'var(--text-secondary)',
          marginTop:     2,
          letterSpacing: '-0.01em',
          whiteSpace:    'nowrap',
          overflow:      'hidden',
          textOverflow:  'ellipsis',
        }}>
          {entity.subtitle}
          {status === 'confirmed' && (
            <span style={{ color: EMERALD, fontWeight: 800, marginInlineStart: 6 }}>
              · {row.ref}
            </span>
          )}
        </div>
      </div>

      {/* Source tag */}
      {entity.tags[0] && (
        <div style={{
          fontSize:      8.5,
          fontWeight:    700,
          color:         color,
          background:    `${color}0E`,
          border:        `1px solid ${color}20`,
          borderRadius:  6,
          paddingBlock:  3,
          paddingInline: 7,
          flexShrink:    0,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          whiteSpace:    'nowrap',
        }}>
          {entity.tags[0]}
        </div>
      )}

      {/* Price */}
      <div style={{
        fontSize:      13,
        fontWeight:    800,
        color:         'var(--text-primary)',
        letterSpacing: '-0.02em',
        flexShrink:    0,
      }}>
        ${entity.price.toLocaleString()}
      </div>

      {/* Status dot */}
      <motion.div
        animate={{
          background: status === 'confirmed' ? EMERALD
                    : status === 'failed'    ? RED
                    : status === 'pending'   ? AZURE
                    : 'rgba(0,0,0,0.10)',
          boxShadow: status === 'confirmed'
            ? '0 0 8px rgba(48,209,88,0.55)'
            : 'none',
        }}
        transition={{ duration: 0.4 }}
        style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0 }}
        aria-label={status}
      />
    </motion.div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CheckoutPage() {
  const trip         = useTravelEngine(s => s.trip);
  const days         = useTravelEngine(s => s.days);
  const budget       = useTravelEngine(s => s.budget);
  const toggleBooked = useTravelEngine(s => s.toggleBooked);

  const rows = useMemo<EntityRow[]>(() =>
    days.flatMap(day =>
      day.entities.map(entity => ({
        entity,
        day,
        ref: `UNI-${entity.id.slice(-6).toUpperCase()}`,
      }))
    ),
    [days]
  );

  const total = useMemo(
    () => rows.reduce((s, r) => s + r.entity.price, 0),
    [rows]
  );

  const [phase,     setPhase]     = useState<'idle' | 'authorizing' | 'complete'>('idle');
  const [statuses,  setStatuses]  = useState<Record<string, BookingStatus>>({});
  const [showShare, setShowShare] = useState(false);

  const setEntityStatus = useCallback((id: string, s: BookingStatus) => {
    setStatuses(prev => ({ ...prev, [id]: s }));
  }, []);

  const authorizeAll = useCallback(async () => {
    if (rows.length === 0 || phase !== 'idle') return;
    setPhase('authorizing');

    // Mark all entities pending simultaneously
    setStatuses(Object.fromEntries(rows.map(r => [r.entity.id, 'pending' as BookingStatus])));

    // Commit each entity with a UX stagger: 300ms apart.
    // toggleBooked() is the real state mutation that fires at end of each ring fill.
    // The stagger is intentional UX choreography (sequential visual commit), not fake API latency.
    await Promise.all(
      rows.map((r, i) =>
        new Promise<void>(resolve => {
          setTimeout(() => {
            toggleBooked(r.day.id, r.entity.id);
            setEntityStatus(r.entity.id, 'confirmed');
            resolve();
          }, 380 + i * 310); // ring fills for 380ms before first commit; 310ms stagger per entity
        })
      )
    );

    // Real export: download .ics for calendar import
    triggerICSExport(days, trip.title || 'My Trip');

    setPhase('complete');
  }, [rows, phase, toggleBooked, days, trip.title, setEntityStatus]);

  // ── Empty state ──────────────────────────────────────────────────────────────

  if (rows.length === 0) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100%', gap: 20, padding: 40, textAlign: 'center',
      }}>
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          style={{ fontSize: 56 }}
          aria-hidden
        >
          🧳
        </motion.div>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, letterSpacing: '-0.04em', color: 'var(--text-primary)' }}>
            Nothing to commit
          </h2>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500, maxWidth: 300, lineHeight: 1.55 }}>
            Add flights, hotels, and dining to your Timeline, then return here to authorize.
          </p>
        </div>
        <Link
          href="/zone/management"
          style={{
            fontSize: 12, fontWeight: 800, color: AZURE,
            background: `${AZURE}10`, border: `1.5px solid ${AZURE}28`,
            borderRadius: 12, paddingBlock: 10, paddingInline: 22,
            textDecoration: 'none',
          }}
        >
          ← Open Timeline
        </Link>
      </div>
    );
  }

  // ── Active days ───────────────────────────────────────────────────────────────

  const activeDays = days.filter(d => d.entities.length > 0);

  return (
    <div style={{
      position:      'relative',
      height:        '100%',
      width:         '100%',
      overflow:      'hidden',
      display:       'flex',
      flexDirection: 'column',
      background: [
        'radial-gradient(ellipse at 18% 0%,   rgba(0,122,255,0.07) 0%, transparent 55%)',
        'radial-gradient(ellipse at 85% 100%, rgba(48,209,88,0.05) 0%, transparent 50%)',
        '#F2F2F7',
      ].join(', '),
    }}>

      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...SPRING, delay: 0.04 }}
        style={{ paddingTop: 24, paddingInline: 22, paddingBottom: 14, flexShrink: 0 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <h1 style={{
            margin: 0, fontSize: 'clamp(1.3rem, 2vw, 1.8rem)',
            fontWeight: 900, letterSpacing: '-0.04em',
            color: 'var(--text-primary)', lineHeight: 1.1,
          }}>
            Commit Matrix
          </h1>
          <motion.span
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2.2, repeat: Infinity }}
            style={{ fontSize: 12, color: AZURE }}
            aria-hidden
          >
            ✦
          </motion.span>
          <AnimatePresence>
            {phase === 'complete' && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={SPRING}
                style={{
                  fontSize: 11, fontWeight: 800, color: EMERALD,
                  background: `${EMERALD}14`, border: `1.5px solid ${EMERALD}30`,
                  borderRadius: 8, paddingBlock: 4, paddingInline: 10,
                }}
              >
                ✓ All Committed
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', letterSpacing: '-0.01em' }}>
          {rows.length} item{rows.length !== 1 ? 's' : ''} across {activeDays.length} day{activeDays.length !== 1 ? 's' : ''}
          {trip.travelers.length > 0 && ` · ${trip.travelers.join(' & ')}`}
          {budget.total > 0 && ` · $${budget.total.toLocaleString()} budget`}
        </p>
      </motion.div>

      {/* ── Entity rows (grouped by day) ── */}
      <div
        className="no-scrollbar"
        style={{
          flex:          1,
          overflowY:     'auto',
          overflowX:     'hidden',
          paddingInline: 16,
          paddingBottom: 124,
        }}
      >
        {activeDays.map((day, di) => (
          <motion.div
            key={day.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING, delay: di * 0.07 }}
            style={{ marginBottom: 14 }}
          >
            {/* Day header */}
            <div style={{
              fontSize: 9.5, fontWeight: 700, color: 'var(--text-tertiary)',
              textTransform: 'uppercase', letterSpacing: '0.06em',
              paddingInline: 4, paddingBlock: '8px 6px',
            }}>
              Day {day.dayNumber} · {day.destination}
              {day.date && ` · ${new Date(day.date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
            </div>

            {/* Glass card */}
            <div style={{
              borderRadius:         20,
              background:           'rgba(255,255,255,0.64)',
              backdropFilter:       'blur(48px) saturate(1.9)',
              WebkitBackdropFilter: 'blur(48px) saturate(1.9)',
              border:               '1.5px solid rgba(255,255,255,0.82)',
              boxShadow:            '0 4px 24px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,1)',
              overflow:             'hidden',
            }}>
              {day.entities.map((entity, ei) => {
                const row = rows.find(r => r.entity.id === entity.id);
                if (!row) return null;
                return (
                  <EntityRow
                    key={entity.id}
                    row={row}
                    status={statuses[entity.id] ?? 'idle'}
                    isLast={ei === day.entities.length - 1}
                  />
                );
              })}
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Bottom CTA ── */}
      <div style={{
        position:             'absolute',
        bottom:               0,
        insetInlineStart:     0,
        insetInlineEnd:       0,
        padding:              '14px 16px 28px',
        background:           'rgba(242,242,247,0.90)',
        backdropFilter:       'blur(32px)',
        WebkitBackdropFilter: 'blur(32px)',
        borderBlockStart:     '1px solid rgba(0,0,0,0.06)',
      }}>
        <AnimatePresence mode="wait">
          {phase === 'complete' ? (
            <motion.div
              key="complete"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={SPRING}
              style={{ display: 'flex', gap: 10 }}
            >
              <motion.button
                onClick={() => setShowShare(true)}
                whileHover={{ scale: 1.02, boxShadow: `0 10px 32px ${EMERALD}44` }}
                whileTap={{ scale: 0.97 }}
                transition={SPRING}
                style={{
                  flex:          1,
                  paddingBlock:  16,
                  borderRadius:  18,
                  border:        'none',
                  background:    `linear-gradient(135deg, ${EMERALD} 0%, #00C7BE 100%)`,
                  color:         '#fff',
                  fontSize:      14,
                  fontWeight:    900,
                  letterSpacing: '-0.02em',
                  cursor:        'pointer',
                  fontFamily:    'inherit',
                  boxShadow:     `0 6px 24px ${EMERALD}44, inset 0 1px 0 rgba(255,255,255,0.30)`,
                }}
              >
                Share Journey ✨
              </motion.button>
              <Link href="/on-trip" style={{ textDecoration: 'none', flexShrink: 0 }}>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  transition={SPRING}
                  style={{
                    paddingBlock:  16,
                    paddingInline: 20,
                    borderRadius:  18,
                    border:        '1.5px solid rgba(0,0,0,0.09)',
                    background:    'rgba(255,255,255,0.82)',
                    color:         'var(--text-primary)',
                    fontSize:      14,
                    fontWeight:    800,
                    letterSpacing: '-0.02em',
                    cursor:        'pointer',
                    display:       'flex',
                    alignItems:    'center',
                    gap:           6,
                    boxShadow:     '0 4px 14px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,1)',
                    whiteSpace:    'nowrap',
                  }}
                >
                  On-Trip OS →
                </motion.div>
              </Link>
            </motion.div>
          ) : (
            <motion.button
              key="authorize"
              onClick={authorizeAll}
              disabled={phase === 'authorizing'}
              whileHover={phase === 'idle' ? {
                scale: 1.01,
                boxShadow: '0 16px 56px rgba(0,122,255,0.36), inset 0 1px 0 rgba(255,255,255,0.4)',
              } : {}}
              whileTap={phase === 'idle' ? { scale: 0.98 } : {}}
              animate={{
                background: phase === 'authorizing'
                  ? 'linear-gradient(135deg, rgba(0,122,255,0.55) 0%, rgba(94,92,230,0.55) 100%)'
                  : 'linear-gradient(135deg, #007AFF 0%, #5E5CE6 100%)',
              }}
              transition={SPRING}
              style={{
                width:          '100%',
                paddingBlock:   18,
                borderRadius:   20,
                border:         'none',
                color:          '#fff',
                fontSize:       15,
                fontWeight:     900,
                letterSpacing:  '-0.03em',
                cursor:         phase === 'idle' ? 'pointer' : 'default',
                fontFamily:     'inherit',
                boxShadow:      '0 8px 32px rgba(0,122,255,0.30), inset 0 1px 0 rgba(255,255,255,0.28)',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                gap:            10,
              }}
            >
              {phase === 'authorizing' ? (
                <>
                  <motion.span
                    animate={{ rotate: [0, 360] }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    style={{ display: 'inline-block', fontSize: 13 }}
                    aria-hidden
                  >
                    ✦
                  </motion.span>
                  Authorizing {rows.length} item{rows.length !== 1 ? 's' : ''}…
                </>
              ) : (
                <>
                  Authorize Omni-Booking
                  <span style={{
                    fontSize: 13, fontWeight: 700,
                    background: 'rgba(255,255,255,0.16)',
                    borderRadius: 8, paddingBlock: 4, paddingInline: 10,
                  }}>
                    ${total.toLocaleString()}
                  </span>
                </>
              )}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* ── Share modal ── */}
      <AnimatePresence>
        {showShare && (
          <ShareableTrip onClose={() => setShowShare(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
