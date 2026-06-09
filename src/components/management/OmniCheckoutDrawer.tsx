'use client';

import { useEffect }               from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter }               from 'next/navigation';
import { useCheckoutEngine }       from '@/store/useCheckoutEngine';
import { useTravelEngine }         from '@/store/useTravelEngine';
import { useCurrencyFormatter }    from '@/utils/CurrencyEngine';
import { CollisionResolver }       from '@/components/management/CollisionResolver';

// ── Design tokens ─────────────────────────────────────────────────────────────

const SPRING     = { type: 'spring', stiffness: 380, damping: 30 } as const;
const SPRING_POP = { type: 'spring', stiffness: 520, damping: 28 } as const;
const AZURE      = '#007AFF';
const INDIGO     = '#5E5CE6';
const EMERALD    = '#30D158';
const GOLD       = '#FF9F0A';

const TRAVELER_COLORS = ['#007AFF', '#BF5AF2', '#30D158', '#FF9F0A'];

// ── Sweeping light shimmer on the authorize button ────────────────────────────

function ButtonShimmer() {
  return (
    <motion.div
      aria-hidden
      animate={{ x: ['-120%', '220%'] }}
      transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 2.5, ease: 'easeInOut' }}
      style={{
        position:   'absolute',
        inset:      0,
        width:      '35%',
        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.28) 50%, transparent 100%)',
        transform:  'skewX(-18deg)',
        pointerEvents: 'none',
      }}
    />
  );
}

// ── Auth progress overlay ─────────────────────────────────────────────────────

function AuthOverlay({ step }: { step: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{    opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={{
        position:             'absolute',
        inset:                0,
        background:           'rgba(255,255,255,0.72)',
        backdropFilter:       'blur(20px) saturate(1.8)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.8)',
        zIndex:               50,
        display:              'flex',
        flexDirection:        'column',
        alignItems:           'center',
        justifyContent:       'center',
        gap:                  16,
        borderRadius:         'inherit',
      }}
    >
      {/* Orbital spinner */}
      <div style={{ position: 'relative', width: 52, height: 52 }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
          style={{
            position:    'absolute',
            inset:       0,
            borderRadius: '50%',
            border:      `2.5px solid ${AZURE}22`,
            borderTop:   `2.5px solid ${AZURE}`,
          }}
        />
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 2.1, repeat: Infinity, ease: 'linear' }}
          style={{
            position:    'absolute',
            inset:       8,
            borderRadius: '50%',
            border:      `2px solid ${INDIGO}22`,
            borderBottom:`2px solid ${INDIGO}`,
          }}
        />
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16,
        }}>
          ✦
        </div>
      </div>

      {/* Step text */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{    opacity: 0, y: -4 }}
          transition={SPRING_POP}
          style={{
            fontSize: 12, fontWeight: 700, color: '#48484A',
            letterSpacing: '-0.02em', textAlign: 'center',
          }}
        >
          {step}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

// ── Main drawer ───────────────────────────────────────────────────────────────

