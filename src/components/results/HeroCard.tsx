'use client';

import { useState, useCallback }              from 'react';
import { motion }                             from 'framer-motion';
import { useDraggable }                       from '@dnd-kit/core';
import { GlassCard }                          from '@/components/ui/GlassCard';
import type { AggregatedFlight, AggregatedResult } from '@/services/OmniAggregator';
import type { HeroDefinition }                from './SpatialResultMatrix';

// ── Props ──────────────────────────────────────────────────────────────────────

export interface HeroCardProps {
  hero:       HeroDefinition;
  onClick:    () => void;
  onStage:    (source: AggregatedResult) => void;
  style?:     React.CSSProperties;
  className?: string;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function MetricPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[8px] uppercase tracking-wider text-[#AEAEB2]">{label}</span>
      <span className="text-xs font-bold text-[#1D1D1F]">{value}</span>
    </div>
  );
}

// ── HeroCard ───────────────────────────────────────────────────────────────────

export function HeroCard({ hero, onClick, onStage, style, className = '' }: HeroCardProps) {
  const [hovered, setHovered] = useState(false);

  // Make only the drag handle draggable — clicking the card itself expands it
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id:   `hero-drag-${hero.result.id}`,
    data: { source: hero.result },
  });

  const handleDragHandleClick = useCallback(
    (e: React.MouseEvent) => e.stopPropagation(),
    [],
  );

  const stopsLabel = hero.result.stops === 0
    ? 'Nonstop'
    : `${hero.result.stops} stop`;

  return (
    <div
      className={`relative ${className}`}
      style={{ perspective: '1200px', ...style }}
    >
      {/* ── Peek-behind stack (up to 3 stacked ghost cards) ──────────────── */}
      {hero.secondary.slice(0, 3).map((_, i) => (
        <motion.div
          key={i}
          className="absolute inset-0 rounded-3xl pointer-events-none"
          style={{
            background:       'rgba(255,255,255,0.72)',
            backdropFilter:   'blur(48px)',
            WebkitBackdropFilter: 'blur(48px)',
            border:           '1px solid rgba(255,255,255,0.90)',
            zIndex:           -(i + 1),
            transformOrigin:  'center bottom',
          }}
          animate={{
            y:       hovered ? (i + 1) * 12 : (i + 1) * 3,
            scaleX:  1 - (i + 1) * 0.025,
            scaleY:  1 - (i + 1) * 0.01,
            opacity: hovered
              ? Math.max(0, 0.55 - i * 0.18)
              : Math.max(0, 0.28 - i * 0.08),
          }}
          transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        />
      ))}

      {/* ── Main hero card ────────────────────────────────────────────────── */}
      <motion.div
        layoutId={hero.layoutId}
        className="relative overflow-hidden rounded-3xl cursor-pointer h-full"
        style={{
          background:          'rgba(255,255,255,0.80)',
          backdropFilter:      'blur(48px)',
          WebkitBackdropFilter: 'blur(48px)',
          border:              '1px solid rgba(255,255,255,0.95)',
          transformStyle:      'preserve-3d',
          zIndex:              1,
          opacity:             isDragging ? 0.55 : 1,
        }}
        animate={{
          rotateX:   hovered ? -5 : 0,
          y:         hovered ? -8 : 0,
          boxShadow: hovered
            ? `0 28px 72px rgba(0,0,0,0.14), 0 8px 24px rgba(0,0,0,0.07), 0 0 0 1px ${hero.color}18`
            : `0 8px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.05), 0 0 0 1px rgba(255,255,255,0.9)`,
        }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        onHoverStart={() => setHovered(true)}
        onHoverEnd={()   => setHovered(false)}
        onClick={onClick}
      >
        {/* Colored top accent bar */}
        <div className="h-1 w-full" style={{ background: hero.gradient }} />

        {/* Specular highlight layer */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:   'linear-gradient(145deg, rgba(255,255,255,0.55) 0%, transparent 45%, transparent 55%, rgba(255,255,255,0.15) 100%)',
            borderRadius: 'inherit',
          }}
        />

        {/* Card body */}
        <div className="flex flex-col gap-3 p-5 h-full">

          {/* Category badge */}
          <div className="flex items-center gap-2">
            <span
              className="text-[9px] font-black uppercase tracking-[0.18em] px-2 py-1 rounded-full"
              style={{
                background: `${hero.color}12`,
                color:      hero.color,
                border:     `1px solid ${hero.color}25`,
              }}
            >
              {hero.label}
            </span>
            <span className="text-lg">{hero.icon}</span>
          </div>

          {/* Route + airline */}
          <div>
            <p className="text-xl font-black text-[#1D1D1F] leading-tight">
              {hero.result.airline}
            </p>
            <p className="text-sm text-[#6E6E73] mt-0.5">{hero.result.route}</p>
          </div>

          {/* Key metrics row */}
          <div className="flex items-center gap-3 flex-wrap">
            <MetricPill label="Duration" value={hero.result.durationLabel} color={hero.color} />
            <MetricPill label="Stops"    value={stopsLabel}                color={hero.color} />
            <MetricPill label="Class"    value={hero.result.class}         color={hero.color} />
          </div>

          {/* Sub-label */}
          <p className="text-xs text-[#6E6E73] flex-1">{hero.subLabel}</p>

          {/* Footer row — price + drag handle */}
          <div className="flex items-end justify-between mt-auto">
            <div>
              <p className="text-[10px] text-[#AEAEB2] uppercase tracking-wider">From</p>
              <p className="text-3xl font-black" style={{ color: hero.color }}>
                ${hero.result.price.toLocaleString()}
              </p>
            </div>

            {/* Drag handle — stopPropagation prevents triggering card expand */}
            <motion.div
              ref={setNodeRef}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl cursor-grab active:cursor-grabbing"
              style={{
                background:          'rgba(0,0,0,0.05)',
                backdropFilter:      'blur(8px)',
                border:              '1px solid rgba(0,0,0,0.06)',
              }}
              whileHover={{
                scale:       1.08,
                background:  `${hero.color}15`,
                borderColor: `${hero.color}30`,
              }}
              whileTap={{ scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 400, damping: 22 }}
              onClick={handleDragHandleClick}
              {...listeners}
              {...attributes}
            >
              <span className="text-[#6E6E73] text-sm select-none">⠿</span>
              <span className="text-[9px] font-bold text-[#6E6E73] uppercase tracking-wide select-none">
                Drag
              </span>
            </motion.div>
          </div>
        </div>

        {/* Peek counter badge (shown on hover) */}
        <motion.div
          className="absolute top-3 flex items-center gap-1 px-2 py-1 rounded-full"
          style={{
            insetInlineEnd:      12,
            background:          'rgba(255,255,255,0.85)',
            backdropFilter:      'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border:              '1px solid rgba(0,0,0,0.06)',
          }}
          animate={{ opacity: hovered ? 1 : 0, y: hovered ? 0 : -4 }}
          transition={{ duration: 0.2 }}
        >
          <span className="text-[9px] text-[#6E6E73]">
            +{hero.secondary.length} options below
          </span>
        </motion.div>
      </motion.div>
    </div>
  );
}
