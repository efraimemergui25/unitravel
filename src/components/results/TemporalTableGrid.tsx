'use client';

import { useMemo, useState }        from 'react';
import { motion, AnimatePresence }   from 'framer-motion';
import { GripHorizontal }            from 'lucide-react';
import { useTravelEngine }           from '@/store/useTravelEngine';
import type { AggregatedDining }     from '@/services/OmniAggregator';

// ── Constants ─────────────────────────────────────────────────────────────────

const SPRING     = { type: 'spring', stiffness: 420, damping: 28 } as const;
const SPRING_POP = { type: 'spring', stiffness: 500, damping: 24 } as const;
const ORANGE     = '#FF9F0A';
const GREEN      = '#30D158';
const RED        = '#FF453A';

// ── Time slot math ────────────────────────────────────────────────────────────

interface TimeSlot {
  time:    string; // HH:MM
  hours:   number;
  minutes: number;
}

function generateSlots(startHour: number, endHour: number, stepMins: number): TimeSlot[] {
  const slots: TimeSlot[] = [];
  for (let h = startHour; h <= endHour; h++) {
    for (let m = 0; m < 60; m += stepMins) {
      if (h === endHour && m > 0) break;
      const hh = String(h).padStart(2, '0');
      const mm = String(m).padStart(2, '0');
      slots.push({ time: `${hh}:${mm}`, hours: h, minutes: m });
    }
  }
  return slots;
}

function parseHHMM(t: string): number {
  const [hStr, mStr] = t.split(':');
  const h = parseInt(hStr ?? '0', 10);
  const m = parseInt(mStr ?? '0', 10);
  return h * 60 + m;
}

// Returns true if slot is within bufferMins of any placed entity on the day
function isBlocked(slot: TimeSlot, blockedRanges: Array<[number, number]>, bufferMins = 60): boolean {
  const slotMin = slot.hours * 60 + slot.minutes;
  return blockedRanges.some(([start, end]) =>
    slotMin >= start - bufferMins && slotMin <= end + bufferMins,
  );
}

// First available slot after all blocked ranges (+ buffer)
function findSuggestedSlot(
  slots: TimeSlot[],
  blockedRanges: Array<[number, number]>,
  bufferMins = 60,
): string | null {
  if (blockedRanges.length === 0) return slots[3]?.time ?? null;
  const latestEnd = Math.max(...blockedRanges.map(([, e]) => e));
  const safeMin   = latestEnd + bufferMins;
  const best      = slots.find(s => s.hours * 60 + s.minutes >= safeMin);
  return best?.time ?? null;
}

// ── Single slot button ────────────────────────────────────────────────────────

