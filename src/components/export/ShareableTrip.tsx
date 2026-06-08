'use client';

import { useState, useCallback }             from 'react';
import { motion, AnimatePresence }            from 'framer-motion';
import { X, Copy, Check }                     from 'lucide-react';
import { useTravelEngine }                    from '@/store/useTravelEngine';
import {
  buildBookingManifest,
  buildWhatsAppShareUrl,
  buildInstagramCaption,
  generateTripDeepLink,
}                                             from '@/utils/OmniSyncEngine';

// ── Design tokens ─────────────────────────────────────────────────────────────

const SPRING      = { type: 'spring', stiffness: 360, damping: 30 } as const;
const SPRING_POP  = { type: 'spring', stiffness: 480, damping: 26 } as const;

const CATEGORY_ICON: Record<string, string> = {
  flight:     '✈️',
  hotel:      '🏨',
  restaurant: '🍽️',
  activity:   '🎭',
  transport:  '🚗',
};

// ── Destination gradient palette ──────────────────────────────────────────────

function tripGradient(destinations: string[]): string {
  const d = destinations.map(s => s.toLowerCase());
  if (d.some(x => x.includes('tulum') || x.includes('cancun') || x.includes('playa')))
    return 'linear-gradient(160deg, #1A3A2B 0%, #2D6A4F 30%, #40916C 65%, #52B788 100%)';
  if (d.some(x => x.includes('bahamas') || x.includes('nassau') || x.includes('caribbean')))
    return 'linear-gradient(160deg, #0D47A1 0%, #0288D1 40%, #00ACC1 75%, #B2EBF2 100%)';
  if (d.some(x => x.includes('miami') || x.includes('florida')))
    return 'linear-gradient(160deg, #AD1457 0%, #F06292 40%, #FFB74D 75%, #FFF176 100%)';
  if (d.some(x => x.includes('paris') || x.includes('france')))
    return 'linear-gradient(160deg, #4A148C 0%, #7B1FA2 40%, #CE93D8 75%, #FCE4EC 100%)';
  if (d.some(x => x.includes('dubai') || x.includes('uae')))
    return 'linear-gradient(160deg, #E65100 0%, #F57C00 40%, #FFB300 75%, #FFF8E1 100%)';
  if (d.some(x => x.includes('bali') || x.includes('indonesia')))
    return 'linear-gradient(160deg, #1B5E20 0%, #388E3C 40%, #81C784 75%, #F1F8E9 100%)';
  if (d.some(x => x.includes('maldives')))
    return 'linear-gradient(160deg, #006064 0%, #00838F 40%, #4DB6AC 75%, #E0F7FA 100%)';
  // default
  return 'linear-gradient(160deg, #1A237E 0%, #283593 30%, #1565C0 65%, #1976D2 100%)';
}

// ── Route SVG ─────────────────────────────────────────────────────────────────

