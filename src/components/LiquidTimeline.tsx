'use client';

import { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { useDroppable } from '@dnd-kit/core';
import { GlassCard } from '@/components/ui/GlassCard';
import { TimelineEntity } from '@/components/DraggableEntity';
import { useTravelEngine, EngineDay, PlacedEntity } from '@/store/useTravelEngine';
import { AggregatedResult } from '@/services/OmniAggregator';
import type { BurnSchedule } from '@/utils/FinancialEngine';
import { useLocaleStore } from '@/store/useLocaleStore';
import { CalendarSyncButton } from '@/components/CalendarSyncButton';

const DEST_COLORS: Record<string, string> = {
  'Mexico City':    '#FF6B6B',
  'Tulum':          '#30D158',
  'Riviera Maya':   '#00C7BE',
  'Cabo San Lucas': '#FFD60A',
};

// ── Day budget arc ────────────────────────────────────────────────────────────
function DayBudgetArc({ spent, budget, color }: { spent: number; budget: number; color: string }) {
  const pct  = Math.min(spent / budget, 1);
  const over = spent > budget;
  const r = 18, cx = 22, cy = 22, circ = 2 * Math.PI * r;
  return (
    <svg width={44} height={44} viewBox="0 0 44 44" fill="none">
      <circle cx={cx} cy={cy} r={r} stroke="rgba(255,255,255,0.06)" strokeWidth={3} />
      <motion.circle
        cx={cx} cy={cy} r={r}
        stroke={over ? '#FF6B6B' : color} strokeWidth={3} strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ * (1 - pct) }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        style={{ transform: 'rotate(-90deg)', transformOrigin: `${cx}px ${cy}px`, filter: `drop-shadow(0 0 4px ${over ? '#FF6B6B' : color}60)` }}
      />
      <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
        fill={over ? '#FF6B6B' : 'rgba(255,255,255,0.6)'} fontSize={7} fontWeight={700}
        style={{ fontVariantNumeric: 'tabular-nums' }}>
        {over ? '!!' : `${Math.round(pct * 100)}%`}
      </text>
    </svg>
  );
}

