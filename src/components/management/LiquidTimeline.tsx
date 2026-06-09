'use client';

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS }                                from '@dnd-kit/utilities';
import { motion, AnimatePresence }            from 'framer-motion';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTravelEngine }                    from '@/store/useTravelEngine';
import type { PlacedEntity, EngineDay }       from '@/store/useTravelEngine';
import { handleEntityDrop }                   from '@/utils/TimelineSync';
import type { TimelineDropPayload }           from '@/utils/TimelineSync';
import {
  Plane, Hotel, UtensilsCrossed, Compass, Car,
  Plus, Check, Circle, X as XIcon, GripVertical,
  StickyNote, Undo2,
} from 'lucide-react';

// ── Design tokens ──────────────────────────────────────────────────────────────

const AZURE   = '#007AFF';
const EMERALD = '#30D158';
const AMBER   = '#FF9F0A';
const RED     = '#FF453A';
const VIOLET  = '#5E5CE6';

type LucideIcon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

const CAT_ICONS: Record<string, LucideIcon> = {
  flight: Plane, hotel: Hotel, restaurant: UtensilsCrossed, activity: Compass, transport: Car,
};
const CAT_COLORS: Record<string, string> = {
  flight: AZURE, hotel: VIOLET, restaurant: AMBER, activity: EMERALD, transport: '#00C7BE',
};
const DEST_COLORS: Record<string, string> = {
  Paris: AZURE, Rome: EMERALD, 'Riviera Maya': AMBER, 'Cabo San Lucas': VIOLET,
};

const SPRING      = { type: 'spring', stiffness: 400, damping: 28 } as const;
const SPRING_POP  = { type: 'spring', stiffness: 520, damping: 26 } as const;

function parseHHMM(t: string): number {
  const parts = t.split(':');
  return (parseInt(parts[0] ?? '0', 10)) * 60 + (parseInt(parts[1] ?? '0', 10));
}

// ── EntityCard (pure visual) ───────────────────────────────────────────────────

interface EntityCardProps {
  entity:       PlacedEntity;
  dayId:        string;
  isConflict?:  boolean;
  isDragGhost?: boolean;
  dragHandle?:  React.ReactNode;
}

