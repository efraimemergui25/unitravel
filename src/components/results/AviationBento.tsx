'use client';

import { useState, memo }                               from 'react';
import { motion, AnimatePresence, LayoutGroup }         from 'framer-motion';
import { GripHorizontal }                               from 'lucide-react';
import { GlassShimmer }                                 from '@/components/ui/GlassShimmer';
import type { BentoFlight as LibBentoFlight }           from '@/lib/amadeus';

// ── Spring constants ──────────────────────────────────────────────────────────

const SPRING        = { type: 'spring', stiffness: 380, damping: 30 } as const;
const SPRING_DETAIL = { type: 'spring', stiffness: 320, damping: 34 } as const;

// ── Types ─────────────────────────────────────────────────────────────────────

export type SearchState = 'idle' | 'loading' | 'results';

interface Layover {
  airport:       string;
  code:          string;
  durationLabel: string;
  durationMin:   number;
}

interface BentoFlight {
  id:             string;
  airline:        string;
  logo:           string;
  flightNumbers:  string[];
  origin:         string;
  destination:    string;
  routeLabel:     string;
  departure:      string;
  arrival:        string;
  arrivalNote:    string;
  totalMin:       number;
  durationLabel:  string;
  layovers:       Layover[];
  cabinClass:     string;
  pricePerPerson: number;
  totalPrice:     number;
  pax:            number;
  baggage:        { cabin: string; checked: string };
  co2PerPerson:   number;
  co2Comparison:  string;
  amenities:      string[];
  bookingUrl?:    string;
}

interface HeroDef {
  key:      string;
  flight:   BentoFlight;
  label:    string;
  subLabel: string;
  icon:     string;
  color:    string;
  gradient: string;
}

// ── Real data conversion ──────────────────────────────────────────────────────

function libToBentoFlight(lib: LibBentoFlight): BentoFlight {
  return {
    id:             lib.id,
    airline:        lib.airline,
    logo:           '✈️',
    flightNumbers:  lib.flightNumbers,
    origin:         lib.origin,
    destination:    lib.destination,
    routeLabel:     lib.routeLabel,
    departure:      lib.departure,
    arrival:        lib.arrival,
    arrivalNote:    lib.arrivalNote,
    totalMin:       lib.totalMin,
    durationLabel:  lib.durationLabel,
    layovers:       lib.layovers,
    cabinClass:     lib.cabinClass,
    pricePerPerson: lib.pricePerPerson,
    totalPrice:     lib.totalPrice,
    pax:            lib.pax,
    baggage:        lib.baggage,
    co2PerPerson:   lib.co2PerPerson,
    co2Comparison:  lib.co2Comparison,
    amenities:      lib.amenities,
    bookingUrl:     lib.bookingUrl,
  };
}

function libToHeroDefs(results: LibBentoFlight[]): HeroDef[] {
  if (results.length === 0) return [];

  const all = [...results];
  const cabinRank = (c: string) =>
    c.includes('First') ? 4 : c.includes('Business') ? 3 : c.includes('Premium') ? 2 : 1;

  const fastest  = all.reduce((a, b) => a.totalMin < b.totalMin ? a : b);
  const rest1    = all.filter(f => f.id !== fastest.id);
  const cheapest = (rest1.length > 0 ? rest1 : all)
    .reduce((a, b) => a.pricePerPerson < b.pricePerPerson ? a : b);
  const rest2    = all.filter(f => f.id !== fastest.id && f.id !== cheapest.id);
  const premium  = (rest2.length > 0 ? rest2 : all)
    .reduce((a, b) => cabinRank(a.cabinClass) > cabinRank(b.cabinClass) ? a : b);

  const seen    = new Set<string>();
  const unique: LibBentoFlight[] = [];
  for (const f of [fastest, cheapest, premium]) {
    if (!seen.has(f.id)) { seen.add(f.id); unique.push(f); }
  }
  for (const f of all) {
    if (unique.length >= 3) break;
    if (!seen.has(f.id)) { seen.add(f.id); unique.push(f); }
  }

  const HERO_CONFIGS = [
    {
      label:    'The Time-Saver',
      icon:     '⚡',
      color:    '#007AFF',
      gradient: 'linear-gradient(135deg, #007AFF 0%, #5E5CE6 100%)',
      subLabelFn: (lib: LibBentoFlight) =>
        `Fastest route · ${lib.durationLabel}${lib.layovers.length === 0 ? ' · Non-stop' : ` · via ${lib.layovers[0].code}`}`,
    },
    {
      label:    'The Smart Value',
      icon:     '✦',
      color:    '#30D158',
      gradient: 'linear-gradient(135deg, #30D158 0%, #00C7BE 100%)',
      subLabelFn: (lib: LibBentoFlight) =>
        `Best price · $${lib.pricePerPerson.toLocaleString()}/person · ${lib.cabinClass}`,
    },
    {
      label:    'The Premium Pick',
      icon:     '👑',
      color:    '#FF9F0A',
      gradient: 'linear-gradient(135deg, #FFD60A 0%, #FF9F0A 100%)',
      subLabelFn: (lib: LibBentoFlight) =>
        `${lib.cabinClass}${lib.layovers.length === 0 ? ' · Direct flight' : ` · via ${lib.layovers.map(l => l.code).join(', ')}`}`,
    },
  ];

  return unique.slice(0, 3).map((lib, idx) => {
    const cfg = HERO_CONFIGS[idx];
    return {
      key:      lib.id,
      flight:   libToBentoFlight(lib),
      label:    cfg.label,
      subLabel: cfg.subLabelFn(lib),
      icon:     cfg.icon,
      color:    cfg.color,
      gradient: cfg.gradient,
    };
  });
}

// ── Destination photo map (Unsplash source — no API key, free) ───────────────