function RouteSVG({ destinations }: { destinations: string[] }) {
  if (destinations.length < 2) {
    return (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {destinations.map(d => (
          <div key={d} style={{
            fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.80)',
            background: 'rgba(255,255,255,0.12)', borderRadius: 99,
            paddingBlock: 3, paddingInline: 10, border: '1px solid rgba(255,255,255,0.20)',
          }}>
            📍 {d}
          </div>
        ))}
      </div>
    );
  }

  const W = 230;
  const H = 54;
  const pts = destinations.map((d, i) => ({
    d,
    x: 18 + (i / (destinations.length - 1)) * (W - 36),
    y: H / 2 + (i % 2 === 0 ? -8 : 8),
  }));

  // Build a smooth bezier path
  let pathD = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const cx = (pts[i].x + pts[i + 1].x) / 2;
    pathD += ` C ${cx} ${pts[i].y}, ${cx} ${pts[i + 1].y}, ${pts[i + 1].x} ${pts[i + 1].y}`;
  }

  return (
    <div>
      <svg width={W} height={H} style={{ overflow: 'visible' }}>
        {/* Dashed path */}
        <motion.path
          d={pathD}
          stroke="rgba(255,255,255,0.35)"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1], delay: 0.4 }}
        />
        {/* Solid fill path */}
        <motion.path
          d={pathD}
          stroke="rgba(255,255,255,0.90)"
          strokeWidth={1.5}
          fill="none"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.5 }}
        />
        {/* Destination dots */}
        {pts.map((pt, i) => (
          <motion.g key={i}>
            <motion.circle
              cx={pt.x} cy={pt.y} r={5}
              fill="rgba(255,255,255,0.25)"
              stroke="rgba(255,255,255,0.90)"
              strokeWidth={1.5}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ ...SPRING_POP, delay: 0.3 + i * 0.12 }}
            />
          </motion.g>
        ))}
      </svg>
      {/* Destination labels */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        {destinations.map((d, i) => (
          <motion.span
            key={d}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 + i * 0.08 }}
            style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.04em',
              color: 'rgba(255,255,255,0.80)',
              textTransform: 'uppercase',
            }}
          >
            {i > 0 && <span style={{ marginInlineEnd: 6, opacity: 0.40 }}>→</span>}
            {d}
          </motion.span>
        ))}
      </div>
    </div>
  );
}

// ── Stat pill ─────────────────────────────────────────────────────────────────

function StatPill({ icon, label }: { icon: string; label: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      paddingBlock: 6, paddingInline: 12, borderRadius: 99,
      background: 'rgba(255,255,255,0.14)',
      border: '1px solid rgba(255,255,255,0.22)',
      backdropFilter: 'blur(8px)',
    }}>
      <span style={{ fontSize: 12 }}>{icon}</span>
      <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.92)', letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
        {label}
      </span>
    </div>
  );
}

// ── Category summary dots ─────────────────────────────────────────────────────

