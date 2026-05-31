'use client';

import { useState, memo }                               from 'react';
import { motion, AnimatePresence, LayoutGroup }         from 'framer-motion';
import { GlassShimmer }                                 from '@/components/ui/GlassShimmer';

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
  baggage:        { cabin: string; checked: string };
  co2PerPerson:   number;
  co2Comparison:  string;
  amenities:      string[];
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

// ── Mock data: TLV → MEX, Oct 2 2026, Effi & Nofar ───────────────────────────

const FLIGHTS: Record<string, BentoFlight> = {
  ts: {
    id:             'tlv-mex-ua-ts',
    airline:        'United Airlines',
    logo:           '✈️',
    flightNumbers:  ['UA 97', 'UA 958'],
    origin:         'TLV',
    destination:    'MEX',
    routeLabel:     'TLV → EWR → MEX',
    departure:      '08:25',
    arrival:        '23:10',
    arrivalNote:    '+1',
    totalMin:       1245,
    durationLabel:  '20h 45m',
    layovers:       [{ airport: 'Newark Liberty', code: 'EWR', durationLabel: '2h 10m', durationMin: 130 }],
    cabinClass:     'Economy Plus',
    pricePerPerson: 1180,
    totalPrice:     2360,
    baggage:        { cabin: '1× carry-on 10 kg', checked: '1× checked 23 kg' },
    co2PerPerson:   842,
    co2Comparison:  '8% below route avg',
    amenities:      ['Extra legroom', 'USB-A power', 'Seat selection', 'Snack & beverage'],
  },
  sv: {
    id:             'tlv-mex-cm-sv',
    airline:        'Copa Airlines',
    logo:           '🌉',
    flightNumbers:  ['LY 7', 'CM 481'],
    origin:         'TLV',
    destination:    'MEX',
    routeLabel:     'TLV → PTY → MEX',
    departure:      '14:55',
    arrival:        '16:20',
    arrivalNote:    '+1',
    totalMin:       1525,
    durationLabel:  '25h 25m',
    layovers:       [{ airport: 'Panama City (Tocumen)', code: 'PTY', durationLabel: '3h 10m', durationMin: 190 }],
    cabinClass:     'Economy',
    pricePerPerson: 780,
    totalPrice:     1560,
    baggage:        { cabin: '1× carry-on 10 kg', checked: '1× checked 23 kg' },
    co2PerPerson:   920,
    co2Comparison:  '2% above route avg',
    amenities:      ['Meal included', '34" seat pitch', 'Copa Hub lounge'],
  },
  ld: {
    id:             'tlv-mex-am-ld',
    airline:        'Aeroméxico',
    logo:           '🦅',
    flightNumbers:  ['LY 3', 'AM 404'],
    origin:         'TLV',
    destination:    'MEX',
    routeLabel:     'TLV → JFK → MEX',
    departure:      '22:40',
    arrival:        '19:55',
    arrivalNote:    '+1',
    totalMin:       1275,
    durationLabel:  '21h 15m',
    layovers:       [{ airport: 'New York JFK T1', code: 'JFK', durationLabel: '2h 25m', durationMin: 145 }],
    cabinClass:     'Clase Premier (Business)',
    pricePerPerson: 4200,
    totalPrice:     8400,
    baggage:        { cabin: '2× carry-on 15 kg', checked: '2× checked 32 kg' },
    co2PerPerson:   1080,
    co2Comparison:  '22% above avg (offset available)',
    amenities:      ['Flat-bed seat 180°', 'Sky Club lounge', 'Chauffeur service', 'Fine dining', 'Amenity kit', 'Fast-track security'],
  },
};

const HEROES: HeroDef[] = [
  {
    key:      'ts',
    flight:   FLIGHTS.ts,
    label:    'The Time-Saver',
    subLabel: 'Fastest connection · 1 technical stop via EWR',
    icon:     '⚡',
    color:    '#007AFF',
    gradient: 'linear-gradient(135deg, #007AFF 0%, #5E5CE6 100%)',
  },
  {
    key:      'sv',
    flight:   FLIGHTS.sv,
    label:    'The Smart Value',
    subLabel: 'Best price-to-comfort ratio across 10 engines',
    icon:     '✦',
    color:    '#30D158',
    gradient: 'linear-gradient(135deg, #30D158 0%, #00C7BE 100%)',
  },
  {
    key:      'ld',
    flight:   FLIGHTS.ld,
    label:    'The Luxury Direct',
    subLabel: 'Business class · flat-bed · JFK Sky Club lounge',
    icon:     '👑',
    color:    '#FF9F0A',
    gradient: 'linear-gradient(135deg, #FFD60A 0%, #FF9F0A 100%)',
  },
];

// ── Idle state ────────────────────────────────────────────────────────────────

