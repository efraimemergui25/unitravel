'use client';

import { useState }                    from 'react';
import { motion, AnimatePresence }     from 'framer-motion';
import { GripHorizontal }              from 'lucide-react';
import { useDraggable, DndContext }    from '@dnd-kit/core';
import type { DragEndEvent }           from '@dnd-kit/core';
import { useTravelEngine }             from '@/store/useTravelEngine';
import type { AggregatedLodging }      from '@/services/OmniAggregator';

// ── Constants ─────────────────────────────────────────────────────────────────

const SPRING     = { type: 'spring', stiffness: 400, damping: 28 } as const;
const SPRING_POP = { type: 'spring', stiffness: 500, damping: 24 } as const;
const GREEN      = '#30D158';
const BLUE       = '#007AFF';

// ── Room type ─────────────────────────────────────────────────────────────────

export interface RoomCategory {
  id:              string;
  name:            string;
  bedType:         'King' | 'Queen' | 'Twin' | 'Double';
  sizeSqm:         number;
  pricePerNight:   number;
  boardType:       string;
  freeCancel:      boolean;
  cancelDeadline?: string;
  maxOccupancy:    number;
  view?:           string;
  floor?:          string;
  amenities:       string[];
}

// ── Bespoke SVG bed icon ──────────────────────────────────────────────────────

function BedIcon({ type, color }: { type: string; color: string }) {
  return (
    <svg width={28} height={20} viewBox="0 0 28 20" fill="none" aria-label={`${type} bed`}>
      {/* Frame */}
      <rect x="1" y="8" width="26" height="10" rx="2" fill={`${color}20`} stroke={color} strokeWidth="1.3" />
      {/* Headboard */}
      <rect x="1" y="3" width="4" height="15" rx="2" fill={`${color}30`} stroke={color} strokeWidth="1.3" />
      {/* Pillows — differ per bed type */}
      {(type === 'King' || type === 'Double') ? (
        <>
          <rect x="7"  y="9.5" width="8" height="5" rx="1.5" fill={color} opacity="0.50" />
          <rect x="17" y="9.5" width="8" height="5" rx="1.5" fill={color} opacity="0.50" />
        </>
      ) : type === 'Twin' ? (
        <>
          <rect x="7"  y="9.5" width="7" height="5" rx="1.5" fill={color} opacity="0.50" />
          <rect x="16" y="9.5" width="7" height="5" rx="1.5" fill={color} opacity="0.50" />
        </>
      ) : (
        <rect x="7" y="9.5" width="16" height="5" rx="1.5" fill={color} opacity="0.50" />
      )}
      {/* Legs */}
      <line x1="3"  y1="18" x2="3"  y2="20" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="25" y1="18" x2="25" y2="20" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ── Square-footage geometric fill ─────────────────────────────────────────────
// Renders a 4×4 grid of cells; filled cells represent floor area.

function RoomSizeViz({ sqm }: { sqm: number }) {
  const pct    = Math.min(100, Math.round((sqm / 120) * 100));
  const filled = Math.round((pct / 100) * 16);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, width: 36, height: 36 }}
        role="img"
        aria-label={`${sqm} square metres`}
      >
        {Array.from({ length: 16 }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ ...SPRING_POP, delay: i * 0.018 }}
            style={{
              borderRadius: 2,
              background:   i < filled ? `${BLUE}70` : 'rgba(0,0,0,0.06)',
              border:       i < filled ? `1px solid ${BLUE}40` : '1px solid rgba(0,0,0,0.06)',
            }}
          />
        ))}
      </div>
      <span style={{ fontSize: 9.5, fontWeight: 700, color: BLUE, letterSpacing: '-0.01em', fontFamily: 'inherit' }}>
        {sqm} m²
      </span>
    </div>
  );
}

// ── Cancellation badge ────────────────────────────────────────────────────────

function CancelBadge({ freeCancel, deadline }: { freeCancel: boolean; deadline?: string }) {
  const color = freeCancel ? GREEN : '#FF9F0A';
  const label = freeCancel
    ? deadline ? `Free cancel until ${deadline}` : 'Free Cancellation'
    : 'Non-Refundable';

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={SPRING_POP}
      style={{
        display:     'flex', alignItems: 'center', gap: 5,
        paddingBlock: 4, paddingInline: 9,
        borderRadius: 20,
        background:   `${color}12`,
        border:       `1.5px solid ${color}40`,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        boxShadow:    `0 0 8px ${color}20`,
      }}
    >
      <motion.div
        animate={{ scale: [1, 1.25, 1] }}
        transition={{ duration: 2.4, repeat: Infinity }}
        style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }}
      />
      <span style={{ fontSize: 9.5, fontWeight: 800, color, fontFamily: 'inherit', letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
        {label}
      </span>
    </motion.div>
  );
}

