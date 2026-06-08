'use client';

import {
  useRef, useCallback, useEffect, useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { useLodgingSync }                        from '@/store/useLodgingSync';
import { useLocaleEngine }                       from '@/store/useLocaleEngine';
import { AMENITY_LIST }                          from '@/store/useLodgingSync';
import type { Amenity, VibeZone }                from '@/store/useLodgingSync';

// ── Constants ─────────────────────────────────────────────────────────────────

const SPRING     = { type: 'spring', stiffness: 420, damping: 28 } as const;
const SPRING_POP = { type: 'spring', stiffness: 500, damping: 24 } as const;
const GREEN      = '#30D158';
const GRADIENT   = 'linear-gradient(135deg, #30D158 0%, #00C7BE 100%)';

// ── Amenity metadata ──────────────────────────────────────────────────────────

const AMENITY_ICONS: Record<Amenity, string> = {
  'Pool':             '🏊',
  'Spa':              '🧖',
  'Gym':              '💪',
  'Ocean View':       '🌊',
  'Beach Access':     '🏖',
  'Balcony':          '🌅',
  'Rooftop':          '🌆',
  'Restaurant':       '🍽',
  'Bar':              '🍸',
  'Pet-Friendly':     '🐾',
  'Free WiFi':        '📶',
  'Parking':          '🅿',
  'EV Charging':      '⚡',
  'Kids Club':        '🎠',
  'Airport Transfer': '✈',
};

// ── Amenity pill ──────────────────────────────────────────────────────────────

function AmenityPill({ amenity, isActive, onToggle }: {
  amenity:  Amenity;
  isActive: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.button
      onClick={onToggle}
      aria-pressed={isActive}
      layout
      whileHover={{ y: isActive ? 0 : -1 }}
      animate={{
        scale:      isActive ? 0.95 : 1,
        background: isActive ? 'rgba(48,209,88,0.15)' : 'rgba(255,255,255,0.25)',
      }}
      transition={SPRING}
      style={{
        display:        'flex',
        alignItems:     'center',
        gap:            6,
        paddingBlock:   8,
        paddingInline:  12,
        borderRadius:   20,
        border:         isActive
          ? '1.5px solid rgba(48,209,88,0.45)'
          : '1.5px solid rgba(255,255,255,0.55)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow:      isActive
          ? 'inset 0 3px 10px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.5)'
          : 'inset 0 1px 0 rgba(255,255,255,0.80)',
        cursor:         'pointer',
        fontFamily:     'inherit',
        flexShrink:     0,
        userSelect:     'none',
        WebkitUserSelect: 'none',
      }}
    >
      <span style={{ fontSize: 13, lineHeight: 1, flexShrink: 0 }}>
        {AMENITY_ICONS[amenity]}
      </span>
      <span style={{
        fontSize:      10,
        fontWeight:    isActive ? 800 : 600,
        color:         isActive ? GREEN : '#6E6E73',
        letterSpacing: '-0.01em',
        whiteSpace:    'nowrap',
      }}>
        {amenity}
      </span>
    </motion.button>
  );
}

// ── Budget × Distance slider (reuses pointer-event approach) ──────────────────

interface DualAxisSliderProps {
  priceRange:    [number, number];
  distanceRange: [number, number];
  onPriceChange:    (r: [number, number]) => void;
  onDistanceChange: (r: [number, number]) => void;
  isRtl?:        boolean;
}

function DualAxisSlider({ priceRange, distanceRange, onPriceChange, onDistanceChange, isRtl }: DualAxisSliderProps) {
  const trackPriceRef = useRef<HTMLDivElement>(null);
  const trackDistRef  = useRef<HTMLDivElement>(null);
  const dragging = useRef<{ which: 'price' | 'dist'; thumb: 'lo' | 'hi' } | null>(null);

  const pctFromRef = useCallback((ref: React.RefObject<HTMLDivElement | null>, e: PointerEvent): number => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return 0;
    const raw = isRtl
      ? (rect.right - e.clientX) / rect.width
      : (e.clientX - rect.left)  / rect.width;
    return Math.max(0, Math.min(1, raw));
  }, [isRtl]);

  const handleMove = useCallback((e: PointerEvent) => {
    if (!dragging.current) return;
    const { which, thumb } = dragging.current;

    if (which === 'price') {
      const v = Math.round(pctFromRef(trackPriceRef, e) * 2000);
      if (thumb === 'lo') onPriceChange([Math.min(v, priceRange[1] - 50), priceRange[1]]);
      else                onPriceChange([priceRange[0], Math.max(v, priceRange[0] + 50)]);
    } else {
      const v = Math.round(pctFromRef(trackDistRef, e) * 20 * 10) / 10;
      if (thumb === 'lo') onDistanceChange([Math.min(v, distanceRange[1] - 1), distanceRange[1]]);
      else                onDistanceChange([distanceRange[0], Math.max(v, distanceRange[0] + 1)]);
    }
  }, [pctFromRef, priceRange, distanceRange, onPriceChange, onDistanceChange]);

  const stopDrag = useCallback(() => { dragging.current = null; }, []);

  useEffect(() => {
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup',   stopDrag);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup',   stopDrag);
    };
  }, [handleMove, stopDrag]);

  const startDrag = (which: 'price' | 'dist', thumb: 'lo' | 'hi') =>
    (e: ReactPointerEvent<HTMLDivElement>) => {
      dragging.current = { which, thumb };
      (e.target as Element).setPointerCapture(e.pointerId);
    };

  // Price slider
  const pLo = (priceRange[0] / 2000) * 100;
  const pHi = (priceRange[1] / 2000) * 100;

  // Distance slider
  const dLo = (distanceRange[0] / 20) * 100;
  const dHi = (distanceRange[1] / 20) * 100;

  // "Sweet spot" center: AI-optimal price band is $150–$400/night
  const sweetPctLo = (150 / 2000) * 100;
  const sweetPctHi = (400 / 2000) * 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Price slider */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 9.5, fontWeight: 800, color: '#6E6E73', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'inherit' }}>
            Price / Night
          </span>
          <span style={{ fontSize: 10, fontWeight: 700, color: GREEN, fontFamily: 'inherit' }}>
            ${priceRange[0]} — ${priceRange[1] === 2000 ? '2000+' : priceRange[1]}
          </span>
        </div>
        <div ref={trackPriceRef} style={{ position: 'relative', height: 20, display: 'flex', alignItems: 'center' }}>
          {/* Full track */}
          <div className="bg-white/30" style={{ position: 'absolute', insetInlineStart: 0, insetInlineEnd: 0, height: 6, borderRadius: 999 }} />

          {/* "Sweet Spot" gradient band */}
          <div style={{
            position:        'absolute',
            insetInlineStart: `${sweetPctLo}%`,
            width:           `${sweetPctHi - sweetPctLo}%`,
            height:          6, borderRadius: 999,
            background:      'linear-gradient(90deg, rgba(48,209,88,0.15), rgba(48,209,88,0.45), rgba(48,209,88,0.15))',
            border:          '1px solid rgba(48,209,88,0.30)',
            pointerEvents:   'none',
          }} />

          {/* Active range */}
          <motion.div
            animate={{ insetInlineStart: `${pLo}%`, width: `${pHi - pLo}%` }}
            transition={{ ease: 'linear', duration: 0.06 }}
            style={{
              position: 'absolute', height: 6, borderRadius: 999,
              background: 'rgba(48,209,88,0.35)',
              boxShadow: `0 0 8px ${GREEN}55`,
              border: '1px solid rgba(48,209,88,0.60)',
              pointerEvents: 'none',
            }}
          />

          {/* Lo thumb */}
          <motion.div
            animate={{ insetInlineStart: `calc(${pLo}% - 10px)` }}
            transition={{ ease: 'linear', duration: 0.06 }}
            onPointerDown={startDrag('price', 'lo')}
            style={{ position: 'absolute', width: 20, height: 20, borderRadius: '50%', background: 'rgba(255,255,255,0.95)', border: '1.5px solid rgba(255,255,255,0.9)', boxShadow: '0 2px 8px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,1)', cursor: 'grab', touchAction: 'none', zIndex: 2 }}
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.92 }}
          />

          {/* Hi thumb */}
          <motion.div
            animate={{ insetInlineStart: `calc(${pHi}% - 10px)` }}
            transition={{ ease: 'linear', duration: 0.06 }}
            onPointerDown={startDrag('price', 'hi')}
            style={{ position: 'absolute', width: 20, height: 20, borderRadius: '50%', background: 'rgba(255,255,255,0.95)', border: '1.5px solid rgba(255,255,255,0.9)', boxShadow: '0 2px 8px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,1)', cursor: 'grab', touchAction: 'none', zIndex: 2 }}
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.92 }}
          />
        </div>

        {/* Sweet spot label */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: GREEN, fontFamily: 'inherit', letterSpacing: '-0.01em' }}>
            ✦ AI Sweet Spot: $150–$400/night
          </span>
        </div>
      </div>

      {/* Distance slider */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 9.5, fontWeight: 800, color: '#6E6E73', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'inherit' }}>
            Distance from Center
          </span>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#00C7BE', fontFamily: 'inherit' }}>
            {distanceRange[0]}km — {distanceRange[1]}km
          </span>
        </div>
        <div ref={trackDistRef} style={{ position: 'relative', height: 20, display: 'flex', alignItems: 'center' }}>
          <div className="bg-white/30" style={{ position: 'absolute', insetInlineStart: 0, insetInlineEnd: 0, height: 6, borderRadius: 999 }} />
          <motion.div
            animate={{ insetInlineStart: `${dLo}%`, width: `${dHi - dLo}%` }}
            transition={{ ease: 'linear', duration: 0.06 }}
            style={{ position: 'absolute', height: 6, borderRadius: 999, background: 'rgba(0,199,190,0.40)', boxShadow: '0 0 8px rgba(0,199,190,0.50)', border: '1px solid rgba(0,199,190,0.55)', pointerEvents: 'none' }}
          />
          <motion.div animate={{ insetInlineStart: `calc(${dLo}% - 10px)` }} transition={{ ease: 'linear', duration: 0.06 }} onPointerDown={startDrag('dist', 'lo')} style={{ position: 'absolute', width: 20, height: 20, borderRadius: '50%', background: 'rgba(255,255,255,0.95)', border: '1.5px solid rgba(255,255,255,0.9)', boxShadow: '0 2px 8px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,1)', cursor: 'grab', touchAction: 'none', zIndex: 2 }} whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.92 }} />
          <motion.div animate={{ insetInlineStart: `calc(${dHi}% - 10px)` }} transition={{ ease: 'linear', duration: 0.06 }} onPointerDown={startDrag('dist', 'hi')} style={{ position: 'absolute', width: 20, height: 20, borderRadius: '50%', background: 'rgba(255,255,255,0.95)', border: '1.5px solid rgba(255,255,255,0.9)', boxShadow: '0 2px 8px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,1)', cursor: 'grab', touchAction: 'none', zIndex: 2 }} whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.92 }} />
        </div>
      </div>
    </div>
  );
}

