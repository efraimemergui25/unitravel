'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { GlassCard } from '@/components/ui/GlassCard';
import { EntityCard } from './EntityCard';
import { DayPlan } from '@/types';
import { useTripStore } from '@/store/tripStore';

interface TimelineDayProps {
  day: DayPlan;
  isActive: boolean;
  onClick: () => void;
}

const DESTINATION_COLORS: Record<string, string> = {
  'Mexico City':   '#FF6B6B',
  'Tulum':         '#30D158',
  'Riviera Maya':  '#00C7BE',
  'Cabo San Lucas':'#FFD60A',
};

export function TimelineDay({ day, isActive, onClick }: TimelineDayProps) {
  const { draggingEntity } = useTripStore();
  const { setNodeRef, isOver } = useDroppable({ id: day.id });

  const dailyTotal = day.entities.reduce((sum, e) => sum + e.price, 0);
  const destColor  = DESTINATION_COLORS[day.destination] || '#007AFF';

  const dateObj   = new Date(day.date + 'T00:00:00');
  const dayLabel  = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
  const dateLabel = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const bookedCount = day.entities.filter(e => e.booked).length;
  const totalCount  = day.entities.length;

  return (
    <motion.div
      layout
      className="flex-shrink-0 w-72"
      animate={{
        scale: isActive ? 1 : 0.98,
        opacity: isActive ? 1 : 0.7,
      }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    >
      <GlassCard
        variant={isActive ? 'strong' : 'default'}
        glow={isOver ? 'blue' : 'none'}
        className="flex flex-col h-full"
        style={{
          borderTop: `2px solid ${destColor}`,
          minHeight: 280,
          outline: isOver ? `2px dashed rgba(0,122,255,0.6)` : 'none',
          outlineOffset: isOver ? 4 : 0,
          boxShadow: isOver
            ? `0 0 32px rgba(0,122,255,0.3), 0 8px 32px rgba(0,0,0,0.4)`
            : undefined,
        }}
      >
        {/* Day header */}
        <button
          onClick={onClick}
          className="flex items-start justify-between p-4 pb-3 w-full text-left"
        >
          <div className="flex items-start gap-3">
            {/* Day number badge */}
            <div
              className="flex flex-col items-center justify-center rounded-xl flex-shrink-0"
              style={{
                width: 44, height: 44,
                background: `${destColor}18`,
                border: `1px solid ${destColor}30`,
                boxShadow: `0 0 16px ${destColor}15`,
              }}
            >
              <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: destColor, lineHeight: 1 }}>{dayLabel}</span>
              <span className="text-lg font-bold tabular-nums leading-tight text-white/90">{dateObj.getDate()}</span>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: destColor }}>
                Day {day.dayNumber}
              </p>
              <p className="text-sm font-bold text-white/90">{day.destination}</p>
              <p className="text-[11px] text-white/40">{dateLabel}</p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            {/* Weather */}
            {day.weather && (
              <div className="flex items-center gap-1">
                <span className="text-base">{day.weather.icon}</span>
                <span className="text-xs font-semibold text-white/70">{day.weather.temp}°C</span>
              </div>
            )}
            {/* Booked progress */}
            <div className="flex items-center gap-1">
              <div className="h-1 w-16 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${totalCount > 0 ? (bookedCount / totalCount) * 100 : 0}%`,
                    background: destColor,
                    boxShadow: `0 0 6px ${destColor}`,
                  }}
                />
              </div>
              <span className="text-[9px] text-white/35">{bookedCount}/{totalCount}</span>
            </div>
          </div>
        </button>

        {/* Daily spend */}
        <div className="px-4 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-white/35 uppercase tracking-wider">Daily</span>
            <span className="text-xs font-bold tabular-nums text-white/75">
              ${dailyTotal.toLocaleString()}
            </span>
          </div>
          <div
            className="h-1 flex-1 mx-3 rounded-full overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{ background: dailyTotal > day.dailyBudget ? '#FF6B6B' : destColor }}
              animate={{ width: `${Math.min((dailyTotal / day.dailyBudget) * 100, 100)}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
          <span className="text-[10px] text-white/25">${day.dailyBudget.toLocaleString()}</span>
        </div>

        {/* Drop zone + entity list */}
        <div
          ref={setNodeRef}
          className="flex-1 px-3 pb-3 flex flex-col gap-2"
        >
          <SortableContext
            items={day.entities.map(e => e.id)}
            strategy={verticalListSortingStrategy}
          >
            <AnimatePresence mode="popLayout">
              {day.entities.map((entity, i) => (
                <EntityCard
                  key={entity.id}
                  entity={entity}
                  dayId={day.id}
                  index={i}
                />
              ))}
            </AnimatePresence>
          </SortableContext>

          {/* Drop hint */}
          <AnimatePresence>
            {draggingEntity && isOver && (
              <motion.div
                key="drop-hint"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className="flex items-center justify-center h-12 rounded-xl"
                style={{
                  border: '2px dashed rgba(0,122,255,0.5)',
                  background: 'rgba(0,122,255,0.06)',
                }}
              >
                <span className="text-xs text-brand-azure font-semibold">Drop here</span>
              </motion.div>
            )}
            {draggingEntity && !isOver && day.entities.length === 0 && (
              <motion.div
                key="empty-hint"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-center h-12 rounded-xl"
                style={{ border: '1px dashed rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.02)' }}
              >
                <span className="text-[11px] text-white/30">Drop to add</span>
              </motion.div>
            )}
          </AnimatePresence>

          {day.entities.length === 0 && !draggingEntity && (
            <div className="flex items-center justify-center h-16 rounded-xl"
              style={{ border: '1px dashed rgba(255,255,255,0.08)' }}>
              <span className="text-[11px] text-white/20">Drag items here from AI panel</span>
            </div>
          )}
        </div>
      </GlassCard>
    </motion.div>
  );
}