export function OmniCheckoutDrawer() {
  const router = useRouter();

  const {
    isOpen, isAuthorizing, isComplete, conflicts, authStep,
    close, validateTimeline, authorize,
  } = useCheckoutEngine();

  const { format } = useCurrencyFormatter();
  const trip       = useTravelEngine(s => s.trip);
  const days       = useTravelEngine(s => s.days);
  const budget     = useTravelEngine(s => s.budget);

  const travelers     = trip.travelers;
  const totalSpent    = budget.spent;
  const perPerson     = travelers.length > 0 ? Math.round(totalSpent / travelers.length) : 0;
  const totalEntities = days.flatMap(d => d.entities).length;

  // Navigate to success page when complete
  useEffect(() => {
    if (isComplete) {
      close();
      router.push('/zone/management/success');
    }
  }, [isComplete, close, router]);

  // Validate on open
  useEffect(() => {
    if (isOpen) validateTimeline();
  }, [isOpen, validateTimeline]);

  const handleAuthorize = async () => {
    if (conflicts.length > 0 || isAuthorizing) return;
    await authorize();
  };

  const hasConflicts = conflicts.length > 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{    opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={close}
            style={{
              position:   'absolute',
              inset:      0,
              background: 'rgba(0,0,0,0.18)',
              backdropFilter: 'blur(2px)',
              zIndex:     40,
            }}
          />

          {/* Drawer */}
          <motion.div
            key="drawer"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{    y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 360 }}
            style={{
              position:             'absolute',
              bottom:               0,
              left:                 0,
              right:                0,
              zIndex:               50,
              borderRadius:         '32px 32px 0 0',
              background:           'rgba(255,255,255,0.85)',
              backdropFilter:       'blur(48px) saturate(2)',
              WebkitBackdropFilter: 'blur(48px) saturate(2)',
              border:               '1.5px solid rgba(255,255,255,0.90)',
              borderBottom:         'none',
              boxShadow:            '0 -16px 64px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,1)',
              overflow:             'hidden',
              maxHeight:            '88vh',
              display:              'flex',
              flexDirection:        'column',
            }}
          >
            {/* Auth overlay */}
            <AnimatePresence>
              {isAuthorizing && <AuthOverlay step={authStep} />}
            </AnimatePresence>

            {/* Drag handle */}
            <div style={{
              width: 36, height: 4, borderRadius: 2,
              background: 'rgba(0,0,0,0.12)',
              margin: '12px auto 0',
              flexShrink: 0,
            }} />

            {/* Scrollable content */}
            <div
              className="no-scrollbar"
              style={{ flex: 1, overflowY: 'auto', padding: '16px 22px 0' }}
            >
              {/* Header */}
              <div style={{
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', marginBottom: 18,
              }}>
                <div>
                  <h2 style={{
                    margin: 0, fontSize: 20, fontWeight: 900,
                    letterSpacing: '-0.04em', color: '#1C1C1E',
                  }}>
                    Omni-Booking
                  </h2>
                  <p style={{
                    margin: '3px 0 0', fontSize: 11, fontWeight: 500, color: '#8E8E93',
                  }}>
                    {totalEntities} item{totalEntities !== 1 ? 's' : ''}
                    {trip.title && ` · ${trip.title.split('·').pop()?.trim()}`}
                  </p>
                </div>
                <motion.button
                  onClick={close}
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  transition={SPRING}
                  style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'rgba(0,0,0,0.06)', border: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', fontSize: 14, color: '#6E6E73',
                    fontFamily: 'inherit',
                  }}
                >
                  ✕
                </motion.button>
              </div>

              {/* Collision resolver — shows when conflicts exist */}
              {hasConflicts && (
                <div style={{ marginBottom: 16 }}>
                  <CollisionResolver />
                </div>
              )}

              {/* Total price — glowing CurrencyEngine display */}
              <motion.div
                animate={{
                  boxShadow: hasConflicts
                    ? 'none'
                    : `0 0 32px rgba(0,122,255,0.12), inset 0 1px 0 rgba(255,255,255,0.9)`,
                }}
                transition={{ duration: 0.5 }}
                style={{
                  paddingBlock:         18,
                  paddingInline:        20,
                  borderRadius:         20,
                  background:           hasConflicts ? 'rgba(0,0,0,0.03)' : `${AZURE}06`,
                  border:               `1.5px solid ${hasConflicts ? 'rgba(0,0,0,0.06)' : `${AZURE}18`}`,
                  marginBottom:         16,
                  display:              'flex',
                  alignItems:           'center',
                  justifyContent:       'space-between',
                }}
              >
                <div>
                  <div style={{
                    fontSize: 10, fontWeight: 700, color: '#8E8E93',
                    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4,
                  }}>
                    Total
                  </div>
                  <div style={{
                    fontSize: 32, fontWeight: 900, color: hasConflicts ? '#8E8E93' : AZURE,
                    letterSpacing: '-0.05em', lineHeight: 1,
                    textShadow: hasConflicts ? 'none' : `0 0 24px ${AZURE}50`,
                  }}>
                    {format(totalSpent)}
                  </div>
                </div>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: '#8E8E93',
                  textAlign: 'end', lineHeight: 1.5,
                }}>
                  <div>{totalEntities} items</div>
                  <div>{trip.nights} nights</div>
                </div>
              </motion.div>

              {/* Per-traveler breakdown pills */}
              {travelers.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
                  {travelers.map((name, i) => (
                    <motion.div
                      key={name}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ ...SPRING_POP, delay: i * 0.08 }}
                      style={{
                        display:              'flex',
                        alignItems:           'center',
                        gap:                  8,
                        paddingBlock:         10,
                        paddingInline:        14,
                        borderRadius:         14,
                        background:           `${TRAVELER_COLORS[i % TRAVELER_COLORS.length]}08`,
                        border:               `1.5px solid ${TRAVELER_COLORS[i % TRAVELER_COLORS.length]}20`,
                        backdropFilter:       'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        flex:                 1, minWidth: 120,
                      }}
                    >
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: `${TRAVELER_COLORS[i % TRAVELER_COLORS.length]}18`,
                        border: `1.5px solid ${TRAVELER_COLORS[i % TRAVELER_COLORS.length]}40`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 800,
                        color: TRAVELER_COLORS[i % TRAVELER_COLORS.length],
                        flexShrink: 0,
                      }}>
                        {name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: '#8E8E93' }}>
                          {name}&apos;s Share
                        </div>
                        <div style={{
                          fontSize: 15, fontWeight: 900,
                          color: TRAVELER_COLORS[i % TRAVELER_COLORS.length],
                          letterSpacing: '-0.03em',
                        }}>
                          {format(perPerson)}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Provider summary */}
              <div style={{ marginBottom: 20 }}>
                {[
                  { cat: 'flight',     icon: '✈', label: 'Duffel Aviation',    color: AZURE },
                  { cat: 'hotel',      icon: '🏨', label: 'Booking.com',        color: '#5E5CE6' },
                  { cat: 'restaurant', icon: '🍽', label: 'OpenTable Reserve',  color: GOLD },
                  { cat: 'activity',   icon: '🎭', label: 'Viator Experiences', color: EMERALD },
                ].map(({ cat, icon, label, color }) => {
                  const count = days.flatMap(d => d.entities).filter(e => e.category === cat).length;
                  if (count === 0) return null;
                  return (
                    <div key={cat} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      paddingBlock: 8, paddingInline: 12,
                      borderBottom: '1px solid rgba(0,0,0,0.04)',
                    }}>
                      <span style={{ fontSize: 14 }}>{icon}</span>
                      <span style={{ flex: 1, fontSize: 11, fontWeight: 600, color: '#48484A' }}>
                        {label}
                      </span>
                      <span style={{
                        fontSize: 10, fontWeight: 800,
                        background: `${color}10`, border: `1px solid ${color}25`,
                        color, borderRadius: 6, paddingBlock: 2, paddingInline: 7,
                      }}>
                        {count} item{count !== 1 ? 's' : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Fixed bottom CTA */}
            <div style={{
              padding:      '14px 22px 28px',
              flexShrink:   0,
              borderTop:    '1px solid rgba(0,0,0,0.05)',
              background:   'rgba(255,255,255,0.60)',
              backdropFilter: 'blur(16px)',
            }}>
              <motion.button
                onClick={handleAuthorize}
                disabled={hasConflicts || isAuthorizing}
                whileHover={!hasConflicts && !isAuthorizing ? {
                  scale: 1.01,
                  boxShadow: '0 16px 56px rgba(0,122,255,0.38), inset 0 1px 0 rgba(255,255,255,0.4)',
                } : {}}
                whileTap={!hasConflicts && !isAuthorizing ? { scale: 0.98 } : {}}
                animate={{
                  background: hasConflicts
                    ? 'linear-gradient(135deg, rgba(0,122,255,0.25) 0%, rgba(94,92,230,0.25) 100%)'
                    : 'linear-gradient(135deg, #007AFF 0%, #5E5CE6 100%)',
                }}
                transition={SPRING}
                style={{
                  position:       'relative',
                  width:          '100%',
                  paddingBlock:   18,
                  borderRadius:   20,
                  border:         'none',
                  overflow:       'hidden',
                  color:          '#fff',
                  fontSize:       16,
                  fontWeight:     900,
                  letterSpacing:  '-0.03em',
                  cursor:         hasConflicts || isAuthorizing ? 'not-allowed' : 'pointer',
                  fontFamily:     'inherit',
                  boxShadow:      hasConflicts
                    ? 'none'
                    : '0 8px 32px rgba(0,122,255,0.30), inset 0 1px 0 rgba(255,255,255,0.28)',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  gap:            12,
                }}
              >
                {/* Sweeping light reflection */}
                {!hasConflicts && <ButtonShimmer />}

                <span style={{ position: 'relative', zIndex: 1 }}>
                  {hasConflicts
                    ? `Resolve ${conflicts.length} conflict${conflicts.length !== 1 ? 's' : ''} first`
                    : 'Authorize Omni-Booking'
                  }
                </span>

                {!hasConflicts && (
                  <span style={{
                    position:      'relative',
                    zIndex:        1,
                    fontSize:      13,
                    fontWeight:    700,
                    background:    'rgba(255,255,255,0.16)',
                    borderRadius:  9,
                    paddingBlock:  4,
                    paddingInline: 10,
                    letterSpacing: '-0.01em',
                  }}>
                    {format(totalSpent)}
                  </span>
                )}
              </motion.button>

              {!hasConflicts && (
                <p style={{
                  margin: '8px 0 0', textAlign: 'center',
                  fontSize: 9.5, color: '#AEAEB2', fontWeight: 500, letterSpacing: '-0.01em',
                }}>
                  All bookings are final · Cancellation policies apply
                </p>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
