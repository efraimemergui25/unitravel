'use client';

import { useState, useRef, memo }                 from 'react';
import { GripHorizontal }                          from 'lucide-react';
import { motion, AnimatePresence, LayoutGroup }    from 'framer-motion';
import { GlassShimmer }                            from '@/components/ui/GlassShimmer';
import { SentimentGauge }                          from '@/components/results/SentimentGauge';
import type { SentimentScore }                     from '@/services/OmniAggregator';
import type { BentoHotel }                         from '@/app/api/hotels/route';

// ── Spring constants ──────────────────────────────────────────────────────────

const SPRING        = { type: 'spring', stiffness: 380, damping: 30 } as const;
const SPRING_DETAIL = { type: 'spring', stiffness: 320, damping: 34 } as const;

// ── Types ─────────────────────────────────────────────────────────────────────

export type LodgingSearchState = 'idle' | 'loading' | 'results';

interface FeeBySource {
  source:     string;
  basePrice:  number;
  taxes:      number;
  resortFee:  number;
}

interface PhotoSlide {
  label:    string;
  gradient: string;
}

interface BentoProperty {
  id:              string;
  name:            string;
  location:        string;
  destination:     string;
  tier:            string;
  roomType:        string;
  checkIn:         string;
  checkOut:        string;
  nights:          number;
  pricePerNight:   number;
  totalPrice:      number;
  rating:          number;
  reviewCount:     number;
  sentiment:       SentimentScore;
  amenities:       string[];
  aiHighlight:     string;
  sources:         string[];
  sourceCount:     number;
  bestPriceSource: string;
  bestPrice:       number;
  bestTrustSource: string;
  trustScore:      number;
  feesBySource:    FeeBySource[];
  photos:          PhotoSlide[];
}

interface HeroDef {
  key:      string;
  property: BentoProperty;
  label:    string;
  subLabel: string;
  icon:     string;
  color:    string;
  gradient: string;
}

// ── Mock properties: Mexico 2026, Effi & Nofar ───────────────────────────────