const DEST_PHOTOS: Record<string, string> = {
  MAD: 'https://images.unsplash.com/photo-1543783207-ec64e4d95325?w=800&q=80',
  CDG: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&q=80',
  NRT: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&q=80',
  JFK: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=800&q=80',
  LHR: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800&q=80',
  DXB: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800&q=80',
  BCN: 'https://images.unsplash.com/photo-1523531294919-4bcd7c65e216?w=800&q=80',
  FCO: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800&q=80',
  BKK: 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=800&q=80',
  SIN: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=800&q=80',
  AMS: 'https://images.unsplash.com/photo-1534351590666-13e3e96b5902?w=800&q=80',
  SYD: 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=800&q=80',
  LIS: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=800&q=80',
  IST: 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=800&q=80',
  TLV: 'https://images.unsplash.com/photo-1576045515606-3be3c27e2a8a?w=800&q=80',
  MIA: 'https://images.unsplash.com/photo-1514214246283-d427a95c5d2f?w=800&q=80',
  LAX: 'https://images.unsplash.com/photo-1534430480872-3498386e7856?w=800&q=80',
  MUC: 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?w=800&q=80',
  VIE: 'https://images.unsplash.com/photo-1516550135131-fe3dcbb7e4b0?w=800&q=80',
  PRG: 'https://images.unsplash.com/photo-1541849546-216549ae216d?w=800&q=80',
};

function destPhoto(code: string | undefined): string | null {
  if (!code) return null;
  const iata = code.match(/\(([A-Z]{3})\)/)?.[1] ?? code.trim().toUpperCase().slice(0, 3);
  return DEST_PHOTOS[iata] ?? null;
}

// ── States ────────────────────────────────────────────────────────────────────

function IdleState({ from, to }: { from?: string; to?: string }) {
  const hasRoute = from && to;
  const photo    = destPhoto(to);

  if (hasRoute && photo) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={SPRING}
        style={{
          borderRadius: 22, overflow: 'hidden', position: 'relative',
          height: 240, marginTop: 8, cursor: 'default',
        }}
      >
        {/* Background photo */}
        <img
          src={photo}
          alt={to}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'center',
          }}
        />
        {/* Gradient overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(0deg, rgba(0,0,0,0.70) 0%, rgba(0,0,0,0.18) 60%, transparent 100%)',
        }} />
        {/* Glass info bar */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, padding: '20px 22px 18px',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.15, margin: 0, textShadow: '0 2px 12px rgba(0,0,0,0.4)' }}>
                {from} → {to}
              </p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', margin: '4px 0 0', fontWeight: 500, letterSpacing: '-0.01em' }}>
                Select engines and hit Search to find the best fares
              </p>
            </div>
            <motion.div
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
              style={{ fontSize: 32, lineHeight: 1, filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.4))' }}
              aria-hidden
            >✈️</motion.div>
          </div>
        </div>
        {/* Specular top */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)' }} />
      </motion.div>
    );
  }

  // Fallback — no photo or no route: rich atmospheric idle card
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={SPRING}
      style={{
        height: '100%', minHeight: 340, borderRadius: 20, overflow: 'hidden',
        position: 'relative', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 0,
        background: 'linear-gradient(145deg, #E8F2FF 0%, #EEF6FF 35%, #F0F4FF 65%, #E8EFFF 100%)',
        marginTop: 8,
      }}
    >
      {/* Ambient glow orbs */}
      <div aria-hidden style={{ position: 'absolute', top: '-25%', left: '-10%', width: '65%', height: '65%', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(0,122,255,0.12) 0%, transparent 65%)', animation: 'ambient-drift-a 22s ease-in-out infinite', pointerEvents: 'none' }} />
      <div aria-hidden style={{ position: 'absolute', bottom: '-20%', right: '-8%', width: '55%', height: '55%', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(90,200,250,0.11) 0%, transparent 65%)', animation: 'ambient-drift-b 28s ease-in-out infinite', pointerEvents: 'none' }} />

      {/* Sky horizon line */}
      <div aria-hidden style={{ position: 'absolute', bottom: '28%', left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent 5%, rgba(0,122,255,0.12) 20%, rgba(0,122,255,0.20) 50%, rgba(0,122,255,0.12) 80%, transparent 95%)', pointerEvents: 'none' }} />

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, paddingInline: 32, textAlign: 'center' }}>
        <motion.div
          animate={{ y: [0, -12, 0], rotate: [0, 1.5, -1, 0] }}
          transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
          style={{ fontSize: 56, lineHeight: 1, filter: 'drop-shadow(0 8px 20px rgba(0,122,255,0.20))' }}
          aria-hidden
        >✈️</motion.div>

        <div>
          <p style={{ fontSize: 22, fontWeight: 900, color: '#1A1A2E', letterSpacing: '-0.04em', lineHeight: 1.15, margin: 0 }}>
            Where are you flying?
          </p>
          <p style={{ fontSize: 13, color: '#48484A', marginTop: 7, letterSpacing: '-0.012em', lineHeight: 1.6, maxWidth: 320 }}>
            Enter origin and destination above — Unit scans 30 global fare engines simultaneously and ranks the best routes for you.
          </p>
        </div>

        {/* Feature pills */}
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', justifyContent: 'center' }}>
          {['⚡ 30 engines live', '🔁 Real-time dedup', '🛡 No hidden fees'].map(f => (
            <div key={f} style={{ fontSize: 10.5, fontWeight: 700, paddingBlock: 5, paddingInline: 11, borderRadius: 99, background: 'rgba(0,122,255,0.08)', border: '1px solid rgba(0,122,255,0.18)', color: '#005BBF', letterSpacing: '-0.005em' }}>
              {f}
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function NeedsApiKeyState({
  provider,
  setupUrl,
  message,
}: {
  provider:  string;
  setupUrl?: string;
  message?:  string | null;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={SPRING}
      style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        height:         '100%',
        minHeight:      480,
        gap:            20,
        textAlign:      'center',
        paddingInline:  32,
      }}
    >
      <div
        style={{
          width:           64,
          height:          64,
          borderRadius:    20,
          background:      'rgba(255,159,10,0.10)',
          border:          '1.5px solid rgba(255,159,10,0.25)',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          fontSize:        28,
        }}
        aria-hidden
      >
        🔑
      </div>
      <div>
        <p style={{ fontSize: 18, fontWeight: 900, color: '#1D1D1F', letterSpacing: '-0.03em' }}>
          Connect {provider} API
        </p>
        <p style={{ fontSize: 12, color: '#6E6E73', marginBlockStart: 6, lineHeight: 1.65, maxWidth: 320 }}>
          {message ?? `Add your ${provider} credentials to .env.local to enable real-time flight search.`}
        </p>
      </div>
      <div
        style={{
          padding:       '14px 18px',
          borderRadius:  14,
          background:    'rgba(0,0,0,0.025)',
          border:        '1px solid rgba(0,0,0,0.07)',
          textAlign:     'start',
          maxWidth:      360,
          width:         '100%',
          display:       'flex',
          flexDirection: 'column',
          gap:           6,
        }}
      >
        <p style={{ fontSize: 10, fontWeight: 800, color: '#AEAEB2', textTransform: 'uppercase', letterSpacing: '0.10em', marginBlockEnd: 2 }}>
          Setup
        </p>
        {[
          '1. Register at developers.amadeus.com',
          '2. Create an app → copy Client ID + Secret',
          '3. Add to .env.local:',
          '   AMADEUS_CLIENT_ID=your_id',
          '   AMADEUS_CLIENT_SECRET=your_secret',
          '4. Restart the dev server',
        ].map(step => (
          <p
            key={step}
            style={{
              fontSize:   11,
              color:      '#3C3C43',
              lineHeight: 1.5,
              fontFamily: step.startsWith('   ') ? 'monospace' : 'inherit',
            }}
          >
            {step}
          </p>
        ))}
      </div>
      {setupUrl && (
        <motion.a
          href={setupUrl}
          target="_blank"
          rel="noopener noreferrer"
          whileHover={{ scale: 1.02, boxShadow: '0 8px 28px rgba(255,159,10,0.35)' }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 400, damping: 22 }}
          style={{
            display:        'flex',
            alignItems:     'center',
            gap:            6,
            paddingBlock:   12,
            paddingInline:  22,
            borderRadius:   12,
            background:     'linear-gradient(135deg, #FFD60A 0%, #FF9F0A 100%)',
            boxShadow:      '0 4px 16px rgba(255,159,10,0.28)',
            color:          'white',
            fontSize:       13,
            fontWeight:     800,
            letterSpacing:  '-0.01em',
            textDecoration: 'none',
          }}
        >
          Get Free API Key →
        </motion.a>
      )}
    </motion.div>
  );
}

function ErrorState({ message }: { message?: string | null }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={SPRING}
      style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        height:         '100%',
        minHeight:      480,
        gap:            16,
        textAlign:      'center',
        paddingInline:  32,
      }}
    >
      <span style={{ fontSize: 48 }} aria-hidden>⚠️</span>
      <div>
        <p style={{ fontSize: 18, fontWeight: 900, color: '#1D1D1F', letterSpacing: '-0.03em' }}>
          Search Failed
        </p>
        <p style={{ fontSize: 12, color: '#6E6E73', marginBlockStart: 6, maxWidth: 340, lineHeight: 1.65 }}>
          {message ?? 'An error occurred while searching. Please check your connection and try again.'}
        </p>
      </div>
    </motion.div>
  );
}

