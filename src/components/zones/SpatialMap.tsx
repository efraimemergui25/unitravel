'use client';

import { useMemo, memo } from 'react';
import { motion }        from 'framer-motion';
import type { AttractionEntity, ExperienceType } from '@/types/attractions';

// ── Constants ─────────────────────────────────────────────────────────────────

const WALKING_KM       = 1.5;   // threshold for drawing walking lines
const MAP_PADDING      = 0.18;  // normalized bounding box padding
const COLOR: Record<ExperienceType, string> = {
  cultural:  '#5E5CE6',
  outdoor:   '#30D158',
  culinary:  '#FF9F0A',
  adventure: '#FF453A',
  wellness:  '#00C7BE',
};

// ── Math helpers ──────────────────────────────────────────────────────────────

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R    = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a    = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
    * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface Bounds {
  minLat: number; maxLat: number;
  minLon: number; maxLon: number;
}

function normalizeToCanvas(lat: number, lon: number, b: Bounds, p: number) {
  const latRange = (b.maxLat - b.minLat) || 0.01;
  const lonRange = (b.maxLon - b.minLon) || 0.01;
  const x = (lon - b.minLon + lonRange * p) / (lonRange * (1 + 2 * p));
  const y = 1 - (lat - b.minLat + latRange * p) / (latRange * (1 + 2 * p));
  return { x: Math.max(0.04, Math.min(0.96, x)), y: Math.max(0.04, Math.min(0.96, y)) };
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LodgingPin {
  name: string;
  lat:  number;
  lon:  number;
}

export interface SpatialMapProps {
  lodging:     LodgingPin;
  attractions: AttractionEntity[];
  onSelect?:   (id: string) => void;
  selectedId?: string;
}

// ── Lodging marker ────────────────────────────────────────────────────────────

const LodgingMarker = memo(function LodgingMarker({
  x, y, name,
}: { x: number; y: number; name: string }) {
  return (
    <div style={{
      position:  'absolute',
      left:      `${x * 100}%`,
      top:       `${y * 100}%`,
      transform: 'translate(-50%, -50%)',
      zIndex:    10,
    }}>
      <motion.div
        animate={{
          boxShadow: [
            '0 0 0px 0px rgba(0,199,190,0)',
            '0 0 18px 6px rgba(0,199,190,0.55)',
            '0 0 0px 0px rgba(0,199,190,0)',
          ],
        }}
        transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          width:        22,
          height:       22,
          borderRadius: '50%',
          background:   'linear-gradient(135deg, #00C7BE, #007AFF)',
          border:       '2.5px solid rgba(255,255,255,0.95)',
          display:      'flex',
          alignItems:   'center',
          justifyContent: 'center',
          fontSize:     10,
          cursor:       'default',
        }}
        title={name}
      >
        🏨
      </motion.div>

      {/* Lodging label */}
      <div style={{
        position:    'absolute',
        insetBlockEnd: '110%',
        insetInlineStart: '50%',
        transform:   'translateX(-50%)',
        background:  'rgba(0,0,0,0.72)',
        color:       '#fff',
        fontSize:    8,
        fontWeight:  700,
        paddingBlock: 2,
        paddingInline: 6,
        borderRadius: 5,
        whiteSpace:  'nowrap',
        pointerEvents: 'none',
        marginBlockEnd: 3,
      }}>
        {name}
      </div>
    </div>
  );
});

// ── Attraction pin ────────────────────────────────────────────────────────────

const AttractionPin = memo(function AttractionPin({
  entity, x, y, index, isSelected, isWalking, onClick,
}: {
  entity:     AttractionEntity;
  x:          number;
  y:          number;
  index:      number;
  isSelected: boolean;
  isWalking:  boolean;
  onClick:    () => void;
}) {
  const color = COLOR[entity.type] ?? '#8E8E93';
  const size  = isSelected ? 16 : 12;

  return (
    <motion.div
      onClick={onClick}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 22, delay: index * 0.05 }}
      whileHover={{ scale: 1.35 }}
      style={{
        position:  'absolute',
        left:      `${x * 100}%`,
        top:       `${y * 100}%`,
        transform: 'translate(-50%, -50%)',
        zIndex:    isSelected ? 8 : 4,
        cursor:    'pointer',
      }}
      title={entity.title}
    >
      <motion.div
        animate={{
          boxShadow: [
            `0 0 3px 0px ${color}50`,
            `0 0 ${isWalking ? '14px 5px' : '10px 3px'} ${color}80`,
            `0 0 3px 0px ${color}50`,
          ],
        }}
        transition={{ duration: 2.2 + index * 0.18, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          width:        size,
          height:       size,
          borderRadius: '50%',
          background:   isSelected
            ? `radial-gradient(circle, ${color}, ${color}CC)`
            : color,
          border:       `${isSelected ? 2.5 : 1.5}px solid rgba(255,255,255,0.9)`,
          transition:   'width 0.2s, height 0.2s',
        }}
      />

      {/* Walking badge */}
      {isWalking && (
        <div style={{
          position:    'absolute',
          insetBlockEnd: '110%',
          insetInlineStart: '50%',
          transform:   'translateX(-50%)',
          background:  `${color}18`,
          border:      `1px solid ${color}40`,
          backdropFilter: 'blur(8px)',
          color,
          fontSize:    7,
          fontWeight:  800,
          paddingBlock: 2,
          paddingInline: 5,
          borderRadius: 5,
          whiteSpace:  'nowrap',
          pointerEvents: 'none',
        }}>
          🚶 walk
        </div>
      )}
    </motion.div>
  );
});