const PROPERTIES: Record<string, BentoProperty> = {
  nt: {
    id:              'tulum-nomade',
    name:            'Nomade Tulum',
    location:        'Carretera Tulum–Boca Paila, Tulum',
    destination:     'Tulum',
    tier:            'Ultra-Luxury',
    roomType:        'Jungle Treehouse Suite',
    checkIn:         'Oct 5, 2026',
    checkOut:        'Oct 10, 2026',
    nights:          5,
    pricePerNight:   720,
    totalPrice:      3600,
    rating:          9.4,
    reviewCount:     2840,
    sentiment:       { positive: 0.91, neutral: 0.07, negative: 0.02, compound: 0.89 },
    amenities:       ['Cenote Pool', 'Jungle Spa', 'Sound Healing', 'Organic Farm Dining', 'Private Beach', 'Yoga Deck'],
    aiHighlight:     'Highest sentiment score among Tulum eco-luxury properties. 91% positive reviews mention the cenote experience.',
    sources:         ['Airbnb', 'Booking.com', 'Hotels.com', 'Mr & Mrs Smith', 'Design Hotels', 'Tablet Hotels'],
    sourceCount:     6,
    bestPriceSource: 'Airbnb',
    bestPrice:       720,
    bestTrustSource: 'Mr & Mrs Smith',
    trustScore:      9.4,
    feesBySource:    [
      { source: 'Airbnb',   basePrice: 720,  taxes: 93,  resortFee: 0  },
      { source: 'Booking',  basePrice: 748,  taxes: 97,  resortFee: 40 },
      { source: 'Hotels',   basePrice: 755,  taxes: 98,  resortFee: 40 },
      { source: 'Direct',   basePrice: 720,  taxes: 93,  resortFee: 0  },
      { source: 'Expedia',  basePrice: 760,  taxes: 99,  resortFee: 40 },
    ],
    photos: [
      { label: 'Treehouse Suite',  gradient: 'linear-gradient(155deg, #1a4a2e 0%, #2d7a4f 100%)' },
      { label: 'Cenote Pool',      gradient: 'linear-gradient(155deg, #0e4d6b 0%, #1a8fa8 100%)' },
      { label: 'Jungle Spa',       gradient: 'linear-gradient(155deg, #3a1a5c 0%, #7b3fa8 100%)' },
      { label: 'Ocean View',       gradient: 'linear-gradient(155deg, #004d7a 0%, #0099cc 100%)' },
      { label: 'Private Beach',    gradient: 'linear-gradient(155deg, #c07800 0%, #e8a832 100%)' },
    ],
  },

  bt: {
    id:              'riviera-banyan',
    name:            'Banyan Tree Mayakoba',
    location:        'Playa del Carmen, Riviera Maya',
    destination:     'Riviera Maya',
    tier:            '5★',
    roomType:        'Lagoon Pavilion Villa',
    checkIn:         'Oct 10, 2026',
    checkOut:        'Oct 17, 2026',
    nights:          7,
    pricePerNight:   1150,
    totalPrice:      8050,
    rating:          9.6,
    reviewCount:     4100,
    sentiment:       { positive: 0.93, neutral: 0.05, negative: 0.02, compound: 0.91 },
    amenities:       ['Private Pool', 'Butler Service', 'Banyan Tree Spa', 'Lagoon Canoe', 'Four Restaurants', 'Beach Club'],
    aiHighlight:     'Top-rated resort on the Riviera Maya strip. Butler service rated #1 in Mexico by Leading Hotels of the World.',
    sources:         ['Booking.com', 'Agoda', 'Expedia', 'Mr & Mrs Smith', 'Leading Hotels', 'Hotels.com', 'Four Seasons Direct', 'Virtuoso'],
    sourceCount:     8,
    bestPriceSource: 'Agoda',
    bestPrice:       1090,
    bestTrustSource: 'Leading Hotels of the World',
    trustScore:      9.8,
    feesBySource:    [
      { source: 'Agoda',    basePrice: 1090, taxes: 141, resortFee: 85  },
      { source: 'Booking',  basePrice: 1150, taxes: 150, resortFee: 85  },
      { source: 'Expedia',  basePrice: 1175, taxes: 153, resortFee: 85  },
      { source: 'Direct',   basePrice: 1150, taxes: 150, resortFee: 0   },
      { source: 'Hotels',   basePrice: 1195, taxes: 155, resortFee: 85  },
    ],
    photos: [
      { label: 'Lagoon Pavilion',  gradient: 'linear-gradient(155deg, #006994 0%, #00b4cc 100%)' },
      { label: 'Private Pool',     gradient: 'linear-gradient(155deg, #0080a0 0%, #40c0d8 100%)' },
      { label: 'Banyan Tree Spa',  gradient: 'linear-gradient(155deg, #2d4a3e 0%, #4a7c6a 100%)' },
      { label: 'Beach Club',       gradient: 'linear-gradient(155deg, #c8a040 0%, #e8c870 100%)' },
      { label: 'La Ceiba Dining',  gradient: 'linear-gradient(155deg, #6b1a00 0%, #cc4400 100%)' },
    ],
  },

  hc: {
    id:              'cdmx-carlota',
    name:            'Hotel Carlota',
    location:        'Río Amazonas, Cuauhtémoc, Mexico City',
    destination:     'Mexico City',
    tier:            '4★',
    roomType:        'Pool Loft',
    checkIn:         'Oct 1, 2026',
    checkOut:        'Oct 5, 2026',
    nights:          4,
    pricePerNight:   295,
    totalPrice:      1180,
    rating:          9.1,
    reviewCount:     1620,
    sentiment:       { positive: 0.88, neutral: 0.09, negative: 0.03, compound: 0.85 },
    amenities:       ['Rooftop Pool', 'Design Interiors', 'Loup Bar', 'Roma Norte Access', 'In-House Gallery', 'Yoga Classes'],
    aiHighlight:     'Most distinctive design hotel in Mexico City. Best value-luxury ratio in Roma Norte — $295/n vs $680/n at comparable boutique hotels.',
    sources:         ['Booking.com', 'Design Hotels', 'Tablet Hotels', 'Airbnb', 'Mr & Mrs Smith', 'Google Hotels'],
    sourceCount:     6,
    bestPriceSource: 'Airbnb',
    bestPrice:       275,
    bestTrustSource: 'Design Hotels',
    trustScore:      9.2,
    feesBySource:    [
      { source: 'Airbnb',   basePrice: 275, taxes: 44, resortFee: 0  },
      { source: 'Direct',   basePrice: 285, taxes: 46, resortFee: 0  },
      { source: 'Booking',  basePrice: 295, taxes: 47, resortFee: 25 },
      { source: 'Design H', basePrice: 300, taxes: 48, resortFee: 0  },
      { source: 'Expedia',  basePrice: 305, taxes: 49, resortFee: 25 },
    ],
    photos: [
      { label: 'Pool Loft',       gradient: 'linear-gradient(155deg, #1a1a2e 0%, #3d3d6b 100%)' },
      { label: 'Rooftop Pool',    gradient: 'linear-gradient(155deg, #0d4f5c 0%, #1a8fa8 100%)' },
      { label: 'Loup Bar',        gradient: 'linear-gradient(155deg, #3d1a00 0%, #8b4000 100%)' },
      { label: 'Gallery Space',   gradient: 'linear-gradient(155deg, #1a1a1a 0%, #4a4a4a 100%)' },
      { label: 'Roma Norte View', gradient: 'linear-gradient(155deg, #3a2600 0%, #8a5c00 100%)' },
    ],
  },
};