function NoResultsState({ from, to }: { from?: string; to?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={SPRING}
      style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        height:         '100%',
        minHeight:      480,
        gap:            16,
        textAlign:      'center',
        paddingInline:  32,
      }}
    >
      <span style={{ fontSize: 48 }} aria-hidden>🔍</span>
      <div>
        <p style={{ fontSize: 18, fontWeight: 900, color: '#1D1D1F', letterSpacing: '-0.03em' }}>
          No Flights Found
        </p>
        <p style={{ fontSize: 12, color: '#6E6E73', marginBlockStart: 6, maxWidth: 340, lineHeight: 1.65 }}>
          {from && to
            ? `No flights found from ${from} to ${to} for the selected criteria.`
            : 'No flights found for the selected criteria.'}
          {' '}Try adjusting your dates, cabin class, or adding a connection.
        </p>
      </div>
    </motion.div>
  );
}

// ── Loading skeleton (3 glass cards in bento layout) ─────────────────────────

function BentoSkeleton({ engineCount, from, to }: { engineCount: number; from?: string; to?: string }) {
  const routeText = from && to ? `${from} → ${to}` : 'your route';
  return (
    <motion.div
      key="skeleton"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
    >
      {/* Scanning header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBlockEnd: 18 }}>
        <motion.span
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
          style={{ fontSize: 13, color: '#007AFF', display: 'inline-block' }}
          aria-hidden
        >
          ✦
        </motion.span>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#007AFF', letterSpacing: '-0.01em' }}>
          Scanning {engineCount} engines
        </span>
        <span style={{ fontSize: 11, color: '#AEAEB2' }}>·</span>
        <motion.span
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.8, repeat: Infinity }}
          style={{ fontSize: 11, color: '#AEAEB2' }}
        >
          Distilling {routeText} results…
        </motion.span>
      </div>

      {/* 3-card bento skeleton grid */}
      <div
        style={{
          display:             'grid',
          gridTemplateColumns: '1.65fr 1fr',
          gridTemplateRows:    'repeat(2, 240px)',
          gap:                 12,
        }}
      >
        <GlassShimmer
          variant="hero-card"
          style={{ gridRow: '1 / span 2', borderRadius: 24, height: '100%' }}
          delay={0}
        />
        <GlassShimmer
          variant="hero-card"
          style={{ borderRadius: 24, height: '100%' }}
          delay={0.12}
        />
        <GlassShimmer
          variant="hero-card"
          style={{ borderRadius: 24, height: '100%' }}
          delay={0.24}
        />
      </div>
    </motion.div>
  );
}

// ── Drag handle ───────────────────────────────────────────────────────────────

function DragHandle({ flight, color }: { flight: BentoFlight; color: string }) {
  const dispatchDrag = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof document === 'undefined') return;
    document.dispatchEvent(
      new CustomEvent('unitravel:zone-drag-commit', {
        detail: {
          id:         flight.id,
          type:       'flight',
          title:      flight.airline,
          subtitle:   flight.routeLabel,
          price:      flight.totalPrice,
          currency:   'USD',
          icon:       flight.logo,
          sourceZone: 'flights',
        },
      }),
    );
  };

  return (
    <motion.button
      onClick={dispatchDrag}
      whileHover={{ scale: 1.1, background: `${color}18`, borderColor: `${color}35` }}
      whileTap={{ scale: 0.92 }}
      transition={{ type: 'spring', stiffness: 400, damping: 22 }}
      title="Add to timeline"
      aria-label="Drag to timeline"
      style={{
        display:          'flex',
        alignItems:       'center',
        gap:              5,
        paddingBlock:     7,
        paddingInline:    10,
        borderRadius:     10,
        background:       'rgba(0,0,0,0.04)',
        border:           '1px solid rgba(0,0,0,0.07)',
        cursor:           'grab',
        fontFamily:       'inherit',
        color:            '#6E6E73',
        flexShrink:       0,
      }}
    >
      <GripHorizontal size={13} aria-hidden strokeWidth={2.2} />
      <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', userSelect: 'none' }}>
        Add
      </span>
    </motion.button>
  );
}

