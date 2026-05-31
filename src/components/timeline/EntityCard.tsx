'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { GlassCard } from '@/components/ui/GlassCard';
import { CategoryIcon, getCategoryColor } from '@/components/ui/CategoryIcon';
import { BudgetBadge } from '@/components/ui/BudgetBadge';
import { TravelEntity } from '@/types';
import { useTripStore } from '@/store/tripStore';

interface EntityCardProps {
  entity: TravelEntity;
  dayId: string;
  index: number;
}

export function EntityCard({ entity, dayId, index }: EntityCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showAgentActions, setShowAgentActions] = useState(false);
  const { toggleEntityBooked, removeEntityFromDay } = useTripStore();

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: entity.id,
    data: { entity, sourceDayId: dayId },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 9999 : 'auto',
    opacity: isDragging ? 0.4 : 1,
  };

  const color = getCategoryColor(entity.category);

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      initial={{ opacity: 0, x: -16, scale: 0.97 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 16, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30, delay: index * 0.04 }}
      layout
      layoutId={`entity-${entity.id}`}
    >
      <GlassCard
        variant="default"
        className="overflow-visible cursor-grab active:cursor-grabbing"
        style={{
          borderLeft: `2px solid ${color}`,
          boxShadow: isDragging
            ? `0 24px 64px rgba(0,0,0,0.7), 0 0 32px ${color}40`
            : `0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.07)`,
        }}
        whileHover={{ y: -2, boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 20px ${color}25` }}
        {...attributes}
        {...listeners}
      >
        {/* Main row */}
        <div className="flex items-start gap-3 p-3">
          <CategoryIcon category={entity.category} size="sm" pulse={entity.aiGenerated} />

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white/90 truncate leading-tight">{entity.title}</p>
                <p className="text-[11px] text-white/45 mt-0.5 truncate">{entity.subtitle}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {entity.aiGenerated && (
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(94,92,230,0.15)', color: '#5E5CE6', border: '1px solid rgba(94,92,230,0.25)' }}>
                    AI
                  </span>
                )}
                <BudgetBadge amount={entity.price} size="sm" />
              </div>
            </div>

            {/* Meta row */}
            <div className="flex items-center gap-3 mt-1.5">
              {entity.time && (
                <span className="text-[10px] text-white/40 flex items-center gap-1">
                  <span style={{ color }}>⏰</span> {entity.time}
                </span>
              )}
              {entity.duration && (
                <span className="text-[10px] text-white/40 flex items-center gap-1">
                  <span style={{ color }}>⏱</span> {entity.duration}
                </span>
              )}
              {entity.rating && (
                <span className="text-[10px] font-semibold" style={{ color: '#FFD60A' }}>
                  ★ {entity.rating.toFixed(1)}
                </span>
              )}
              {/* Booked status */}
              <button
                onClick={(e) => { e.stopPropagation(); toggleEntityBooked(dayId, entity.id); }}
                className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full transition-all"
                style={entity.booked
                  ? { background: 'rgba(48,209,88,0.15)', color: '#30D158', border: '1px solid rgba(48,209,88,0.25)' }
                  : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.10)' }
                }
              >
                {entity.booked ? '✓ Booked' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>

        {/* Expand toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}
          className="w-full flex items-center justify-center py-1 border-t"
          style={{ borderColor: 'rgba(255,255,255,0.05)' }}
          onPointerDown={e => e.stopPropagation()}
        >
          <motion.span
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="text-white/25 text-xs"
          >
            ▾
          </motion.span>
        </button>

        {/* Expanded details — layout-morphing */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              key="details"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="overflow-hidden"
              onPointerDown={e => e.stopPropagation()}
            >
              <div className="px-3 pb-3 flex flex-col gap-2">
                {/* Details grid */}
                <div className="grid grid-cols-2 gap-1.5">
                  {Object.entries(entity.details).map(([k, v]) => (
                    <div key={k} className="rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <p className="text-[9px] text-white/35 uppercase tracking-wider mb-0.5">{k}</p>
                      <p className="text-[11px] text-white/75 font-medium">{String(v)}</p>
                    </div>
                  ))}
                </div>

                {/* Agentic actions */}
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => setShowAgentActions(v => !v)}
                    className="text-[10px] font-semibold px-2.5 py-1 rounded-full transition-all"
                    style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}
                  >
                    🤖 AI Actions
                  </button>
                  <button
                    onClick={() => removeEntityFromDay(dayId, entity.id)}
                    className="text-[10px] font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(255,107,107,0.10)', color: '#FF6B6B', border: '1px solid rgba(255,107,107,0.2)' }}
                  >
                    Remove
                  </button>
                </div>

                <AnimatePresence>
                  {showAgentActions && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      className="flex flex-col gap-1.5"
                    >
                      {[
                        '📧 Draft hotel late check-in email',
                        '🚕 Calculate taxi time to airport',
                        '📋 Add to packing list',
                        '💳 Send payment confirmation',
                      ].map((action) => (
                        <button
                          key={action}
                          className="text-left text-[11px] text-white/60 hover:text-white/90 px-2.5 py-1.5 rounded-lg transition-all"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                        >
                          {action}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCard>
    </motion.div>
  );
}
