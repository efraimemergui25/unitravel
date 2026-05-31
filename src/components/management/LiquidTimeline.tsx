'use client';

import {
  motion, AnimatePresence, LayoutGroup, Reorder,
} from 'framer-motion';
import {
  useState, useEffect, useRef, useMemo, useCallback,
} from 'react';
import { useTravelEngine }               from '@/store/useTravelEngine';
import type { PlacedEntity, EngineDay }  from '@/store/useTravelEngine';
import { handleEntityDrop }              from '@/utils/TimelineSync';
import type { TimelineDropPayload }      from '@/utils/TimelineSync';
import { GapFiller }                     from '@/components/management/GapFiller';

// ── Design tokens ─────────────────────────────────────────────────────────────

const AZURE   = '#007AFF';
const EMERALD = '#30D158';
const AMBER   = '#FF9F0A';

const DEST_COLORS: Record<string, string> = {
  'Mexico City':   '#007AFF',
  'Tulum':         '#30D158',
  'Riviera Maya':  '#FF9F0A',
  'Cabo San Lucas':'#5E5CE6',
};

const CATEGORY_ICONS: Record<string, string> = {
  flight:     '✈',
  hotel:      '🏨',
  restaurant: '🍽',
  activity:   '🎭',
  transport:  '🚕',
};

const CATEGORY_COLORS: Record<string, string> = {
  flight:     AZURE,
  hotel:      '#5E5CE6',
  restaurant: AMBER,
  activity:   EMERALD,
  transport:  '#00C7BE',
};

const SPRING_SNAPPY = { type: 'spring', stiffness: 480, damping: 24 } as const;

// ── Entity card ───────────────────────────────────────────────────────────────

function EntityCard({ entity, dayId }: { entity: PlacedEntity; dayId: string }) {
  const removeEntity = useTravelEngine(s => s.removeEntity);
  const toggleBooked = useTravelEngine(s => s.toggleBooked);
  const color = CATEGORY_COLORS[entity.category] ?? AZURE;
  const icon  = CATEGORY_ICONS[entity.category] ?? '•';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.18 } }}
      transition={SPRING_SNAPPY}
      style={{
        display:              'flex',
        alignItems:           'center',
        gap:                  10,
        paddingBlock:         9,
        paddingInline:        11,
        borderRadius:         13,
        background:           'rgba(255,255,255,0.84)',
        border:               `1.5px solid ${color}1A`,
        backdropFilter:       'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        position:             'relative',
        overflow:             'hidden',
        cursor:               'grab',
        userSelect:           'none',
      }}
    >
      {/* Category accent stripe */}
      <div style={{
        position:         'absolute',
        insetInlineStart: 0,
        top: 0, bottom: 0,
        width:            3,
        background:       color,
        borderStartStartRadius: 3,
        borderEndStartRadius:   3,
      }} />

      {/* Icon */}
      <span style={{
        fontSize:            14, flexShrink: 0,
        marginInlineStart:   5,
        opacity:             entity.booked ? 1 : 0.75,
      }}>
        {icon}
      </span>

      {/* Main content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize:      12, fontWeight: 700,
          letterSpacing: '-0.01em',
          color:         'var(--text-primary)',
          whiteSpace:    'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {entity.title}
        </div>
        <div style={{
          fontSize:   10, fontWeight: 500,
          color:      'var(--text-secondary)', marginTop: 1,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {entity.time ? `${entity.time} · ` : ''}{entity.subtitle}
        </div>
      </div>

      {/* Price */}
      {entity.price > 0 && (
        <span style={{
          fontSize:      11, fontWeight: 800,
          color,         letterSpacing: '-0.02em',
          flexShrink:    0,
        }}>
          ${entity.price.toLocaleString()}
        </span>
      )}

      {/* Booked badge */}
      {entity.booked && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={SPRING_SNAPPY}
          style={{
            fontSize:      8, fontWeight: 800,
            background:    'rgba(48,209,88,0.12)',
            border:        '1px solid rgba(48,209,88,0.3)',
            color:         EMERALD,
            borderRadius:  5,
            paddingBlock:  2, paddingInline: 5,
            letterSpacing: '0.04em',
            flexShrink:    0,
          }}
        >
          ✓
        </motion.span>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={e => { e.stopPropagation(); toggleBooked(dayId, entity.id); }}
          title={entity.booked ? 'Mark unbooked' : 'Mark booked'}
          style={{
            width:          22, height: 22, borderRadius: '50%',
            background:     entity.booked ? 'rgba(48,209,88,0.12)' : 'rgba(0,0,0,0.05)',
            border:         'none', cursor: 'pointer',
            display:        'flex', alignItems: 'center', justifyContent: 'center',
            fontSize:       11, color: entity.booked ? EMERALD : 'var(--text-tertiary)',
            fontWeight:     700,
          }}
        >
          {entity.booked ? '✓' : '○'}
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={e => { e.stopPropagation(); removeEntity(dayId, entity.id); }}
          title="Remove"
          style={{
            width:      22, height: 22, borderRadius: '50%',
            background: 'rgba(0,0,0,0.05)',
            border:     'none', cursor: 'pointer',
            display:    'flex', alignItems: 'center', justifyContent: 'center',
            fontSize:   14, color: 'var(--text-tertiary)',
          }}
        >
          ×
        </motion.button>
      </div>
    </motion.div>
  );
}