function EntityCard({ entity, dayId, isConflict = false, isDragGhost = false, dragHandle }: EntityCardProps) {
  const removeEntity       = useTravelEngine(s => s.removeEntity);
  const toggleBooked       = useTravelEngine(s => s.toggleBooked);
  const reorderDayEntities = useTravelEngine(s => s.reorderDayEntities);
  const days               = useTravelEngine(s => s.days);

  const color = CAT_COLORS[entity.category] ?? AZURE;
  const Icon  = (CAT_ICONS[entity.category] ?? Compass) as LucideIcon;

  const [isEditing, setIsEditing] = useState(false);
  const [editTime,  setEditTime]  = useState(entity.time   ?? '');
  const [editPrice, setEditPrice] = useState(String(entity.price));
  const [editNote,  setEditNote]  = useState(entity.aiHighlight ?? '');
  const cardRef                   = useRef<HTMLDivElement>(null);

  const saveEdit = useCallback(() => {
    const day = days.find(d => d.id === dayId);
    if (!day) return;
    const newPrice = parseFloat(editPrice);
    reorderDayEntities(dayId, day.entities.map(e =>
      e.id === entity.id
        ? { ...e, time: editTime.trim() || undefined, price: isNaN(newPrice) ? e.price : newPrice, aiHighlight: editNote.trim() || undefined }
        : e
    ));
    setIsEditing(false);
  }, [days, dayId, entity.id, editTime, editPrice, editNote, reorderDayEntities]);

  return (
    <motion.div
      ref={cardRef}
      layout={!isDragGhost}
      initial={isDragGhost ? false : { opacity: 0, y: 5 }}
      animate={{ opacity: isConflict ? 0.58 : 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.13 } }}
      transition={SPRING}
      style={{
        borderRadius: 13,
        background: isConflict
          ? 'rgba(255,69,58,0.06)'
          : entity.booked
          ? `linear-gradient(135deg, ${EMERALD}08 0%, rgba(255,255,255,0.94) 50%)`
          : `linear-gradient(135deg, ${color}06 0%, rgba(255,255,255,0.92) 55%)`,
        border: isConflict
          ? '1.5px solid rgba(255,69,58,0.30)'
          : entity.booked
          ? `1.5px solid ${EMERALD}28`
          : `1.5px solid ${color}1E`,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        position: 'relative',
        overflow: 'hidden',
        cursor: isDragGhost ? 'grabbing' : 'default',
        boxShadow: isConflict
          ? '0 2px 12px rgba(255,69,58,0.10)'
          : entity.booked
          ? `0 1px 6px ${EMERALD}14`
          : `0 1px 6px ${color}0A`,
      }}
    >
      {/* Category color blob — creates depth behind glass */}
      <div aria-hidden style={{
        position: 'absolute', right: -20, top: -20,
        width: 60, height: 60, borderRadius: '50%',
        background: isConflict ? `${RED}15` : `${color}12`,
        filter: 'blur(16px)',
        pointerEvents: 'none',
      }} />
      {/* Color accent stripe */}
      <div style={{
        position: 'absolute', left: 0, top: 4, bottom: 4, width: 4,
        background: isConflict ? RED : `linear-gradient(180deg, ${color}, ${color}66)`,
        borderRadius: 4, pointerEvents: 'none',
      }} />

      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px 9px 14px' }}>

        {/* Drag handle */}
        {!isDragGhost && dragHandle && (
          <div style={{ flexShrink: 0, cursor: 'grab', color: 'rgba(0,0,0,0.18)', display: 'flex', touchAction: 'none' }}>
            {dragHandle}
          </div>
        )}

        {/* Category icon */}
        <div style={{
          width: 24, height: 24, borderRadius: 7, flexShrink: 0,
          background: isConflict ? 'rgba(255,69,58,0.10)' : `${color}14`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={11} color={isConflict ? RED : color} strokeWidth={2} />
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 12, fontWeight: 700, letterSpacing: '-0.01em',
            color: isConflict ? '#B91C1C' : '#1D1D1F',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {entity.title}
            {isConflict && (
              <span style={{
                marginLeft: 5, fontSize: 9, fontWeight: 800, color: '#B91C1C',
                background: 'rgba(255,69,58,0.10)', border: '1px solid rgba(255,69,58,0.25)',
                borderRadius: 4, padding: '1px 5px', verticalAlign: 'middle',
              }}>CONFLICT</span>
            )}
          </div>
          <div style={{
            fontSize: 10, fontWeight: 500, marginTop: 1, letterSpacing: '-0.01em',
            color: isConflict ? '#DC2626' : '#6E6E73',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {entity.time ? `${entity.time} · ` : ''}{entity.subtitle}
          </div>
          {entity.aiHighlight && !isDragGhost && (
            <div style={{ fontSize: 9.5, fontStyle: 'italic', color, opacity: 0.70, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              ✦ {entity.aiHighlight}
            </div>
          )}
        </div>

        {/* Price */}
        {entity.price > 0 && (
          <span style={{ fontSize: 11, fontWeight: 800, color: isConflict ? '#B91C1C' : color, letterSpacing: '-0.02em', flexShrink: 0 }}>
            ${entity.price.toLocaleString()}
          </span>
        )}

        {/* Booked badge */}
        {entity.booked && !isDragGhost && (
          <motion.div
            initial={{ scale: 0 }} animate={{ scale: 1 }} transition={SPRING_POP}
            style={{
              display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0,
              background: 'rgba(48,209,88,0.10)', border: '1px solid rgba(48,209,88,0.28)',
              borderRadius: 6, padding: '2px 5px',
            }}
          >
            <Check size={8} color={EMERALD} strokeWidth={3} />
            <span style={{ fontSize: 9, fontWeight: 800, color: EMERALD, letterSpacing: '0.04em' }}>BOOKED</span>
          </motion.div>
        )}

        {/* Action buttons */}
        {!isDragGhost && (
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            <motion.button whileTap={{ scale: 0.88 }}
              onClick={e => { e.stopPropagation(); setIsEditing(v => { const n = !v; if (n) setTimeout(() => cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 120); return n; }); }}
              style={{ width: 22, height: 22, borderRadius: '50%', background: isEditing ? `${color}18` : 'rgba(0,0,0,0.04)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <StickyNote size={10} color={isEditing ? color : '#8E8E93'} strokeWidth={2} />
            </motion.button>
            <motion.button whileTap={{ scale: 0.88 }}
              onClick={e => { e.stopPropagation(); toggleBooked(dayId, entity.id); }}
              style={{ width: 22, height: 22, borderRadius: '50%', background: entity.booked ? 'rgba(48,209,88,0.14)' : 'rgba(0,0,0,0.04)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {entity.booked
                ? <Check  size={11} color={EMERALD}   strokeWidth={2.5} />
                : <Circle size={11} color="#8E8E93"   strokeWidth={1.75} />}
            </motion.button>
            <motion.button whileTap={{ scale: 0.88 }}
              onClick={e => { e.stopPropagation(); removeEntity(dayId, entity.id); }}
              style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(0,0,0,0.04)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <XIcon size={11} color="#8E8E93" strokeWidth={2} />
            </motion.button>
          </div>
        )}
      </div>

      {/* Inline edit panel */}
      <AnimatePresence>
        {isEditing && !isDragGhost && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.20, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ height: 1, background: `${color}18`, borderRadius: 1 }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Time</div>
                  {/* Smart suggestion: find next open slot based on other timed entities */}
                  {!editTime && (() => {
                    const d = days.find(dd => dd.id === dayId);
                    const timed = (d?.entities ?? []).filter(e => e.id !== entity.id && e.time)
                      .sort((a, b) => parseHHMM(a.time!) - parseHHMM(b.time!));
                    if (timed.length === 0) return null;
                    const last = timed[timed.length - 1]!;
                    const mins = parseHHMM(last.time!) + 60;
                    const hh   = String(Math.floor(mins / 60) % 24).padStart(2, '0');
                    const mm   = String(mins % 60).padStart(2, '0');
                    const suggested = `${hh}:${mm}`;
                    return (
                      <motion.button type="button" whileTap={{ scale: 0.95 }}
                        onClick={() => setEditTime(suggested)}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 6, cursor: 'pointer', background: `${color}10`, border: `1px solid ${color}28`, marginBottom: 4, fontFamily: 'inherit', fontSize: 9.5, fontWeight: 700, color }}>
                        ✦ Suggest {suggested}
                      </motion.button>
                    );
                  })()}
                  <input type="time" value={editTime} onChange={e => setEditTime(e.target.value)}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: 8, boxSizing: 'border-box', border: '1.5px solid rgba(0,0,0,0.10)', background: 'rgba(0,0,0,0.02)', fontSize: 12, fontWeight: 600, color: '#1D1D1F', fontFamily: 'inherit', outline: 'none' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Price $</div>
                  <input type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: 8, boxSizing: 'border-box', border: '1.5px solid rgba(0,0,0,0.10)', background: 'rgba(0,0,0,0.02)', fontSize: 12, fontWeight: 600, color: '#1D1D1F', fontFamily: 'inherit', outline: 'none' }} />
                </div>
              </div>
              <input value={editNote} onChange={e => setEditNote(e.target.value)} placeholder="Add a note…"
                style={{ width: '100%', padding: '6px 8px', borderRadius: 8, border: '1.5px solid rgba(0,0,0,0.08)', background: 'rgba(0,0,0,0.02)', fontSize: 12, fontFamily: 'inherit', outline: 'none', color: '#3C3C43', boxSizing: 'border-box' }} />
              <motion.button whileTap={{ scale: 0.97 }} onClick={saveEdit}
                style={{ padding: '7px', borderRadius: 9, border: 'none', cursor: 'pointer', background: `linear-gradient(135deg, ${color}, ${color}bb)`, color: '#fff', fontSize: 11, fontWeight: 800, fontFamily: 'inherit', letterSpacing: '-0.01em', boxShadow: `0 3px 12px ${color}30` }}>
                Save
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── SortableEntityCard ─────────────────────────────────────────────────────────

function SortableEntityCard({
  entity, dayId, isConflict,
}: {
  entity: PlacedEntity; dayId: string; isConflict: boolean;
}) {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({
    id:   entity.id,
    data: { type: 'entity', dayId, entity },
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: isDragging ? undefined : transition,
        opacity: isDragging ? 0 : 1,
        zIndex:  isDragging ? 50 : undefined,
      }}
    >
      <EntityCard
        entity={entity}
        dayId={dayId}
        isConflict={isConflict}
        dragHandle={
          <div {...attributes} {...listeners} style={{ display: 'flex', cursor: 'grab', padding: '2px', touchAction: 'none' }}>
            <GripVertical size={14} strokeWidth={2} />
          </div>
        }
      />
    </div>
  );
}

// ── DayCard ────────────────────────────────────────────────────────────────────

function DayCard({
  day, isActive, isAnyDragging, dimmed = false, filterCategory, onActivate,
}: {
  day:            EngineDay;
  isActive:       boolean;
  isAnyDragging:  boolean;
  dimmed?:        boolean;
  filterCategory: string | null;
  onActivate:     () => void;
}) {
  const reorderDayEntities = useTravelEngine(s => s.reorderDayEntities);
  const [undoEntity, setUndoEntity] = useState<PlacedEntity | null>(null);
  const undoTimerRef                = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dayNote,    setDayNote]    = useState('');
  const [isHovered,  setIsHovered]  = useState(false);
  const prevEntitiesRef             = useRef(day.entities);

  // Fix hydration: read localStorage only after mount
  useEffect(() => {
    setDayNote(localStorage.getItem(`unitravel:note:${day.id}`) ?? '');
  }, [day.id]);

  useEffect(() => () => { if (undoTimerRef.current) clearTimeout(undoTimerRef.current); }, []);

  // Track entity removals for undo
  useEffect(() => {
    const prevIds = new Set(prevEntitiesRef.current.map(e => e.id));
    const currIds = new Set(day.entities.map(e => e.id));
    const removed = prevEntitiesRef.current.find(e => !currIds.has(e.id));
    if (removed) {
      setUndoEntity(removed);
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      undoTimerRef.current = setTimeout(() => setUndoEntity(null), 4500);
    }
    prevEntitiesRef.current = day.entities;
  }, [day.entities]);

  const handleUndoRemove = useCallback(() => {
    if (!undoEntity) return;
    const engine = useTravelEngine.getState();
    const d = engine.days.find(dd => dd.id === day.id);
    if (d) engine.reorderDayEntities(day.id, [...d.entities, undoEntity]);
    setUndoEntity(null);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
  }, [undoEntity, day.id]);

  // useDroppable: cross-day drops onto empty area of this card
  const { setNodeRef: setDropRef, isOver: isDragOver } = useDroppable({
    id:   `drop-day-${day.id}`,
    data: { type: 'day', dayId: day.id },
  });

  // Conflict detection
  const conflictIds = useMemo(() => {
    const timed = [...day.entities]
      .filter(e => e.time)
      .sort((a, b) => parseHHMM(a.time!) - parseHHMM(b.time!));
    const set = new Set<string>();
    for (let i = 1; i < timed.length; i++) {
      const prev = timed[i - 1]!;
      const curr = timed[i]!;
      const prevEnd = parseHHMM(prev.time!) + (prev.duration ? parseInt(prev.duration, 10) : 60);
      if (parseHHMM(curr.time!) < prevEnd) { set.add(prev.id); set.add(curr.id); }
    }
    return set;
  }, [day.entities]);

  const hasConflicts = conflictIds.size > 0;
  const destColor    = DEST_COLORS[day.destination] ?? AZURE;
  const date         = new Date(day.date + 'T12:00:00Z');
  const dateStr      = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const weekday      = date.toLocaleDateString('en-US', { weekday: 'short' });
  const totalCost    = day.entities.reduce((s, e) => s + e.price, 0);
  const entityIds    = day.entities.map(e => e.id);

  // Compact row for empty inactive day (not during drag)
  if (day.entities.length === 0 && !isActive && !isAnyDragging) {
    return (
      <motion.div
        ref={setDropRef}
        layout
        onClick={onActivate}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        whileTap={{ scale: 0.99 }}
        animate={{ border: isDragOver ? `2px dashed ${destColor}60` : '1px solid rgba(255,255,255,0.40)' }}
        style={{
          display: 'flex', alignItems: 'center', padding: '0 16px', height: 52,
          borderRadius: 16,
          background: isDragOver ? `${destColor}06` : 'rgba(255,255,255,0.30)',
          backdropFilter: 'blur(20px)',
          cursor: 'pointer', opacity: dimmed ? 0.38 : 1,
          transition: 'background 0.15s ease',
        }}
      >
        <div style={{ width: 34, height: 34, borderRadius: 11, flexShrink: 0, marginRight: 12, background: isDragOver ? `${destColor}14` : 'rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s ease' }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: isDragOver ? destColor : '#1D1D1F', lineHeight: 1 }}>{day.dayNumber}</span>
          <span style={{ fontSize: 7.5, fontWeight: 600, color: isDragOver ? destColor : '#8E8E93', letterSpacing: '0.04em' }}>{weekday.toUpperCase()}</span>
        </div>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1D1D1F', letterSpacing: '-0.018em' }}>{dateStr}</span>
          {day.destination && <span style={{ fontSize: 11, color: '#8E8E93', marginLeft: 6 }}>· {day.destination}</span>}
        </div>
        {isDragOver ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ fontSize: 11, fontWeight: 700, color: destColor }}>Drop here →</motion.div>
        ) : (
          <AnimatePresence>
            {isHovered && (
              <motion.div initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 6 }} transition={{ duration: 0.12 }}
                style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: AZURE }}>Plan this day</span>
                <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,122,255,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Plus size={9} color={AZURE} strokeWidth={2.5} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
        {day.weather?.temp > 0 && <span style={{ fontSize: 14, marginLeft: 8 }}>{day.weather.icon}</span>}
      </motion.div>
    );
  }

  return (
    <motion.div
      ref={setDropRef}
      layout
      onClick={onActivate}
      animate={{
        boxShadow: isDragOver
          ? `0 0 0 2px ${destColor}55, 0 12px 32px rgba(0,122,255,0.16), inset 0 0 20px rgba(255,255,255,0.70)`
          : hasConflicts
          ? '0 0 0 2px rgba(255,69,58,0.30), 0 8px 24px rgba(255,69,58,0.07), 0 0 18px rgba(255,69,58,0.08)'
          : isActive
          ? `0 0 0 2px ${destColor}38, 0 8px 24px rgba(0,0,0,0.07), 0 0 24px ${destColor}12`
          : day.entities.length > 0 && !day.entities.some(e => e.category === 'hotel')
          ? '0 2px 8px rgba(0,0,0,0.04), 0 0 16px rgba(255,159,10,0.08)'
          : day.entities.length > 0 && day.entities.every(e => e.booked)
          ? '0 2px 8px rgba(0,0,0,0.04), 0 0 16px rgba(48,209,88,0.10)'
          : '0 2px 8px rgba(0,0,0,0.04)',
      }}
      transition={{ boxShadow: { duration: 0.22 } }}
      style={{
        borderRadius: 28,
        background: isActive ? 'rgba(255,255,255,0.64)' : 'rgba(255,255,255,0.34)',
        backdropFilter: 'blur(24px) saturate(1.8)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.8)',
        border: isDragOver
          ? `2px dashed ${destColor}60`
          : hasConflicts ? '1.5px solid rgba(255,69,58,0.28)'
          : isActive   ? `1.5px solid ${destColor}28`
          : '1.5px solid rgba(255,255,255,0.44)',
        padding: '18px 18px 14px',
        cursor: 'pointer', position: 'relative', overflow: 'hidden',
        opacity: dimmed ? 0.38 : 1,
        transition: 'border-color 0.20s ease, background 0.20s ease',
      }}
    >
      {/* Active left bar */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} exit={{ scaleY: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            style={{
              position: 'absolute', left: 0, top: 10, bottom: 10, width: 5,
              background: hasConflicts
                ? 'linear-gradient(180deg, #FF453A, #FF453A88)'
                : `linear-gradient(180deg, ${destColor}, ${destColor}66)`,
              borderTopRightRadius: 4, borderBottomRightRadius: 4,
              transformOrigin: 'top',
              boxShadow: hasConflicts ? '2px 0 8px rgba(255,69,58,0.30)' : `2px 0 10px ${destColor}50`,
            }}
          />
        )}
      </AnimatePresence>

      {/* Day header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12,
        paddingLeft: isActive ? 8 : 0,
        transition: 'padding 0.20s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <motion.div
            animate={{ background: isActive ? (hasConflicts ? RED : destColor) : 'rgba(0,0,0,0.06)' }}
            transition={{ duration: 0.22 }}
            style={{ width: 32, height: 32, borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            <span style={{ fontSize: 12, fontWeight: 800, lineHeight: 1, color: isActive ? '#fff' : '#1D1D1F' }}>{day.dayNumber}</span>
            <span style={{ fontSize: 7, fontWeight: 600, letterSpacing: '0.03em', color: isActive ? 'rgba(255,255,255,0.65)' : '#8E8E93' }}>{weekday.toUpperCase()}</span>
          </motion.div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1D1D1F', letterSpacing: '-0.020em', lineHeight: 1.2 }}>
              {dateStr}
              {day.destination && (
                <span style={{ fontSize: 10, color: destColor, fontWeight: 600, marginLeft: 6 }}>{day.destination}</span>
              )}
              {hasConflicts && (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={SPRING_POP}
                  style={{ marginLeft: 6, fontSize: 9, fontWeight: 800, color: '#B91C1C', background: 'rgba(255,69,58,0.10)', border: '1px solid rgba(255,69,58,0.25)', borderRadius: 5, padding: '1px 5px', verticalAlign: 'middle' }}>
                  {Math.ceil(conflictIds.size / 2)} conflict{conflictIds.size > 2 ? 's' : ''}
                </motion.span>
              )}
            </div>
            <div style={{ fontSize: 10, color: '#6E6E73', fontWeight: 500, marginTop: 1 }}>
              {day.entities.length === 0
                ? 'Empty — tap to plan'
                : `${day.entities.length} item${day.entities.length !== 1 ? 's' : ''}${totalCost > 0 ? ` · $${totalCost.toLocaleString()}` : ''}`}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {(day.weather?.temp ?? 0) > 0 && (
            <>
              <span style={{ fontSize: 14 }}>{day.weather.icon}</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: '#6E6E73' }}>{day.weather.temp}°</span>
            </>
          )}
        </div>
      </div>

      {/* Entity list with SortableContext */}
      <SortableContext items={entityIds} strategy={verticalListSortingStrategy}>
        <AnimatePresence mode="popLayout">
          {day.entities.length > 0 ? (
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: 5 }}
              onClick={e => e.stopPropagation()}
            >
              {day.entities.map(entity => {
                const visible = !filterCategory || entity.category === filterCategory;
                return visible ? (
                  <SortableEntityCard
                    key={entity.id}
                    entity={entity}
                    dayId={day.id}
                    isConflict={conflictIds.has(entity.id)}
                  />
                ) : null;
              })}
            </div>
          ) : (
            isActive && (
              <motion.div
                key="drop-hint"
                initial={{ opacity: 0, y: 4 }}
                animate={{
                  opacity: 1, y: 0,
                  background: isDragOver ? `${destColor}08` : `${destColor}04`,
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
                style={{
                  padding: '16px', borderRadius: 13,
                  border: `1.5px dashed ${isDragOver ? destColor + '60' : destColor + '28'}`,
                  transition: 'border-color 0.16s ease',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                }}
              >
                <motion.div
                  animate={isDragOver ? { scale: [1, 1.15, 1] } : { scale: [1, 1.06, 1] }}
                  transition={{ duration: isDragOver ? 0.4 : 3, repeat: Infinity, ease: 'easeInOut' }}
                  style={{ width: 32, height: 32, borderRadius: 10, background: `${destColor}12`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Plus size={16} color={destColor} strokeWidth={2} />
                </motion.div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: isDragOver ? destColor : `${destColor}80`, letterSpacing: '-0.01em' }}>
                    {isDragOver ? 'Release to drop here ↓' : 'Nothing planned yet'}
                  </div>
                  {!isDragOver && (
                    <div style={{ fontSize: 10, color: '#AEAEB2', marginTop: 3, letterSpacing: '-0.01em' }}>
                      Search flights, stays &amp; dining — then drag here
                    </div>
                  )}
                </div>
              </motion.div>
            )
          )}
        </AnimatePresence>
      </SortableContext>

      {/* Undo toast */}
      <AnimatePresence>
        {undoEntity && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.94 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit={{    opacity: 0, y: 4,  scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 460, damping: 28 }}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, padding: '8px 12px', borderRadius: 12, background: 'rgba(30,30,30,0.88)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.88)', letterSpacing: '-0.01em' }}>
              Removed <strong style={{ color: '#fff' }}>{undoEntity.title}</strong>
            </span>
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={e => { e.stopPropagation(); handleUndoRemove(); }}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 8, background: 'rgba(0,122,255,0.30)', border: '1px solid rgba(0,122,255,0.45)', color: '#60B3FF', fontSize: 10.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              <Undo2 size={10} strokeWidth={2.5} /> Undo
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Per-day note */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{    opacity: 0, height: 0     }}
            transition={{ duration: 0.20, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: 'hidden', marginTop: 8 }}
          >
            <textarea
              value={dayNote}
              onChange={e => { setDayNote(e.target.value); localStorage.setItem(`unitravel:note:${day.id}`, e.target.value); }}
              onClick={e => e.stopPropagation()}
              placeholder="Add a note for this day…"
              rows={dayNote ? undefined : 1}
              style={{ width: '100%', boxSizing: 'border-box', resize: 'none', padding: '8px 11px', borderRadius: 10, background: 'rgba(255,255,255,0.60)', border: '1px solid rgba(0,0,0,0.08)', fontSize: 11.5, fontWeight: 500, color: '#1D1D1F', fontFamily: 'inherit', lineHeight: 1.55, outline: 'none', backdropFilter: 'blur(8px)' }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── DestinationSection ──────────────────────────────────────────────────────────

function DestinationSection({
  destination, days, activeDayId, isAnyDragging, filterCategory, onActivate,
}: {
  destination:    string;
  days:           EngineDay[];
  activeDayId:    string | null;
  isAnyDragging:  boolean;
  filterCategory: string | null;
  onActivate:     (id: string) => void;
}) {
  const color    = DEST_COLORS[destination] ?? AZURE;
  const total    = days.reduce((s, d) => s + d.entities.length, 0);
  const isSpread = days.some(d => d.id === activeDayId);

  return (
    <motion.div layout style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Section header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 9,
        padding: '4px 4px 10px',
        position: 'sticky', top: 0, zIndex: 10,
        background: 'linear-gradient(to bottom, rgba(242,242,247,1) 65%, rgba(242,242,247,0) 100%)',
      }}>
        <motion.div
          animate={{ background: color, boxShadow: isSpread ? `0 0 10px ${color}70` : `0 0 5px ${color}40` }}
          transition={{ duration: 0.35 }}
          style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0 }}
        />
        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '-0.02em', color: '#1D1D1F', flex: 1 }}>{destination}</span>
        <span style={{ fontSize: 10, fontWeight: 600, color: '#8E8E93', letterSpacing: '-0.01em' }}>
          {days.length}d · {total} items
        </span>
      </div>

      {/* Day density mini heatmap */}
      <div style={{ display: 'flex', gap: 3, paddingBottom: 8, paddingLeft: 14 }}>
        {days.map(day => {
          const count    = day.entities.length;
          const maxCount = Math.max(...days.map(d => d.entities.length), 1);
          const intensity = count / maxCount;
          const isAct    = activeDayId === day.id;
          return (
            <motion.div
              key={day.id}
              title={count === 0 ? `Day ${day.dayNumber}: Empty` : `Day ${day.dayNumber}: ${day.entities.slice(0, 3).map(e => e.title).join(', ')}${count > 3 ? ` +${count - 3}` : ''}`}
              whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.94 }}
              onClick={() => onActivate(day.id)}
              style={{
                flex: 1, height: 22, borderRadius: 5, cursor: 'pointer',
                background: count === 0
                  ? 'rgba(0,0,0,0.04)'
                  : `${color}${Math.round(intensity * 55 + 18).toString(16).padStart(2, '0')}`,
                border: `1.5px solid ${isAct ? color + '70' : 'transparent'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'border-color 0.16s ease',
              }}
            >
              {count > 0 && (
                <span style={{ fontSize: 9, fontWeight: 800, lineHeight: 1, color: intensity > 0.55 ? 'rgba(255,255,255,0.90)' : color, letterSpacing: '-0.01em' }}>
                  {count}
                </span>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Day cards with left connector */}
      <div style={{ position: 'relative', paddingLeft: 14 }}>
        <div style={{ position: 'absolute', left: 5, top: 18, bottom: 18, width: 2, borderRadius: 1, background: `linear-gradient(to bottom, ${color}25, ${color}08)`, pointerEvents: 'none' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {days.map(day => {
            const dimmed = !!filterCategory && !day.entities.some(e => e.category === filterCategory);
            return (
              <DayCard
                key={day.id}
                day={day}
                isActive={activeDayId === day.id}
                isAnyDragging={isAnyDragging}
                dimmed={dimmed}
                filterCategory={filterCategory}
                onActivate={() => onActivate(day.id)}
              />
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

// ── LiquidTimeline ─────────────────────────────────────────────────────────────

interface LiquidTimelineProps {
  filterCategory?: string | null;
}

export function LiquidTimeline({ filterCategory = null }: LiquidTimelineProps) {
  const days         = useTravelEngine(s => s.days);
  const activeDay    = useTravelEngine(s => s.activeDay);
  const setActiveDay = useTravelEngine(s => s.setActiveDay);

  const [activeDragData, setActiveDragData] = useState<{ entity: PlacedEntity; dayId: string } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor,  { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const grouped = useMemo(() => {
    const map = new Map<string, EngineDay[]>();
    for (const day of days) {
      const arr = map.get(day.destination) ?? [];
      arr.push(day);
      map.set(day.destination, arr);
    }
    return map;
  }, [days]);

  const onDragStart = useCallback(({ active }: DragStartEvent) => {
    const data = active.data.current as { entity: PlacedEntity; dayId: string } | undefined;
    if (data?.entity) setActiveDragData({ entity: data.entity, dayId: data.dayId });
  }, []);

  const onDragEnd = useCallback(({ active, over }: DragEndEvent) => {
    setActiveDragData(null);
    if (!over) return;

    const activeData = active.data.current as { type: string; dayId: string; entity: PlacedEntity } | undefined;
    const overData   = over.data.current   as { type: string; dayId: string } | undefined;
    if (!activeData) return;

    const sourceDayId = activeData.dayId;
    const targetDayId = overData?.dayId ?? sourceDayId;

    const engine = useTravelEngine.getState();
    const srcDay = engine.days.find(d => d.id === sourceDayId);
    const tgtDay = engine.days.find(d => d.id === targetDayId);
    if (!srcDay || !tgtDay) return;

    if (sourceDayId === targetDayId) {
      // Same-day reorder
      const oldIdx = srcDay.entities.findIndex(e => e.id === String(active.id));
      const newIdx = srcDay.entities.findIndex(e => e.id === String(over.id));
      if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
        engine.reorderDayEntities(sourceDayId, arrayMove(srcDay.entities, oldIdx, newIdx));
      }
    } else {
      // Cross-day move
      const entity = srcDay.entities.find(e => e.id === String(active.id));
      if (!entity) return;
      const newSrc = srcDay.entities.filter(e => e.id !== entity.id);
      let newTgt: PlacedEntity[];
      if (overData?.type === 'entity') {
        const overIdx = tgtDay.entities.findIndex(e => e.id === String(over.id));
        newTgt = [...tgtDay.entities];
        newTgt.splice(Math.max(0, overIdx), 0, entity);
      } else {
        newTgt = [...tgtDay.entities, entity];
      }
      engine.reorderDayEntities(sourceDayId, newSrc);
      engine.reorderDayEntities(targetDayId, newTgt);
      engine.calculatePredictiveBudget();
    }
  }, []);

  // Zone-drag-commit bridge (from plan zones → timeline)
  useEffect(() => {
    const handler = async (e: Event) => {
      const detail      = (e as CustomEvent<TimelineDropPayload>).detail;
      const engine      = useTravelEngine.getState();
      const targetDayId = engine.activeDay ?? engine.days[0]?.id;
      if (!targetDayId) return;
      try { await handleEntityDrop(detail, targetDayId); }
      catch (err) { console.error('[LiquidTimeline] drop failed:', err); }
    };
    document.addEventListener('unitravel:zone-drag-commit', handler);
    return () => document.removeEventListener('unitravel:zone-drag-commit', handler);
  }, []);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBlock: 4, paddingInline: 2 }}>
        {Array.from(grouped.entries()).map(([dest, destDays]) => (
          <DestinationSection
            key={dest}
            destination={dest}
            days={destDays}
            activeDayId={activeDay}
            isAnyDragging={activeDragData !== null}
            filterCategory={filterCategory}
            onActivate={setActiveDay}
          />
        ))}
      </div>

      {/* Drag overlay — floating ghost card */}
      <DragOverlay dropAnimation={{ duration: 160, easing: 'cubic-bezier(0.22,1,0.36,1)' }}>
        {activeDragData ? (
          <div style={{
            pointerEvents: 'none', width: 300,
            transform: 'rotate(1.8deg)',
            filter: 'drop-shadow(0 14px 36px rgba(0,0,0,0.18)) drop-shadow(0 4px 12px rgba(0,122,255,0.13))',
            opacity: 0.96,
          }}>
            <EntityCard
              entity={activeDragData.entity}
              dayId={activeDragData.dayId}
              isDragGhost
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