const HEROES: HeroDef[] = [
  {
    key:      'nt',
    property: PROPERTIES.nt,
    label:    'The Tulum Jewel',
    subLabel: 'Highest sentiment in Tulum · 6 sources merged · cenote + jungle spa',
    icon:     '🌴',
    color:    '#30D158',
    gradient: 'linear-gradient(135deg, #30D158 0%, #00C7BE 100%)',
  },
  {
    key:      'bt',
    property: PROPERTIES.bt,
    label:    'The Immersive Retreat',
    subLabel: 'Lagoon villa · butler · Agoda saves $560 vs Hotels.com across 7 nights',
    icon:     '✦',
    color:    '#007AFF',
    gradient: 'linear-gradient(135deg, #007AFF 0%, #5E5CE6 100%)',
  },
  {
    key:      'hc',
    property: PROPERTIES.hc,
    label:    'The City Soul',
    subLabel: 'Best design hotel CDMX · rooftop pool · Roma Norte walking access',
    icon:     '🏛',
    color:    '#FF9F0A',
    gradient: 'linear-gradient(135deg, #FF9F0A 0%, #FF6B35 100%)',
  },
];

// ── Drag handle ───────────────────────────────────────────────────────────────

function DragHandle({ property, color }: { property: BentoProperty; color: string }) {
  const dispatch = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof document === 'undefined') return;
    document.dispatchEvent(
      new CustomEvent('unitravel:zone-drag-commit', {
        detail: {
          id:         property.id,
          type:       'hotel',
          title:      property.name,
          subtitle:   property.roomType,
          price:      property.totalPrice,
          currency:   'USD',
          icon:       '🏨',
          sourceZone: 'lodging',
        },
      }),
    );
  };

  return (
    <motion.button
      onClick={dispatch}
      whileHover={{ scale: 1.1, background: `${color}18`, borderColor: `${color}35` }}
      whileTap={{ scale: 0.92 }}
      transition={{ type: 'spring', stiffness: 400, damping: 22 }}
      title="Add to timeline"
      aria-label="Add to timeline"
      style={{
        display:       'flex',
        alignItems:    'center',
        gap:           5,
        paddingBlock:  7,
        paddingInline: 10,
        borderRadius:  10,
        background:    'rgba(0,0,0,0.04)',
        border:        '1px solid rgba(0,0,0,0.07)',
        cursor:        'grab',
        fontFamily:    'inherit',
        color:         '#6E6E73',
        flexShrink:    0,
      }}
    >
      <GripHorizontal size={13} strokeWidth={2.2} aria-hidden />
      <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', userSelect: 'none' }}>
        Add
      </span>
    </motion.button>
  );
}

// ── Photo carousel ────────────────────────────────────────────────────────────

function PhotoCarousel({ photos, color }: { photos: PhotoSlide[]; color: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef} style={{ overflow: 'hidden', borderRadius: 14, cursor: 'grab', position: 'relative' }}>
      <motion.div
        drag="x"
        dragConstraints={containerRef}
        whileDrag={{ cursor: 'grabbing' }}
        dragElastic={0.12}
        style={{ display: 'flex', gap: 10, width: 'max-content' }}
      >
        {photos.map((photo, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.07, ...SPRING }}
            style={{
              width:          252,
              height:         168,
              borderRadius:   12,
              background:     photo.gradient,
              flexShrink:     0,
              display:        'flex',
              alignItems:     'flex-end',
              padding:        '12px 14px',
              userSelect:     'none',
              position:       'relative',
              overflow:       'hidden',
            }}
          >
            {/* Specular */}
            <div
              aria-hidden
              style={{
                position:   'absolute',
                inset:      0,
                background: 'linear-gradient(145deg, rgba(255,255,255,0.18) 0%, transparent 45%)',
                borderRadius: 'inherit',
              }}
            />
            {/* Scrim + label */}
            <div
              style={{
                position:   'absolute',
                insetBlockEnd: 0, insetInlineStart: 0, insetInlineEnd: 0,
                height:     '45%',
                background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 100%)',
                borderRadius: '0 0 12px 12px',
              }}
            />
            <span style={{
              position:      'relative',
              zIndex:        1,
              fontSize:      11, fontWeight: 700,
              color:         'rgba(255,255,255,0.92)',
              letterSpacing: '-0.01em',
            }}>
              {photo.label}
            </span>
            {/* Slide counter */}
            <span style={{
              position:      'absolute',
              top:           10, insetInlineEnd: 10,
              fontSize:      8, fontWeight: 700,
              color:         'rgba(255,255,255,0.7)',
              background:    'rgba(0,0,0,0.3)',
              paddingBlock:  2, paddingInline: 6,
              borderRadius:  999,
            }}>
              {i + 1}/{photos.length}
            </span>
          </motion.div>
        ))}
      </motion.div>

      {/* Drag hint */}
      <div style={{
        position:       'absolute',
        insetBlockEnd:  0, insetInlineStart: 0, insetInlineEnd: 0,
        height:         '100%',
        background:     `linear-gradient(to inline-end, transparent 70%, rgba(255,255,255,0.28) 100%)`,
        pointerEvents:  'none',
        borderRadius:   14,
      }} />
    </div>
  );
}