// ── @dnd-kit drag handle ──────────────────────────────────────────────────────
// Each room tier gets its own useDraggable instance so the user drags the
// SPECIFIC suite (not just the hotel) into the LiquidTimeline.

function RoomDragHandle({
  room,
  hotel,
  color,
}: {
  room:  RoomCategory;
  hotel: AggregatedLodging;
  color: string;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id:   `room-drag-${room.id}`,
    data: {
      type:   'room',
      roomId: room.id,
      room,
      hotel,
      // Serialisable summary for the timeline drop handler
      summary: {
        id:            room.id,
        name:          `${hotel.name} — ${room.name}`,
        pricePerNight: room.pricePerNight,
        bedType:       room.bedType,
        sizeSqm:       room.sizeSqm,
        view:          room.view,
      },
    },
  });

  return (
    <motion.div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      animate={{
        scale:     isDragging ? 1.18 : 1,
        boxShadow: isDragging
          ? `0 6px 20px ${color}55`
          : `0 0 0 1px ${color}20`,
        background: isDragging ? `${color}22` : `${color}10`,
      }}
      whileHover={{ scale: 1.10, background: `${color}1A` }}
      transition={SPRING_POP}
      style={{
        width:          28, height: 28,
        borderRadius:   8,
        border:         `1px solid ${color}28`,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        cursor:         isDragging ? 'grabbing' : 'grab',
        color:          `${color}CC`,
        touchAction:    'none',
      }}
      title={`Drag "${room.name}" to timeline`}
      aria-label={`Drag ${room.name} to timeline`}
    >
      <GripHorizontal size={13} strokeWidth={2.2} aria-hidden />
    </motion.div>
  );
}

// ── Room card ─────────────────────────────────────────────────────────────────

