'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from '@/components/ui/GlassCard';
import type { AggregatedFlight } from '@/services/OmniAggregator';

export interface ComparisonMatrixProps {
  results:   AggregatedFlight[];
  isLoading: boolean;
}

type CategoryKey = 'fastest' | 'cheapest' | 'best-value' | 'lowest-carbon';

interface Category {
  key:   CategoryKey;
  label: string;
  icon:  string;
  color: string;
  pick:  (flights: AggregatedFlight[]) => AggregatedFlight | null;
}

function parseDurationMins(label: string): number {
  const h = parseInt(label.match(/(\d+)h/)?.[1] ?? '0');
  const m = parseInt(label.match(/(\d+)m/)?.[1] ?? '0');
  return h * 60 + m;
}

const CATEGORIES: Category[] = [
  {
    key:   'fastest',
    label: 'Fastest',
    icon:  '⚡',
    color: '#007AFF',
    pick:  (f) =>
      f.length === 0
        ? null
        : f.reduce((a, b) =>
            parseDurationMins(a.durationLabel) <= parseDurationMins(b.durationLabel) ? a : b
          ),
  },
  {
    key:   'cheapest',
    label: 'Cheapest',
    icon:  '💰',
    color: '#30D158',
    pick:  (f) =>
      f.length === 0 ? null : f.reduce((a, b) => (a.price <= b.price ? a : b)),
  },
  {
    key:   'best-value',
    label: 'Best Value',
    icon:  '✦',
    color: '#5E5CE6',
    pick:  (f) => {
      if (f.length === 0) return null;
      const maxP = Math.max(...f.map(x => x.price));
      return f.reduce((a, b) => {
        const sa = a.aiConfidence * 0.6 + (1 - a.price / maxP) * 0.4;
        const sb = b.aiConfidence * 0.6 + (1 - b.price / maxP) * 0.4;
        return sa >= sb ? a : b;
      });
    },
  },
  {
    key:   'lowest-carbon',
    label: 'Lowest Carbon',
    icon:  '🍃',
    color: '#00C7BE',
    pick:  (f) => {
      if (f.length === 0) return null;
      // Prefer nonstop + lower price as a carbon proxy
      const nonstop = f.filter(x => x.stops === 0);
      const pool = nonstop.length > 0 ? nonstop : f;
      return pool.reduce((a, b) => (a.price <= b.price ? a : b));
    },
  },
];

export function ComparisonMatrix({ results, isLoading }: ComparisonMatrixProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 mb-6" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        {CATEGORIES.map(cat => (
          <div key={cat.key} className="h-24 rounded-2xl shimmer-light" />
        ))}
      </div>
    );
  }

  if (results.length === 0) return null;

  return (
    <div className="flex flex-col gap-4 mb-6">
      <span className="text-xs font-black uppercase tracking-widest text-[#6E6E73]">
        AI Distillation
      </span>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        {CATEGORIES.map((cat, i) => {
          const winner = cat.pick(results);
          if (!winner) return null;
          const isExpanded = expandedId === `${cat.key}-${winner.id}`;

          return (
            <motion.div
              key={cat.key}
              layout
              layoutId={`comparison-${cat.key}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28, delay: i * 0.06 }}
            >
              <GlassCard
                variant="light"
                rounded="2xl"
                className="overflow-hidden cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : `${cat.key}-${winner.id}`)}
                whileHover={{ y: -2, boxShadow: `0 8px 32px rgba(0,0,0,0.10), 0 0 0 1px ${cat.color}20` }}
                transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              >
                {/* Compact view */}
                <div className="p-3 flex flex-col gap-1.5">
                  {/* Category badge */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">{cat.icon}</span>
                    <span
                      className="text-[9px] font-black uppercase tracking-widest"
                      style={{ color: cat.color }}
                    >
                      {cat.label}
                    </span>
                    <div
                      className="h-[1px] flex-1"
                      style={{ background: `${cat.color}25`, marginInlineStart: 4 }}
                    />
                  </div>

                  {/* Winner summary */}
                  <p className="text-sm font-black text-[#1D1D1F] leading-tight">{winner.airline}</p>
                  <p className="text-[10px] text-[#6E6E73]">{winner.route} · {winner.class}</p>
                  <div className="flex items-end justify-between mt-1">
                    <span className="text-xs text-[#6E6E73]">
                      {winner.durationLabel} · {winner.stops === 0 ? 'Nonstop' : `${winner.stops} stop`}
                    </span>
                    <span
                      className="text-base font-black"
                      style={{ color: cat.color }}
                    >
                      ${winner.price.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Expanded details */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      key="expanded"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                      className="flex flex-col gap-2"
                      style={{
                        paddingInlineStart:  12,
                        paddingInlineEnd:    12,
                        paddingBottom:       12,
                        borderBlockStart:    '1px solid rgba(0,0,0,0.05)',
                      }}
                    >
                      <div className="flex flex-col gap-1 pt-2">
                        <DetailRow label="Departure"  value={winner.departure} />
                        <DetailRow label="Carbon"     value={winner.carbonLabel} />
                        <DetailRow label="Seats left" value={String(winner.seats)} />
                        <DetailRow label="Refundable" value={winner.refundable ? '✓ Yes' : '✗ No'} />
                        <DetailRow label="AI score"   value={`${Math.round(winner.aiConfidence * 100)}%`} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </GlassCard>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[10px]">
      <span className="text-[#AEAEB2]">{label}</span>
      <span className="font-semibold text-[#1D1D1F]">{value}</span>
    </div>
  );
}
