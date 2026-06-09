'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence }           from 'framer-motion';
import { Plane, Hotel, UtensilsCrossed, Compass, Train, MapPin } from 'lucide-react';
import Link                                  from 'next/link';
import { useCheckoutEngine }                 from '@/store/useCheckoutEngine';
import { useTravelEngine }                   from '@/store/useTravelEngine';
import { useCurrencyFormatter }              from '@/utils/CurrencyEngine';
import { triggerICSExport, buildGoogleCalendarDeepLink } from '@/utils/OmniSyncEngine';

// ── Design tokens ─────────────────────────────────────────────────────────────

const SPRING     = { type: 'spring', stiffness: 380, damping: 28 } as const;
const SPRING_POP = { type: 'spring', stiffness: 540, damping: 24 } as const;
const AZURE      = '#007AFF';
const EMERALD    = '#30D158';

type CatIconComp = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
const CATEGORY_ICONS: Record<string, CatIconComp> = {
  flight:     Plane,
  hotel:      Hotel,
  restaurant: UtensilsCrossed,
  activity:   Compass,
  transport:  Train,
};

const CATEGORY_COLORS: Record<string, string> = {
  flight:     AZURE,
  hotel:      '#5E5CE6',
  restaurant: '#FF9F0A',
  activity:   EMERALD,
  transport:  '#00C7BE',
};

// ── Glass confetti particle config ────────────────────────────────────────────

const PARTICLE_COLORS = [
  'rgba(255,215,0,0.65)',   // gold
  'rgba(255,255,255,0.80)', // white glass
  'rgba(0,122,255,0.28)',   // azure tint
  'rgba(255,255,255,0.55)', // soft white
  'rgba(255,215,0,0.42)',   // pale gold
  'rgba(255,255,255,0.70)', // bright white
  'rgba(94,92,230,0.25)',   // indigo ghost
];

interface Particle {
  id:          number;
  x:           number;  // vw %
  size:        number;  // px
  color:       string;
  duration:    number;  // s
  delay:       number;  // s
  rotation:    number;  // deg
  drift:       number;  // vw drift
  isCircle:    boolean;
  opacity:     number;
  // Pre-computed so ConfettiParticle never calls Math.random() in render
  repeatDelay: number;
  height:      number;  // px
  borderRadiusPx: number;
}

// ── Copyable PNR tag ──────────────────────────────────────────────────────────