// ── Vibe zone toggle ──────────────────────────────────────────────────────────

const VIBE_META: Record<VibeZone, { icon: string; label: string; color: string }> = {
  culinary:  { icon: '🍽', label: 'Culinary',  color: '#FF9F0A' },
  nightlife: { icon: '🎵', label: 'Nightlife', color: '#BF5AF2' },
  quiet:     { icon: '🌿', label: 'Quiet',     color: '#00C7BE' },
  family:    { icon: '👨‍👩‍👧', label: 'Family',   color: '#30D158' },
  business:  { icon: '💼', label: 'Business',  color: '#007AFF' },
};

function VibeToggle({ zone, isActive, onToggle }: {
  zone: VibeZone; isActive: boolean; onToggle: () => void;
}) {
  const { icon, label, color } = VIBE_META[zone];
  return (
    <motion.button
      onClick={onToggle}
      aria-pressed={isActive}
      whileHover={{ y: -1 }}
      animate={{
        scale:      isActive ? 0.96 : 1,
        background: isActive ? `${color}18` : 'rgba(255,255,255,0.22)',
      }}
      whileTap={{ scale: 0.93 }}
      transition={SPRING}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        paddingBlock: 10, paddingInline: 14,
        borderRadius: 16,
        border:    isActive ? `1.5px solid ${color}45` : '1.5px solid rgba(255,255,255,0.50)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: isActive ? `inset 0 3px 10px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.5)` : 'inset 0 1px 0 rgba(255,255,255,0.7)',
        cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
      }}
    >
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span style={{ fontSize: 9.5, fontWeight: isActive ? 800 : 600, color: isActive ? color : '#6E6E73', whiteSpace: 'nowrap' }}>
        {label}
      </span>
    </motion.button>
  );
}

