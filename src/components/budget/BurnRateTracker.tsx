'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useTripStore } from '@/store/tripStore';
import { GlassCard } from '@/components/ui/GlassCard';
import { BudgetBadge } from '@/components/ui/BudgetBadge';

function ArcGauge({ rate, color }: { rate: number; color: string }) {
  const r = 54;
  const cx = 64, cy = 64;
  const startAngle = -210;
  const arcSpan   = 240;
  const endAngle  = startAngle + arcSpan * Math.min(rate, 1);

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const ptOnCircle = (deg: number) => ({
    x: cx + r * Math.cos(toRad(deg)),
    y: cy + r * Math.sin(toRad(deg)),
  });

  const buildArc = (from: number, to: number) => {
    const s = ptOnCircle(from);
    const e = ptOnCircle(to);
    const large = Math.abs(to - from) > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
  };

  const needle = ptOnCircle(endAngle);

  return (
    <svg width="128" height="128" viewBox="0 0 128 128" fill="none">
      {/* Track */}
      <path
        d={buildArc(startAngle, startAngle + arcSpan)}
        stroke="rgba(255,255,255,0.06)"
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
      />
      {/* Fill */}
      <motion.path
        d={buildArc(startAngle, endAngle)}
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
        style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
      />
      {/* Needle dot */}
      <motion.circle
        cx={needle.x}
        cy={needle.y}
        r="5"
        fill={color}
        style={{ filter: `drop-shadow(0 0 8px ${color})` }}
        animate={{ cx: needle.x, cy: needle.y }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      />
    </svg>
  );
}

export function BurnRateTracker() {
  const { totalBudget, budgetBreakdown, getBurnRate, days } = useTripStore();

  const totalSpent   = Object.values(budgetBreakdown).reduce((a, b) => a + b, 0);
  const burnRate     = getBurnRate();
  const remaining    = totalBudget - totalSpent;
  const isWarning    = burnRate >= 0.7;
  const isDanger     = burnRate >= 0.85;
  const gaugeColor   = isDanger ? '#FF6B6B' : isWarning ? '#FFD60A' : '#30D158';

  const categoryColors: Record<string, string> = {
    flights: '#007AFF', hotels: '#00C7BE', restaurants: '#FFD60A',
    activities: '#30D158', transport: '#5E5CE6',
  };

  const daysElapsed  = 7;
  const totalDays    = days.length;
  const projectedEnd = (totalSpent / daysElapsed) * totalDays;
  const overBudget   = projectedEnd > totalBudget;

  return (
    <GlassCard
      variant="strong"
      glow={isDanger ? 'coral' : isWarning ? 'gold' : 'teal'}
      className="p-5 flex flex-col gap-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-white/50 uppercase tracking-widest mb-0.5">Budget Burn Rate</p>
          <p className="text-sm font-semibold text-white/90">Effi & Nofar · Mexico 2026</p>
        </div>
        <AnimatePresence mode="wait">
          {isDanger ? (
            <motion.div
              key="danger"
              initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
              className="text-xs px-2 py-1 rounded-full font-semibold"
              style={{ background: 'rgba(255,107,107,0.15)', color: '#FF6B6B', border: '1px solid rgba(255,107,107,0.3)' }}
            >
              ⚠️ Critical
            </motion.div>
          ) : isWarning ? (
            <motion.div
              key="warning"
              initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
              className="text-xs px-2 py-1 rounded-full font-semibold"
              style={{ background: 'rgba(255,214,10,0.12)', color: '#FFD60A', border: '1px solid rgba(255,214,10,0.3)' }}
            >
              ⚡ Watch
            </motion.div>
          ) : (
            <motion.div
              key="ok"
              initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
              className="text-xs px-2 py-1 rounded-full font-semibold"
              style={{ background: 'rgba(48,209,88,0.12)', color: '#30D158', border: '1px solid rgba(48,209,88,0.3)' }}
            >
              ✓ On Track
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Arc gauge + main numbers */}
      <div className="flex items-center gap-4">
        <div className="relative flex-shrink-0">
          <ArcGauge rate={burnRate} color={gaugeColor} />
          <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ paddingTop: 8 }}>
            <span className="text-xl font-bold tabular-nums" style={{ color: gaugeColor }}>
              {Math.round(burnRate * 100)}%
            </span>
            <span className="text-[10px] text-white/40 uppercase tracking-wider">used</span>
          </div>
        </div>

        <div className="flex-1 flex flex-col gap-2">
          <div>
            <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Total Budget</p>
            <BudgetBadge amount={totalBudget} variant="default" size="sm" />
          </div>
          <div>
            <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Spent</p>
            <BudgetBadge
              amount={totalSpent}
              variant={isDanger ? 'danger' : isWarning ? 'warning' : 'default'}
              size="sm"
            />
          </div>
          <div>
            <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Remaining</p>
            <BudgetBadge amount={remaining} variant={remaining < 5000 ? 'warning' : 'success'} size="sm" />
          </div>
        </div>
      </div>

      {/* Projection warning */}
      {overBudget && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="rounded-xl p-3"
          style={{ background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.2)' }}
        >
          <p className="text-xs text-[#FF6B6B] font-medium">
            🔮 AI Projection: At current pace, trip will exceed budget by{' '}
            <strong>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(projectedEnd - totalBudget)}</strong>.
            Suggest reducing dinner budget tomorrow.
          </p>
        </motion.div>
      )}

      {/* Category breakdown bars */}
      <div className="flex flex-col gap-1.5">
        <p className="text-[10px] text-white/40 uppercase tracking-wider">Breakdown</p>
        {Object.entries(budgetBreakdown).map(([cat, amount]) => {
          const pct = totalBudget > 0 ? (amount / totalBudget) * 100 : 0;
          const color = categoryColors[cat] || '#fff';
          return (
            <div key={cat} className="flex items-center gap-2">
              <span className="text-[10px] text-white/50 w-20 capitalize">{cat}</span>
              <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: color, boxShadow: `0 0 8px ${color}60` }}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
                />
              </div>
              <span className="text-[10px] tabular-nums" style={{ color, width: 36, textAlign: 'right' }}>
                ${Math.round(amount / 1000)}k
              </span>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
