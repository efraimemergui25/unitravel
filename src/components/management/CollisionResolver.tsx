'use client';

import { useCallback }            from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Zap, Clock, X, CheckCheck } from 'lucide-react';
import { useCheckoutEngine }      from '@/store/useCheckoutEngine';
import { checkoutMinToHHMM }      from '@/store/useCheckoutEngine';
import { useTravelEngine }        from '@/store/useTravelEngine';
import { parseHHMMtoMin, parseDurationMin } from '@/utils/AnticipatoryEngine';
import type { TemporalConflict }  from '@/store/useCheckoutEngine';

// ── Design tokens ─────────────────────────────────────────────────────────────

const SPRING     = { type: 'spring', stiffness: 420, damping: 28 } as const;
const SPRING_POP = { type: 'spring', stiffness: 540, damping: 24 } as const;
const RED        = '#FF453A';
const AMBER      = '#FF9F0A';
const AZURE      = '#007AFF';

// ── Single conflict row ───────────────────────────────────────────────────────

function ConflictRow({
  conflict,
  index,
  onResolve,
}: {
  conflict:  TemporalConflict;
  index:     number;
  onResolve: (c: TemporalConflict) => void;
}) {
  const color = conflict.type === 'overlap' ? RED : AMBER;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{    opacity: 0, x:  8, scale: 0.96 }}
      transition={{ ...SPRING_POP, delay: index * 0.06 }}
      style={{
        display:              'flex',
        alignItems:           'flex-start',
        gap:                  10,
        paddingBlock:         10,
        paddingInline:        12,
        borderRadius:         12,
        background:           `${color}08`,
        border:               `1px solid ${color}25`,
        backdropFilter:       'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      {/* Type icon */}
      <div style={{
        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
        background: `${color}14`, border: `1px solid ${color}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginTop: 1,
      }}>
        {conflict.type === 'overlap'
          ? <Zap size={13} color={color} strokeWidth={2} />
          : <Clock size={13} color={color} strokeWidth={2} />
        }
      </div>

      {/* Description */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 10, fontWeight: 800, color,
          textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2,
        }}>
          {conflict.type === 'overlap' ? 'Temporal Clash' : 'Transit Gap'}
        </div>
        <div style={{
          fontSize: 11, fontWeight: 600, color: '#1C1C1E',
          letterSpacing: '-0.01em', lineHeight: 1.45,
        }}>
          {conflict.description}
        </div>
      </div>

      {/* Auto-resolve CTA */}
      <motion.button
        onClick={() => onResolve(conflict)}
        whileHover={{ scale: 1.04, boxShadow: `0 4px 16px ${AZURE}30` }}
        whileTap={{ scale: 0.95 }}
        transition={SPRING}
        style={{
          paddingBlock:         7,
          paddingInline:        12,
          borderRadius:         10,
          background:           'rgba(255,255,255,0.72)',
          backdropFilter:       'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border:               `1.5px solid ${AZURE}28`,
          color:                AZURE,
          fontSize:             10,
          fontWeight:           800,
          letterSpacing:        '-0.01em',
          cursor:               'pointer',
          whiteSpace:           'nowrap',
          flexShrink:           0,
          fontFamily:           'inherit',
          boxShadow:            '0 2px 8px rgba(0,122,255,0.12), inset 0 1px 0 rgba(255,255,255,0.9)',
        }}
      >
        Auto-Resolve
      </motion.button>
    </motion.div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function CollisionResolver() {
  const { conflicts, clearConflicts }  = useCheckoutEngine();
  const reorderDayEntities             = useTravelEngine(s => s.reorderDayEntities);
  const days                           = useTravelEngine(s => s.days);

  const resolveConflict = useCallback((conflict: TemporalConflict) => {
    const day = days.find(d => d.id === conflict.dayId);
    if (!day) return;

    const { entityA, entityB } = conflict;

    if (!entityA.time) return;

    // Push entityB to: entityA.end + 30min transit buffer
    const aEnd      = parseHHMMtoMin(entityA.time) + parseDurationMin(entityA.duration);
    const newBStart = aEnd + 30;

    const updatedEntities = day.entities.map(e =>
      e.id === entityB.id ? { ...e, time: checkoutMinToHHMM(newBStart) } : e
    );

    reorderDayEntities(conflict.dayId, updatedEntities);

    // Remove this conflict from the store
    useCheckoutEngine.setState(s => ({
      ...s,
      conflicts: s.conflicts.filter(c => c.id !== conflict.id),
    }));
  }, [days, reorderDayEntities]);

  const resolveAll = useCallback(() => {
    for (const conflict of conflicts) resolveConflict(conflict);
  }, [conflicts, resolveConflict]);

  if (conflicts.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="collision-resolver"
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0,  scale: 1    }}
        exit={{    opacity: 0, y: 8,  scale: 0.96 }}
        transition={SPRING}
        // Spec: bg-red-500/10 backdrop-blur-3xl border border-red-500/30 rounded-2xl p-4
        className="bg-red-500/10 backdrop-blur-3xl border border-red-500/30 rounded-2xl p-4"
        style={{
          display:    'flex',
          flexDirection: 'column',
          gap:        12,
          boxShadow:  '0 8px 32px rgba(255,69,58,0.08), inset 0 1px 0 rgba(255,255,255,0.7)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <motion.div
              animate={{ scale: [1, 1.15, 1], opacity: [0.8, 1, 0.8] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 28, height: 28, borderRadius: 9,
                background: 'rgba(255,69,58,0.12)', border: '1px solid rgba(255,69,58,0.25)',
              }}
            >
              <AlertTriangle size={14} color={RED} strokeWidth={2.5} />
            </motion.div>
            <div>
              <div style={{
                fontSize: 12, fontWeight: 900, color: RED,
                letterSpacing: '-0.02em',
              }}>
                {conflicts.length} Temporal {conflicts.length === 1 ? 'Conflict' : 'Conflicts'} Detected
              </div>
              <div style={{ fontSize: 9.5, fontWeight: 500, color: '#8E8E93', marginTop: 1 }}>
                Resolve before authorizing Omni-Booking
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            {/* Resolve all */}
            {conflicts.length > 1 && (
              <motion.button
                onClick={resolveAll}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.95 }}
                transition={SPRING}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  paddingBlock:  6, paddingInline: 12,
                  borderRadius:  9,
                  background:    'linear-gradient(135deg, #007AFF 0%, #5E5CE6 100%)',
                  border:        'none', cursor: 'pointer',
                  color:         '#fff', fontSize: 10, fontWeight: 800,
                  letterSpacing: '-0.01em', fontFamily: 'inherit',
                  boxShadow:     '0 4px 14px rgba(0,122,255,0.30)',
                }}
              >
                <CheckCheck size={11} color="#fff" strokeWidth={2.5} />
                Resolve All
              </motion.button>
            )}
            {/* Dismiss */}
            <motion.button
              onClick={clearConflicts}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              transition={SPRING}
              style={{
                width: 26, height: 26, borderRadius: '50%',
                background: 'rgba(0,0,0,0.06)', border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
              aria-label="Dismiss conflicts"
            >
              <X size={12} color="#8E8E93" strokeWidth={2.5} />
            </motion.button>
          </div>
        </div>

        {/* Conflict list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <AnimatePresence>
            {conflicts.map((c, i) => (
              <ConflictRow
                key={c.id}
                conflict={c}
                index={i}
                onResolve={resolveConflict}
              />
            ))}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
