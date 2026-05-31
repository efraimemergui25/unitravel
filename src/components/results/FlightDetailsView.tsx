'use client';

import { motion }          from 'framer-motion';
import { useDraggable }    from '@dnd-kit/core';
import { PriceComparisonBar } from './PriceComparisonBar';
import { BaggageVisualizer }  from './BaggageVisualizer';
import { CarbonMetrics }      from './CarbonMetrics';
import type { AggregatedFlight, AggregatedResult } from '@/services/OmniAggregator';
import type { HeroDefinition } from './SpatialResultMatrix';

interface FlightDetailsViewProps {
  hero:       HeroDefinition;
  allResults: AggregatedFlight[];
  onClose:    () => void;
  onStage:    (source: AggregatedResult) => void;
}

export function FlightDetailsView({ hero, allResults, onClose, onStage }: FlightDetailsViewProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id:   `details-drag-${hero.result.id}`,
    data: { source: hero.result },
  });

  const r = hero.result;

  return (
    <motion.div
      layoutId={hero.layoutId}
      className="overflow-hidden rounded-3xl"
      style={{
        background:           'rgba(255,255,255,0.88)',
        backdropFilter:       'blur(56px)',
        WebkitBackdropFilter: 'blur(56px)',
        border:               '1px solid rgba(255,255,255,0.95)',
        boxShadow:            '0 24px 72px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.07)',
      }}
      initial={false}
      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
    >
      {/* Gradient header bar */}
      <div className="h-1.5" style={{ background: hero.gradient }} />

      {/* Specular sheen */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:   'linear-gradient(145deg, rgba(255,255,255,0.45) 0%, transparent 35%)',
          borderRadius: 'inherit',
        }}
      />

      <div className="relative flex flex-col gap-0">
        {/* ── Top bar ─────────────────────────────────────────────────────── */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBlockEnd: '1px solid rgba(0,0,0,0.05)' }}
        >
          <div className="flex items-center gap-3">
            <motion.button
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
              style={{ background: 'rgba(0,0,0,0.05)', color: '#6E6E73' }}
              whileHover={{ scale: 1.04, background: 'rgba(0,0,0,0.08)' }}
              whileTap={{ scale: 0.97 }}
              onClick={onClose}
              transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            >
              ← Back
            </motion.button>
            <div className="flex items-center gap-2">
              <span className="text-lg">{hero.icon}</span>
              <span className="text-sm font-black text-[#1D1D1F]">{hero.label}</span>
            </div>
          </div>
          <div className="text-end">
            <p className="text-[10px] text-[#AEAEB2] uppercase tracking-wider">Total</p>
            <p className="text-2xl font-black" style={{ color: hero.color }}>
              ${r.price.toLocaleString()}
            </p>
          </div>
        </div>

        {/* ── Main content grid ───────────────────────────────────────────── */}
        <motion.div
          className="grid gap-6 p-6"
          style={{ gridTemplateColumns: '1fr 1fr' }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.35, ease: 'easeOut' }}
        >
          {/* Left column */}
          <div className="flex flex-col gap-6">
            {/* Flight summary card */}
            <div
              className="flex flex-col gap-3 p-4 rounded-2xl"
              style={{
                background: 'rgba(0,0,0,0.025)',
                border:     '1px solid rgba(0,0,0,0.05)',
              }}
            >
              <div className="flex items-center gap-3">
                <div className="text-2xl">✈️</div>
                <div>
                  <p className="text-base font-black text-[#1D1D1F]">{r.route}</p>
                  <p className="text-xs text-[#6E6E73]">{r.airline} · {r.class}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {(
                  [
                    { label: 'Departs',  val: r.departure },
                    { label: 'Duration', val: r.durationLabel },
                    { label: 'Stops',    val: r.stops === 0 ? 'Nonstop' : String(r.stops) },
                    { label: 'Seats',    val: String(r.seats) },
                    { label: 'Refund',   val: r.refundable ? '✓ Yes' : '✗ No' },
                  ] as const
                ).map(item => (
                  <div
                    key={item.label}
                    className="flex flex-col gap-0.5 px-3 py-2 rounded-xl"
                    style={{
                      background: 'rgba(255,255,255,0.8)',
                      border:     '1px solid rgba(0,0,0,0.05)',
                    }}
                  >
                    <span className="text-[8px] uppercase tracking-wider text-[#AEAEB2]">
                      {item.label}
                    </span>
                    <span className="text-xs font-bold text-[#1D1D1F]">{item.val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Baggage */}
            <BaggageVisualizer accentColor={hero.color} />
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-6">
            <PriceComparisonBar
              results={allResults}
              highlight={r}
              highlightColor={hero.color}
            />
            <CarbonMetrics flight={r} accentColor="#30D158" />
          </div>
        </motion.div>

        {/* ── Action bar ──────────────────────────────────────────────────── */}
        <motion.div
          className="flex items-center gap-3 px-6 pb-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          {/* Drag to timeline handle */}
          <motion.div
            ref={setNodeRef}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl cursor-grab active:cursor-grabbing flex-1"
            style={{
              background: hero.gradient,
              boxShadow:  `0 4px 20px ${hero.color}35`,
              opacity:    isDragging ? 0.5 : 1,
            }}
            whileHover={{ scale: 1.02, boxShadow: `0 8px 32px ${hero.color}45` }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 24 }}
            {...listeners}
            {...attributes}
          >
            <span className="text-white text-base select-none">⠿</span>
            <span className="text-white text-xs font-black uppercase tracking-wide select-none">
              Drag to Timeline
            </span>
          </motion.div>

          {/* Stage button */}
          <motion.button
            className="flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-bold"
            style={{
              background: 'rgba(0,0,0,0.05)',
              border:     '1px solid rgba(0,0,0,0.08)',
              color:      '#1D1D1F',
            }}
            whileHover={{ scale: 1.02, background: 'rgba(0,0,0,0.08)' }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onStage(r)}
            transition={{ type: 'spring', stiffness: 400, damping: 24 }}
          >
            <span>+ Stage</span>
          </motion.button>
        </motion.div>
      </div>
    </motion.div>
  );
}