// ── AI sync flash ─────────────────────────────────────────────────────────────

function AISyncFlash({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
          transition={SPRING_POP}
          style={{ paddingBlock: 4, paddingInline: 10, borderRadius: 20, background: `${GREEN}18`, border: `1px solid ${GREEN}40`, fontSize: 9.5, fontWeight: 700, color: GREEN, fontFamily: 'inherit', flexShrink: 0 }}
        >
          ✦ AI synced
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function LodgingDeepFilters() {
  const {
    filters, toggleAmenity, toggleVibeZone,
    setPriceRange, setDistanceRange, lastAISyncAt,
  } = useLodgingSync();
  const { profile } = useLocaleEngine();
  const isRtl = profile.direction === 'rtl';

  const [showAIFlash, setShowAIFlash] = useState(false);

  useEffect(() => {
    if (!lastAISyncAt) return;
    setShowAIFlash(true);
    const t = setTimeout(() => setShowAIFlash(false), 2500);
    return () => clearTimeout(t);
  }, [lastAISyncAt]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING, delay: 0.04 }}
      className="glass-panel mx-4 flex-shrink-0"
      style={{ direction: isRtl ? 'rtl' : 'ltr', display: 'flex', flexDirection: 'column', gap: 0, overflow: 'hidden' }}
    >
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBlock: 12, paddingInline: 16, borderBlockEnd: '1px solid rgba(255,255,255,0.40)', flexWrap: 'wrap', rowGap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, boxShadow: '0 4px 12px rgba(48,209,88,0.35)' }}>
            🏨
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Lodging Filters</div>
            <div style={{ fontSize: 9.5, color: '#6E6E73', fontWeight: 500 }}>AI-synced · real-time</div>
          </div>
        </div>
        <div style={{ marginInlineStart: 'auto' }}>
          <AISyncFlash show={showAIFlash} />
        </div>
      </div>

      {/* Amenity pills */}
      <div
        className="flex flex-row flex-wrap gap-2 overflow-x-auto no-scrollbar"
        style={{ paddingInline: 16, paddingBlock: 12, borderBlockEnd: '1px solid rgba(255,255,255,0.35)' }}
      >
        {AMENITY_LIST.map(a => (
          <AmenityPill
            key={a}
            amenity={a}
            isActive={filters.amenities.includes(a)}
            onToggle={() => toggleAmenity(a)}
          />
        ))}
      </div>

      {/* Vibe zones */}
      <div style={{ paddingInline: 16, paddingBlock: 12, borderBlockEnd: '1px solid rgba(255,255,255,0.35)' }}>
        <p style={{ margin: 0, marginBlockEnd: 10, fontSize: 9.5, fontWeight: 800, color: '#6E6E73', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'inherit' }}>
          Vibe Zone
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(Object.keys(VIBE_META) as VibeZone[]).map(z => (
            <VibeToggle
              key={z} zone={z}
              isActive={filters.vibeZones.includes(z)}
              onToggle={() => toggleVibeZone(z)}
            />
          ))}
        </div>
      </div>

      {/* Budget × Distance sliders */}
      <div style={{ paddingInline: 16, paddingBlock: 14 }}>
        <DualAxisSlider
          priceRange={filters.priceRange}
          distanceRange={filters.distanceRange}
          onPriceChange={setPriceRange}
          onDistanceChange={setDistanceRange}
          isRtl={isRtl}
        />
      </div>
    </motion.div>
  );
}
