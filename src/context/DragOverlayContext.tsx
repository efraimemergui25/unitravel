'use client';

import {
  createContext, useContext, useRef, useState, useCallback,
  useEffect, type ReactNode, type PointerEvent as ReactPointerEvent,
} from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';

// ── CommitableEntity — what gets dragged from a zone card ─────────────────────

export interface CommitableEntity {
  id:           string;
  type:         'flight' | 'hotel' | 'restaurant' | 'attraction' | 'transit';
  title:        string;
  subtitle:     string;
  price:        number;
  currency:     string;
  icon:         string;
  sourceZone:   string;
  metadata?:    Record<string, unknown>;
}

// ── Day tile (passed to overlay for drop targets) ─────────────────────────────

export interface DayTile {
  dayIndex:    number;
  label:       string;        // "Day 3"
  date:        string;        // "Oct 15"
  destination: string;
  icon:        string;
}

// ── Context shape ─────────────────────────────────────────────────────────────

interface DragOverlayCtx {
  isDragging:   boolean;
  dragEntity:   CommitableEntity | null;
  startDrag:    (entity: CommitableEntity, e: ReactPointerEvent) => void;
  cancelDrag:   () => void;
  registerDays: (days: DayTile[]) => void;
}

const DragOverlayContext = createContext<DragOverlayCtx | null>(null);

export function useDragOverlay(): DragOverlayCtx {
  const ctx = useContext(DragOverlayContext);
  if (!ctx) throw new Error('useDragOverlay must be used inside DragOverlayProvider');
  return ctx;
}

// ── Ghost card ────────────────────────────────────────────────────────────────

function GhostCard({ entity }: { entity: CommitableEntity }) {
  return (
    <div style={{
      background:    'rgba(255,255,255,0.96)',
      backdropFilter:'blur(32px) saturate(2)',
      borderRadius:  16,
      border:        '1.5px solid rgba(255,255,255,0.8)',
      boxShadow:     '0 12px 40px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)',
      padding:       '10px 14px',
      width:         200,
      pointerEvents: 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 18 }}>{entity.icon}</span>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#1C1C1E', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            {entity.title}
          </div>
          <div style={{ fontSize: 9, color: '#8E8E93', marginTop: 1 }}>
            {entity.subtitle}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#007AFF', letterSpacing: '-0.03em' }}>
        {entity.currency} {entity.price.toLocaleString()}
      </div>
      <div style={{
        marginTop: 8, fontSize: 8, fontWeight: 700, color: '#007AFF',
        background: 'rgba(0,122,255,0.08)', borderRadius: 6,
        paddingBlock: 3, paddingInline: 7, textAlign: 'center',
        border: '1px solid rgba(0,122,255,0.2)',
      }}>
        Drop on a day to auto-book →
      </div>
    </div>
  );
}

// ── Day tile strip ────────────────────────────────────────────────────────────

function DayStrip({
  days, entity, onCommit,
}: {
  days:     DayTile[];
  entity:   CommitableEntity;
  onCommit: (day: DayTile) => void;
}) {
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 80, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 360, damping: 28 }}
      style={{
        position:      'fixed',
        bottom:        20,
        left:          '50%',
        transform:     'translateX(-50%)',
        zIndex:        9997,
        display:       'flex',
        gap:           8,
        padding:       '12px 16px',
        background:    'rgba(28,28,30,0.92)',
        backdropFilter:'blur(32px)',
        borderRadius:  20,
        border:        '1px solid rgba(255,255,255,0.12)',
        boxShadow:     '0 8px 40px rgba(0,0,0,0.4)',
        pointerEvents: 'auto',
      }}
    >
      <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginRight: 4, alignSelf: 'center', whiteSpace: 'nowrap' }}>
        Drop on:
      </div>
      {days.map(day => {
        const isHover = hoveredDay === day.dayIndex;
        return (
          <motion.div
            key={day.dayIndex}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.96 }}
            onPointerEnter={() => setHoveredDay(day.dayIndex)}
            onPointerLeave={() => setHoveredDay(null)}
            onPointerUp={() => onCommit(day)}
            animate={isHover ? {
              background: 'rgba(0,122,255,0.25)',
              borderColor: 'rgba(0,122,255,0.5)',
            } : {
              background: 'rgba(255,255,255,0.06)',
              borderColor: 'rgba(255,255,255,0.12)',
            }}
            transition={{ duration: 0.12 }}
            style={{
              borderRadius:  12,
              border:        '1.5px solid rgba(255,255,255,0.12)',
              padding:       '8px 10px',
              cursor:        'pointer',
              textAlign:     'center',
              minWidth:      52,
            }}
          >
            <div style={{ fontSize: 14 }}>{day.icon}</div>
            <div style={{ fontSize: 9, fontWeight: 800, color: isHover ? '#007AFF' : '#fff', marginTop: 2 }}>
              {day.label}
            </div>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)' }}>
              {day.date}
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

// ── Zone recession overlay ────────────────────────────────────────────────────

function RecessionOverlay({ visible }: { visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            position:       'fixed',
            inset:          0,
            zIndex:         9996,
            background:     'rgba(0,0,0,0.22)',
            backdropFilter: 'blur(4px)',
            pointerEvents:  'none',
          }}
        />
      )}
    </AnimatePresence>
  );
}

