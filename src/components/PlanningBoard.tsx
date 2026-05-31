'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDraggable } from '@dnd-kit/core';
import { usePlanningBoard, StagedEntity } from '@/store/usePlanningBoard';
import type { AggregatedResult, AggregatedFlight, AggregatedLodging, AggregatedDining } from '@/services/OmniAggregator';

const CATEGORY_ICON: Record<string, string> = {
  flight:     '✈️',
  hotel:      '🏨',
  restaurant: '🍽',
  activity:   '🎭',
  transport:  '🚗',
};

const CATEGORY_COLOR: Record<string, string> = {
  flight:     '#007AFF',
  hotel:      '#00C7BE',
  restaurant: '#FFD60A',
  activity:   '#30D158',
  transport:  '#5E5CE6',
};

function StagedCard({ entity, onRemove }: { entity: StagedEntity; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id:   entity.id,
    data: { source: entity.source },
  });

  const color = CATEGORY_COLOR[entity.source.category] ?? '#007AFF';
  const icon  = CATEGORY_ICON[entity.source.category]  ?? '📌';

  const src = entity.source;
  const title = src.category === 'flight'
    ? `${(src as AggregatedFlight).airline} · ${(src as AggregatedFlight).route}`
    : (src as AggregatedLodging | AggregatedDining).name;
  const price = src.category === 'flight'
    ? (src as AggregatedFlight).price
    : src.category === 'hotel'
      ? (src as AggregatedLodging).totalPrice
      : (src as AggregatedDining).pricePerPerson * 2;

  return (
    <motion.div
      ref={setNodeRef}
      layout
      initial={{ opacity: 0, x: -20, scale: 0.95 }}
      animate={{ opacity: isDragging ? 0.4 : 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -20, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      className="flex items-center gap-2.5 p-2.5 rounded-xl cursor-grab active:cursor-grabbing"
      style={{
        background:        'rgba(255,255,255,0.82)',
        border:            '1px solid rgba(255,255,255,0.9)',
        boxShadow:         '0 2px 8px rgba(0,0,0,0.06)',
        borderInlineStart: `3px solid ${color}`,
        touchAction:       'none',
      }}
      {...listeners}
      {...attributes}
    >
      <span className="text-base flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-[#1D1D1F] truncate">{title}</p>
        <p className="text-[10px] text-[#6E6E73]">${price.toLocaleString()}</p>
      </div>
      <motion.button
        className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px]"
        style={{ background: 'rgba(0,0,0,0.06)', color: '#6E6E73' }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        transition={{ duration: 0.15 }}
      >
        ✕
      </motion.button>
    </motion.div>
  );
}

export function PlanningBoard() {
  const { staged, removeFromBoard, clearBoard } = usePlanningBoard();
  const [collapsed, setCollapsed] = useState(false);

  // Only render when there are staged items
  if (staged.length === 0) return null;

  return (
    <motion.div
      className="fixed z-[80] flex flex-col"
      style={{
        insetBlockStart:  80,   // logical: top
        insetInlineStart: 16,   // logical: start-edge (left in LTR, right in RTL)
        width:            220,
      }}
      initial={{ x: -240, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -240, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
    >
      <div
        className="flex flex-col gap-2 rounded-2xl overflow-hidden"
        style={{
          background:           'rgba(245,245,247,0.92)',
          backdropFilter:       'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          border:               '1px solid rgba(255,255,255,0.90)',
          boxShadow:            '0 8px 40px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-3 py-2.5 cursor-pointer"
          style={{ borderBlockEnd: '1px solid rgba(0,0,0,0.05)' }}
          onClick={() => setCollapsed(c => !c)}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm">📋</span>
            <span className="text-xs font-black text-[#1D1D1F]">Planning Board</span>
            <span
              className="text-[9px] font-black px-1.5 py-0.5 rounded-full text-white"
              style={{ background: '#007AFF' }}
            >
              {staged.length}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <motion.button
              className="text-[9px] text-[#007AFF] font-semibold"
              whileTap={{ scale: 0.95 }}
              onClick={(e) => { e.stopPropagation(); clearBoard(); }}
            >
              Clear
            </motion.button>
            <motion.span
              className="text-[10px] text-[#AEAEB2]"
              animate={{ rotate: collapsed ? -90 : 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              ▾
            </motion.span>
          </div>
        </div>

        {/* Staged items */}
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 350, damping: 28 }}
              className="flex flex-col gap-1.5 px-2 pb-2"
            >
              <AnimatePresence mode="popLayout">
                {staged.map(entity => (
                  <StagedCard
                    key={entity.id}
                    entity={entity}
                    onRemove={() => removeFromBoard(entity.id)}
                  />
                ))}
              </AnimatePresence>
              <p className="text-[9px] text-[#AEAEB2] text-center pt-1">
                Drag to the timeline →
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