// ── Hero bento card (in grid) ─────────────────────────────────────────────────

function LayoverMicroDetail({ flight, color }: { flight: BentoFlight; color: string }) {
  const hasLayover = flight.layovers.length > 0;

  return (
    <div style={{ position: 'relative', paddingBlock: 10 }}>
      {/* Dashed route line */}
      <div style={{
        position:     'relative',
        height:       2,
        borderRadius: 999,
        background:   'transparent',
        borderBlockEnd: '1.5px dashed rgba(0,0,0,0.15)',
      }}>
        {/* Origin dot */}
        <div style={{
          position:   'absolute',
          insetBlockStart: '50%',
          insetInlineStart: 0,
          transform:  'translate(-50%, -50%)',
          width:      8, height: 8, borderRadius: '50%',
          background: color,
          boxShadow:  `0 0 0 3px ${color}20`,
        }} />

        {/* Layover dot(s) */}
        {hasLayover && flight.layovers.map((lay, i) => {
          const pos = ((i + 1) / (flight.layovers.length + 1)) * 100;
          return (
            <div key={lay.code} style={{ position: 'absolute', insetBlockStart: '50%', insetInlineStart: `${pos}%`, transform: 'translate(-50%, -50%)' }}>
              {/* Pulsing yellow ring */}
              <motion.div
                animate={{ scale: [1, 1.5, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                  position: 'absolute', inset: -4, borderRadius: '50%',
                  background: '#FF9F0A', opacity: 0.4,
                }}
                aria-hidden
              />
              <div style={{
                width: 10, height: 10, borderRadius: '50%',
                background: '#FF9F0A',
                border: '2px solid white',
                boxShadow: '0 0 0 2px rgba(255,159,10,0.35)',
                position: 'relative', zIndex: 1,
              }} />
              {/* Layover label */}
              <div style={{
                position: 'absolute', top: 14, insetInlineStart: '50%',
                transform: 'translateX(-50%)',
                whiteSpace: 'nowrap',
                fontSize: 9, fontWeight: 800, color: '#FF9F0A',
                background: 'rgba(255,255,255,0.95)',
                paddingBlock: 2, paddingInline: 5,
                borderRadius: 6,
                border: '1px solid rgba(255,159,10,0.20)',
              }}>
                {lay.code} · {lay.durationLabel}
              </div>
            </div>
          );
        })}

        {/* Destination dot */}
        <div style={{
          position:   'absolute',
          insetBlockStart: '50%',
          insetInlineEnd: 0,
          transform:  'translate(50%, -50%)',
          width:      8, height: 8, borderRadius: '50%',
          background: '#5E5CE6',
          boxShadow:  '0 0 0 3px rgba(94,92,230,0.20)',
        }} />
      </div>

      {/* Origin / Dest labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBlockStart: hasLayover ? 32 : 10 }}>
        <span style={{ fontSize: 9, fontWeight: 800, color, letterSpacing: '0.04em' }}>{flight.origin}</span>
        <span style={{ fontSize: 10, color: '#AEAEB2', fontWeight: 600 }}>{flight.durationLabel}</span>
        <span style={{ fontSize: 9, fontWeight: 800, color: '#5E5CE6', letterSpacing: '0.04em' }}>{flight.destination}</span>
      </div>

      {/* Departure / Arrival times */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBlockStart: 2 }}>
        <span style={{ fontSize: 11, fontWeight: 900, color: '#1D1D1F' }}>{flight.departure}</span>
        <span style={{ fontSize: 11, fontWeight: 900, color: '#1D1D1F' }}>{flight.arrival}</span>
      </div>
    </div>
  );
}