// ── DragOverlayProvider ───────────────────────────────────────────────────────

export function DragOverlayProvider({ children }: { children: ReactNode }) {
  const [isDragging,  setIsDragging]  = useState(false);
  const [dragEntity,  setDragEntity]  = useState<CommitableEntity | null>(null);
  const [days,        setDays]        = useState<DayTile[]>([]);
  const [showAutoBook, setShowAutoBook] = useState(false);
  const [lastCommit,  setLastCommit]  = useState<{ entity: CommitableEntity; day: DayTile } | null>(null);

  const cursorX = useMotionValue(0);
  const cursorY = useMotionValue(0);

  // Ghost card follows cursor with 12px offsets
  const ghostX = useTransform(cursorX, x => x + 12);
  const ghostY = useTransform(cursorY, y => y - 40);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    cursorX.set(e.clientX);
    cursorY.set(e.clientY);
  }, [cursorX, cursorY]);

  const endDrag = useCallback(() => {
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup',   endDrag);
    setIsDragging(false);
    setDragEntity(null);
  }, [handlePointerMove]);

  const startDrag = useCallback((entity: CommitableEntity, e: ReactPointerEvent) => {
    cursorX.set(e.clientX);
    cursorY.set(e.clientY);
    setDragEntity(entity);
    setIsDragging(true);
    setShowAutoBook(false);

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup',   endDrag);
  }, [cursorX, cursorY, handlePointerMove, endDrag]);

  const cancelDrag = useCallback(() => {
    endDrag();
  }, [endDrag]);

  const registerDays = useCallback((d: DayTile[]) => setDays(d), []);

  const handleCommit = useCallback((day: DayTile) => {
    if (!dragEntity) return;

    // Dispatch the commit event for zone components to listen
    window.dispatchEvent(new CustomEvent('unitravel:zone-drag-commit', {
      detail: { entity: dragEntity, day },
    }));

    setLastCommit({ entity: dragEntity, day });
    setShowAutoBook(true);
    endDrag();
  }, [dragEntity, endDrag]);

  // Clean up on unmount
  useEffect(() => () => {
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup',   endDrag);
  }, [handlePointerMove, endDrag]);

  return (
    <DragOverlayContext.Provider value={{ isDragging, dragEntity, startDrag, cancelDrag, registerDays }}>
      {children}

      {/* Zone recession when dragging */}
      <RecessionOverlay visible={isDragging} />

      {/* Ghost card following cursor */}
      <AnimatePresence>
        {isDragging && dragEntity && (
          <motion.div
            key="ghost"
            style={{
              position: 'fixed',
              top:      0,
              left:     0,
              x:        ghostX,
              y:        ghostY,
              zIndex:   9999,
              pointerEvents: 'none',
            }}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.85, opacity: 0 }}
            transition={{ duration: 0.12 }}
          >
            <GhostCard entity={dragEntity} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Day tile strip when dragging */}
      <AnimatePresence>
        {isDragging && days.length > 0 && dragEntity && (
          <DayStrip key="strip" days={days} entity={dragEntity} onCommit={handleCommit} />
        )}
      </AnimatePresence>

      {/* Auto-book confirmation toast */}
      <AnimatePresence>
        {showAutoBook && lastCommit && (
          <motion.div
            key="autobook"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            style={{
              position:      'fixed',
              bottom:        100,
              left:          '50%',
              transform:     'translateX(-50%)',
              zIndex:        9999,
              background:    'rgba(28,28,30,0.96)',
              backdropFilter:'blur(32px)',
              borderRadius:  18,
              border:        '1px solid rgba(255,255,255,0.12)',
              boxShadow:     '0 12px 48px rgba(0,0,0,0.4)',
              padding:       '14px 18px',
              display:       'flex',
              alignItems:    'center',
              gap:           12,
              minWidth:      320,
            }}
          >
            <span style={{ fontSize: 22 }}>{lastCommit.entity.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#fff', marginBottom: 2 }}>
                {lastCommit.entity.title}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>
                Added to {lastCommit.day.label} · {lastCommit.day.destination}
              </div>
            </div>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                window.dispatchEvent(new CustomEvent('unitravel:auto-book', {
                  detail: { entity: lastCommit.entity, day: lastCommit.day },
                }));
                setShowAutoBook(false);
              }}
              style={{
                fontSize:    10,
                fontWeight:  800,
                color:       '#fff',
                background:  '#007AFF',
                border:      'none',
                borderRadius:10,
                paddingBlock:7,
                paddingInline:14,
                cursor:      'pointer',
                whiteSpace:  'nowrap',
              }}
            >
              Auto-Book via AI →
            </motion.button>
            <button
              onClick={() => setShowAutoBook(false)}
              style={{
                fontSize: 9, color: 'rgba(255,255,255,0.4)',
                background: 'none', border: 'none', cursor: 'pointer', padding: 4,
              }}
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </DragOverlayContext.Provider>
  );
}