// ── Day card ──────────────────────────────────────────────────────────────────

function DayCard({
  day,
  isActive,
  isLocked,
  onActivate,
}: {
  day:        EngineDay;
  isActive:   boolean;
  isLocked:   boolean;
  onActivate: () => void;
}) {
  // Local entity order — syncs from Zustand when new entities arrive
  const [entities, setEntities] = useState<PlacedEntity[]>(() => [...day.entities]);
  const reorderDayEntities = useTravelEngine(s => s.reorderDayEntities);

  useEffect(() => {
    setEntities(prev => {
      const prevIds    = new Set(prev.map(e => e.id));
      const zustandIds = new Set(day.entities.map(e => e.id));
      const merged     = prev.filter(e => zustandIds.has(e.id));
      for (const e of day.entities) {
        if (!prevIds.has(e.id)) merged.push(e);
      }
      return merged;
    });
  }, [day.entities]);

  const handleReorder = useCallback((newEntities: PlacedEntity[]) => {
    setEntities(newEntities);
    reorderDayEntities(day.id, newEntities);
  }, [day.id, reorderDayEntities]);

  const destColor = DEST_COLORS[day.destination] ?? AZURE;

  const date     = new Date(day.date + 'T12:00:00Z');
  const dateStr  = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const weekday  = date.toLocaleDateString('en-US', { weekday: 'short' });

  const totalDayCost = entities.reduce((s, e) => s + e.price, 0);

  return (
    <motion.div
      layout
      data-day-id={day.id}
      animate={{
        scale:     isLocked ? [1, 1.018, 1] : 1,
        boxShadow: isActive
          ? `0 0 0 2px ${destColor}3A, 0 8px 24px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,1)`
          : `0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.85)`,
      }}
      transition={{
        scale:     { type: 'spring', stiffness: 540, damping: 18 },
        boxShadow: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
      }}
      onClick={onActivate}
      style={{
        background:           isActive ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.78)',
        backdropFilter:       'blur(32px) saturate(1.8)',
        WebkitBackdropFilter: 'blur(32px) saturate(1.8)',
        borderRadius:         16,
        border:               isActive
          ? `1.5px solid ${destColor}28`
          : '1.5px solid rgba(255,255,255,0.92)',
        padding:              '12px 12px 10px',
        cursor:               'pointer',
        position:             'relative',
        overflow:             'hidden',
        transition:           'border-color 0.22s ease, background 0.22s ease',
      }}
    >
      {/* Active indicator bar */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ scaleY: 0, opacity: 0 }}
            animate={{ scaleY: 1, opacity: 1 }}
            exit={{ scaleY: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            style={{
              position:         'absolute',
              insetInlineStart: 0,
              top: 14, bottom: 14,
              width:            3,
              background:       destColor,
              borderStartEndRadius: 3,
              borderEndEndRadius:   3,
              transformOrigin:  'top',
            }}
          />
        )}
      </AnimatePresence>

      {/* Day header */}
      <div style={{
        display:            'flex',
        alignItems:         'center',
        justifyContent:     'space-between',
        marginBottom:       entities.length > 0 ? 10 : 0,
        paddingInlineStart: isActive ? 8 : 0,
        transition:         'padding 0.22s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Day badge */}
          <motion.div
            animate={{ background: isActive ? destColor : 'rgba(0,0,0,0.06)' }}
            transition={{ duration: 0.22 }}
            style={{
              width:          30, height: 30,
              borderRadius:   9,
              display:        'flex', flexDirection: 'column',
              alignItems:     'center', justifyContent: 'center',
              flexShrink:     0,
            }}
          >
            <span style={{
              fontSize: 11, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.01em',
              color: isActive ? '#fff' : 'var(--text-secondary)',
            }}>
              {day.dayNumber}
            </span>
            <span style={{
              fontSize: 7, fontWeight: 600, letterSpacing: '0.03em',
              color: isActive ? 'rgba(255,255,255,0.65)' : 'var(--text-tertiary)',
            }}>
              {weekday.toUpperCase()}
            </span>
          </motion.div>

          <div>
            <div style={{
              fontSize: 12, fontWeight: 700,
              letterSpacing: '-0.02em', color: 'var(--text-primary)', lineHeight: 1.2,
            }}>
              {dateStr}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 500, marginTop: 1 }}>
              {entities.length === 0
                ? 'Empty'
                : `${entities.length} ${entities.length === 1 ? 'item' : 'items'}${totalDayCost > 0 ? ` · $${totalDayCost.toLocaleString()}` : ''}`
              }
            </div>
          </div>
        </div>

        {/* Weather */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 13 }}>{day.weather.icon}</span>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)' }}>
            {day.weather.temp}°
          </span>
        </div>
      </div>

      {/* Entity list */}
      <AnimatePresence mode="popLayout">
        {entities.length > 0 ? (
          <Reorder.Group
            key="entities"
            as="div"
            axis="y"
            values={entities}
            onReorder={handleReorder}
            style={{
              display:      'flex',
              flexDirection: 'column',
              gap:           5,
              listStyle:    'none', margin: 0, padding: 0,
            }}
          >
            {entities.map(entity => (
              <Reorder.Item
                key={entity.id}
                value={entity}
                as="div"
                style={{ listStyle: 'none' }}
                whileDrag={{
                  scale:     1.025,
                  boxShadow: '0 12px 28px rgba(0,0,0,0.12)',
                  zIndex:    50,
                  cursor:    'grabbing',
                }}
              >
                <EntityCard entity={entity} dayId={day.id} />
              </Reorder.Item>
            ))}
          </Reorder.Group>
        ) : isActive ? (
          <motion.div
            key="drop-hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              marginTop:     8,
              paddingBlock:  12,
              textAlign:     'center',
              fontSize:      11, fontWeight: 600,
              letterSpacing: '-0.01em',
              color:         destColor,
              border:        `1.5px dashed ${destColor}38`,
              borderRadius:  11,
            }}
          >
            Add activities here ↓
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Gap filler — shows breathable AI-fill button for free slots > 3h */}
      {isActive && <GapFiller dayId={day.id} />}
    </motion.div>
  );
}

