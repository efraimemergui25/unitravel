'use client';

import { useRef } from 'react';
import { motion } from 'framer-motion';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import { TimelineDay } from './TimelineDay';
import { GlassCard } from '@/components/ui/GlassCard';
import { CategoryIcon } from '@/components/ui/CategoryIcon';
import { useTripStore } from '@/store/tripStore';
import { TravelEntity } from '@/types';

function DragOverlayCard({ entity }: { entity: TravelEntity }) {
  const color = '#007AFF';
  return (
    <GlassCard
      variant="strong"
      glow="blue"
      className="w-64 p-3"
      style={{ rotate: '3deg', borderLeft: `2px solid ${color}` }}
    >
      <div className="flex items-center gap-3">
        <CategoryIcon category={entity.category} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white/90 truncate">{entity.title}</p>
          <p className="text-[10px] text-white/45 truncate">{entity.subtitle}</p>
        </div>
        <span className="text-xs font-bold" style={{ color }}>
          ${entity.price.toLocaleString()}
        </span>
      </div>
    </GlassCard>
  );
}

interface TimelineHeaderProps {
  title: string;
  travelers: string[];
  startDate: string;
  endDate: string;
  aiPanelOpen: boolean;
  onToggleAI: () => void;
}

function TimelineHeader({ title, travelers, startDate, endDate, aiPanelOpen, onToggleAI }: TimelineHeaderProps) {
  const start = new Date(startDate + 'T00:00:00');
  const end   = new Date(endDate   + 'T00:00:00');
  const nights = Math.round((end.getTime() - start.getTime()) / 86400000);

  return (
    <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center gap-4">
        {/* Logo mark */}
        <motion.div
          className="flex items-center gap-2"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        >
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #007AFF 0%, #00C7BE 100%)', boxShadow: '0 0 20px rgba(0,122,255,0.4)' }}>
            <span className="text-sm font-black text-white">U</span>
          </div>
          <span className="text-lg font-black" style={{
            background: 'linear-gradient(135deg, #007AFF 0%, #00C7BE 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            Unitravel
          </span>
        </motion.div>

        {/* Trip info pill */}
        <motion.div
          className="hidden md:flex items-center gap-3 px-3 py-1.5 rounded-full"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 400, damping: 30 }}
        >
          <span className="text-sm">💍</span>
          <span className="text-xs font-semibold text-white/80">{title}</span>
          <span className="text-[10px] text-white/35">·</span>
          <span className="text-[10px] text-white/45">{nights} nights · Mexico</span>
        </motion.div>
      </div>

      <div className="flex items-center gap-3">
        {/* Travelers */}
        <div className="flex items-center -space-x-2">
          {travelers.map((name, i) => (
            <motion.div
              key={name}
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
              style={{
                background: i === 0
                  ? 'linear-gradient(135deg, #007AFF, #5E5CE6)'
                  : 'linear-gradient(135deg, #FF6B6B, #FFD60A)',
                border: '2px solid #080B14',
                boxShadow: '0 0 12px rgba(0,122,255,0.3)',
                zIndex: 2 - i,
              }}
              whileHover={{ scale: 1.2, zIndex: 10 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              {name[0]}
            </motion.div>
          ))}
        </div>

        {/* AI Toggle */}
        <motion.button
          onClick={onToggleAI}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
          style={aiPanelOpen
            ? { background: 'rgba(94,92,230,0.2)', color: '#5E5CE6', border: '1px solid rgba(94,92,230,0.35)', boxShadow: '0 0 16px rgba(94,92,230,0.3)' }
            : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.10)' }
          }
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        >
          <span>✦</span>
          <span>AI Concierge</span>
        </motion.button>
      </div>
    </div>
  );
}

export function Timeline() {
  const {
    days, activeDay, title, travelers, startDate, endDate,
    setActiveDay, addEntityToDay, setDraggingEntity, draggingEntity,
    toggleAIPanel, aiPanelOpen,
  } = useTripStore();

  const scrollRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { entity } = event.active.data.current as { entity: TravelEntity; sourceDayId: string | null };
    setDraggingEntity(entity);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { over, active } = event;
    setDraggingEntity(null);

    if (!over) return;

    const { entity, sourceDayId } = active.data.current as { entity: TravelEntity; sourceDayId: string | null };
    const targetDayId = over.id as string;

    if (sourceDayId === targetDayId) return;

    addEntityToDay(targetDayId, { ...entity, id: `${entity.id}-${Date.now()}` });
    setActiveDay(targetDayId);
  };

  // Group days by destination
  const destinations = Array.from(new Set(days.map(d => d.destination)));

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TimelineHeader
        title={title}
        travelers={travelers}
        startDate={startDate}
        endDate={endDate}
        aiPanelOpen={aiPanelOpen}
        onToggleAI={toggleAIPanel}
      />

      {/* Destination tabs */}
      <div className="flex items-center gap-2 px-6 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        {destinations.map((dest) => {
          const destDays = days.filter(d => d.destination === dest);
          const isActive = destDays.some(d => d.id === activeDay);
          const DEST_COLORS: Record<string, string> = {
            'Mexico City': '#FF6B6B', 'Tulum': '#30D158',
            'Riviera Maya': '#00C7BE', 'Cabo San Lucas': '#FFD60A',
          };
          const color = DEST_COLORS[dest] || '#007AFF';
          return (
            <motion.button
              key={dest}
              onClick={() => setActiveDay(destDays[0].id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={isActive
                ? { background: `${color}20`, color, border: `1px solid ${color}40`, boxShadow: `0 0 12px ${color}25` }
                : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }
              }
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              <span>{destDays.length}d</span>
              <span>{dest}</span>
            </motion.button>
          );
        })}
      </div>

      {/* Main timeline scroll area */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div
          ref={scrollRef}
          className="flex-1 overflow-x-auto overflow-y-hidden"
          style={{ padding: '20px 24px', scrollSnapType: 'x mandatory' }}
        >
          <div className="flex gap-4 h-full" style={{ width: 'max-content', paddingRight: 320 }}>
            {days.map(day => (
              <div key={day.id} style={{ scrollSnapAlign: 'start' }}>
                <TimelineDay
                  day={day}
                  isActive={day.id === activeDay}
                  onClick={() => setActiveDay(day.id)}
                />
              </div>
            ))}
          </div>
        </div>

        <DragOverlay dropAnimation={{
          duration: 220,
          easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
        }}>
          {draggingEntity && <DragOverlayCard entity={draggingEntity} />}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