const HeroBentoCard = memo(function HeroBentoCard({
  hero,
  isExpanded,
  isBlurred,
  onClick,
}: {
  hero:       HeroDef;
  isExpanded: boolean;
  isBlurred:  boolean;
  onClick:    () => void;
}) {
  const { flight } = hero;
  const [microOpen, setMicroOpen] = useState(false);

  return (
    <motion.div
      animate={{
        opacity: isExpanded ? 0 : isBlurred ? 0.26 : 1,
        filter:  isBlurred ? 'blur(6px) saturate(0.5)' : 'none',
        scale:   isBlurred ? 0.97 : 1,
      }}
      transition={SPRING}
      style={{ height: '100%' }}
    >
      {/* When not the expanded card: render the layoutId card */}
      {!isExpanded && (
        <motion.div
          layoutId={`avi-hero-${flight.id}`}
          onClick={onClick}
          className="flex flex-col rounded-[2rem] border border-white/70 bg-white/40 backdrop-blur-2xl shadow-xl transition-all"
          style={{
            height:               '100%',
            backdropFilter:       'blur(40px) saturate(1.8)',
            WebkitBackdropFilter: 'blur(40px) saturate(1.8)',
            overflow:             'hidden',
            position:             'relative',
            cursor:               'pointer',
            boxShadow:            '0 8px 32px rgba(0,0,0,0.07), 0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,1)',
          }}
          whileHover={{
            y: -6,
            boxShadow: `0 22px 60px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.07), 0 0 0 1px ${hero.color}22, inset 0 1px 0 rgba(255,255,255,1)`,
          }}
          transition={SPRING}
        >
          {/* Top gradient accent */}
          <div style={{ height: 3, background: hero.gradient, flexShrink: 0 }} />

          {/* Specular highlight */}
          <div
            aria-hidden
            style={{
              position:      'absolute',
              inset:         0,
              background:    'linear-gradient(145deg, rgba(255,255,255,0.52) 0%, transparent 42%)',
              borderRadius:  'inherit',
              pointerEvents: 'none',
            }}
          />

          {/* Card body */}
          <div
            style={{
              flex:          1,
              display:       'flex',
              flexDirection: 'column',
              gap:           12,
              padding:       '16px 18px 18px',
              position:      'relative',
              zIndex:        1,
            }}
          >
            {/* Hero badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  fontSize:      9,
                  fontWeight:    900,
                  textTransform: 'uppercase',
                  letterSpacing: '0.15em',
                  paddingBlock:  4,
                  paddingInline: 8,
                  borderRadius:  999,
                  background:    `${hero.color}14`,
                  color:         hero.color,
                  border:        `1px solid ${hero.color}28`,
                }}
              >
                {hero.label}
              </span>
              <span style={{ fontSize: 16 }} aria-hidden>{hero.icon}</span>
            </div>

            {/* Airline + route */}
            <div>
              <p style={{ fontSize: 17, fontWeight: 900, color: '#1D1D1F', letterSpacing: '-0.025em', lineHeight: 1.2 }}>
                {flight.airline}
              </p>
              <p style={{ fontSize: 11, color: '#6E6E73', marginBlockStart: 3 }}>{flight.routeLabel}</p>
            </div>

            {/* Key metrics */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {[
                { label: 'Duration', value: flight.durationLabel },
                { label: 'Stops',    value: flight.layovers.length === 0 ? 'Non-stop' : `${flight.layovers.length} stop${flight.layovers.length !== 1 ? 's' : ''}` },
                { label: 'Class',    value: flight.cabinClass },
              ].map(m => (
                <div
                  key={m.label}
                  style={{
                    display:       'flex',
                    flexDirection: 'column',
                    gap:           1,
                    paddingBlock:  5,
                    paddingInline: 8,
                    borderRadius:  8,
                    background:    'rgba(0,0,0,0.025)',
                    border:        '1px solid rgba(0,0,0,0.05)',
                  }}
                >
                  <span style={{ fontSize: 8, color: '#AEAEB2', textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: 1 }}>
                    {m.label}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#1D1D1F' }}>{m.value}</span>
                </div>
              ))}
            </div>

            {/* Sub-label */}
            <p style={{ fontSize: 11, color: '#6E6E73', flex: 1, lineHeight: 1.55 }}>
              {hero.subLabel}
            </p>

            {/* Micro-detail toggle */}
            <motion.button
              onClick={e => { e.stopPropagation(); setMicroOpen(o => !o); }}
              whileHover={{ background: `${hero.color}0C` }}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.15 }}
              style={{
                display:       'flex',
                alignItems:    'center',
                gap:           5,
                paddingBlock:  5,
                paddingInline: 8,
                borderRadius:  8,
                background:    'rgba(0,0,0,0.028)',
                border:        '1px solid rgba(0,0,0,0.06)',
                cursor:        'pointer',
                fontFamily:    'inherit',
                alignSelf:     'flex-start',
              }}
              aria-expanded={microOpen}
              aria-label="Toggle micro-details"
            >
              <span style={{ fontSize: 10, fontWeight: 700, color: hero.color }}>
                View Micro-Details
              </span>
              <motion.span
                animate={{ rotate: microOpen ? 180 : 0 }}
                transition={{ duration: 0.22 }}
                style={{ fontSize: 9, color: hero.color, lineHeight: 1 }}
                aria-hidden
              >
                ▾
              </motion.span>
            </motion.button>

            {/* Micro-detail expansion */}
            <AnimatePresence>
              {microOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ type: 'spring', stiffness: 360, damping: 30 }}
                  style={{ overflow: 'hidden' }}
                >
                  <LayoverMicroDetail flight={flight} color={hero.color} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Footer: price + drag handle */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBlockStart: 'auto' }}>
              <div>
                <p style={{ fontSize: 9, color: '#AEAEB2', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Per person</p>
                <p style={{ fontSize: 30, fontWeight: 900, color: hero.color, letterSpacing: '-0.03em', lineHeight: 1.08 }}>
                  ${flight.pricePerPerson.toLocaleString()}
                </p>
              </div>
              <DragHandle flight={flight} color={hero.color} />
            </div>
          </div>
        </motion.div>
      )}

      {/* When expanded: show a placeholder to hold grid space */}
      {isExpanded && (
        <div
          aria-hidden
          style={{
            height:       '100%',
            borderRadius: 24,
            background:   'rgba(0,0,0,0.025)',
            border:       '1px dashed rgba(0,0,0,0.06)',
          }}
        />
      )}
    </motion.div>
  );
});

// ── Expanded detail overlay ───────────────────────────────────────────────────