// ── Destination section ───────────────────────────────────────────────────────

function DestinationSection({
  destination,
  days,
  activeDayId,
  lockedDayId,
  onActivate,
}: {
  destination: string;
  days:        EngineDay[];
  activeDayId: string | null;
  lockedDayId: string | null;
  onActivate:  (dayId: string) => void;
}) {
  const color    = DEST_COLORS[destination] ?? AZURE;
  const total    = days.reduce((s, d) => s + d.entities.length, 0);
  const isSpread = days.some(d => d.id === activeDayId);

  return (
    <motion.div layout style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Group header */}
      <div style={{
        display:        'flex',
        alignItems:     'center',
        gap:            9,
        paddingInline:  4,
        paddingBlock:   '4px 10px',
        position:       'sticky',
        top:            0,
        zIndex:         10,
        background:     'linear-gradient(to bottom, var(--surface-base) 70%, transparent)',
      }}>
        <motion.div
          animate={{
            background:  color,
            boxShadow:   isSpread ? `0 0 10px ${color}70` : `0 0 5px ${color}40`,
          }}
          transition={{ duration: 0.35 }}
          style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0 }}
        />
        <span style={{
          fontSize:      12, fontWeight: 800,
          letterSpacing: '-0.02em',
          color:         'var(--text-primary)', flex: 1,
        }}>
          {destination}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 600,
          color: 'var(--text-tertiary)', letterSpacing: '-0.01em',
        }}>
          {days.length}d · {total} items
        </span>
      </div>

      {/* Days */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {days.map(day => (
          <DayCard
            key={day.id}
            day={day}
            isActive={activeDayId === day.id}
            isLocked={lockedDayId === day.id}
            onActivate={() => onActivate(day.id)}
          />
        ))}
      </div>
    </motion.div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function LiquidTimeline() {
  const days        = useTravelEngine(s => s.days);
  const activeDay   = useTravelEngine(s => s.activeDay);
  const setActiveDay = useTravelEngine(s => s.setActiveDay);

  const [lockedDayId, setLockedDayId] = useState<string | null>(null);
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Group days by destination (preserving DESTINATIONS order via Map insertion)
  const grouped = useMemo(() => {
    const map = new Map<string, EngineDay[]>();
    for (const day of days) {
      const arr = map.get(day.destination) ?? [];
      arr.push(day);
      map.set(day.destination, arr);
    }
    return map;
  }, [days]);

  // `unitravel:drop-lock` → spring-bounce target day for 700ms
  useEffect(() => {
    const handler = (e: Event) => {
      const { dayId } = (e as CustomEvent<{ dayId: string }>).detail;
      setLockedDayId(dayId);
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
      lockTimerRef.current = setTimeout(() => setLockedDayId(null), 700);
    };
    document.addEventListener('unitravel:drop-lock', handler);
    return () => {
      document.removeEventListener('unitravel:drop-lock', handler);
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    };
  }, []);

  // `unitravel:zone-drag-commit` → drop entity to active day
  const handleDragCommit = useCallback(async (e: Event) => {
    const detail     = (e as CustomEvent<TimelineDropPayload>).detail;
    const targetDayId = activeDay ?? days[0]?.id;
    if (!targetDayId) return;
    try {
      await handleEntityDrop(detail, targetDayId);
    } catch (err) {
      console.error('[LiquidTimeline] drop failed:', err);
    }
  }, [activeDay, days]);

  useEffect(() => {
    document.addEventListener('unitravel:zone-drag-commit', handleDragCommit);
    return () => document.removeEventListener('unitravel:zone-drag-commit', handleDragCommit);
  }, [handleDragCommit]);

  return (
    <LayoutGroup>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBlock: 4, paddingInline: 2 }}>
        {Array.from(grouped.entries()).map(([dest, destDays]) => (
          <DestinationSection
            key={dest}
            destination={dest}
            days={destDays}
            activeDayId={activeDay}
            lockedDayId={lockedDayId}
            onActivate={setActiveDay}
          />
        ))}
      </div>
    </LayoutGroup>
  );
}
