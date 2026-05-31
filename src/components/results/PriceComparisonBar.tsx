'use client';

import { motion } from 'framer-motion';
import type { AggregatedFlight } from '@/services/OmniAggregator';

interface PriceComparisonBarProps {
  results:        AggregatedFlight[];
  highlight:      AggregatedFlight;
  highlightColor: string;
}

export function PriceComparisonBar({ results, highlight, highlightColor }: PriceComparisonBarProps) {
  const top5     = results.slice(0, 5);
  const minPrice = Math.min(...top5.map(r => r.price));

  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[#AEAEB2]">
        Price Comparison · Top {top5.length} Sources
      </span>
      {top5.map((result, i) => {
        const pct    = (minPrice / result.price) * 100;
        const isHero = result.id === highlight.id;
        return (
          <div key={result.id} className="flex items-center gap-3">
            {/* Source label */}
            <span
              className="text-[10px] font-semibold flex-shrink-0 text-end"
              style={{ width: 80, color: isHero ? highlightColor : '#6E6E73' }}
            >
              {result.airline.split(' ')[0]}
            </span>
            {/* Bar track */}
            <div className="flex-1 h-2.5 rounded-full" style={{ background: 'rgba(0,0,0,0.06)' }}>
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: isHero
                    ? `linear-gradient(90deg, ${highlightColor}CC, ${highlightColor})`
                    : 'rgba(0,0,0,0.14)',
                  boxShadow: isHero ? `0 0 8px ${highlightColor}40` : 'none',
                }}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ type: 'spring', stiffness: 300, damping: 28, delay: i * 0.07 }}
              />
            </div>
            {/* Price label */}
            <span
              className="text-[10px] font-black tabular-nums flex-shrink-0"
              style={{ width: 52, color: isHero ? highlightColor : '#1D1D1F' }}
            >
              ${result.price.toLocaleString()}
            </span>
          </div>
        );
      })}
    </div>
  );
}