function RoomCard({ room, hotel }: { room: RoomCategory; hotel: AggregatedLodging }) {
  const BED_COLOR: Record<string, string> = {
    King:   BLUE,
    Queen:  '#BF5AF2',
    Twin:   '#00C7BE',
    Double: '#FF9F0A',
  };
  const bedColor = BED_COLOR[room.bedType] ?? BLUE;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8 }}
      transition={SPRING}
      style={{
        position:       'relative',
        display:        'grid',
        gridTemplateColumns: '44px 1fr auto',
        gap:            12,
        alignItems:     'center',
        paddingBlock:   12,
        paddingInline:  14,
        borderRadius:   16,
        background:     'rgba(255,255,255,0.32)',
        backdropFilter: 'blur(20px) saturate(1.7)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.7)',
        border:         '1.5px solid rgba(255,255,255,0.65)',
        boxShadow:      'inset 0 1px 0 rgba(255,255,255,0.90)',
      }}
    >
      {/* Square-footage geometric visualizer */}
      <RoomSizeViz sqm={room.sizeSqm} />

      {/* Room details */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <BedIcon type={room.bedType} color={bedColor} />
          <span style={{
            fontSize: 12, fontWeight: 800, color: '#1C1C1E',
            letterSpacing: '-0.02em', fontFamily: 'inherit',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {room.name}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 9.5, fontWeight: 600, color: '#6E6E73', fontFamily: 'inherit' }}>
            👥 Up to {room.maxOccupancy}
          </span>
          {room.view && (
            <span style={{ fontSize: 9.5, fontWeight: 600, color: '#6E6E73', fontFamily: 'inherit' }}>
              🪟 {room.view}
            </span>
          )}
          {room.floor && (
            <span style={{ fontSize: 9.5, fontWeight: 600, color: '#6E6E73', fontFamily: 'inherit' }}>
              🏢 {room.floor}
            </span>
          )}
        </div>

        <CancelBadge freeCancel={room.freeCancel} deadline={room.cancelDeadline} />

        {room.amenities.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {room.amenities.slice(0, 3).map(a => (
              <span key={a} style={{
                fontSize: 9, fontWeight: 600, color: '#8E8E93',
                background: 'rgba(0,0,0,0.05)', borderRadius: 6,
                paddingBlock: 2, paddingInline: 6, fontFamily: 'inherit',
              }}>
                {a}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Price + @dnd-kit drag handle */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
        <div style={{ textAlign: 'end' }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: BLUE, letterSpacing: '-0.03em', fontFamily: 'inherit' }}>
            ${room.pricePerNight}
          </div>
          <div style={{ fontSize: 9, fontWeight: 600, color: '#6E6E73', fontFamily: 'inherit' }}>
            / night
          </div>
        </div>

        {/* Per-room-tier dnd-kit drag handle — drags THIS specific suite */}
        <RoomDragHandle room={room} hotel={hotel} color={BLUE} />
      </div>
    </motion.div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface RoomTypeVisualizerProps {
  hotel:  AggregatedLodging;
  rooms?: RoomCategory[];
}

function buildDefaultRooms(hotel: AggregatedLodging): RoomCategory[] {
  const base = hotel.pricePerNight;
  return [
    {
      id: `${hotel.id}-standard`, name: `Standard ${hotel.roomType}`,
      bedType: 'King', sizeSqm: 28, pricePerNight: Math.round(base * 0.90),
      boardType: 'Room Only', freeCancel: true, cancelDeadline: 'Check-in',
      maxOccupancy: 2, view: 'City View', amenities: ['Free WiFi', 'A/C', 'Safe'],
    },
    {
      id: `${hotel.id}-deluxe`, name: `Deluxe ${hotel.roomType}`,
      bedType: 'King', sizeSqm: 38, pricePerNight: Math.round(base * 1.10),
      boardType: 'B&B', freeCancel: true, cancelDeadline: 'Check-in',
      maxOccupancy: 2, view: 'Ocean View', floor: 'High Floor',
      amenities: ['Free WiFi', 'Mini-Bar', 'Bathrobe'],
    },
    {
      id: `${hotel.id}-suite`, name: `Junior Suite`,
      bedType: 'King', sizeSqm: 58, pricePerNight: Math.round(base * 1.55),
      boardType: 'B&B', freeCancel: false, maxOccupancy: 3,
      view: 'Panoramic', floor: 'Executive Floor',
      amenities: ['Butler Service', 'Jacuzzi', 'Lounge Access'],
    },
  ];
}

// ── Main export ───────────────────────────────────────────────────────────────

export function RoomTypeVisualizer({ hotel, rooms: propRooms }: RoomTypeVisualizerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rooms               = propRooms ?? buildDefaultRooms(hotel);
  const { setDragging }     = useTravelEngine();

  // When a room is dropped on the LiquidTimeline, commit it to the store.
  // The DndContext here is scoped to this visualizer; the LiquidTimeline's
  // DndContext (higher in the tree) handles the actual drop target.
  const handleDragEnd = (e: DragEndEvent) => {
    if (!e.over) return;
    const { room } = e.active.data.current as { room: RoomCategory };
    setDragging({
      ...hotel,
      id:            room.id,
      name:          `${hotel.name} — ${room.name}`,
      pricePerNight: room.pricePerNight,
      totalPrice:    room.pricePerNight * hotel.nights,
      roomType:      room.name,
      aiHighlight:   `${room.bedType} · ${room.sizeSqm}m²${room.view ? ` · ${room.view}` : ''}`,
    });
  };

  return (
    // DndContext scoped to room cards — each RoomDragHandle is a useDraggable source.
    <DndContext onDragEnd={handleDragEnd}>
      <div>
        {/* Toggle */}
        <motion.button
          onClick={() => setIsOpen(v => !v)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            paddingBlock: 7, paddingInline: 14,
            borderRadius: 10,
            border: `1px solid ${BLUE}30`,
            background: `${BLUE}08`,
            color: BLUE, fontSize: 10.5, fontWeight: 800,
            cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '-0.01em',
          }}
          aria-expanded={isOpen}
        >
          <motion.span
            animate={{ rotate: isOpen ? 90 : 0 }}
            transition={SPRING}
            style={{ display: 'inline-block', fontSize: 10 }}
            aria-hidden
          >
            ▶
          </motion.span>
          {isOpen ? 'Hide Rooms' : `View ${rooms.length} Room Categories`}
        </motion.button>

        {/* Animated accordion */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ ...SPRING, duration: 0.35 }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBlockStart: 10 }}>
                {rooms.map(room => (
                  <RoomCard key={room.id} room={room} hotel={hotel} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DndContext>
  );
}