function PNRTag({ title, pnr, color, icon: IconComp, index }: {
  title:  string;
  pnr:    string;
  color:  string;
  icon:   CatIconComp;
  index:  number;
}) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(pnr);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Clipboard API unavailable — silently skip
    }
  }, [pnr]);

  return (
    <motion.button
      onClick={copy}
      initial={{ opacity: 0, y: 12, scale: 0.94 }}
      animate={{ opacity: 1, y: 0,  scale: 1   }}
      transition={{ ...SPRING_POP, delay: 0.4 + index * 0.09 }}
      whileHover={{ scale: 1.03, boxShadow: `0 8px 28px ${color}25` }}
      whileTap={{ scale: 0.97 }}
      style={{
        display:              'flex',
        alignItems:           'center',
        gap:                  10,
        paddingBlock:         11,
        paddingInline:        14,
        borderRadius:         14,
        background:           'rgba(255,255,255,0.70)',
        backdropFilter:       'blur(24px) saturate(1.8)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.8)',
        border:               `1.5px solid ${color}20`,
        boxShadow:            `0 3px 16px ${color}10, inset 0 1px 0 rgba(255,255,255,1)`,
        cursor:               'pointer',
        fontFamily:           'inherit',
        textAlign:            'start',
        width:                '100%',
      }}
    >
      {/* Category icon */}
      <div style={{
        width: 32, height: 32, borderRadius: 10, flexShrink: 0,
        background: `${color}14`, border: `1px solid ${color}28`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <IconComp size={15} color={color} strokeWidth={1.8} />
      </div>

      {/* Title + PNR */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize:      11, fontWeight: 700, color: '#1C1C1E',
          letterSpacing: '-0.02em',
          overflow:      'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {title}
        </div>
        <div style={{
          fontSize: 12, fontWeight: 900, color,
          letterSpacing: '0.10em', marginTop: 1,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {pnr}
        </div>
      </div>

      {/* Copy indicator */}
      <AnimatePresence mode="wait">
        <motion.div
          key={copied ? 'copied' : 'copy'}
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1   }}
          exit={{    opacity: 0, scale: 0.7 }}
          transition={SPRING_POP}
          style={{
            fontSize:      10, fontWeight: 800,
            color:         copied ? EMERALD : '#AEAEB2',
            background:    copied ? `${EMERALD}12` : 'rgba(0,0,0,0.05)',
            border:        `1px solid ${copied ? `${EMERALD}30` : 'transparent'}`,
            borderRadius:  8,
            paddingBlock:  4, paddingInline: 8,
            flexShrink:    0, whiteSpace: 'nowrap',
          }}
        >
          {copied ? '✓ Copied' : '⎘ Copy'}
        </motion.div>
      </AnimatePresence>
    </motion.button>
  );
}

// ── Confetti particle ─────────────────────────────────────────────────────────

function ConfettiParticle({ p }: { p: Particle }) {
  return (
    <motion.div
      aria-hidden
      initial={{ y: '-8vh', x: `${p.x}vw`, opacity: 0, rotate: 0, scale: 0.6 }}
      animate={{
        y:       ['-8vh', '108vh'],
        x:       [`${p.x}vw`, `${p.x + p.drift}vw`],
        opacity: [0, p.opacity, p.opacity, 0],
        rotate:  [0, p.rotation],
        scale:   [0.6, 1, 1, 0.5],
      }}
      transition={{
        duration:    p.duration,
        delay:       p.delay,
        repeat:      Infinity,
        repeatDelay: p.repeatDelay,
        ease:        'linear',
      }}
      style={{
        position:      'fixed',
        top:           0,
        left:          0,
        width:         p.size,
        height:        p.height,
        borderRadius:  p.isCircle ? '50%' : `${p.borderRadiusPx}px`,
        background:    p.color,
        backdropFilter:'blur(2px)',
        pointerEvents: 'none',
        zIndex:        0,
        boxShadow:     `0 2px 8px ${p.color.replace(/[\d.]+\)$/, '0.4)')}`,
      }}
    />
  );
}

// ── Calendar sync button ──────────────────────────────────────────────────────

function CalendarSyncRow() {
  const trip = useTravelEngine(s => s.trip);
  const days = useTravelEngine(s => s.days);

  const handleApple = useCallback(() => {
    triggerICSExport(days, trip.title || 'Unitravel Trip');
  }, [days, trip.title]);

  const handleGoogle = useCallback(() => {
    const firstDay    = days.find(d => d.entities.length > 0);
    const firstEntity = firstDay?.entities[0];
    if (!firstDay || !firstEntity) return;
    const url = buildGoogleCalendarDeepLink(firstEntity, firstDay);
    window.open(url, '_blank', 'noopener');
  }, [days]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING, delay: 0.8 }}
      style={{ display: 'flex', gap: 10 }}
    >
      {[
        { label: '🍎 Sync to Apple Calendar', onClick: handleApple,  color: '#1C1C1E' },
        { label: '📅 Sync to Google Calendar', onClick: handleGoogle, color: AZURE     },
      ].map(({ label, onClick, color }) => (
        <motion.button
          key={label}
          onClick={onClick}
          whileHover={{ scale: 1.03, boxShadow: `0 8px 28px rgba(0,0,0,0.09)` }}
          whileTap={{ scale: 0.97 }}
          transition={SPRING}
          style={{
            flex:                 1,
            paddingBlock:         12,
            paddingInline:        16,
            borderRadius:         14,
            background:           'rgba(255,255,255,0.70)',
            backdropFilter:       'blur(20px) saturate(1.8)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.8)',
            border:               '1.5px solid rgba(255,255,255,0.85)',
            boxShadow:            '0 4px 18px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,1)',
            cursor:               'pointer',
            fontFamily:           'inherit',
            fontSize:             11,
            fontWeight:           700,
            color,
            letterSpacing:        '-0.01em',
          }}
        >
          {label}
        </motion.button>
      ))}
    </motion.div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BookingSuccessPage() {
  const { pnrs, reset }   = useCheckoutEngine();
  const { format }        = useCurrencyFormatter();
  const trip              = useTravelEngine(s => s.trip);
  const days              = useTravelEngine(s => s.days);
  const budget            = useTravelEngine(s => s.budget);

  // Generate confetti particles client-side only (avoids hydration mismatch)
  const [particles, setParticles] = useState<Particle[]>([]);
  useEffect(() => {
    setParticles(
      Array.from({ length: 38 }, (_, i) => {
        const size     = 4 + Math.random() * 9;
        const isCircle = Math.random() > 0.45;
        return {
          id:             i,
          x:              Math.random() * 100,
          size,
          color:          PARTICLE_COLORS[i % PARTICLE_COLORS.length]!,
          duration:       4.5 + Math.random() * 5,
          delay:          Math.random() * 4,
          rotation:       Math.random() * 720 - 360,
          drift:          (Math.random() - 0.5) * 30,
          isCircle,
          opacity:        0.35 + Math.random() * 0.55,
          repeatDelay:    0.5 + Math.random() * 2,
          height:         isCircle ? size : size * (0.6 + Math.random() * 0.8),
          borderRadiusPx: 2 + Math.random() * 4,
        };
      })
    );
  }, []);

  // Build PNR rows from store
  const pnrRows = days.flatMap(d =>
    d.entities
      .filter(e => pnrs[e.id])
      .map(e => ({
        entityId: e.id,
        pnr:      pnrs[e.id]!,
        title:    e.title,
        category: e.category,
      }))
  );

  const totalPaid    = budget.spent;
  const travelerName = trip.travelers[0] ?? 'Traveler';

  return (
    <div style={{
      position:      'relative',
      height:        '100%',
      width:         '100%',
      overflow:      'hidden',
      display:       'flex',
      flexDirection: 'column',
    }}>
      {/* ── Pulsing mesh gradient ──────────────────────────────────── */}
      <motion.div
        aria-hidden
        animate={{
          background: [
            'radial-gradient(ellipse at 15% 10%, rgba(255,215,0,0.08) 0%, transparent 50%), radial-gradient(ellipse at 85% 90%, rgba(0,122,255,0.07) 0%, transparent 55%), radial-gradient(ellipse at 50% 50%, rgba(48,209,88,0.05) 0%, transparent 60%), #F8F9FA',
            'radial-gradient(ellipse at 35% 25%, rgba(255,215,0,0.12) 0%, transparent 55%), radial-gradient(ellipse at 65% 75%, rgba(0,122,255,0.10) 0%, transparent 55%), radial-gradient(ellipse at 50% 50%, rgba(48,209,88,0.07) 0%, transparent 65%), #F8F9FA',
            'radial-gradient(ellipse at 15% 10%, rgba(255,215,0,0.08) 0%, transparent 50%), radial-gradient(ellipse at 85% 90%, rgba(0,122,255,0.07) 0%, transparent 55%), radial-gradient(ellipse at 50% 50%, rgba(48,209,88,0.05) 0%, transparent 60%), #F8F9FA',
          ],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        style={{ position: 'absolute', inset: 0, zIndex: 0 }}
      />

      {/* ── Glass confetti particles ───────────────────────────────── */}
      {particles.map(p => <ConfettiParticle key={p.id} p={p} />)}

      {/* ── Scrollable content ─────────────────────────────────────── */}
      <div
        className="no-scrollbar"
        style={{
          position:   'relative',
          zIndex:     10,
          flex:       1,
          overflowY:  'auto',
          overflowX:  'hidden',
          padding:    '32px 24px 80px',
          display:    'flex',
          flexDirection: 'column',
          gap:        24,
        }}
      >
        {/* Hero section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0  }}
          transition={{ ...SPRING, delay: 0.1 }}
          style={{ textAlign: 'center' }}
        >
          {/* Animated success ring */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1,   opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.2 }}
            style={{
              width:          72, height: 72,
              borderRadius:   '50%',
              background:     `linear-gradient(135deg, ${EMERALD}20 0%, rgba(0,199,190,0.12) 100%)`,
              border:         `2px solid ${EMERALD}40`,
              boxShadow:      `0 0 32px ${EMERALD}30`,
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              margin:         '0 auto 18px',
              fontSize:       32,
            }}
          >
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 20, delay: 0.45 }}
            >
              ✦
            </motion.span>
          </motion.div>

          <h1 style={{
            margin:        0, marginBottom: 6,
            fontSize:      'clamp(1.6rem, 3vw, 2.2rem)',
            fontWeight:    900, letterSpacing: '-0.05em',
            color:         '#1C1C1E', lineHeight: 1.05,
          }}>
            Journey Authorized
          </h1>
          <p style={{
            margin: 0, fontSize: 13, fontWeight: 500,
            color: '#6E6E73', letterSpacing: '-0.01em', lineHeight: 1.55,
          }}>
            {travelerName}&apos;s{trip.title ? ` ${trip.title.split('·').pop()?.trim()} ` : ' '}trip
            is confirmed. {pnrRows.length} booking{pnrRows.length !== 1 ? 's' : ''} secured.
          </p>
        </motion.div>

        {/* Total paid card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1   }}
          transition={{ ...SPRING, delay: 0.25 }}
          style={{
            paddingBlock:         20,
            paddingInline:        22,
            borderRadius:         24,
            background:           'rgba(255,255,255,0.72)',
            backdropFilter:       'blur(32px) saturate(1.9)',
            WebkitBackdropFilter: 'blur(32px) saturate(1.9)',
            border:               '1.5px solid rgba(255,255,255,0.88)',
            boxShadow:            `0 8px 32px ${EMERALD}10, inset 0 1px 0 rgba(255,255,255,1)`,
            display:              'flex',
            alignItems:           'center',
            justifyContent:       'space-between',
          }}
        >
          <div>
            <div style={{
              fontSize: 9.5, fontWeight: 700, color: EMERALD,
              textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5,
            }}>
              Total Paid
            </div>
            <div style={{
              fontSize:      30, fontWeight: 900,
              letterSpacing: '-0.05em', color: '#1C1C1E', lineHeight: 1,
            }}>
              {format(totalPaid)}
            </div>
          </div>
          <div style={{
            paddingBlock:  8, paddingInline: 14,
            borderRadius:  12,
            background:    `${EMERALD}12`, border: `1.5px solid ${EMERALD}30`,
            fontSize:      11, fontWeight: 800, color: EMERALD,
            letterSpacing: '-0.01em',
          }}>
            ✓ Confirmed
          </div>
        </motion.div>

        {/* PNR booking references */}
        {pnrRows.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
          >
            <div style={{
              fontSize: 9.5, fontWeight: 700, color: '#8E8E93',
              textTransform: 'uppercase', letterSpacing: '0.07em',
              marginBottom: 10,
            }}>
              Booking References
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pnrRows.map((row, i) => (
                <PNRTag
                  key={row.entityId}
                  title={row.title}
                  pnr={row.pnr}
                  color={CATEGORY_COLORS[row.category] ?? AZURE}
                  icon={CATEGORY_ICONS[row.category] ?? MapPin}
                  index={i}
                />
              ))}
            </div>
          </motion.div>
        )}

        {/* Calendar sync */}
        <div>
          <div style={{
            fontSize: 9.5, fontWeight: 700, color: '#8E8E93',
            textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10,
          }}>
            Add to Calendar
          </div>
          <CalendarSyncRow />
        </div>

        {/* Navigation actions */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING, delay: 1.0 }}
          style={{ display: 'flex', gap: 10, paddingTop: 4 }}
        >
          <Link href="/on-trip" style={{ flex: 1, textDecoration: 'none' }}>
            <motion.div
              whileHover={{ scale: 1.02, boxShadow: `0 12px 40px ${AZURE}35` }}
              whileTap={{ scale: 0.98 }}
              transition={SPRING}
              style={{
                paddingBlock:   14,
                borderRadius:   16,
                background:     `linear-gradient(135deg, ${AZURE} 0%, #5E5CE6 100%)`,
                color:          '#fff',
                fontSize:       13, fontWeight: 900, letterSpacing: '-0.02em',
                cursor:         'pointer',
                display:        'flex', alignItems: 'center',
                justifyContent: 'center', gap: 8,
                boxShadow:      `0 6px 24px ${AZURE}35, inset 0 1px 0 rgba(255,255,255,0.25)`,
              }}
            >
              Enter On-Trip OS →
            </motion.div>
          </Link>

          <motion.button
            onClick={reset}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={SPRING}
            style={{
              paddingBlock:   14, paddingInline: 18,
              borderRadius:   16,
              background:     'rgba(255,255,255,0.72)',
              backdropFilter: 'blur(12px)',
              border:         '1.5px solid rgba(0,0,0,0.08)',
              color:          '#48484A',
              fontSize:       13, fontWeight: 700, letterSpacing: '-0.02em',
              cursor:         'pointer', fontFamily: 'inherit',
              whiteSpace:     'nowrap',
              boxShadow:      '0 4px 14px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,1)',
            }}
          >
            New Trip
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}