function IdleState() {
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
        gap:            22,
        textAlign:      'center',
        paddingInline:  32,
      }}
    >
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
        style={{ fontSize: 60, lineHeight: 1 }}
        aria-hidden
      >
        ✈️
      </motion.div>
      <div>
        <p style={{ fontSize: 22, fontWeight: 900, color: '#1D1D1F', letterSpacing: '-0.03em', lineHeight: 1.2 }}>
          Aviation Hub Ready
        </p>
        <p style={{ fontSize: 13, color: '#6E6E73', marginBlockStart: 8, letterSpacing: '-0.01em' }}>
          TLV → MEX · Fri Oct 2, 2026 · Effi & Nofar
        </p>
      </div>
      <p style={{ fontSize: 12, color: '#AEAEB2', maxWidth: 340, lineHeight: 1.65 }}>
        Select your engines in the control panel and launch an Omni-Search
        across up to 30 global aviation APIs simultaneously.
        Unit's AI will distill results into 3 curated hero options.
      </p>
    </motion.div>
  );
}

// ── Loading skeleton (3 glass cards in bento layout) ─────────────────────────

function BentoSkeleton({ engineCount }: { engineCount: number }) {
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
          Distilling TLV → MEX results…
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
      <span style={{ fontSize: 13, userSelect: 'none', lineHeight: 1 }} aria-hidden>⠿</span>
      <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', userSelect: 'none' }}>
        Drag
      </span>
    </motion.button>
  );
}