function DetailView({ hero, onClose }: { hero: HeroDef; onClose: () => void }) {
  const { flight } = hero;

  return (
    <motion.div
      layoutId={`avi-hero-${flight.id}`}
      style={{
        position:             'relative',
        width:                'min(680px, calc(100vw - 48px))',
        maxHeight:            'calc(100dvh - 96px)',
        background:           'rgba(255,255,255,0.97)',
        backdropFilter:       'blur(56px) saturate(2)',
        WebkitBackdropFilter: 'blur(56px) saturate(2)',
        border:               '1px solid rgba(255,255,255,0.98)',
        boxShadow:            '0 40px 120px rgba(0,0,0,0.20), 0 8px 32px rgba(0,0,0,0.09)',
        borderRadius:         24,
        overflowY:            'auto',
        overflowX:            'hidden',
        zIndex:               1,
        scrollbarWidth:       'none',
      }}
      transition={SPRING_DETAIL}
      onClick={e => e.stopPropagation()}
    >
      {/* Top gradient */}
      <div style={{ height: 4, background: hero.gradient, flexShrink: 0 }} />

      {/* Specular */}
      <div
        aria-hidden
        style={{
          position:      'absolute',
          inset:         0,
          background:    'linear-gradient(145deg, rgba(255,255,255,0.46) 0%, transparent 36%)',
          pointerEvents: 'none',
          borderRadius:  'inherit',
        }}
      />

      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* ── Top bar ──────────────────────────────────────────────── */}
        <div
          style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            paddingInline:  24,
            paddingBlock:   18,
            borderBlockEnd: '1px solid rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <motion.button
              onClick={onClose}
              whileHover={{ scale: 1.04, background: 'rgba(0,0,0,0.08)' }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 400, damping: 22 }}
              style={{
                display:       'flex',
                alignItems:    'center',
                gap:           5,
                paddingBlock:  6,
                paddingInline: 12,
                borderRadius:  999,
                background:    'rgba(0,0,0,0.05)',
                border:        'none',
                cursor:        'pointer',
                fontSize:      12,
                fontWeight:    600,
                color:         '#6E6E73',
                fontFamily:    'inherit',
              }}
            >
              ← Back
            </motion.button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }} aria-hidden>{hero.icon}</span>
              <span style={{ fontSize: 15, fontWeight: 900, color: '#1D1D1F', letterSpacing: '-0.02em' }}>
                {hero.label}
              </span>
            </div>
          </div>
          <div style={{ textAlign: 'end' }}>
            <p style={{ fontSize: 9, color: '#AEAEB2', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Total for {flight.pax}
            </p>
            <p style={{ fontSize: 28, fontWeight: 900, color: hero.color, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
              ${flight.totalPrice.toLocaleString()}
            </p>
          </div>
        </div>

        {/* ── Detail sections ───────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14, duration: 0.3, ease: 'easeOut' }}
          style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}
        >

          <DetailSection title="Flight Timeline">
            <FlightTimeline flight={flight} color={hero.color} />
          </DetailSection>

          <DetailSection title="Baggage Allowance">
            <BaggageView baggage={flight.baggage} color={hero.color} />
          </DetailSection>

          <DetailSection title="Carbon Footprint">
            <CarbonView flight={flight} color={hero.color} />
          </DetailSection>

          {flight.amenities.length > 0 && (
            <DetailSection title="Included">
              <AmenitiesView amenities={flight.amenities} color={hero.color} />
            </DetailSection>
          )}

          <DetailSection title="Price Breakdown">
            <PriceBreakdown flight={flight} color={hero.color} />
          </DetailSection>

          {/* CTA row */}
          <div style={{ display: 'flex', gap: 10, paddingBlockStart: 4 }}>
            <motion.button
              onClick={() => {
                const url = flight.bookingUrl
                  ?? `https://www.google.com/flights?q=${encodeURIComponent(flight.origin + ' to ' + flight.destination)}`;
                window.open(url, '_blank', 'noopener');
              }}
              whileHover={{ scale: 1.02, boxShadow: `0 8px 28px ${hero.color}45` }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 24 }}
              style={{
                flex:           1,
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                gap:            8,
                paddingBlock:   14,
                borderRadius:   14,
                background:     hero.gradient,
                boxShadow:      `0 4px 18px ${hero.color}38`,
                color:          'white',
                fontSize:       13,
                fontWeight:     800,
                letterSpacing:  '-0.01em',
                border:         'none',
                cursor:         'pointer',
                fontFamily:     'inherit',
              }}
            >
              {flight.bookingUrl ? `Book on ${flight.airline} →` : `Search on Google Flights →`}
            </motion.button>

            <motion.button
              onClick={() => {
                if (typeof document === 'undefined') return;
                document.dispatchEvent(
                  new CustomEvent('unitravel:zone-drag-commit', {
                    detail: {
                      id:         flight.id,
                      type:       'flight',
                      title:      flight.airline,
                      subtitle:   flight.routeLabel,
                      price:      flight.totalPrice,
                      currency:   'USD',
                      icon:       flight.logo,
                      sourceZone: 'flights',
                    },
                  }),
                );
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 24 }}
              style={{
                display:       'flex',
                alignItems:    'center',
                gap:           6,
                paddingBlock:  14,
                paddingInline: 20,
                borderRadius:  14,
                background:    'rgba(0,0,0,0.04)',
                border:        '1px solid rgba(0,0,0,0.09)',
                color:         '#1D1D1F',
                fontSize:      13,
                fontWeight:    700,
                cursor:        'pointer',
                fontFamily:    'inherit',
                flexShrink:    0,
              }}
            >
              <span aria-hidden>⠿</span>
              <span>Add to Timeline</span>
            </motion.button>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ── Detail sub-components ─────────────────────────────────────────────────────

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ fontSize: 10, fontWeight: 800, color: '#AEAEB2', textTransform: 'uppercase', letterSpacing: '0.10em' }}>
        {title}
      </p>
      {children}
    </div>
  );
}