// ── Horizontal fee transparency bars ─────────────────────────────────────────

function FeeHorizBar({ feesBySource, color }: { feesBySource: FeeBySource[]; color: string }) {
  const totals   = feesBySource.map(f => f.basePrice + f.taxes + f.resortFee);
  const maxTotal = Math.max(...totals);
  const bestIdx  = totals.indexOf(Math.min(...totals));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {[
          { color: '#007AFF',  label: 'Base rate' },
          { color: '#FF9F0A',  label: 'Taxes & fees' },
          { color: '#FF453A',  label: 'Resort fee' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color, flexShrink: 0 }} />
            <span style={{ fontSize: 9, color: '#6E6E73', fontWeight: 500 }}>{l.label}</span>
          </div>
        ))}
        <span style={{ marginInlineStart: 'auto', fontSize: 9, color: '#30D158', fontWeight: 700 }}>
          👑 = Best all-in
        </span>
      </div>

      {/* Rows */}
      {feesBySource.map((item, i) => {
        const total        = item.basePrice + item.taxes + item.resortFee;
        const barWidthPct  = (total / maxTotal) * 100;
        const isBest       = i === bestIdx;
        const baseFrac     = item.basePrice / total;
        const taxFrac      = (item.basePrice + item.taxes) / total;

        const barGradient  = item.resortFee > 0
          ? `linear-gradient(to right,
              #007AFF 0%,  #007AFF ${baseFrac * 100}%,
              #FF9F0A ${baseFrac * 100}%, #FF9F0A ${taxFrac * 100}%,
              #FF453A ${taxFrac * 100}%, #FF453A 100%)`
          : `linear-gradient(to right,
              #007AFF 0%, #007AFF ${baseFrac * 100}%,
              #FF9F0A ${baseFrac * 100}%, #FF9F0A 100%)`;

        return (
          <div key={item.source} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Source label */}
            <div style={{ width: 56, textAlign: 'end', flexShrink: 0 }}>
              {isBest && (
                <span style={{ fontSize: 10, marginInlineEnd: 2 }} aria-hidden>👑</span>
              )}
              <span style={{
                fontSize:   9,
                fontWeight: isBest ? 800 : 600,
                color:      isBest ? '#1D1D1F' : '#6E6E73',
              }}>
                {item.source}
              </span>
            </div>

            {/* Glass bar track */}
            <div style={{
              flex:                 1,
              height:               16,
              background:           'rgba(255,255,255,0.35)',
              backdropFilter:       'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              borderRadius:         999,
              overflow:             'hidden',
              border:               '1px solid rgba(255,255,255,0.55)',
            }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${barWidthPct}%` }}
                transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1], delay: i * 0.07 }}
                style={{
                  height:       '100%',
                  background:   barGradient,
                  borderRadius: 999,
                  boxShadow:    isBest ? '0 0 8px rgba(48,209,88,0.35)' : 'none',
                }}
              />
            </div>

            {/* Total */}
            <span style={{
              fontSize:      10,
              fontWeight:    800,
              color:         isBest ? '#30D158' : '#6E6E73',
              width:         42,
              textAlign:     'end',
              flexShrink:    0,
              letterSpacing: '-0.01em',
            }}>
              ${total.toLocaleString()}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Detail sections ───────────────────────────────────────────────────────────

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

function AmenitiesView({ amenities, color }: { amenities: string[]; color: string }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {amenities.map(a => (
        <div
          key={a}
          style={{
            paddingBlock:  5,
            paddingInline: 10,
            borderRadius:  8,
            background:    `${color}0C`,
            border:        `1px solid ${color}22`,
            fontSize:      11, fontWeight: 600,
            color:         '#1D1D1F',
          }}
        >
          {a}
        </div>
      ))}
    </div>
  );
}

function StayDates({ property, color }: { property: BentoProperty; color: string }) {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      {[
        { label: 'Check-in', value: property.checkIn, icon: '→' },
        { label: 'Check-out', value: property.checkOut, icon: '←' },
        { label: 'Duration', value: `${property.nights} nights`, icon: '◉' },
      ].map(item => (
        <div
          key={item.label}
          style={{
            flex:          1,
            paddingBlock:  10,
            paddingInline: 13,
            borderRadius:  12,
            background:    'rgba(0,0,0,0.025)',
            border:        '1px solid rgba(0,0,0,0.05)',
          }}
        >
          <p style={{ fontSize: 8, color: '#AEAEB2', textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: 1 }}>
            {item.label}
          </p>
          <p style={{ fontSize: 12, fontWeight: 800, color: '#1D1D1F', marginBlockStart: 4, letterSpacing: '-0.02em' }}>
            <span style={{ color, marginInlineEnd: 4 }}>{item.icon}</span>
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

// ── Expanded detail overlay ───────────────────────────────────────────────────

function DetailView({ hero, onClose }: { hero: HeroDef; onClose: () => void }) {
  const { property } = hero;

  return (
    <motion.div
      layoutId={`lodg-hero-${property.id}`}
      style={{
        position:             'relative',
        width:                'min(700px, calc(100vw - 48px))',
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
      {/* Gradient accent top stripe */}
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
              <div>
                <p style={{ fontSize: 15, fontWeight: 900, color: '#1D1D1F', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                  {property.name}
                </p>
                <p style={{ fontSize: 10, color: '#6E6E73', marginBlockStart: 1 }}>
                  {property.location} · {property.tier}
                </p>
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'end' }}>
            <p style={{ fontSize: 9, color: '#AEAEB2', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {property.nights}n total
            </p>
            <p style={{ fontSize: 28, fontWeight: 900, color: hero.color, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
              ${property.totalPrice.toLocaleString()}
            </p>
          </div>
        </div>

        {/* ── Detail body ───────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14, duration: 0.3, ease: 'easeOut' }}
          style={{ padding: '20px 24px 28px', display: 'flex', flexDirection: 'column', gap: 22 }}
        >

          {/* Photo carousel */}
          <DetailSection title="Property Showcase — Drag to explore">
            <PhotoCarousel photos={property.photos} color={hero.color} />
          </DetailSection>

          {/* Stay dates */}
          <DetailSection title="Stay Details">
            <StayDates property={property} color={hero.color} />
          </DetailSection>

          {/* AI dedup sentiment */}
          <DetailSection title="AI Deduplication & Sentiment Analysis">
            <SentimentGauge
              sources={property.sources}
              sourceCount={property.sourceCount}
              bestPriceSource={property.bestPriceSource}
              bestPrice={property.bestPrice}
              bestTrustSource={property.bestTrustSource}
              trustScore={property.trustScore}
              sentiment={property.sentiment}
              aiConfidence={0.94}
              compact={false}
              color={hero.color}
            />
          </DetailSection>

          {/* Hidden fees visualizer */}
          <DetailSection title="Hidden Fees Transparency — All-in price by source">
            <div
              style={{
                padding:       '16px 16px 12px',
                borderRadius:  14,
                background:    'rgba(0,0,0,0.025)',
                border:        '1px solid rgba(0,0,0,0.05)',
              }}
            >
              <FeeHorizBar feesBySource={property.feesBySource} color={hero.color} />
            </div>
          </DetailSection>

          {/* Amenities */}
          <DetailSection title="Included">
            <AmenitiesView amenities={property.amenities} color={hero.color} />
          </DetailSection>

          {/* AI highlight */}
          <div
            style={{
              padding:       '13px 16px',
              borderRadius:  12,
              background:    `${hero.color}08`,
              border:        `1px solid ${hero.color}1E`,
            }}
          >
            <p style={{ fontSize: 12, color: '#1D1D1F', lineHeight: 1.6, letterSpacing: '-0.01em' }}>
              <span style={{ color: hero.color, marginInlineEnd: 5 }}>✦</span>
              {property.aiHighlight}
            </p>
          </div>

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
              Book via {property.bestPriceSource} →
            </motion.button>

            <motion.button
              onClick={() => {
                if (typeof document === 'undefined') return;
                document.dispatchEvent(
                  new CustomEvent('unitravel:zone-drag-commit', {
                    detail: {
                      id: property.id, type: 'hotel',
                      title: property.name, subtitle: property.roomType,
                      price: property.totalPrice, currency: 'USD',
                      icon: '🏨', sourceZone: 'lodging',
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
              <GripHorizontal size={13} strokeWidth={2.2} aria-hidden />
              <span>Add to Timeline</span>
            </motion.button>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ── Hero bento card ───────────────────────────────────────────────────────────

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
  const { property } = hero;

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
      {!isExpanded && (
        <motion.div
          layoutId={`lodg-hero-${property.id}`}
          onClick={onClick}
          style={{
            height:               '100%',
            borderRadius:         32,
            background:           'rgba(255,255,255,0.40)',
            backdropFilter:       'blur(40px) saturate(1.9)',
            WebkitBackdropFilter: 'blur(40px) saturate(1.9)',
            border:               '1px solid rgba(255,255,255,0.70)',
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
          {/* Photo thumbnail gradient */}
          <motion.div
            style={{
              height:     76,
              flexShrink: 0,
              background: property.photos[0]?.gradient ?? hero.gradient,
              position:   'relative',
              overflow:   'hidden',
            }}
          >
            {/* Gradient top bar */}
            <div style={{ height: 3, background: hero.gradient, position: 'absolute', insetBlockStart: 0, insetInlineStart: 0, insetInlineEnd: 0 }} />
            {/* Tier badge */}
            <span style={{
              position:      'absolute',
              insetBlockEnd: 8, insetInlineEnd: 10,
              fontSize:      8, fontWeight: 800,
              background:    'rgba(0,0,0,0.45)',
              color:         'rgba(255,255,255,0.92)',
              borderRadius:  6, paddingBlock: 3, paddingInline: 7,
              letterSpacing: '0.03em',
              backdropFilter: 'blur(8px)',
            }}>
              {property.tier}
            </span>
            {/* Specular */}
            <div aria-hidden style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(145deg, rgba(255,255,255,0.20) 0%, transparent 50%)',
            }} />
          </motion.div>

          {/* Card body */}
          <div
            style={{
              flex:          1,
              display:       'flex',
              flexDirection: 'column',
              gap:           10,
              padding:       '13px 16px 15px',
              position:      'relative',
              zIndex:        1,
            }}
          >
            {/* Hero badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                fontSize:      9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em',
                paddingBlock:  4, paddingInline: 8, borderRadius: 999,
                background:    `${hero.color}14`, color: hero.color, border: `1px solid ${hero.color}28`,
              }}>
                {hero.label}
              </span>
              <span style={{ fontSize: 14 }} aria-hidden>{hero.icon}</span>
            </div>

            {/* Property name + location */}
            <div>
              <p style={{ fontSize: 16, fontWeight: 900, color: '#1D1D1F', letterSpacing: '-0.025em', lineHeight: 1.2 }}>
                {property.name}
              </p>
              <p style={{ fontSize: 10, color: '#6E6E73', marginBlockStart: 3 }}>
                {property.destination} · {property.nights}n · {property.roomType}
              </p>
            </div>

            {/* Key metrics */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {[
                { label: 'Rating',   value: `${property.rating}/10` },
                { label: 'Sources',  value: `${property.sourceCount} merged` },
                { label: 'Best via', value: property.bestPriceSource },
              ].map(m => (
                <div
                  key={m.label}
                  style={{
                    display: 'flex', flexDirection: 'column', gap: 1,
                    paddingBlock: 5, paddingInline: 8, borderRadius: 8,
                    background: 'rgba(0,0,0,0.025)', border: '1px solid rgba(0,0,0,0.05)',
                  }}
                >
                  <span style={{ fontSize: 8, color: '#AEAEB2', textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: 1 }}>
                    {m.label}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#1D1D1F' }}>{m.value}</span>
                </div>
              ))}
            </div>

            {/* Compact sentiment */}
            <SentimentGauge
              sources={property.sources}
              sourceCount={property.sourceCount}
              bestPriceSource={property.bestPriceSource}
              bestPrice={property.bestPrice}
              bestTrustSource={property.bestTrustSource}
              trustScore={property.trustScore}
              sentiment={property.sentiment}
              aiConfidence={0.94}
              compact
              color={hero.color}
            />

            {/* Footer: price + drag */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBlockStart: 'auto' }}>
              <div>
                <p style={{ fontSize: 9, color: '#AEAEB2', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Per night</p>
                <p style={{ fontSize: 27, fontWeight: 900, color: hero.color, letterSpacing: '-0.03em', lineHeight: 1.08 }}>
                  ${property.bestPrice.toLocaleString()}
                </p>
              </div>
              <DragHandle property={property} color={hero.color} />
            </div>
          </div>
        </motion.div>
      )}

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

// ── Idle / loading states ─────────────────────────────────────────────────────

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
        style={{ fontSize: 56, lineHeight: 1 }}
        aria-hidden
      >
        🏨
      </motion.div>
      <div>
        <p style={{ fontSize: 22, fontWeight: 900, color: '#1D1D1F', letterSpacing: '-0.03em', lineHeight: 1.2 }}>
          Hospitality Hub Ready
        </p>
        <p style={{ fontSize: 13, color: '#6E6E73', marginBlockStart: 8, letterSpacing: '-0.01em' }}>
          Mexico City · Tulum · Riviera Maya · Cabo San Lucas
        </p>
      </div>
      <p style={{ fontSize: 12, color: '#AEAEB2', maxWidth: 360, lineHeight: 1.65 }}>
        Select your engines and launch. Unit's AI will scan up to 30 global lodging APIs,
        deduplicate identical properties, strip marketing tags, and surface 3 hero stays — each with
        full sentiment analysis and hidden-fee transparency.
      </p>
    </motion.div>
  );
}

function BentoSkeleton({ engineCount }: { engineCount: number }) {
  return (
    <motion.div
      key="skeleton"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBlockEnd: 18 }}>
        <motion.span
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
          style={{ fontSize: 13, color: '#00C7BE', display: 'inline-block' }}
          aria-hidden
        >
          ✦
        </motion.span>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#00C7BE', letterSpacing: '-0.01em' }}>
          Scanning {engineCount} engines
        </span>
        <span style={{ fontSize: 11, color: '#AEAEB2' }}>·</span>
        <motion.span
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.8, repeat: Infinity }}
          style={{ fontSize: 11, color: '#AEAEB2' }}
        >
          Merging duplicates · stripping marketing noise…
        </motion.span>
      </div>

      <div
        style={{
          display:             'grid',
          gridTemplateColumns: '1.65fr 1fr',
          gridTemplateRows:    'repeat(2, 240px)',
          gap:                 12,
        }}
      >
        <GlassShimmer variant="hero-card" style={{ gridRow: '1 / span 2', borderRadius: 24, height: '100%' }} delay={0} />
        <GlassShimmer variant="hero-card" style={{ borderRadius: 24, height: '100%' }} delay={0.12} />
        <GlassShimmer variant="hero-card" style={{ borderRadius: 24, height: '100%' }} delay={0.24} />
      </div>
    </motion.div>
  );
}

// ── LodgingBento (main export) ────────────────────────────────────────────────

export interface LodgingBentoProps {
  searchState:  LodgingSearchState;
  engineCount?: number;
  results?:     BentoHotel[] | null;
  apiStatus?:   'ok' | 'needs_api_key' | 'error' | null;
  apiMessage?:  string | null;
  query?:       { city: string; checkIn: string; checkOut: string; adults: number; roomType: string };
}

const COLOR_LODGING = '#00C7BE';

function NeedsApiKeyState({ message }: { message: string | null }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, height: '100%', textAlign: 'center', padding: 40 }}
    >
      <div style={{ fontSize: 48 }} aria-hidden>🔑</div>
      <div>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#1D1D1F', letterSpacing: '-0.04em' }}>Connect Hotels API</h2>
        <p style={{ margin: '8px 0 0', fontSize: 12, fontWeight: 500, color: '#6E6E73', maxWidth: 340, lineHeight: 1.55 }}>
          {message ?? 'Add AMADEUS_CLIENT_ID and AMADEUS_CLIENT_SECRET to .env.local to enable live hotel search.'}
        </p>
      </div>
      <a
        href="https://developers.amadeus.com/register"
        target="_blank"
        rel="noopener noreferrer"
        style={{ fontSize: 11, fontWeight: 800, color: COLOR_LODGING, background: `${COLOR_LODGING}10`, border: `1.5px solid ${COLOR_LODGING}28`, borderRadius: 10, paddingBlock: 8, paddingInline: 16, textDecoration: 'none' }}
      >
        Get Amadeus API Key →
      </a>
    </motion.div>
  );
}

function RealHotelList({ hotels }: { hotels: BentoHotel[] }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBlockEnd: 4 }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#1D1D1F', letterSpacing: '-0.04em' }}>
            {hotels.length} Hotels
          </h2>
          <p style={{ margin: 0, fontSize: 11, color: '#AEAEB2', letterSpacing: '-0.01em' }}>
            Live · Amadeus Hotels
          </p>
        </div>
        <div style={{ fontSize: 10, fontWeight: 800, color: COLOR_LODGING, background: `${COLOR_LODGING}10`, border: `1.5px solid ${COLOR_LODGING}28`, borderRadius: 10, paddingBlock: 5, paddingInline: 11 }}>
          ✓ Live data
        </div>
      </div>
      {hotels.map((hotel, i) => (
        <motion.div
          key={hotel.id}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30, delay: i * 0.05 }}
          style={{ borderRadius: 16, background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(40px)', border: '1px solid rgba(0,0,0,0.07)', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', overflow: 'hidden' }}
        >
          <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.02em' }}>{hotel.name}</div>
                <div style={{ fontSize: 11, color: '#6E6E73', marginBlockStart: 2 }}>
                  {hotel.cityCode} · {hotel.roomType} · {hotel.nights}n
                  {hotel.rating ? ` · ${'⭐'.repeat(hotel.rating)}` : ''}
                </div>
              </div>
              <div style={{ textAlign: 'end', flexShrink: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: COLOR_LODGING, letterSpacing: '-0.03em' }}>
                  ${hotel.pricePerNight.toLocaleString()}<span style={{ fontSize: 10, fontWeight: 600, color: '#AEAEB2' }}>/night</span>
                </div>
                <div style={{ fontSize: 10, color: '#AEAEB2' }}>Total: ${hotel.totalPrice.toLocaleString()}</div>
              </div>
            </div>
            {hotel.amenities.length > 0 && (
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {hotel.amenities.slice(0, 4).map(a => (
                  <span key={a} style={{ fontSize: 9.5, fontWeight: 600, color: '#6E6E73', background: 'rgba(0,0,0,0.04)', borderRadius: 6, paddingBlock: 3, paddingInline: 7 }}>{a}</span>
                ))}
              </div>
            )}
            <a
              href={hotel.bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 10.5, fontWeight: 700, color: COLOR_LODGING, textDecoration: 'none', alignSelf: 'flex-start', background: `${COLOR_LODGING}10`, border: `1px solid ${COLOR_LODGING}28`, borderRadius: 8, paddingBlock: 4, paddingInline: 10 }}
            >
              View on Google Hotels →
            </a>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}

export function LodgingBento({ searchState, engineCount = 10, results, apiStatus, apiMessage }: LodgingBentoProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const expandedHero = expandedId
    ? HEROES.find(h => h.property.id === expandedId) ?? null
    : null;

  if (searchState === 'idle') {
    return <AnimatePresence mode="wait"><IdleState key="idle" /></AnimatePresence>;
  }

  if (searchState === 'loading') {
    return <AnimatePresence mode="wait"><BentoSkeleton key="skeleton" engineCount={engineCount} /></AnimatePresence>;
  }

  if (apiStatus === 'needs_api_key') return <NeedsApiKeyState message={apiMessage ?? null} />;
  if (apiStatus === 'error') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center p-8 rounded-3xl bg-red-50/30 backdrop-blur-xl border border-red-100/50 h-full"
      >
        <div style={{ fontSize: 36, marginBlockEnd: 12 }} aria-hidden>⚠️</div>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#9A3412', marginBlockEnd: 4 }}>AI Context Missing</p>
        <p style={{ fontSize: 12, fontWeight: 500, color: '#78716c', textAlign: 'center', maxWidth: 280 }}>
          {apiMessage === 'Please provide valid check-in/check-out dates and guest count.'
            ? 'Please provide exact dates and guest count to search hotels.'
            : apiMessage ?? 'Search failed. Please provide dates and try again.'}
        </p>
      </motion.div>
    );
  }
  if (apiStatus === 'ok' && results && results.length > 0) return <RealHotelList hotels={results} />;
  if (apiStatus === 'ok' && results && results.length === 0) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, height: '100%', padding: 40, textAlign: 'center' }}
      >
        <div style={{ fontSize: 40 }} aria-hidden>🏨</div>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#6E6E73' }}>No hotels found. Try different dates or city.</p>
      </motion.div>
    );
  }

  return (
    <LayoutGroup id="lodg-bento">
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
            3 hero stays · {engineCount} engines · duplicates merged
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
            background:    'rgba(0,199,190,0.10)',
            border:        '1.5px solid rgba(0,199,190,0.26)',
            fontSize:      11,
            fontWeight:    700,
            color:         '#00C7BE',
          }}
        >
          <motion.span
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.9, repeat: Infinity }}
            style={{ width: 5, height: 5, borderRadius: '50%', background: '#00C7BE', display: 'inline-block', flexShrink: 0 }}
            aria-hidden
          />
          Dedup complete · no duplicates
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
        <motion.div
          style={{ gridRow: '1 / span 2' }}
          initial={{ opacity: 0, scale: 0.94, y: 18 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ ...SPRING, delay: 0 }}
        >
          <HeroBentoCard
            hero={HEROES[0]}
            isExpanded={expandedId === HEROES[0].property.id}
            isBlurred={!!expandedId && expandedId !== HEROES[0].property.id}
            onClick={() => setExpandedId(HEROES[0].property.id)}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 18 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ ...SPRING, delay: 0.09 }}
        >
          <HeroBentoCard
            hero={HEROES[1]}
            isExpanded={expandedId === HEROES[1].property.id}
            isBlurred={!!expandedId && expandedId !== HEROES[1].property.id}
            onClick={() => setExpandedId(HEROES[1].property.id)}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 18 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ ...SPRING, delay: 0.18 }}
        >
          <HeroBentoCard
            hero={HEROES[2]}
            isExpanded={expandedId === HEROES[2].property.id}
            isBlurred={!!expandedId && expandedId !== HEROES[2].property.id}
            onClick={() => setExpandedId(HEROES[2].property.id)}
          />
        </motion.div>
      </div>

      {/* Expanded detail overlay */}
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
            <motion.div
              initial={{ backdropFilter: 'blur(0px)', background: 'rgba(0,0,0,0)' }}
              animate={{ backdropFilter: 'blur(8px)',  background: 'rgba(0,0,0,0.22)' }}
              exit={{ backdropFilter:   'blur(0px)',  background: 'rgba(0,0,0,0)' }}
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
