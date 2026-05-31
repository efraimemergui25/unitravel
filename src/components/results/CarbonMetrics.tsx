'use client';

import { motion } from 'framer-motion';
import type { AggregatedFlight } from '@/services/OmniAggregator';

interface CarbonMetricsProps {
  flight:      AggregatedFlight;
  accentColor: string;
}

export function CarbonMetrics({ flight, accentColor }: CarbonMetricsProps) {
  // Derive kg CO2 from carbonLabel field or fall back to route estimate
  const kgCO2 = flight.carbonLabel.includes('kg')
    ? parseInt(flight.carbonLabel.match(/(\d+)/)?.[1] ?? '345', 10)
    : flight.carbonKg > 0
      ? flight.carbonKg
      : 345;

  const treesNeeded = Math.ceil(kgCO2 / 21); // ~21 kg CO2 absorbed per tree/year

  return (
    <div className="flex flex-col gap-3">
      <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[#AEAEB2]">
        Carbon Footprint
      </span>

      {/* CO2 display */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xl"
          style={{
            background: `${accentColor}10`,
            border:     `1px solid ${accentColor}20`,
          }}
        >
          🍃
        </div>
        <div>
          <p className="text-lg font-black text-[#1D1D1F]">{kgCO2} kg CO₂</p>
          <p className="text-[10px] text-[#6E6E73]">per 2 passengers · round trip</p>
        </div>
      </div>

      {/* Offset bar */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between items-center">
          <span className="text-[9px] text-[#AEAEB2]">Carbon offset</span>
          <span className="text-[9px] font-semibold" style={{ color: '#30D158' }}>
            ≈ {treesNeeded} trees · 1 yr
          </span>
        </div>
        <div className="h-2 rounded-full" style={{ background: 'rgba(0,0,0,0.06)' }}>
          <motion.div
            className="h-full rounded-full"
            style={{
              background: 'linear-gradient(90deg, #30D158, #00C7BE)',
              maxWidth:   '100%',
            }}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, (treesNeeded / 20) * 100)}%` }}
            transition={{ type: 'spring', stiffness: 250, damping: 28, delay: 0.4 }}
          />
        </div>
      </div>

      {/* Tree icons row */}
      <div className="flex gap-1 flex-wrap">
        {Array.from({ length: Math.min(treesNeeded, 12) }).map((_, i) => (
          <motion.span
            key={i}
            className="text-sm"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.5 + i * 0.04 }}
          >
            🌳
          </motion.span>
        ))}
        {treesNeeded > 12 && (
          <span className="text-[9px] text-[#AEAEB2] self-center">+{treesNeeded - 12} more</span>
        )}
      </div>
    </div>
  );
}