function CategorySummary({ entries }: { entries: { category: string; price: number }[] }) {
  const byCategory = entries.reduce<Record<string, { count: number; total: number }>>((acc, e) => {
    if (!acc[e.category]) acc[e.category] = { count: 0, total: 0 };
    acc[e.category].count++;
    acc[e.category].total += e.price;
    return acc;
  }, {});

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {Object.entries(byCategory).map(([cat, { count, total }]) => (
        <motion.div
          key={cat}
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={SPRING_POP}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            paddingBlock: 7, paddingInline: 12, borderRadius: 12,
            background: 'rgba(255,255,255,0.12)',
            border: '1px solid rgba(255,255,255,0.18)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <span style={{ fontSize: 14 }}>{CATEGORY_ICON[cat] ?? '📍'}</span>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.95)', letterSpacing: '-0.01em' }}>
              {count} {cat}
            </div>
            <div style={{ fontSize: 8.5, fontWeight: 600, color: 'rgba(255,255,255,0.58)', letterSpacing: '-0.01em' }}>
              ${total.toLocaleString()}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ShareableTripProps {
  onClose: () => void;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function ShareableTrip({ onClose }: ShareableTripProps) {
  const trip   = useTravelEngine(s => s.trip);
  const days   = useTravelEngine(s => s.days);
  const budget = useTravelEngine(s => s.budget);

  const manifest = buildBookingManifest(trip, days);

  const [copied, setCopied] = useState(false);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(manifest.deepLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // fallback: noop
    }
  }, [manifest.deepLink]);

  const whatsappUrl    = buildWhatsAppShareUrl(manifest);
  const instagramCaption = buildInstagramCaption(manifest);

  const destinations = manifest.uniqueDests.length > 0
    ? manifest.uniqueDests
    : trip.title
      ? [trip.title.split('·').pop()?.trim() ?? 'Your Destination']
      : ['Your Destination'];

  const gradient = tripGradient(destinations);

  const titleLine = manifest.travelers.length > 0
    ? `${manifest.travelers.join(' & ')}'s`
    : 'Your';

  const nightsLabel = trip.nights > 0
    ? `${trip.nights}-Night Escape`
    : 'Grand Journey';

  const dateRange = trip.startDate && trip.endDate
    ? `${new Date(trip.startDate + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(trip.endDate + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    : null;

  return (
    <motion.div
      key="share-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      style={{
        position:       'fixed',
        inset:          0,
        zIndex:         200,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        padding:        24,
        background:     'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.90, y: 24 }}
        animate={{ opacity: 1, scale: 1,    y: 0 }}
        exit={{ opacity: 0, scale: 0.92,    y: 16 }}
        transition={{ ...SPRING, delay: 0.04 }}
        onClick={e => e.stopPropagation()}
        style={{
          display:       'flex',
          flexDirection: 'column',
          alignItems:    'center',
          gap:           16,
          maxHeight:     '90vh',
          overflowY:     'auto',
        }}
      >
        {/* ── 9:16 Shareable Card ── */}
        <div
          className="w-full max-w-sm aspect-[9/16] rounded-[2.5rem] border border-white/80 shadow-2xl overflow-hidden"
          style={{
            background:           gradient,
            backdropFilter:       'blur(48px) saturate(2)',
            WebkitBackdropFilter: 'blur(48px) saturate(2)',
            display:              'flex',
            flexDirection:        'column',
            position:             'relative',
            minHeight:            520,
          }}
        >
          {/* Specular overlay */}
          <div style={{
            position:   'absolute',
            inset:      0,
            background: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 55%, rgba(0,0,0,0.15) 100%)',
            pointerEvents: 'none',
          }} aria-hidden />

          {/* ── Header ── */}
          <div style={{ padding: '32px 28px 20px', flexShrink: 0 }}>
            {/* Wordmark */}
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              style={{
                fontSize: 10, fontWeight: 900, letterSpacing: '0.12em',
                textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)',
                marginBottom: 20,
              }}
            >
              ✦ Unitravel
            </motion.div>

            {/* Title */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div style={{
                fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.65)',
                letterSpacing: '-0.01em', marginBottom: 4,
              }}>
                {titleLine}
              </div>
              <h2 style={{
                margin: 0, fontSize: 'clamp(1.5rem, 5vw, 2rem)',
                fontWeight: 900, color: 'rgba(255,255,255,0.97)',
                letterSpacing: '-0.04em', lineHeight: 1.1,
              }}>
                {nightsLabel}
              </h2>
              {dateRange && (
                <div style={{
                  fontSize: 11, fontWeight: 600,
                  color: 'rgba(255,255,255,0.60)', marginTop: 6, letterSpacing: '-0.01em',
                }}>
                  {dateRange}
                </div>
              )}
            </motion.div>
          </div>

          {/* ── Route visualization ── */}
          <div style={{ paddingInline: 28, paddingBlock: 12, flexShrink: 0 }}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <RouteSVG destinations={destinations} />
            </motion.div>
          </div>

          {/* ── Divider ── */}
          <div style={{
            marginInline: 28, height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)',
            flexShrink: 0,
          }} />

          {/* ── Stats row ── */}
          <div style={{ padding: '16px 28px', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {manifest.entries.length > 0 && (
                <StatPill icon="🎫" label={`${manifest.entries.length} items`} />
              )}
              {budget.total > 0 && (
                <StatPill icon="💰" label={`$${Math.round(budget.total).toLocaleString()}`} />
              )}
              {trip.nights > 0 && (
                <StatPill icon="🌙" label={`${trip.nights} nights`} />
              )}
            </div>
          </div>

          {/* ── Category summary ── */}
          {manifest.entries.length > 0 && (
            <div style={{ padding: '0 28px 16px', flexShrink: 0 }}>
              <CategorySummary entries={manifest.entries} />
            </div>
          )}

          {/* ── Spacer ── */}
          <div style={{ flex: 1 }} />

          {/* ── Footer ── */}
          <div style={{
            padding: '16px 28px 32px', flexShrink: 0,
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            {/* Divider */}
            <div style={{
              height: 1,
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.20), transparent)',
              marginBottom: 12,
            }} />
            <div style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
              textTransform: 'uppercase', color: 'rgba(255,255,255,0.40)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <motion.span
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 2.4, repeat: Infinity }}
                aria-hidden
              >
                ✦
              </motion.span>
              Planned with AI · Unitravel Travel OS
            </div>
          </div>
        </div>

        {/* ── Action buttons ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING, delay: 0.24 }}
          style={{
            display:   'flex',
            gap:       10,
            width:     '100%',
            maxWidth:  384,
          }}
        >
          {/* WhatsApp */}
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ flex: 1, textDecoration: 'none' }}
          >
            <motion.div
              whileHover={{ scale: 1.03, boxShadow: '0 8px 28px rgba(37,211,102,0.35)' }}
              whileTap={{ scale: 0.97 }}
              transition={SPRING}
              style={{
                paddingBlock:   13,
                paddingInline:  16,
                borderRadius:   14,
                background:     'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                color:          '#fff',
                fontSize:       12,
                fontWeight:     800,
                letterSpacing:  '-0.01em',
                textAlign:      'center',
                cursor:         'pointer',
                boxShadow:      '0 4px 16px rgba(37,211,102,0.30)',
              }}
            >
              WhatsApp
            </motion.div>
          </a>

          {/* Copy Link */}
          <motion.button
            onClick={copyLink}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            transition={SPRING}
            style={{
              flex:          1,
              paddingBlock:  13,
              paddingInline: 16,
              borderRadius:  14,
              border:        '1.5px solid rgba(255,255,255,0.30)',
              background:    'rgba(255,255,255,0.12)',
              backdropFilter: 'blur(16px)',
              color:         '#fff',
              fontSize:      12,
              fontWeight:    800,
              letterSpacing: '-0.01em',
              cursor:        'pointer',
              fontFamily:    'inherit',
              display:       'flex',
              alignItems:    'center',
              justifyContent:'center',
              gap:           6,
            }}
          >
            <AnimatePresence mode="wait">
              {copied ? (
                <motion.span
                  key="check"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  transition={SPRING_POP}
                  style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <Check size={12} strokeWidth={2.5} /> Copied
                </motion.span>
              ) : (
                <motion.span
                  key="copy"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  transition={SPRING_POP}
                  style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <Copy size={12} strokeWidth={2.5} /> Copy Link
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>

          {/* Instagram caption */}
          <motion.button
            onClick={() => navigator.clipboard?.writeText(instagramCaption)}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            transition={SPRING}
            style={{
              paddingBlock:  13,
              paddingInline: 16,
              borderRadius:  14,
              border:        '1.5px solid rgba(255,255,255,0.30)',
              background:    'linear-gradient(135deg, rgba(225,48,108,0.80) 0%, rgba(249,206,52,0.80) 100%)',
              color:         '#fff',
              fontSize:      12,
              fontWeight:    800,
              letterSpacing: '-0.01em',
              cursor:        'pointer',
              fontFamily:    'inherit',
              whiteSpace:    'nowrap',
              flexShrink:    0,
            }}
          >
            Instagram
          </motion.button>
        </motion.div>

        {/* Close */}
        <motion.button
          onClick={onClose}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          transition={SPRING}
          style={{
            paddingBlock:  10,
            paddingInline: 20,
            borderRadius:  12,
            border:        '1px solid rgba(255,255,255,0.18)',
            background:    'rgba(255,255,255,0.08)',
            color:         'rgba(255,255,255,0.65)',
            fontSize:      12,
            fontWeight:    700,
            cursor:        'pointer',
            fontFamily:    'inherit',
            display:       'flex',
            alignItems:    'center',
            gap:           6,
          }}
        >
          <X size={12} strokeWidth={2.5} /> Close
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