// ── Hero bento card (in grid) ─────────────────────────────────────────────────

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
          style={{
            height:               '100%',
            borderRadius:         24,
            background:           'rgba(255,255,255,0.82)',
            backdropFilter:       'blur(40px) saturate(1.8)',
            WebkitBackdropFilter: 'blur(40px) saturate(1.8)',
            border:               '1px solid rgba(255,255,255,0.95)',
            boxShadow:            '0 8px 32px rgba(0,0,0,0.07), 0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,1)',
            overflow:             'hidden',
            display:              'flex',
            flexDirection:        'column',
            position:             'relative',
            cursor:               'pointer',
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
                { label: 'Stops', value: `${flight.layovers.length} stop` },
                { label: 'Class', value: flight.cabinClass },
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
  const CO2_BASELINE = 940; // Route average (kg per person)

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
                display:      'flex',
                alignItems:   'center',
                gap:          5,
                paddingBlock: 6,
                paddingInline: 12,
                borderRadius:  999,
                background:   'rgba(0,0,0,0.05)',
                border:       'none',
                cursor:       'pointer',
                fontSize:     12,
                fontWeight:   600,
                color:        '#6E6E73',
                fontFamily:   'inherit',
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
            <p style={{ fontSize: 9, color: '#AEAEB2', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total for 2</p>
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

          {/* Flight timeline */}
          <DetailSection title="Flight Timeline">
            <FlightTimeline flight={flight} color={hero.color} />
          </DetailSection>

          {/* Baggage */}
          <DetailSection title="Baggage Allowance">
            <BaggageView baggage={flight.baggage} color={hero.color} />
          </DetailSection>

          {/* Carbon */}
          <DetailSection title="Carbon Footprint">
            <CarbonView flight={flight} color={hero.color} baseline={CO2_BASELINE} />
          </DetailSection>

          {/* Amenities */}
          {flight.amenities.length > 0 && (
            <DetailSection title="Included">
              <AmenitiesView amenities={flight.amenities} color={hero.color} />
            </DetailSection>
          )}

          {/* Price breakdown */}
          <DetailSection title="Price Breakdown">
            <PriceBreakdown flight={flight} color={hero.color} />
          </DetailSection>

          {/* CTA row */}
          <div style={{ display: 'flex', gap: 10, paddingBlockStart: 4 }}>
            <motion.button
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
              Book on {flight.airline} →
            </motion.button>

            <motion.button
              onClick={() => {
                if (typeof document === 'undefined') return;
                document.dispatchEvent(
                  new CustomEvent('unitravel:zone-drag-commit', {
                    detail: { id: flight.id, type: 'flight', title: flight.airline, subtitle: flight.routeLabel, price: flight.totalPrice, currency: 'USD', icon: flight.logo, sourceZone: 'flights' },
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
          <span style={{ fontSize: 9, color: '#AEAEB2', marginBlockStart: 1 }}>Fri Oct 2</span>
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
              {flight.layovers[0]?.code ?? '—'} · {flight.layovers[0]?.durationLabel ?? 'Direct'}
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
          <span style={{ fontSize: 9, color: '#AEAEB2', marginBlockStart: 1 }}>Sat Oct 3</span>
        </div>
      </div>

      {/* Layover detail */}
      {flight.layovers.map(lay => (
        <div
          key={lay.code}
          style={{
            display:          'flex',
            alignItems:       'center',
            gap:              10,
            marginBlockStart: 12,
            paddingBlockStart: 12,
            borderBlockStart: '1px solid rgba(0,0,0,0.05)',
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
    { icon: '🎒', label: 'Cabin Bag', detail: baggage.cabin, included: true },
    { icon: '🧳', label: 'Checked Bag', detail: baggage.checked, included: true },
  ];
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      {items.map(item => (
        <div
          key={item.label}
          style={{
            flex:        1,
            display:     'flex',
            alignItems:  'center',
            gap:         10,
            padding:     '13px 14px',
            borderRadius: 12,
            background:  item.included ? `${color}0A` : 'rgba(0,0,0,0.03)',
            border:      `1px solid ${item.included ? `${color}22` : 'rgba(0,0,0,0.06)'}`,
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

function CarbonView({ flight, color, baseline }: { flight: BentoFlight; color: string; baseline: number }) {
  const ratio    = flight.co2PerPerson / baseline;
  const barColor = ratio < 0.95 ? '#30D158' : ratio < 1.15 ? '#FF9F0A' : '#FF3B30';
  const barWidth = Math.min(ratio * 67, 100);

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

      {/* Carbon bar */}
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
  const taxEst    = Math.round(flight.totalPrice * 0.14);
  const seatFee   = flight.cabinClass.toLowerCase().includes('business') ? 0 : 49 * 2;
  const grandTotal = flight.totalPrice + taxEst + seatFee;

  const rows = [
    { label: `${flight.cabinClass} × 2`, value: `$${flight.totalPrice.toLocaleString()}` },
    { label: 'Taxes & fees (est.)', value: `$${taxEst.toLocaleString()}` },
    { label: 'Checked baggage', value: 'Included' },
    { label: 'Seat selection', value: flight.cabinClass.toLowerCase().includes('business') ? 'Included' : `+$${seatFee}` },
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
  searchState:   SearchState;
  engineCount?:  number;
}

export function AviationBento({ searchState, engineCount = 10 }: AviationBentoProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const expandedHero = expandedId
    ? HEROES.find(h => h.flight.id === expandedId) ?? null
    : null;

  if (searchState === 'idle') {
    return <AnimatePresence mode="wait"><IdleState key="idle" /></AnimatePresence>;
  }

  if (searchState === 'loading') {
    return <AnimatePresence mode="wait"><BentoSkeleton key="skeleton" engineCount={engineCount} /></AnimatePresence>;
  }

  // Results
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
            3 hero options · {engineCount} engines · TLV → MEX
          </p>
        </div>
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ ...SPRING, delay: 0.18 }}
          style={{
            display:      'flex',
            alignItems:   'center',
            gap:          6,
            paddingBlock: 5,
            paddingInline: 11,
            borderRadius:  999,
            background:   'rgba(48,209,88,0.10)',
            border:       '1.5px solid rgba(48,209,88,0.26)',
            fontSize:     11,
            fontWeight:   700,
            color:        '#30D158',
          }}
        >
          <motion.span
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.9, repeat: Infinity }}
            style={{ width: 5, height: 5, borderRadius: '50%', background: '#30D158', display: 'inline-block', flexShrink: 0 }}
            aria-hidden
          />
          AI distillation complete
        </motion.div>
      </motion.div>

      {/* Bento grid */}
      <div
        style={{
          display:             'grid',
          gridTemplateColumns: '1.65fr 1fr',
          gridTemplateRows:    'repeat(2, 240px)',
          gap:                 12,
        }}
      >
        {/* Hero 0 — large, spans 2 rows */}
        <motion.div
          style={{ gridRow: '1 / span 2' }}
          initial={{ opacity: 0, scale: 0.94, y: 18 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ ...SPRING, delay: 0 }}
        >
          <HeroBentoCard
            hero={HEROES[0]}
            isExpanded={expandedId === HEROES[0].flight.id}
            isBlurred={!!expandedId && expandedId !== HEROES[0].flight.id}
            onClick={() => setExpandedId(HEROES[0].flight.id)}
          />
        </motion.div>

        {/* Hero 1 — top right */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 18 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ ...SPRING, delay: 0.09 }}
        >
          <HeroBentoCard
            hero={HEROES[1]}
            isExpanded={expandedId === HEROES[1].flight.id}
            isBlurred={!!expandedId && expandedId !== HEROES[1].flight.id}
            onClick={() => setExpandedId(HEROES[1].flight.id)}
          />
        </motion.div>

        {/* Hero 2 — bottom right */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 18 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ ...SPRING, delay: 0.18 }}
        >
          <HeroBentoCard
            hero={HEROES[2]}
            isExpanded={expandedId === HEROES[2].flight.id}
            isBlurred={!!expandedId && expandedId !== HEROES[2].flight.id}
            onClick={() => setExpandedId(HEROES[2].flight.id)}
          />
        </motion.div>
      </div>

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