function FlightTimeline({ flight, color }: { flight: BentoFlight; color: string }) {
  return (
    <div
      style={{
        padding:       '14px 16px',
        borderRadius:  14,
        background:    'rgba(0,0,0,0.025)',
        border:        '1px solid rgba(0,0,0,0.05)',
        display:       'flex',
        flexDirection: 'column',
        gap:           0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Departure */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 20, fontWeight: 900, color: '#1D1D1F', letterSpacing: '-0.03em' }}>
            {flight.departure}
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color, marginBlockStart: 1 }}>{flight.origin}</span>
          <span style={{ fontSize: 9, color: '#AEAEB2', marginBlockStart: 1 }}>Departure</span>
        </div>

        {/* Route line with layover badge */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'stretch' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.22, duration: 0.55, ease: 'easeOut' }}
              style={{ height: 2, flex: 1, background: `linear-gradient(90deg, ${color} 0%, ${color}44 100%)`, transformOrigin: 'left' }}
            />
            <div
              style={{
                paddingBlock:  3,
                paddingInline: 7,
                borderRadius:  999,
                background:    `${color}14`,
                border:        `1px solid ${color}28`,
                fontSize:      9,
                fontWeight:    700,
                color,
                flexShrink:    0,
                whiteSpace:    'nowrap',
              }}
            >
              {flight.layovers.length === 0
                ? 'Non-stop'
                : `${flight.layovers[0].code} · ${flight.layovers[0].durationLabel}`}
            </div>
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.36, duration: 0.55, ease: 'easeOut' }}
              style={{ height: 2, flex: 1, background: `linear-gradient(90deg, ${color}44 0%, ${color} 100%)`, transformOrigin: 'left' }}
            />
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
          </div>
          <p style={{ textAlign: 'center', fontSize: 10, color: '#6E6E73', fontWeight: 500 }}>
            {flight.durationLabel} total · {flight.flightNumbers.join(' + ')}
          </p>
        </div>

        {/* Arrival */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 20, fontWeight: 900, color: '#1D1D1F', letterSpacing: '-0.03em' }}>
              {flight.arrival}
            </span>
            <span style={{ fontSize: 10, color, fontWeight: 800 }}>{flight.arrivalNote}</span>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color, marginBlockStart: 1 }}>{flight.destination}</span>
          <span style={{ fontSize: 9, color: '#AEAEB2', marginBlockStart: 1 }}>Arrival</span>
        </div>
      </div>

      {/* Layover details */}
      {flight.layovers.map(lay => (
        <div
          key={lay.code}
          style={{
            display:           'flex',
            alignItems:        'center',
            gap:               10,
            marginBlockStart:  12,
            paddingBlockStart: 12,
            borderBlockStart:  '1px solid rgba(0,0,0,0.05)',
          }}
        >
          <span style={{ fontSize: 13 }} aria-hidden>🔄</span>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#1D1D1F' }}>
              Layover · {lay.airport} ({lay.code})
            </p>
            <p style={{ fontSize: 10, color: '#6E6E73', marginBlockStart: 2 }}>
              {lay.durationLabel} connection time · {lay.durationMin < 90 ? '⚠️ Tight' : lay.durationMin > 240 ? '☕ Comfortable' : '✓ Adequate'}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function BaggageView({ baggage, color }: { baggage: BentoFlight['baggage']; color: string }) {
  const items = [
    { icon: '🎒', label: 'Cabin Bag',    detail: baggage.cabin,   included: true },
    { icon: '🧳', label: 'Checked Bag', detail: baggage.checked, included: !baggage.checked.startsWith('No') },
  ];
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      {items.map(item => (
        <div
          key={item.label}
          style={{
            flex:         1,
            display:      'flex',
            alignItems:   'center',
            gap:          10,
            padding:      '13px 14px',
            borderRadius: 12,
            background:   item.included ? `${color}0A` : 'rgba(0,0,0,0.03)',
            border:       `1px solid ${item.included ? `${color}22` : 'rgba(0,0,0,0.06)'}`,
          }}
        >
          <span style={{ fontSize: 22 }} aria-hidden>{item.icon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#1D1D1F' }}>{item.label}</p>
            <p style={{ fontSize: 10, color: '#6E6E73', marginBlockStart: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {item.detail}
            </p>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: item.included ? color : '#AEAEB2', flexShrink: 0 }}>
            {item.included ? '✓' : '✗'}
          </span>
        </div>
      ))}
    </div>
  );
}

function CarbonView({ flight, color }: { flight: BentoFlight; color: string }) {
  const baseline  = Math.round(flight.totalMin * 0.45);
  const ratio     = baseline > 0 ? flight.co2PerPerson / baseline : 1;
  const barColor  = ratio < 0.95 ? '#30D158' : ratio < 1.15 ? '#FF9F0A' : '#FF3B30';
  const barWidth  = Math.min(ratio * 67, 100);

  return (
    <div
      style={{
        padding:       '14px 16px',
        borderRadius:  14,
        background:    'rgba(0,0,0,0.025)',
        border:        '1px solid rgba(0,0,0,0.05)',
        display:       'flex',
        flexDirection: 'column',
        gap:           10,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.01em' }}>
            {flight.co2PerPerson.toLocaleString()} kg CO₂
          </p>
          <p style={{ fontSize: 10, color: '#6E6E73', marginBlockStart: 2 }}>
            Per person · {flight.co2Comparison}
          </p>
        </div>
        <span style={{ fontSize: 22 }} aria-hidden>
          {ratio < 0.95 ? '🌿' : ratio < 1.15 ? '☁️' : '⚠️'}
        </span>
      </div>

      <div style={{ height: 6, borderRadius: 999, background: 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${barWidth}%` }}
          transition={{ delay: 0.2, duration: 0.7, ease: 'easeOut' }}
          style={{ height: '100%', borderRadius: 999, background: barColor }}
        />
      </div>

      <p style={{ fontSize: 9.5, color: '#AEAEB2', lineHeight: 1.55 }}>
        ✦ Unit monitors real-time carbon offset programs.
        Offset this flight for ~${Math.round(flight.co2PerPerson * 0.018)}/person.
      </p>
    </div>
  );
}

function AmenitiesView({ amenities, color }: { amenities: string[]; color: string }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {amenities.map(a => (
        <div
          key={a}
          style={{
            paddingBlock:  5,
            paddingInline: 9,
            borderRadius:  8,
            background:    `${color}0C`,
            border:        `1px solid ${color}22`,
            fontSize:      11,
            fontWeight:    600,
            color:         '#1D1D1F',
          }}
        >
          {a}
        </div>
      ))}
    </div>
  );
}

function PriceBreakdown({ flight, color }: { flight: BentoFlight; color: string }) {
  const taxEst     = Math.round(flight.totalPrice * 0.14);
  const seatFee    = flight.cabinClass.toLowerCase().includes('business') || flight.cabinClass.toLowerCase().includes('first') ? 0 : 49 * flight.pax;
  const grandTotal = flight.totalPrice + taxEst + seatFee;

  const rows = [
    { label: `${flight.cabinClass} × ${flight.pax}`,                          value: `$${flight.totalPrice.toLocaleString()}` },
    { label: 'Taxes & fees (est.)',                                             value: `$${taxEst.toLocaleString()}` },
    { label: 'Checked baggage',                                                 value: flight.baggage.checked.startsWith('No') ? 'Not included' : 'Included' },
    { label: 'Seat selection',                                                  value: seatFee === 0 ? 'Included' : `+$${seatFee}` },
  ];

  return (
    <div
      style={{
        borderRadius: 14,
        background:   'rgba(0,0,0,0.025)',
        border:       '1px solid rgba(0,0,0,0.05)',
        overflow:     'hidden',
      }}
    >
      {rows.map((row, i) => (
        <div
          key={row.label}
          style={{
            display:        'flex',
            justifyContent: 'space-between',
            alignItems:     'center',
            paddingBlock:   10,
            paddingInline:  16,
            borderBlockEnd: i < rows.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
          }}
        >
          <span style={{ fontSize: 12, color: '#3C3C43' }}>{row.label}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#1D1D1F' }}>{row.value}</span>
        </div>
      ))}
      <div
        style={{
          display:          'flex',
          justifyContent:   'space-between',
          alignItems:       'center',
          paddingBlock:     13,
          paddingInline:    16,
          background:       `${color}08`,
          borderBlockStart: `1px solid ${color}22`,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 800, color: '#1D1D1F' }}>Grand Total</span>
        <span style={{ fontSize: 18, fontWeight: 900, color }}>
          ${grandTotal.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

// ── AviationBento (main export) ───────────────────────────────────────────────

export interface AviationBentoProps {
  searchState:  SearchState;
  engineCount?: number;
  results?:     LibBentoFlight[] | null;
  apiStatus?:   'ok' | 'needs_api_key' | 'error' | null;
  apiMessage?:  string | null;
  query?:       { from: string; to: string; date: string; adults: number; travelClass: string };
}

export function AviationBento({
  searchState,
  engineCount = 1,
  results,
  apiStatus,
  apiMessage,
  query,
}: AviationBentoProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const heroes: HeroDef[] = results && results.length > 0 ? libToHeroDefs(results) : [];

  const expandedHero = expandedId
    ? heroes.find(h => h.flight.id === expandedId) ?? null
    : null;

  const routeFrom = query?.from ?? heroes[0]?.flight.origin;
  const routeTo   = query?.to   ?? heroes[0]?.flight.destination;

  if (searchState === 'idle') {
    return (
      <AnimatePresence mode="wait">
        <IdleState key="idle" from={routeFrom} to={routeTo} />
      </AnimatePresence>
    );
  }

  if (searchState === 'loading') {
    return (
      <AnimatePresence mode="wait">
        <BentoSkeleton key="skeleton" engineCount={engineCount} from={routeFrom} to={routeTo} />
      </AnimatePresence>
    );
  }

  // results state — branch on apiStatus
  if (apiStatus === 'needs_api_key') {
    return (
      <AnimatePresence mode="wait">
        <NeedsApiKeyState
          key="no-key"
          provider="Amadeus"
          setupUrl="https://developers.amadeus.com/register"
          message={apiMessage}
        />
      </AnimatePresence>
    );
  }

  if (apiStatus === 'error') {
    return (
      <AnimatePresence mode="wait">
        <ErrorState key="error" message={apiMessage} />
      </AnimatePresence>
    );
  }

  if (heroes.length === 0) {
    return (
      <AnimatePresence mode="wait">
        <NoResultsState key="no-results" from={routeFrom} to={routeTo} />
      </AnimatePresence>
    );
  }

  // Real results — render bento grid
  const routeLabel = routeFrom && routeTo ? `${routeFrom} → ${routeTo}` : `${heroes[0].flight.origin} → ${heroes[0].flight.destination}`;

  return (
    <LayoutGroup id="avi-bento">
      {/* Section header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...SPRING, delay: 0.05 }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBlockEnd: 16 }}
      >
        <div>
          <p style={{ fontSize: 11, fontWeight: 900, color: '#AEAEB2', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
            Distilled Results
          </p>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#1D1D1F', marginBlockStart: 3, letterSpacing: '-0.015em' }}>
            {heroes.length} hero option{heroes.length !== 1 ? 's' : ''} · {engineCount} engine{engineCount !== 1 ? 's' : ''} · {routeLabel}
          </p>
        </div>
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ ...SPRING, delay: 0.18 }}
          style={{
            display:       'flex',
            alignItems:    'center',
            gap:           6,
            paddingBlock:  5,
            paddingInline: 11,
            borderRadius:  999,
            background:    'rgba(48,209,88,0.10)',
            border:        '1.5px solid rgba(48,209,88,0.26)',
            fontSize:      11,
            fontWeight:    700,
            color:         '#30D158',
          }}
        >
          <motion.span
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.9, repeat: Infinity }}
            style={{ width: 5, height: 5, borderRadius: '50%', background: '#30D158', display: 'inline-block', flexShrink: 0 }}
            aria-hidden
          />
          Live · Amadeus
        </motion.div>
      </motion.div>

      {/* Bento grid — adapts to hero count */}
      {heroes.length >= 3 ? (
        <div
          style={{
            display:             'grid',
            gridTemplateColumns: '1.65fr 1fr',
            gridTemplateRows:    'repeat(2, 240px)',
            gap:                 12,
          }}
        >
          <motion.div
            style={{ gridRow: '1 / span 2' }}
            initial={{ opacity: 0, scale: 0.94, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ ...SPRING, delay: 0 }}
          >
            <HeroBentoCard
              hero={heroes[0]}
              isExpanded={expandedId === heroes[0].flight.id}
              isBlurred={!!expandedId && expandedId !== heroes[0].flight.id}
              onClick={() => setExpandedId(heroes[0].flight.id)}
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ ...SPRING, delay: 0.09 }}
          >
            <HeroBentoCard
              hero={heroes[1]}
              isExpanded={expandedId === heroes[1].flight.id}
              isBlurred={!!expandedId && expandedId !== heroes[1].flight.id}
              onClick={() => setExpandedId(heroes[1].flight.id)}
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ ...SPRING, delay: 0.18 }}
          >
            <HeroBentoCard
              hero={heroes[2]}
              isExpanded={expandedId === heroes[2].flight.id}
              isBlurred={!!expandedId && expandedId !== heroes[2].flight.id}
              onClick={() => setExpandedId(heroes[2].flight.id)}
            />
          </motion.div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {heroes.map((hero, i) => (
            <motion.div
              key={hero.key}
              initial={{ opacity: 0, scale: 0.94, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ ...SPRING, delay: i * 0.09 }}
              style={{ height: 240 }}
            >
              <HeroBentoCard
                hero={hero}
                isExpanded={expandedId === hero.flight.id}
                isBlurred={!!expandedId && expandedId !== hero.flight.id}
                onClick={() => setExpandedId(hero.flight.id)}
              />
            </motion.div>
          ))}
        </div>
      )}

      {/* ── Expanded detail overlay ────────────────────────────────── */}
      <AnimatePresence>
        {expandedId && expandedHero && (
          <motion.div
            key="detail-overlay"
            style={{
              position:       'fixed',
              inset:          0,
              zIndex:         500,
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              padding:        24,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {/* Blurred backdrop */}
            <motion.div
              initial={{ backdropFilter: 'blur(0px)', background: 'rgba(0,0,0,0)' }}
              animate={{ backdropFilter: 'blur(8px)',  background: 'rgba(0,0,0,0.22)' }}
              exit={{ backdropFilter: 'blur(0px)',   background: 'rgba(0,0,0,0)' }}
              transition={{ duration: 0.22 }}
              style={{ position: 'absolute', inset: 0 }}
              onClick={() => setExpandedId(null)}
            />
            <DetailView hero={expandedHero} onClose={() => setExpandedId(null)} />
          </motion.div>
        )}
      </AnimatePresence>
    </LayoutGroup>
  );
}