// ── Day card ──────────────────────────────────────────────────────────────────
function DayCard({ day, isActive, onClick, dragging, burnSchedule }: {
  day:          EngineDay;
  isActive:     boolean;
  onClick:      () => void;
  dragging:     AggregatedResult | PlacedEntity | null;
  burnSchedule: BurnSchedule | null;
}) {
  const { placeEntity } = useTravelEngine();
  const { setNodeRef, isOver } = useDroppable({ id: day.id });
  const t      = useTranslations('Timeline');
  const tc     = useTranslations('Common');
  const locale = useLocaleStore(s => s.locale);

  const color      = DEST_COLORS[day.destination] || '#007AFF';
  const dayAllocation    = burnSchedule?.dailyAllocations.find(a => a.dayId === day.id);
  const isFutureDay      = day.entities.length === 0;
  const hasBurnWarning   = isFutureDay && dayAllocation?.isConstrained && burnSchedule && burnSchedule.severity !== 'none';
  const warnColor        = burnSchedule?.severity === 'critical' ? '#FF6B6B'
                         : burnSchedule?.severity === 'watch'    ? '#FFD60A'
                         : null;
  const effectiveTopBorderColor = (hasBurnWarning && warnColor) ? warnColor : color;
  const daySpent   = day.entities.reduce((s, e) => s + e.price, 0);
  const dateObj    = new Date(day.date + 'T00:00:00');
  const dayOfWeek  = dateObj.toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-US', { weekday: 'short' });
  const dateNum    = dateObj.getDate();
  const monthShort = dateObj.toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-US', { month: 'short' });
  const bookedPct  = day.entities.length > 0
    ? day.entities.filter(e => e.booked).length / day.entities.length
    : 0;

  void placeEntity;

  return (
    <motion.div
      className="flex-shrink-0 w-72 h-full"
      layout
      animate={{ scale: isActive ? 1 : 0.985, opacity: isActive ? 1 : 0.72 }}
      transition={{ type: 'spring', stiffness: 350, damping: 28 }}
    >
      <GlassCard
        variant={isActive ? 'strong' : 'default'}
        className="h-full flex flex-col"
        style={{
          borderBlockStart: `2px solid ${effectiveTopBorderColor}`,   /* logical: blockStart = top in both LTR and RTL */
          outline:       isOver ? `2px dashed rgba(0,122,255,0.5)` : 'none',
          outlineOffset: isOver ? 4 : 0,
          boxShadow: isOver
            ? `0 0 40px rgba(0,122,255,0.25), 0 8px 32px rgba(0,0,0,0.4)`
            : `0 4px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.07)`,
          minHeight: 0,
        }}
      >
        {hasBurnWarning && warnColor && (
          <motion.div
            className="absolute inset-0 pointer-events-none z-10"
            style={{ borderRadius: 'inherit', background: warnColor }}
            animate={{ opacity: [0, 0.06, 0] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut', delay: day.dayNumber * 0.15 }}
          />
        )}
        {/* Day header */}
        <button onClick={onClick} className="flex items-start gap-3 p-4 pb-2 w-full text-start flex-shrink-0">
          <div className="flex flex-col items-center justify-center rounded-xl flex-shrink-0"
            style={{ width: 48, height: 48, background: `${color}15`, border: `1px solid ${color}28`, boxShadow: `0 0 16px ${color}12` }}>
            <span className="text-[9px] font-black uppercase tracking-wider" style={{ color, lineHeight: 1 }}>{dayOfWeek}</span>
            <span className="text-xl font-black tabular-nums leading-tight text-white/90">{dateNum}</span>
            <span className="text-[8px] text-white/35 uppercase">{monthShort}</span>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-black uppercase tracking-widest mb-0.5" style={{ color }}>
              {tc('day', { number: day.dayNumber })}
            </p>
            <p className="text-sm font-black text-white/92">{day.destination}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <div className="flex-1 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.07)' }}>
                <motion.div className="h-full rounded-full"
                  style={{ background: color, boxShadow: `0 0 6px ${color}` }}
                  animate={{ width: `${bookedPct * 100}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <span className="text-[9px] text-white/30">{Math.round(bookedPct * 100)}%</span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            {day.weather && <span className="text-lg">{day.weather.icon}</span>}
            {day.weather && <span className="text-[10px] font-semibold text-white/60">{day.weather.temp}°</span>}
          </div>
        </button>

        {/* Budget bar */}
        <div className="flex items-center gap-3 px-4 pb-3 flex-shrink-0">
          <DayBudgetArc spent={daySpent} budget={day.budget} color={color} />
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-[9px] text-white/30 uppercase tracking-wider">{t('dailySpend')}</span>
              <span className="text-[10px] font-bold tabular-nums"
                style={{ color: daySpent > day.budget ? '#FF6B6B' : 'rgba(255,255,255,0.7)' }}>
                ${daySpent.toLocaleString()} / ${day.budget.toLocaleString()}
              </span>
            </div>
            <div className="h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <motion.div className="h-full rounded-full"
                style={{ background: daySpent > day.budget ? '#FF6B6B' : color }}
                animate={{ width: `${Math.min((daySpent / day.budget) * 100, 100)}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>
            {dayAllocation && dayAllocation.isConstrained && (
              <motion.p
                className="text-[9px] font-semibold mt-1"
                style={{ color: warnColor ?? '#FFD60A' }}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                ⚡ {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(dayAllocation.throttled)}/day
              </motion.p>
            )}
          </div>
        </div>

        {/* Drop zone */}
        <div ref={setNodeRef} className="flex-1 px-3 pb-3 flex flex-col gap-2 overflow-y-auto min-h-0">
          <AnimatePresence mode="popLayout">
            {day.entities.map((entity, i) => (
              <TimelineEntity key={entity.id} entity={entity} dayId={day.id} index={i} />
            ))}
          </AnimatePresence>
          <AnimatePresence>
            {dragging && isOver && (
              <motion.div key="drop-active"
                initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }}
                transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                className="flex items-center justify-center h-14 rounded-2xl"
                style={{ border: '2px dashed rgba(0,122,255,0.6)', background: 'rgba(0,122,255,0.06)' }}
              >
                <span className="text-xs font-bold" style={{ color: '#007AFF' }}>{t('drop')}</span>
              </motion.div>
            )}
            {!dragging && day.entities.length === 0 && (
              <motion.div key="empty"
                className="flex flex-col items-center justify-center h-16 rounded-2xl gap-1"
                style={{ border: '1px dashed rgba(255,255,255,0.08)' }}
              >
                <span className="text-lg" style={{ opacity: 0.25 }}>{day.weather?.icon || '📅'}</span>
                <span className="text-[10px] text-white/20">{t('empty')}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </GlassCard>
    </motion.div>
  );
}

// ── Main LiquidTimeline ───────────────────────────────────────────────────────
export function LiquidTimeline() {
  const { days, activeDay, setActiveDay, budget, dragging, trip, burnSchedule } = useTravelEngine();
  const { locale } = useLocaleStore();
  const scrollRef  = useRef<HTMLDivElement>(null);
  const t          = useTranslations('Budget');
  const tc         = useTranslations('Common');

  const destinations = Array.from(new Set(days.map(d => d.destination)));

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat(locale === 'he' ? 'he-IL' : 'en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

  return (
    <motion.div layout className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 flex-shrink-0"
        style={{ borderBlockEnd: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-3">
          <span className="text-base">💍</span>
          <div>
            <p className="text-sm font-black text-white/90">{trip.title}</p>
            <p className="text-[10px] text-white/35">{trip.startDate} → {trip.endDate} · {trip.nights} {tc('nights')}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Destination pills */}
          <div className="hidden lg:flex items-center gap-1.5">
            {destinations.map(dest => {
              const color    = DEST_COLORS[dest] || '#007AFF';
              const isActive = days.filter(d => d.destination === dest).some(d => d.id === activeDay);
              return (
                <motion.button key={dest}
                  onClick={() => { const fd = days.find(d => d.destination === dest); if (fd) setActiveDay(fd.id); }}
                  className="text-[10px] font-semibold px-2.5 py-1 rounded-full"
                  style={isActive
                    ? { background: `${color}20`, color, border: `1px solid ${color}35`, boxShadow: `0 0 12px ${color}20` }
                    : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.08)' }
                  }
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                >
                  {dest}
                </motion.button>
              );
            })}
          </div>

          {/* Budget pill */}
          <motion.div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full"
            style={{
              background: budget.overBudgetBy ? 'rgba(255,107,107,0.10)' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${budget.overBudgetBy ? 'rgba(255,107,107,0.25)' : 'rgba(255,255,255,0.10)'}`,
            }}
            animate={budget.overBudgetBy ? {
              boxShadow: ['0 0 0px rgba(255,107,107,0)', '0 0 16px rgba(255,107,107,0.3)', '0 0 0px rgba(255,107,107,0)'],
            } : {}}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <div className="h-1.5 w-16 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <motion.div className="h-full rounded-full"
                style={{ background: budget.overBudgetBy ? '#FF6B6B' : '#30D158', boxShadow: `0 0 6px ${budget.overBudgetBy ? '#FF6B6B' : '#30D158'}` }}
                animate={{ width: `${Math.min(budget.burnRate * 100, 100)}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <span className="text-[10px] font-bold tabular-nums text-white/70">
              {formatCurrency(budget.spent)} / {formatCurrency(budget.total)}
            </span>
          </motion.div>

          {/* Traveler avatars — uses logical negative margin */}
          <div className="flex items-center">
            {trip.travelers.map((name, i) => (
              <motion.div key={name}
                className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black"
                style={{
                  background: i === 0 ? 'linear-gradient(135deg,#007AFF,#5E5CE6)' : 'linear-gradient(135deg,#FF6B6B,#FFD60A)',
                  border: '2px solid #080B14',
                  marginInlineStart: i === 0 ? 0 : -8,  /* logical negative overlap */
                  zIndex: 2 - i,
                }}
                whileHover={{ scale: 1.2, zIndex: 10 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              >
                {name[0]}
              </motion.div>
            ))}
          </div>

          {/* Calendar sync */}
          <div className="relative">
            <CalendarSyncButton />
          </div>
        </div>
      </div>

      {/* Horizontal timeline */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-x-auto overflow-y-hidden"
        style={{ padding: '16px 20px', scrollSnapType: 'x mandatory' }}
      >
        <div className="flex gap-3 h-full" style={{ width: 'max-content', paddingInlineEnd: 24 }}>
          {days.map(day => (
            <div key={day.id} className="h-full" style={{ scrollSnapAlign: 'start' }}>
              <DayCard
                day={day} isActive={day.id === activeDay}
                onClick={() => setActiveDay(day.id)} dragging={dragging}
                burnSchedule={burnSchedule}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Over-budget projection bar */}
      <AnimatePresence>
        {budget.overBudgetBy && (
          <motion.div
            key="over-budget"
            initial={{ y: 48, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 48, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            className="flex items-center gap-3 px-6 py-2.5 flex-shrink-0"
            style={{ background: 'rgba(255,107,107,0.08)', borderBlockStart: '1px solid rgba(255,107,107,0.15)' }}
          >
            <span className="text-sm flex-shrink-0">⚠️</span>
            <p className="text-xs text-[#FF6B6B] font-medium flex-1">
              {t('overBudget', { amount: formatCurrency(budget.overBudgetBy) })}
              {budget.regressionSlope > 0 && (locale === 'he'
                ? ' ההוצאה היומית עולה — מומלץ להפחית.'
                : ' Daily spending is trending up — consider scaling back.'
              )}
            </p>
            <span className="text-[10px] text-white/30 flex-shrink-0">
              {t('adjustedAllowance', { amount: formatCurrency(budget.dailyAllowance) })}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
