'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence }       from 'framer-motion';
import { QRCodeSVG }                     from 'qrcode.react';
import Link                              from 'next/link';
import { Plane, Hotel, UtensilsCrossed, Compass, Train, MapPin, Zap, Moon, Sun } from 'lucide-react';
import { useTravelEngine }               from '@/store/useTravelEngine';
import type { PlacedEntity, EngineDay }  from '@/store/useTravelEngine';

// ── Design tokens ─────────────────────────────────────────────────────────────

const AZURE   = '#007AFF';
const EMERALD = '#30D158';
const AMBER   = '#FF9F0A';
const RED     = '#FF453A';
const SPRING  = { type: 'spring', stiffness: 340, damping: 30 } as const;

type CatIconComp = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
const CATEGORY_ICON: Record<string, CatIconComp> = {
  flight:     Plane,
  hotel:      Hotel,
  restaurant: UtensilsCrossed,
  activity:   Compass,
  transport:  Train,
};

const CATEGORY_COLOR: Record<string, string> = {
  flight:     AZURE,
  hotel:      '#5E5CE6',
  restaurant: AMBER,
  activity:   EMERALD,
  transport:  '#00C7BE',
};

const CATEGORY_GRADIENT: Record<string, string> = {
  flight:     'linear-gradient(135deg, #007AFF 0%, #5E5CE6 100%)',
  hotel:      'linear-gradient(135deg, #5E5CE6 0%, #BF5AF2 100%)',
  restaurant: 'linear-gradient(135deg, #FF9F0A 0%, #FF453A 100%)',
  activity:   'linear-gradient(135deg, #30D158 0%, #007AFF 100%)',
  transport:  'linear-gradient(135deg, #00C7BE 0%, #5E5CE6 100%)',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Now';
  const totalMin = Math.ceil(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function formatDateDisplay(iso: string): string {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

// ── QR code helpers ───────────────────────────────────────────────────────────

function buildQRData(entity: PlacedEntity): string {
  const ref = `UNI-${entity.id.slice(-6).toUpperCase()}`;
  // Encodes the deep link + booking ref for instant scanner access
  const base = typeof window !== 'undefined' ? window.location.origin : 'https://unitravel.app';
  return `${base}/booking/${ref}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CountdownClock({ targetTime, label }: { targetTime: string; label: string }) {
  const [display, setDisplay] = useState('');

  useEffect(() => {
    const compute = () => {
      const [h, m] = targetTime.split(':').map(Number);
      const target = new Date();
      target.setHours(h, m, 0, 0);
      const ms = target.getTime() - Date.now();
      setDisplay(formatCountdown(ms));
    };
    compute();
    const id = setInterval(compute, 10_000);
    return () => clearInterval(id);
  }, [targetTime]);

  return (
    <div style={{ textAlign: 'center' }}>
      <motion.div
        key={display}
        initial={{ opacity: 0, y: -4, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={SPRING}
        style={{
          fontSize: 'clamp(2.2rem, 6vw, 3rem)',
          fontWeight: 900, letterSpacing: '-0.05em',
          color: 'rgba(255,255,255,0.97)', lineHeight: 1,
        }}
      >
        {display}
      </motion.div>
      <div style={{
        fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.55)',
        letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 4,
      }}>
        {label}
      </div>
    </div>
  );
}

function TodayEventPill({
  entity,
  isCurrent,
  isPast,
}: {
  entity:    PlacedEntity;
  isCurrent: boolean;
  isPast:    boolean;
}) {
  const color = CATEGORY_COLOR[entity.category] ?? AZURE;
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: isPast ? 0.40 : 1, x: 0 }}
      transition={SPRING}
      style={{
        display:              'flex',
        alignItems:           'center',
        gap:                  10,
        paddingBlock:         10,
        paddingInline:        14,
        borderRadius:         14,
        background:           isCurrent ? `${color}18` : 'rgba(255,255,255,0.40)',
        backdropFilter:       'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border:               `1.5px solid ${isCurrent ? `${color}38` : 'rgba(255,255,255,0.55)'}`,
        boxShadow:            isCurrent
          ? `0 0 18px ${color}28, inset 0 1px 0 rgba(255,255,255,0.8)`
          : '0 1px 6px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.8)',
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 9,
        background: `${color}18`, border: `1px solid ${color}22`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {(() => { const CI = CATEGORY_ICON[entity.category] ?? MapPin; return <CI size={15} color={color} strokeWidth={1.8} />; })()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12, fontWeight: 700, color: 'var(--text-primary)',
          letterSpacing: '-0.02em', whiteSpace: 'nowrap',
          overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {entity.title}
        </div>
        {entity.time && (
          <div style={{ fontSize: 10, fontWeight: 500, color, marginTop: 1, letterSpacing: '-0.01em' }}>
            {entity.time}
            {entity.subtitle && ` · ${entity.subtitle.slice(0, 32)}`}
          </div>
        )}
      </div>
      {isCurrent && (
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.6, repeat: Infinity }}
          style={{
            fontSize: 9, fontWeight: 800, color,
            background: `${color}14`, border: `1px solid ${color}28`,
            borderRadius: 6, paddingBlock: 3, paddingInline: 7,
            letterSpacing: '0.04em', textTransform: 'uppercase', flexShrink: 0,
          }}
        >
          Now
        </motion.div>
      )}
      {isPast && (
        <div style={{ fontSize: 14, flexShrink: 0 }} aria-hidden>✓</div>
      )}
    </motion.div>
  );
}

// ── Trip states ───────────────────────────────────────────────────────────────

function PreTripState({ startDate, days }: { startDate: string; days: EngineDay[] }) {
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    const compute = () => {
      const target = new Date(startDate + 'T00:00:00');
      const ms = target.getTime() - Date.now();
      if (ms <= 0) { setCountdown('Today!'); return; }
      const d = Math.floor(ms / 86_400_000);
      const h = Math.floor((ms % 86_400_000) / 3_600_000);
      setCountdown(d > 0 ? `${d}d ${h}h` : `${h}h`);
    };
    compute();
    const id = setInterval(compute, 60_000);
    return () => clearInterval(id);
  }, [startDate]);

  const entityCount = days.reduce((s, d) => s + d.entities.length, 0);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100%', gap: 28, padding: 40, textAlign: 'center',
    }}>
      <motion.div
        animate={{ scale: [1, 1.06, 1] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
        style={{ width: 72, height: 72, borderRadius: 22, background: 'rgba(0,122,255,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        aria-hidden
      >
        <Plane size={34} color="#007AFF" strokeWidth={1.6} />
      </motion.div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
          Departure in
        </div>
        <motion.div
          key={countdown}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={SPRING}
          style={{
            fontSize: 'clamp(2.4rem, 7vw, 3.6rem)',
            fontWeight: 900, letterSpacing: '-0.06em',
            color: 'var(--text-primary)', lineHeight: 1,
          }}
        >
          {countdown}
        </motion.div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600, marginTop: 10, letterSpacing: '-0.01em' }}>
          {formatDateDisplay(startDate)}
        </div>
      </div>
      {entityCount > 0 && (
        <div style={{
          paddingBlock: 12, paddingInline: 20, borderRadius: 14,
          background: 'rgba(0,122,255,0.07)', border: '1px solid rgba(0,122,255,0.14)',
          fontSize: 12, fontWeight: 600, color: AZURE, letterSpacing: '-0.01em',
        }}>
          {entityCount} item{entityCount !== 1 ? 's' : ''} planned · Timeline ready
        </div>
      )}
      <Link href="/zone/management" style={{
        fontSize: 12, fontWeight: 800, color: AZURE,
        background: `${AZURE}10`, border: `1.5px solid ${AZURE}28`,
        borderRadius: 12, paddingBlock: 10, paddingInline: 22,
        textDecoration: 'none',
      }}>
        View Timeline →
      </Link>
    </div>
  );
}

function PostTripState({ tripTitle, travelers, endDate }: {
  tripTitle: string; travelers: string[]; endDate: string;
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100%', gap: 24, padding: 40, textAlign: 'center',
    }}>
      <div style={{ width: 80, height: 80, borderRadius: 24, background: 'linear-gradient(135deg, rgba(255,159,10,0.12), rgba(255,69,58,0.08))', display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-hidden>
        <Sun size={36} color="#FF9F0A" strokeWidth={1.5} />
      </div>
      <div>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: '-0.04em', color: 'var(--text-primary)' }}>
          Journey Complete
        </h2>
        <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500, lineHeight: 1.55, maxWidth: 300 }}>
          {travelers.length > 0 ? `${travelers.join(' & ')}'s ` : ''}
          {tripTitle || 'Journey'} wrapped on {formatDateDisplay(endDate)}.
        </p>
      </div>
      <Link href="/" style={{
        fontSize: 12, fontWeight: 800, color: AZURE,
        background: `${AZURE}10`, border: `1.5px solid ${AZURE}28`,
        borderRadius: 12, paddingBlock: 10, paddingInline: 22, textDecoration: 'none',
      }}>
        Plan Next Trip →
      </Link>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function OnTripPage() {
  const trip = useTravelEngine(s => s.trip);
  const days = useTravelEngine(s => s.days);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Determine trip phase
  const phase = useMemo<'pre' | 'active' | 'post' | 'no-trip'>(() => {
    if (!trip.startDate || !trip.endDate) return 'no-trip';
    if (today < trip.startDate) return 'pre';
    if (today > trip.endDate)   return 'post';
    return 'active';
  }, [trip.startDate, trip.endDate, today]);

  const todayDay = useMemo(
    () => days.find(d => d.date === today) ?? null,
    [days, today]
  );

  // Find the next entity relative to current time (based on entity.time field)
  const nowMinutes = useMemo(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  }, []);

  const nextEntity = useMemo<PlacedEntity | null>(() => {
    if (!todayDay) return null;
    return (
      todayDay.entities
        .filter(e => e.time && timeToMinutes(e.time) > nowMinutes)
        .sort((a, b) => timeToMinutes(a.time!) - timeToMinutes(b.time!))[0] ?? null
    );
  }, [todayDay, nowMinutes]);

  const currentEntity = useMemo<PlacedEntity | null>(() => {
    if (!todayDay) return null;
    // Entity within ±45 minutes of now
    return (
      todayDay.entities
        .filter(e => {
          if (!e.time) return false;
          const diff = Math.abs(timeToMinutes(e.time) - nowMinutes);
          return diff <= 45;
        })
        .sort((a, b) => Math.abs(timeToMinutes(a.time!) - nowMinutes) - Math.abs(timeToMinutes(b.time!) - nowMinutes))[0] ?? null
    );
  }, [todayDay, nowMinutes]);

  const heroEntity  = currentEntity ?? nextEntity;
  const heroColor   = heroEntity ? (CATEGORY_COLOR[heroEntity.category] ?? AZURE) : AZURE;
  const heroGrad    = heroEntity ? (CATEGORY_GRADIENT[heroEntity.category] ?? CATEGORY_GRADIENT.flight) : CATEGORY_GRADIENT.flight;
  const heroRef     = heroEntity ? `UNI-${heroEntity.id.slice(-6).toUpperCase()}` : null;

  // ── Redirect / empty states ──────────────────────────────────────────────────

  if (phase === 'no-trip') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100dvh', gap: 20, padding: 40, textAlign: 'center',
        background: '#F2F2F7',
        fontFamily: "-apple-system, 'SF Pro Display', Inter, sans-serif",
      }}>
        <div style={{ width: 72, height: 72, borderRadius: 22, background: 'rgba(0,122,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <MapPin size={32} color="#007AFF" strokeWidth={1.5} />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, letterSpacing: '-0.04em' }}>No active trip</h2>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: '#6E6E73', fontWeight: 500, maxWidth: 280, lineHeight: 1.55 }}>
            Plan your trip on Unitravel — your live dashboard appears here.
          </p>
        </div>
        <Link href="/" style={{
          fontSize: 12, fontWeight: 800, color: AZURE,
          background: `${AZURE}10`, border: `1.5px solid ${AZURE}28`,
          borderRadius: 12, paddingBlock: 10, paddingInline: 22,
          textDecoration: 'none',
        }}>
          ← Planner
        </Link>
      </div>
    );
  }

  if (phase === 'pre') {
    return (
      <div style={{
        height: '100dvh', width: '100vw', background: '#F2F2F7',
        fontFamily: "-apple-system, 'SF Pro Display', Inter, sans-serif",
        display: 'flex', flexDirection: 'column',
      }}>
        <OnTripNav tripTitle={trip.title} />
        <PreTripState startDate={trip.startDate} days={days} />
      </div>
    );
  }

  if (phase === 'post') {
    return (
      <div style={{
        height: '100dvh', width: '100vw', background: '#F2F2F7',
        fontFamily: "-apple-system, 'SF Pro Display', Inter, sans-serif",
        display: 'flex', flexDirection: 'column',
      }}>
        <OnTripNav tripTitle={trip.title} />
        <PostTripState
          tripTitle={trip.title}
          travelers={trip.travelers}
          endDate={trip.endDate}
        />
      </div>
    );
  }

  // ── ACTIVE: On-Trip OS ───────────────────────────────────────────────────────

  return (
    <div style={{
      height:     '100dvh',
      width:      '100vw',
      overflow:   'hidden',
      display:    'flex',
      flexDirection: 'column',
      background: [
        `radial-gradient(ellipse at 20% 0%, ${heroColor}12 0%, transparent 55%)`,
        'radial-gradient(ellipse at 80% 100%, rgba(48,209,88,0.06) 0%, transparent 50%)',
        '#F2F2F7',
      ].join(', '),
      fontFamily: "-apple-system, 'SF Pro Display', Inter, sans-serif",
    }}>
      <OnTripNav tripTitle={trip.title} />

      <div
        className="no-scrollbar"
        style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingInline: 16, paddingBottom: 32 }}
      >
        {/* ── Day header ── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING, delay: 0.06 }}
          style={{ paddingBlock: '18px 10px', paddingInline: 4 }}
        >
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.04em', color: 'var(--text-primary)', lineHeight: 1.1 }}>
            {todayDay ? `Day ${todayDay.dayNumber} · ${todayDay.destination}` : 'Today'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, marginTop: 3, letterSpacing: '-0.01em' }}>
            {formatDateDisplay(today)}
          </div>
        </motion.div>

        {/* ── Hero card: Next Action ── */}
        {heroEntity ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1,    y: 0 }}
            transition={{ ...SPRING, delay: 0.10 }}
            style={{
              borderRadius:         32,
              overflow:             'hidden',
              background:           heroGrad,
              boxShadow:            `0 16px 56px ${heroColor}38, 0 4px 16px rgba(0,0,0,0.10)`,
              marginBottom:         16,
              position:             'relative',
            }}
          >
            {/* Specular */}
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              background: 'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, transparent 50%)',
            }} aria-hidden />

            {/* Top row */}
            <div style={{ padding: '22px 22px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{
                  fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.60)',
                  letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6,
                }}>
                  {currentEntity
                    ? <><Zap size={10} color="rgba(255,255,255,0.60)" strokeWidth={2.5} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Happening Now</>
                    : <><Plane size={10} color="rgba(255,255,255,0.60)" strokeWidth={2} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Next Up</>
                  }
                </div>
                <div style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-hidden>
                  {(() => { const CI = CATEGORY_ICON[heroEntity.category] ?? MapPin; return <CI size={24} color="rgba(255,255,255,0.92)" strokeWidth={1.6} />; })()}
                </div>
              </div>
              {heroEntity.time && (
                <CountdownClock
                  targetTime={heroEntity.time}
                  label={currentEntity ? 'started' : 'until boarding'}
                />
              )}
            </div>

            {/* Title */}
            <div style={{ padding: '14px 22px 0' }}>
              <h2 style={{
                margin: 0, fontSize: 'clamp(1.4rem, 3.5vw, 2rem)',
                fontWeight: 900, color: '#fff', letterSpacing: '-0.04em', lineHeight: 1.1,
              }}>
                {heroEntity.title}
              </h2>
              {heroEntity.subtitle && (
                <p style={{
                  margin: '6px 0 0', fontSize: 13, fontWeight: 500,
                  color: 'rgba(255,255,255,0.72)', letterSpacing: '-0.01em', lineHeight: 1.4,
                }}>
                  {heroEntity.subtitle}
                </p>
              )}
            </div>

            {/* QR + Ref section */}
            <div style={{
              margin: '20px 22px 22px',
              display: 'flex', gap: 16, alignItems: 'center',
              padding: '16px 18px',
              background: 'rgba(0,0,0,0.22)',
              borderRadius: 20,
              border: '1px solid rgba(255,255,255,0.14)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}>
              {/* QR Code */}
              <div style={{
                flexShrink: 0,
                background: '#fff',
                borderRadius: 12,
                padding: 8,
                boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
              }}>
                <QRCodeSVG
                  value={buildQRData(heroEntity)}
                  size={96}
                  level="M"
                  includeMargin={false}
                  style={{ display: 'block', borderRadius: 6 }}
                />
              </div>

              {/* Info */}
              <div>
                <div style={{
                  fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.50)',
                  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4,
                }}>
                  Booking Reference
                </div>
                <div style={{
                  fontSize: 18, fontWeight: 900, color: '#fff',
                  letterSpacing: '0.04em', fontVariantNumeric: 'tabular-nums',
                }}>
                  {heroRef}
                </div>
                {heroEntity.time && (
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 6, fontWeight: 600 }}>
                    🕐 {heroEntity.time}
                    {todayDay?.destination && ` · ${todayDay.destination}`}
                  </div>
                )}
                {heroEntity.booked && (
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    fontSize: 9, fontWeight: 800, color: EMERALD,
                    background: 'rgba(48,209,88,0.18)', border: '1px solid rgba(48,209,88,0.30)',
                    borderRadius: 6, paddingBlock: 3, paddingInline: 7, marginTop: 8,
                  }}>
                    ✓ Confirmed
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ) : (
          /* No more events today */
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            style={{
              borderRadius: 24, padding: '28px 22px', marginBottom: 16,
              background: 'rgba(255,255,255,0.56)',
              backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)',
              border: '1.5px solid rgba(255,255,255,0.80)',
              textAlign: 'center',
            }}
          >
            <div style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(94,92,230,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }} aria-hidden>
              <Moon size={24} color="#5E5CE6" strokeWidth={1.8} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
              All done for today
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500, marginTop: 6, lineHeight: 1.5 }}>
              Enjoy your evening — tomorrow starts a new day.
            </div>
          </motion.div>
        )}

        {/* ── Today's full timeline ── */}
        {todayDay && todayDay.entities.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.18 }}
          >
            <div style={{
              fontSize: 9.5, fontWeight: 700, color: 'var(--text-tertiary)',
              textTransform: 'uppercase', letterSpacing: '0.06em',
              paddingInline: 4, paddingBlock: '4px 10px',
            }}>
              {"Today's Timeline"}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {todayDay.entities
                .slice()
                .sort((a, b) => {
                  if (!a.time) return 1;
                  if (!b.time) return -1;
                  return timeToMinutes(a.time) - timeToMinutes(b.time);
                })
                .map(entity => {
                  const entityMinutes = entity.time ? timeToMinutes(entity.time) : null;
                  const isPast        = entityMinutes !== null && entityMinutes < nowMinutes - 45;
                  const isCurrent     = entity.id === currentEntity?.id;
                  return (
                    <TodayEventPill
                      key={entity.id}
                      entity={entity}
                      isCurrent={isCurrent}
                      isPast={isPast}
                    />
                  );
                })}
            </div>
          </motion.div>
        )}

        {/* ── Upcoming days strip ── */}
        {days.filter(d => d.date > today && d.entities.length > 0).length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.24 }}
            style={{ marginTop: 20 }}
          >
            <div style={{
              fontSize: 9.5, fontWeight: 700, color: 'var(--text-tertiary)',
              textTransform: 'uppercase', letterSpacing: '0.06em',
              paddingInline: 4, paddingBlock: '4px 10px',
            }}>
              Coming Up
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {days
                .filter(d => d.date > today && d.entities.length > 0)
                .slice(0, 3)
                .map(day => (
                  <div
                    key={day.id}
                    style={{
                      display:              'flex',
                      alignItems:           'center',
                      gap:                  12,
                      paddingBlock:         10,
                      paddingInline:        14,
                      borderRadius:         14,
                      background:           'rgba(255,255,255,0.42)',
                      backdropFilter:       'blur(16px)',
                      WebkitBackdropFilter: 'blur(16px)',
                      border:               '1.5px solid rgba(255,255,255,0.65)',
                      boxShadow:            '0 1px 6px rgba(0,0,0,0.04)',
                    }}
                  >
                    <div style={{
                      fontSize: 11, fontWeight: 800, color: AZURE,
                      background: `${AZURE}10`, border: `1px solid ${AZURE}20`,
                      borderRadius: 8, paddingBlock: 4, paddingInline: 9, flexShrink: 0,
                    }}>
                      Day {day.dayNumber}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                        {day.destination}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 500, marginTop: 1 }}>
                        {day.entities.length} item{day.entities.length !== 1 ? 's' : ''} · {new Date(day.date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      {day.entities.slice(0, 3).map(e => {
                        const EIcon = CATEGORY_ICON[e.category] ?? MapPin;
                        const eColor = ({ flight:'#007AFF',hotel:'#5E5CE6',restaurant:'#FF9F0A',activity:'#30D158',transport:'#BF5AF2' } as Record<string,string>)[e.category] ?? '#6E6E73';
                        return (
                        <span key={e.id} style={{ width: 22, height: 22, borderRadius: 6, background: `${eColor}14`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                          <EIcon size={11} color={eColor} strokeWidth={2} />
                        </span>
                        );
                      })}
                    </div>
                  </div>
                ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ── Navigation bar ────────────────────────────────────────────────────────────

function OnTripNav({ tripTitle }: { tripTitle: string }) {
  return (
    <nav style={{
      height:               52,
      display:              'flex',
      alignItems:           'center',
      paddingInline:        16,
      gap:                  10,
      background:           'rgba(255,255,255,0.88)',
      backdropFilter:       'blur(40px) saturate(2)',
      WebkitBackdropFilter: 'blur(40px) saturate(2)',
      borderBlockEnd:       '1px solid rgba(0,0,0,0.07)',
      flexShrink:           0,
      zIndex:               100,
      boxShadow:            '0 1px 0 rgba(0,0,0,0.05)',
    }}>
      <Link
        href="/"
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          paddingBlock: 6, paddingInline: 11, borderRadius: 10,
          fontSize: 12, fontWeight: 700, color: AZURE,
          background: `${AZURE}09`, border: `1px solid ${AZURE}14`,
          textDecoration: 'none', flexShrink: 0, letterSpacing: '-0.01em',
        }}
      >
        ← Planner
      </Link>

      <div style={{
        flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 800,
        color: 'var(--text-primary)', letterSpacing: '-0.02em',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {tripTitle || 'Live Trip'}
      </div>

      <motion.div
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 2.4, repeat: Infinity }}
        style={{
          width: 8, height: 8, borderRadius: '50%',
          background: EMERALD,
          boxShadow: `0 0 8px ${EMERALD}88`,
          flexShrink: 0,
        }}
        aria-label="Live"
      />
    </nav>
  );
}