// ── Walking line SVG overlay ──────────────────────────────────────────────────

function WalkingLines({
  lodgingX, lodgingY, pins,
}: {
  lodgingX: number;
  lodgingY: number;
  pins:     Array<{ x: number; y: number; color: string; index: number }>;
}) {
  if (!pins.length) return null;
  return (
    <svg
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      width="100%" height="100%"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      {pins.map(pin => (
        <motion.path
          key={`${pin.x}-${pin.y}`}
          d={`M ${lodgingX * 100} ${lodgingY * 100} L ${pin.x * 100} ${pin.y * 100}`}
          stroke={pin.color}
          strokeWidth="0.55"
          strokeDasharray="1.8 1.2"
          fill="none"
          opacity={0.55}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.55 }}
          transition={{ duration: 1.4, delay: pin.index * 0.12, ease: 'easeInOut' }}
        />
      ))}
    </svg>
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────

function MapLegend() {
  return (
    <div style={{
      position: 'absolute', insetBlockEnd: 10, insetInlineEnd: 10,
      display: 'flex', flexDirection: 'column', gap: 4,
      background: 'rgba(255,255,255,0.78)',
      backdropFilter: 'blur(16px)',
      borderRadius: 8, padding: '6px 8px',
      border: '1px solid rgba(0,0,0,0.06)',
    }}>
      {(Object.entries(COLOR) as [ExperienceType, string][]).map(([type, color]) => (
        <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
          <span style={{ fontSize: 8, color: '#636366', fontWeight: 500, textTransform: 'capitalize' }}>{type}</span>
        </div>
      ))}
      <div style={{ height: 1, background: 'rgba(0,0,0,0.07)', marginBlock: 2 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <div style={{ width: 14, height: 1, borderTop: '1px dashed rgba(48,209,88,0.7)', flexShrink: 0 }} />
        <span style={{ fontSize: 8, color: '#636366', fontWeight: 500 }}>Walking</span>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export const SpatialMap = memo(function SpatialMap({
  lodging, attractions, onSelect, selectedId,
}: SpatialMapProps) {
  const withCoords = useMemo(
    () => attractions.filter(e => e.lat !== undefined && e.lon !== undefined),
    [attractions],
  );

  const bounds: Bounds = useMemo(() => {
    const allLats = [lodging.lat, ...withCoords.map(e => e.lat!)];
    const allLons = [lodging.lon, ...withCoords.map(e => e.lon!)];
    return {
      minLat: Math.min(...allLats),
      maxLat: Math.max(...allLats),
      minLon: Math.min(...allLons),
      maxLon: Math.max(...allLons),
    };
  }, [lodging, withCoords]);

  const lodgingPos = useMemo(
    () => normalizeToCanvas(lodging.lat, lodging.lon, bounds, MAP_PADDING),
    [lodging, bounds],
  );

  const pins = useMemo(() =>
    withCoords.map((entity, i) => {
      const pos      = normalizeToCanvas(entity.lat!, entity.lon!, bounds, MAP_PADDING);
      const distKm   = haversineKm(lodging.lat, lodging.lon, entity.lat!, entity.lon!);
      const isWalking = distKm <= WALKING_KM;
      return { entity, pos, distKm, isWalking, index: i };
    }),
    [withCoords, bounds, lodging],
  );

  const walkingPins = useMemo(() =>
    pins.filter(p => p.isWalking).map(p => ({
      x:     p.pos.x,
      y:     p.pos.y,
      color: COLOR[p.entity.type] ?? '#8E8E93',
      index: p.index,
    })),
    [pins],
  );

  return (
    <div style={{
      position:             'relative',
      width:                '100%',
      height:               '100%',
      background:           [
        'radial-gradient(ellipse at 20% 30%, rgba(48,209,88,0.07) 0%, transparent 55%)',
        'radial-gradient(ellipse at 80% 70%, rgba(0,199,190,0.07) 0%, transparent 55%)',
        'rgba(255,255,255,0.40)',
      ].join(', '),
      backdropFilter:       'blur(40px) saturate(1.9)',
      WebkitBackdropFilter: 'blur(40px) saturate(1.9)',
      borderRadius:         20,
      border:               '1.5px solid rgba(255,255,255,0.70)',
      boxShadow:            '0 8px 32px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,1)',
      overflow:             'hidden',
    }}>
      {/* Grid overlay for topographic feel */}
      <div aria-hidden style={{
        position:   'absolute',
        inset:      0,
        backgroundImage: `
          linear-gradient(rgba(0,0,0,0.025) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,0,0,0.025) 1px, transparent 1px)
        `,
        backgroundSize: '16px 16px',
        borderRadius: 'inherit',
      }} />

      {/* SVG walking distance lines */}
      <WalkingLines lodgingX={lodgingPos.x} lodgingY={lodgingPos.y} pins={walkingPins} />

      {/* Lodging marker */}
      <LodgingMarker x={lodgingPos.x} y={lodgingPos.y} name={lodging.name} />

      {/* Attraction pins */}
      {pins.map(({ entity, pos, isWalking, index }) => (
        <AttractionPin
          key={entity.id}
          entity={entity}
          x={pos.x}
          y={pos.y}
          index={index}
          isSelected={entity.id === selectedId}
          isWalking={isWalking}
          onClick={() => onSelect?.(entity.id)}
        />
      ))}

      {/* No-coords empty state */}
      {withCoords.length === 0 && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 6,
        }}>
          <span style={{ fontSize: 24 }}>🗺</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#AEAEB2' }}>
            Coordinates loading…
          </span>
        </div>
      )}

      <MapLegend />
    </div>
  );
});