function SlotButton({
  slot,
  isBlocked,
  isSuggested,
  isSelected,
  onSelect,
}: {
  slot:        TimeSlot;
  isBlocked:   boolean;
  isSuggested: boolean;
  isSelected:  boolean;
  onSelect:    () => void;
}) {
  if (isBlocked) {
    return (
      <div
        aria-disabled="true"
        style={{
          paddingBlock:   8,
          paddingInline:  12,
          borderRadius:   12,
          border:         '1px solid rgba(0,0,0,0.07)',
          background:     'rgba(0,0,0,0.04)',
          opacity:        0.38,
          filter:         'grayscale(1)',
          cursor:         'not-allowed',
          position:       'relative',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          flexShrink:     0,
          pointerEvents:  'none',
        }}
      >
        <span style={{ fontSize: 10, fontWeight: 700, color: '#8E8E93', fontFamily: 'inherit', letterSpacing: '-0.01em', textDecoration: 'line-through' }}>
          {slot.time}
        </span>
        {/* Strike-through overlay icon */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: RED }}>
          ✕
        </div>
      </div>
    );
  }

  return (
    <motion.button
      onClick={onSelect}
      aria-pressed={isSelected}
      whileHover={{ y: -2, scale: 1.05 }}
      whileTap={{ scale: 0.94 }}
      animate={isSuggested && !isSelected
        ? { boxShadow: [`0 0 0px ${GREEN}00`, `0 0 10px ${GREEN}60`, `0 0 0px ${GREEN}00`] }
        : {}
      }
      transition={isSuggested ? { duration: 1.8, repeat: Infinity } : SPRING}
      style={{
        paddingBlock:   8,
        paddingInline:  12,
        borderRadius:   12,
        border:         isSelected
          ? `1.5px solid ${ORANGE}50`
          : isSuggested
          ? `1.5px solid ${GREEN}50`
          : '1.5px solid rgba(255,255,255,0.55)',
        background:     isSelected
          ? `${ORANGE}18`
          : isSuggested
          ? `${GREEN}10`
          : 'rgba(255,255,255,0.28)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow:      isSelected
          ? `inset 0 2px 8px ${ORANGE}18, inset 0 1px 0 rgba(255,255,255,0.8)`
          : 'inset 0 1px 0 rgba(255,255,255,0.7)',
        cursor:         'pointer',
        fontFamily:     'inherit',
        flexShrink:     0,
        position:       'relative',
        display:        'flex',
        alignItems:     'center',
        gap:            4,
      }}
    >
      {isSuggested && !isSelected && (
        <motion.span
          animate={{ scale: [1, 1.25, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 1.6, repeat: Infinity }}
          style={{ width: 5, height: 5, borderRadius: '50%', background: GREEN, boxShadow: `0 0 4px ${GREEN}cc`, flexShrink: 0 }}
        />
      )}
      <span style={{
        fontSize:      10,
        fontWeight:    isSelected ? 900 : 700,
        color:         isSelected ? ORANGE : isSuggested ? GREEN : '#1C1C1E',
        letterSpacing: '-0.01em',
        whiteSpace:    'nowrap',
      }}>
        {slot.time}
      </span>
    </motion.button>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface TemporalTableGridProps {
  restaurant: AggregatedDining;
  dayId:      string;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function TemporalTableGrid({ restaurant, dayId }: TemporalTableGridProps) {
  const { days, setDragging } = useTravelEngine();
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  // Get all placed entities on this day and build blocked time ranges
  const blockedRanges = useMemo((): Array<[number, number]> => {
    const day = days.find(d => d.id === dayId);
    if (!day) return [];

    return day.entities.flatMap(entity => {
      if (!entity.time) return [];
      const startMin = parseHHMM(entity.time);
      // Parse duration: "2h 30m", "1h", "45m" → minutes
      let durationMin = 90; // default
      if (entity.duration) {
        const hm = entity.duration.match(/(\d+)h/);
        const mm = entity.duration.match(/(\d+)m/);
        durationMin = (hm ? parseInt(hm[1]!, 10) * 60 : 0) + (mm ? parseInt(mm[1]!, 10) : 0) || 90;
      }
      return [[startMin, startMin + durationMin]] as Array<[number, number]>;
    });
  }, [days, dayId]);

  const slots       = useMemo(() => generateSlots(18, 23, 30), []);
  const suggested   = useMemo(() => findSuggestedSlot(slots, blockedRanges), [slots, blockedRanges]);

  const handleDragStart = () => {
    if (!selectedTime) return;
    setDragging({ ...restaurant, tags: [...restaurant.tags, `res:${selectedTime}`] });
  };

  const hasConflicts = blockedRanges.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <p style={{ margin: 0, fontSize: 9.5, fontWeight: 800, color: '#6E6E73', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'inherit' }}>
          Reserve a Time
        </p>
        {hasConflicts && (
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={SPRING_POP}
            style={{ fontSize: 9, fontWeight: 700, color: RED, background: `${RED}10`, border: `1px solid ${RED}30`, borderRadius: 6, paddingBlock: 2, paddingInline: 6, fontFamily: 'inherit' }}
          >
            ⚠ {blockedRanges.length} schedule conflict{blockedRanges.length !== 1 ? 's' : ''}
          </motion.span>
        )}
        {suggested && !selectedTime && (
          <motion.span
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ fontSize: 9, fontWeight: 700, color: GREEN, background: `${GREEN}10`, border: `1px solid ${GREEN}30`, borderRadius: 6, paddingBlock: 2, paddingInline: 6, fontFamily: 'inherit' }}
          >
            ✦ {suggested} suggested
          </motion.span>
        )}
      </div>

      {/* Slot strip */}
      <div
        className="flex flex-row overflow-x-auto gap-2 no-scrollbar"
        style={{ paddingBlockEnd: 2 }}
        aria-label="Time slot selector"
      >
        {slots.map(slot => {
          const blocked   = isBlocked(slot, blockedRanges);
          const suggested_slot = slot.time === suggested;
          const sel       = slot.time === selectedTime;
          return (
            <SlotButton
              key={slot.time}
              slot={slot}
              isBlocked={blocked}
              isSuggested={suggested_slot && !blocked}
              isSelected={sel}
              onSelect={() => setSelectedTime(sel ? null : slot.time)}
            />
          );
        })}
      </div>

      {/* Drag handle — only when a valid time is selected */}
      <AnimatePresence>
        {selectedTime && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={SPRING_POP}
            style={{
              display:        'flex',
              alignItems:     'center',
              gap:            8,
              paddingBlock:   8, paddingInline: 12,
              borderRadius:   12,
              background:     `${ORANGE}12`,
              border:         `1.5px solid ${ORANGE}40`,
              backdropFilter: 'blur(8px)',
              alignSelf:      'flex-start',
            }}
          >
            <motion.div
              draggable
              onDragStart={handleDragStart}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.92 }}
              style={{
                width: 28, height: 28, borderRadius: 8,
                background: `${ORANGE}18`, border: `1px solid ${ORANGE}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'grab', color: ORANGE,
              }}
              title="Drag to timeline"
            >
              <GripHorizontal size={13} strokeWidth={2.2} />
            </motion.div>
            <div>
              <span style={{ fontSize: 10, fontWeight: 800, color: ORANGE, fontFamily: 'inherit', letterSpacing: '-0.01em' }}>
                Drag to Day · {selectedTime}
              </span>
              <div style={{ fontSize: 9, fontWeight: 500, color: '#6E6E73', fontFamily: 'inherit' }}>
                {restaurant.name} · ${restaurant.pricePerPerson * 2} for 2
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
