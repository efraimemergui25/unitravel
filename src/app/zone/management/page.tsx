'use client';

import { useState, useCallback, useEffect, Suspense } from 'react';
import { motion, AnimatePresence }  from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { LiquidTimeline }           from '@/components/management/LiquidTimeline';
import { OmniLedger }               from '@/components/management/OmniLedger';
import { useTravelEngine }          from '@/store/useTravelEngine';
import type { EntityCategory, EngineDay, PlacedEntity } from '@/store/useTravelEngine';
import {
  CalendarDays, Wallet, Clock3, CheckSquare,
  Plus, Sparkles, Calendar, TrendingUp,
  Plane, Hotel, UtensilsCrossed, Compass, Train, X,
  Target, Zap, Clipboard, Keyboard, Package,
} from 'lucide-react';
import { TripActionsBar }  from '@/components/export/TripActionsBar';
import { useToast }        from '@/components/ui/Toast';
import { BookingImport }    from '@/components/BookingImport';
import { DreamZone }        from '@/components/management/DreamZone';
import { CommandPalette }        from '@/components/management/CommandPalette';
import { TripHealthPanel }       from '@/components/management/TripHealthPanel';
import { TemporalFlowNavigator } from '@/components/management/TemporalFlowNavigator';
import { TripHealthScore }       from '@/components/TripHealthScore';
import { PackingList }           from '@/components/management/PackingList';
import { BookingConfetti }       from '@/components/ui/SemanticEffects';

// ── Design tokens ─────────────────────────────────────────────────────────────

const SPRING   = { type: 'spring', stiffness: 380, damping: 28 } as const;
const AZURE    = '#007AFF';
const EMERALD  = '#30D158';
const AMBER    = '#FF9F0A';
const RED      = '#FF453A';
const VIOLET   = '#5E5CE6';

// ── Tab config ────────────────────────────────────────────────────────────────

type Tab = 'timeline' | 'budget' | 'calendar' | 'checklist' | 'schedule' | 'dream' | 'pack';

const TABS: Array<{
  id: Tab; label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
  color: string;
}> = [
  { id: 'timeline',  label: 'Timeline',  icon: CalendarDays, color: '#007AFF' },
  { id: 'schedule',  label: 'Schedule',  icon: Clock3,       color: '#FF9F0A' },
  { id: 'budget',    label: 'Budget',    icon: Wallet,       color: '#30D158' },
  { id: 'calendar',  label: 'Calendar',  icon: Calendar,     color: '#BF5AF2' },
  { id: 'checklist', label: 'Checklist', icon: CheckSquare,  color: '#5E5CE6' },
  { id: 'pack',      label: 'Pack',      icon: Package,      color: '#BF5AF2' },
  { id: 'dream',     label: 'Dream',     icon: Sparkles,     color: '#8B5CF6' },
];

// ── Live clock ────────────────────────────────────────────────────────────────

function LiveClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);
  return <span style={{ fontSize: 10, fontWeight: 700, color: '#8E8E93', fontVariantNumeric: 'tabular-nums' }}>{time}</span>;
}

// ── Live countdown (days to trip) ─────────────────────────────────────────────

function useLiveCountdown(startDate: string | null) {
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!startDate) return;
    const update = () => {
      const ms = new Date(startDate).getTime() - Date.now();
      setDaysLeft(Math.max(0, Math.ceil(ms / 86_400_000)));
    };
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [startDate]);
  return daysLeft;
}

// ── Animated budget ring ───────────────────────────────────────────────────────

function BudgetRing({ pct, color, size = 52 }: { pct: number; color: string; size?: number }) {
  const R    = (size - 6) / 2;
  const circ = 2 * Math.PI * R;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={R} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth={6} />
        <motion.circle
          cx={size/2} cy={size/2} r={R} fill="none"
          stroke={color} strokeWidth={6} strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ * (1 - Math.min(1, pct)) }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 900, color, letterSpacing: '-0.04em' }}>{Math.round(pct * 100)}%</span>
      </div>
    </div>
  );
}

// ── SVG Donut chart ───────────────────────────────────────────────────────────

function DonutChart({ breakdown, total }: { breakdown: Record<string, number>; total: number }) {
  const cats   = Object.keys(CAT_COLORS) as Array<keyof typeof CAT_COLORS>;
  const size   = 120;
  const stroke = 18;
  const r      = (size - stroke) / 2;
  const circ   = 2 * Math.PI * r;
  const cx = size / 2, cy = size / 2;

  const spent = cats.reduce((s, c) => s + (breakdown[c] ?? 0), 0);

  let offset = 0;
  const segments = cats.map(cat => {
    const val  = breakdown[cat] ?? 0;
    const pct  = total > 0 ? val / total : 0;
    const dash = pct * circ;
    const gap  = circ - dash;
    const seg  = { cat, val, pct, dash, gap, offset };
    offset += dash;
    return seg;
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      {/* SVG */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          {/* Track */}
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth={stroke} />
          {/* Segments */}
          {segments.map(({ cat, dash, gap, offset: off }) => dash > 0 && (
            <circle
              key={cat}
              cx={cx} cy={cy} r={r} fill="none"
              stroke={CAT_COLORS[cat as keyof typeof CAT_COLORS]}
              strokeWidth={stroke}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-off}
              strokeLinecap="butt"
              style={{ transition: 'stroke-dasharray 0.8s ease' }}
            />
          ))}
        </svg>
        {/* Center label */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 13, fontWeight: 900, color: '#1D1D1F', letterSpacing: '-0.04em', lineHeight: 1 }}>
            ${Math.round(spent / 1000) > 0 ? `${(spent/1000).toFixed(1)}k` : spent.toLocaleString()}
          </span>
          <span style={{ fontSize: 9, fontWeight: 600, color: '#AEAEB2', marginTop: 2 }}>spent</span>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
        {cats.map(cat => {
          const val  = breakdown[cat] ?? 0;
          const Icon = CAT_ICONS[cat as keyof typeof CAT_ICONS];
          const pct  = total > 0 ? Math.round((val / total) * 100) : 0;
          return (
            <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: CAT_COLORS[cat as keyof typeof CAT_COLORS],
              }} />
              <Icon size={10} color={CAT_COLORS[cat as keyof typeof CAT_COLORS]} strokeWidth={2} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: '#3C3C43', fontWeight: 500, flex: 1, letterSpacing: '-0.01em' }}>
                {CAT_LABELS[cat as keyof typeof CAT_LABELS]}
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#1D1D1F', letterSpacing: '-0.02em' }}>
                {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Daily budget sparkline ────────────────────────────────────────────────────

function DailyBudgetBars() {
  const budget = useTravelEngine(s => s.budget);
  const days   = useTravelEngine(s => s.days);

  if (days.length < 2) return null;

  const dailyBudget = budget.total / Math.max(1, days.length);
  const breakdown   = budget.dayBreakdown;

  const values = days.map((_, i) => {
    const dd = breakdown[i];
    return { projected: dailyBudget, actual: dd?.spent ?? 0 };
  });

  const maxVal = Math.max(dailyBudget * 1.6, ...values.map(v => v.actual), 1);
  const W = 280, H = 40;
  const gapPx = 3;
  const barW  = Math.max(2, (W - gapPx * (values.length - 1)) / values.length);

  return (
    <div style={{
      borderRadius: 16, padding: '13px 15px',
      background: 'rgba(255,255,255,0.72)',
      border: '1px solid rgba(255,255,255,0.92)',
      boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
      marginBottom: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.025em' }}>Daily Budget</span>
        <span style={{ fontSize: 10, color: '#6E6E73', fontWeight: 500 }}>
          ~${Math.round(dailyBudget).toLocaleString()}/day
        </span>
      </div>

      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible', display: 'block' }}>
        {/* Budget threshold dashes */}
        <line
          x1={0} y1={H - (dailyBudget / maxVal) * H}
          x2={W} y2={H - (dailyBudget / maxVal) * H}
          stroke="rgba(0,122,255,0.22)" strokeWidth={1}
          strokeDasharray="4 3"
        />
        {values.map((v, i) => {
          const x        = i * (barW + gapPx);
          const projH    = (v.projected / maxVal) * H;
          const actualH  = (v.actual   / maxVal) * H;
          const isOver   = v.actual > v.projected && v.actual > 0;
          const hasActual = v.actual > 0;
          return (
            <g key={i}>
              {/* Planned bar (light) */}
              <motion.rect
                x={x} y={H - projH} width={barW} height={projH} rx={2}
                fill="rgba(0,122,255,0.09)"
                initial={{ height: 0, y: H }} animate={{ height: projH, y: H - projH }}
                transition={{ duration: 0.8, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
              />
              {/* Actual bar */}
              {hasActual && (
                <motion.rect
                  x={x} y={H - actualH} width={barW} height={actualH} rx={2}
                  fill={isOver ? '#FF453A' : AZURE} opacity={0.65}
                  initial={{ height: 0, y: H }} animate={{ height: actualH, y: H - actualH }}
                  transition={{ duration: 0.7, delay: i * 0.04 + 0.1, ease: [0.22, 1, 0.36, 1] }}
                />
              )}
            </g>
          );
        })}
      </svg>

      <div style={{ display: 'flex', gap: 12, marginTop: 7 }}>
        {[
          { color: 'rgba(0,122,255,0.20)', label: 'Allocated' },
          { color: AZURE,                  label: 'Spent'     },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 10, height: 4, borderRadius: 2, background: l.color }} />
            <span style={{ fontSize: 9.5, color: '#6E6E73', fontWeight: 500 }}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── AI Gap Filler ─────────────────────────────────────────────────────────────

const GAP_FILLER_LS_KEY = 'unitravel:gapfiller:dismissed';

function AIGapFiller() {
  const days   = useTravelEngine(s => s.days);
  const router = useRouter();
  // Fix hydration: read localStorage after mount
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    setDismissed(localStorage.getItem(GAP_FILLER_LS_KEY) === '1');
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
    localStorage.setItem(GAP_FILLER_LS_KEY, '1');
  }, []);

  if (dismissed || days.length === 0) return null;

  const gaps = days.filter(d => {
    if (d.entities.length === 0) return false;
    const cats = new Set(d.entities.map(e => e.category));
    return !cats.has('hotel') && !cats.has('flight');
  });

  if (gaps.length === 0) return null;

  const handleFillGaps = () => {
    // Store the gap prompt in sessionStorage so ConciergePanel picks it up
    const dayLabels = gaps.slice(0, 5).map(d => `Day ${d.dayNumber} (${d.destination || 'TBD'})`).join(', ');
    const prompt = `Find hotels for ${dayLabels}. Suggest the best options for each day within my budget.`;
    sessionStorage.setItem('unitravel-ai-prompt', prompt);
    // Navigate to lodging zone where AI can act on the request
    router.push('/zone/lodging');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      style={{
        marginBottom:   10,
        padding:        '10px 14px',
        borderRadius:   16,
        background:     'linear-gradient(135deg, rgba(94,92,230,0.07) 0%, rgba(0,122,255,0.05) 100%)',
        border:         '1px solid rgba(94,92,230,0.18)',
        boxShadow:      '0 3px 12px rgba(94,92,230,0.10), inset 0 1px 0 rgba(255,255,255,0.90)',
        position:       'relative',
        overflow:       'hidden',
      }}
    >
      {/* Corner shimmer */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(128deg, rgba(255,255,255,0.16) 0%, transparent 40%)',
        pointerEvents: 'none',
      }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 9, flexShrink: 0,
          background: 'rgba(94,92,230,0.12)', border: '1px solid rgba(94,92,230,0.22)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Sparkles size={13} color="#5E5CE6" strokeWidth={2} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#5E5CE6', letterSpacing: '-0.015em' }}>
            AI Gap Filler — {gaps.length} day{gaps.length !== 1 ? 's' : ''} without accommodation
          </div>
          <div style={{ fontSize: 10, color: '#6E6E73', marginTop: 2, letterSpacing: '-0.01em' }}>
            {gaps.slice(0,3).map(d => `Day ${d.dayNumber}`).join(', ')}{gaps.length > 3 ? ` +${gaps.length - 3} more` : ''} · Ask AI to suggest hotels
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <motion.button
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={handleFillGaps}
            style={{
              fontSize: 10, fontWeight: 700, color: '#5E5CE6',
              background: 'rgba(94,92,230,0.10)', border: '1px solid rgba(94,92,230,0.22)',
              borderRadius: 100, padding: '4px 11px', cursor: 'pointer', fontFamily: 'inherit',
              letterSpacing: '-0.01em',
            }}
          >
            Fill gaps →
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            onClick={dismiss}
            style={{
              width: 22, height: 22, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: 'rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={10} color="#8E8E93" strokeWidth={2.5} />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Budget breakdown ──────────────────────────────────────────────────────────

const CAT_ICONS = { flight: Plane, hotel: Hotel, restaurant: UtensilsCrossed, activity: Compass, transport: Train };
const CAT_COLORS = { flight: '#007AFF', hotel: '#5AC8FA', restaurant: '#FF9F0A', activity: '#30D158', transport: '#BF5AF2' };
const CAT_LABELS = { flight: 'Flights', hotel: 'Stays', restaurant: 'Dining', activity: 'Experiences', transport: 'Transit' };

function AddExpenseModal({ onClose }: { onClose: () => void }) {
  const days              = useTravelEngine(s => s.days);
  const addManualExpense  = useTravelEngine(s => s.addManualExpense);
  const { success }       = useToast();
  const [title,    setTitle]    = useState('');
  const [amount,   setAmount]   = useState('');
  const [cat,      setCat]      = useState<EntityCategory>('activity');
  const [note,     setNote]     = useState('');
  const [dayId,    setDayId]    = useState(days[0]?.id ?? '');

  const save = () => {
    const n = parseFloat(amount);
    if (!title.trim() || isNaN(n) || n <= 0) return;
    addManualExpense((dayId || days[0]?.id) ?? 'day-1', title.trim(), n, cat, note.trim() || undefined);
    success(`Expense added — $${n.toFixed(0)} for ${title.trim()}`);
    onClose();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.18)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <motion.div initial={{ scale: 0.94, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94, y: 20 }}
        onClick={e => e.stopPropagation()}
        style={{ width: 360, borderRadius: 24, padding: '24px', background: 'rgba(255,255,255,0.96)', border: '1px solid rgba(255,255,255,0.95)', boxShadow: '0 20px 60px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,1)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.025em' }}>Add Expense</span>
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={onClose}
            style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(0,0,0,0.07)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={12} strokeWidth={2.5} color="#6E6E73" />
          </motion.button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Description (e.g. Museum entry)"
            style={{ padding: '10px 13px', borderRadius: 12, border: '1.5px solid rgba(0,0,0,0.10)', background: 'rgba(0,0,0,0.03)', fontSize: 13, fontFamily: 'inherit', outline: 'none', fontWeight: 600, color: '#1D1D1F' }} />

          <div style={{ display: 'flex', gap: 9 }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 7, padding: '10px 13px', borderRadius: 12, border: '1.5px solid rgba(0,122,255,0.22)', background: 'rgba(0,122,255,0.04)' }}>
              <span style={{ fontSize: 15, fontWeight: 900, color: AZURE }}>$</span>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00"
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 18, fontWeight: 800, color: '#1D1D1F', fontFamily: 'inherit', width: 0 }} />
            </div>
            {days.length > 1 && (
              <select value={dayId} onChange={e => setDayId(e.target.value)}
                style={{ padding: '0 10px', borderRadius: 12, border: '1.5px solid rgba(0,0,0,0.10)', background: 'rgba(0,0,0,0.03)', fontSize: 11.5, fontWeight: 700, color: '#1D1D1F', fontFamily: 'inherit', cursor: 'pointer' }}>
                {days.map(d => <option key={d.id} value={d.id}>Day {d.dayNumber}</option>)}
              </select>
            )}
          </div>

          <select value={cat} onChange={e => setCat(e.target.value as EntityCategory)}
            style={{ padding: '10px 13px', borderRadius: 12, border: '1.5px solid rgba(0,0,0,0.10)', background: 'rgba(0,0,0,0.03)', fontSize: 13, fontWeight: 600, color: '#1D1D1F', fontFamily: 'inherit', cursor: 'pointer' }}>
            <option value="flight">Flights</option>
            <option value="hotel">Stays</option>
            <option value="restaurant">Dining</option>
            <option value="activity">Experiences</option>
            <option value="transport">Transport</option>
          </select>

          <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional)"
            style={{ padding: '10px 13px', borderRadius: 12, border: '1.5px solid rgba(0,0,0,0.08)', background: 'rgba(0,0,0,0.03)', fontSize: 12.5, fontFamily: 'inherit', outline: 'none', color: '#3C3C43' }} />

          <motion.button whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.98 }} onClick={save}
            style={{ padding: '12px', borderRadius: 14, background: AZURE, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 800, color: '#fff', boxShadow: '0 4px 16px rgba(0,122,255,0.35)', marginTop: 4 }}>
            Add Expense
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function BudgetTab() {
  const budget           = useTravelEngine(s => s.budget);
  const trip             = useTravelEngine(s => s.trip);
  const days             = useTravelEngine(s => s.days);
  const calcBudget       = useTravelEngine(s => s.calculatePredictiveBudget);
  const [showAdd,        setShowAdd]        = useState(false);
  const [showAllCats,    setShowAllCats]    = useState(false);

  const pct     = budget.total > 0 ? Math.min(100, (budget.spent / budget.total) * 100) : 0;
  const remaining = Math.max(0, budget.total - budget.spent);
  const isOverBudget = budget.spent > budget.total && budget.total > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 0 24px' }}>

      {/* Expense modal */}
      <AnimatePresence>{showAdd && <AddExpenseModal onClose={() => { setShowAdd(false); calcBudget(); }} />}</AnimatePresence>

      {/* No-budget hint */}
      {budget.total === 0 && (
        <motion.div
          initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          style={{ padding: '10px 14px', borderRadius: 14, background: 'rgba(48,209,88,0.07)', border: '1px solid rgba(48,209,88,0.20)', display: 'flex', alignItems: 'center', gap: 10 }}
        >
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#30D158', flexShrink: 0 }} />
          <div style={{ fontSize: 11, color: '#1D1D1F', letterSpacing: '-0.01em' }}>
            <strong>No budget set.</strong> Complete the trip setup wizard to set a budget, then track expenses here.
          </div>
        </motion.div>
      )}

      {/* Total budget card */}
      <div style={{
        borderRadius: 18, padding: '20px',
        background: isOverBudget
          ? 'rgba(255,69,58,0.06)'
          : 'linear-gradient(135deg, rgba(0,122,255,0.08) 0%, rgba(94,92,230,0.06) 100%)',
        border: `1px solid ${isOverBudget ? 'rgba(255,69,58,0.20)' : 'rgba(0,122,255,0.16)'}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#6E6E73', letterSpacing: '-0.01em', marginBottom: 4 }}>
              Total Budget
            </div>
            <div style={{ fontSize: 34, fontWeight: 900, color: '#1D1D1F', letterSpacing: '-0.04em', lineHeight: 1 }}>
              ${budget.total.toLocaleString()}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: '#6E6E73', fontWeight: 500 }}>Remaining</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: isOverBudget ? '#FF453A' : '#30D158', letterSpacing: '-0.03em' }}>
              ${remaining.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Velocity HUD — shows spend rate vs ideal */}
        {(() => {
          const totalDays  = trip.nights ?? days.length ?? 7;
          const daysPassed = Math.max(1, Math.round((Date.now() - new Date(trip.startDate ?? Date.now()).getTime()) / 86400000));
          const idealPct   = budget.total > 0 ? Math.min(100, (daysPassed / Math.max(1, totalDays)) * 100) : 0;
          const burnColor  = isOverBudget ? '#FF453A' : pct > idealPct + 20 ? '#FF9F0A' : pct > 80 ? '#FF9F0A' : '#30D158';
          const velocity   = budget.burnRate > 0 && budget.total > 0
            ? (budget.burnRate / (budget.total / Math.max(1, totalDays)))
            : 1;

          return (
            <>
              {/* Dual-layer progress bar: ideal vs actual */}
              <div style={{ height: 8, borderRadius: 100, background: 'rgba(0,0,0,0.06)', overflow: 'visible', position: 'relative', marginBottom: 8 }}>
                {/* Ideal pace line */}
                {idealPct > 0 && (
                  <div style={{
                    position: 'absolute', top: -4, bottom: -4,
                    left: `${Math.min(99, idealPct)}%`, width: 2,
                    background: 'rgba(0,0,0,0.25)', borderRadius: 1,
                    zIndex: 2,
                  }} />
                )}
                {/* Actual spend bar */}
                <motion.div
                  initial={{ width: '0%' }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                  style={{
                    height: '100%', borderRadius: 100, position: 'relative', willChange: 'width',
                    background: isOverBudget ? '#FF453A' : pct > 80 ? 'linear-gradient(90deg, #FF9F0A, #FF453A)' : `linear-gradient(90deg, #007AFF, ${burnColor})`,
                  }}
                >
                  {/* Animated pulse at the tip when actively spending */}
                  {pct > 0 && pct < 100 && (
                    <motion.div
                      animate={{ opacity: [0.6, 1, 0.6], scale: [1, 1.8, 1] }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                      style={{
                        position: 'absolute', right: -3, top: '50%', transform: 'translateY(-50%)',
                        width: 8, height: 8, borderRadius: '50%', background: burnColor,
                        boxShadow: `0 0 8px ${burnColor}`,
                      }}
                    />
                  )}
                </motion.div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: '#6E6E73' }}>Spent ${(budget.spent || 0).toLocaleString()}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {/* Velocity badge */}
                  {velocity > 0 && budget.total > 0 && (
                    <span style={{
                      fontSize: 9.5, fontWeight: 800, letterSpacing: '-0.01em',
                      color: velocity > 1.25 ? '#FF453A' : velocity > 1.05 ? '#FF9F0A' : '#30D158',
                      background: velocity > 1.25 ? 'rgba(255,69,58,0.10)' : velocity > 1.05 ? 'rgba(255,159,10,0.10)' : 'rgba(48,209,88,0.10)',
                      border: `1px solid ${velocity > 1.25 ? 'rgba(255,69,58,0.25)' : velocity > 1.05 ? 'rgba(255,159,10,0.25)' : 'rgba(48,209,88,0.25)'}`,
                      borderRadius: 100, padding: '2px 7px',
                    }}>
                      {velocity > 1.25 ? '🔥 Fast burn' : velocity > 1.05 ? '↑ Above pace' : '✓ On pace'}
                    </span>
                  )}
                  <span style={{ fontSize: 10, fontWeight: 700, color: isOverBudget ? '#FF453A' : '#6E6E73' }}>{Math.round(pct)}%</span>
                </div>
              </div>
            </>
          );
        })()}
      </div>

      {/* Daily budget bars */}
      <DailyBudgetBars />

      {/* Hotel-gap health warning */}
      {days.length > 0 && (() => {
        const noHotelDays = days.filter(d =>
          d.entities.length > 0 && !d.entities.some(e => e.category === 'hotel')
        ).length;
        if (noHotelDays === 0) return null;
        return (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              display: 'flex', alignItems: 'center', gap: 9,
              padding: '9px 13px', borderRadius: 14,
              background: 'rgba(255,159,10,0.07)',
              border: '1px solid rgba(255,159,10,0.24)',
            }}
          >
            <Hotel size={13} color="#FF9F0A" strokeWidth={2} />
            <span style={{ fontSize: 11, fontWeight: 600, color: '#1D1D1F', letterSpacing: '-0.01em', flex: 1 }}>
              <span style={{ fontWeight: 800, color: '#FF9F0A' }}>{noHotelDays} day{noHotelDays !== 1 ? 's' : ''}</span> without accommodation — budget may be incomplete
            </span>
          </motion.div>
        );
      })()}

      {/* Add expense button */}
      <motion.button whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.98 }}
        onClick={() => setShowAdd(true)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px', borderRadius: 14, background: 'rgba(0,122,255,0.08)', border: '1.5px dashed rgba(0,122,255,0.28)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: AZURE, transition: 'all 0.16s ease' }}>
        <Plus size={14} strokeWidth={2.5} />
        Add expense manually
      </motion.button>

      {/* Over-budget action hint */}
      {isOverBudget && (() => {
        const allEntities = days.flatMap(d => d.entities);
        const priciest = allEntities.sort((a, b) => b.price - a.price)[0];
        const overBy   = Math.round(budget.spent - budget.total);
        return (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            style={{ padding: '10px 14px', borderRadius: 14, background: 'rgba(255,69,58,0.07)', border: '1px solid rgba(255,69,58,0.22)', display: 'flex', flexDirection: 'column', gap: 6 }}
          >
            <span style={{ fontSize: 11.5, fontWeight: 800, color: '#FF453A' }}>Over budget by ${overBy.toLocaleString()}</span>
            {priciest && (
              <span style={{ fontSize: 10.5, color: '#6E6E73', fontWeight: 500 }}>
                Tip: removing <strong style={{ color: '#1D1D1F' }}>{priciest.title}</strong> (${priciest.price.toLocaleString()}) would free up the most budget.
              </span>
            )}
          </motion.div>
        );
      })()}

      {/* Burndown projection */}
      {budget.burnRate > 0 && budget.total > 0 && (() => {
        const daysRemaining = days.length - days.filter(d => d.entities.some(e => e.booked)).length;
        const projectedSpend = budget.spent + (budget.burnRate * daysRemaining);
        const projOverBy     = Math.round(projectedSpend - budget.total);
        if (projOverBy <= 0) return null;
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ padding: '9px 14px', borderRadius: 12, background: 'rgba(255,159,10,0.07)', border: '1px solid rgba(255,159,10,0.22)', display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <TrendingUp size={12} color="#FF9F0A" strokeWidth={2.5} />
            <span style={{ fontSize: 11, color: '#1D1D1F', fontWeight: 600 }}>
              At current rate, you'll exceed budget by <strong style={{ color: '#FF9F0A' }}>${projOverBy.toLocaleString()}</strong>
            </span>
          </motion.div>
        );
      })()}

      {/* Burn rate — with tooltips */}
      <div style={{ display: 'flex', gap: 10 }}>
        {[
          { label: 'Daily rate',     value: `$${Math.round(budget.burnRate || 0)}/day`, color: '#007AFF',  tip: 'Average spend per day based on current expenses' },
          { label: 'Projected total',value: `$${Math.round(budget.projected || 0).toLocaleString()}`, color: '#BF5AF2', tip: 'Estimated final total if spend continues at daily rate' },
          { label: 'Committed',      value: `$${Math.round(budget.committed || 0).toLocaleString()}`, color: '#FF9F0A', tip: 'Cost of all booked/confirmed items' },
        ].map(({ label, value, color, tip }) => (
          <div key={label} title={tip} style={{
            flex: 1, padding: '10px 12px', borderRadius: 12, cursor: 'help',
            background: `${color}07`, border: `1px solid ${color}18`,
          }}>
            <div style={{ fontSize: 10, color: '#6E6E73', fontWeight: 500, letterSpacing: '-0.01em' }}>{label}</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.025em', marginTop: 3 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Donut chart */}
      <div style={{
        borderRadius: 18, padding: '16px 18px',
        background: 'rgba(255,255,255,0.82)', border: '1px solid rgba(255,255,255,0.90)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,1)',
      }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.025em', marginBottom: 12 }}>Spending Breakdown</div>
        <DonutChart breakdown={budget.breakdown ?? {}} total={budget.total > 0 ? budget.total : 1} />
      </div>

      {/* Category breakdown — hide zero-spend by default */}
      <div style={{ borderRadius: 16, overflow: 'hidden', background: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.88)', boxShadow: '0 3px 14px rgba(0,0,0,0.05)' }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.025em' }}>By Category</span>
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowAllCats(v => !v)}
            style={{ fontSize: 10, fontWeight: 700, color: AZURE, background: 'rgba(0,122,255,0.07)', border: '1px solid rgba(0,122,255,0.18)', borderRadius: 7, padding: '3px 8px', cursor: 'pointer', fontFamily: 'inherit' }}>
            {showAllCats ? 'Hide empty' : 'Show all'}
          </motion.button>
        </div>
        <div style={{ padding: '8px 14px 12px', display: 'flex', flexDirection: 'column', gap: 7 }}>
          {(Object.keys(CAT_LABELS) as Array<keyof typeof CAT_LABELS>)
            .filter(cat => showAllCats || (budget.breakdown?.[cat] ?? 0) > 0)
            .map(cat => {
              const spent  = budget.breakdown?.[cat] ?? 0;
              const catPct = budget.total > 0 ? Math.min(100, (spent / budget.total) * 100) : 0;
              const Icon   = CAT_ICONS[cat];
              const color  = CAT_COLORS[cat];
              return (
                <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, background: `${color}10`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={12} color={color} strokeWidth={2} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: spent === 0 ? '#AEAEB2' : '#3C3C43', letterSpacing: '-0.01em' }}>{CAT_LABELS[cat]}</span>
                      <span style={{ fontSize: 11, fontWeight: 800, color: spent === 0 ? '#AEAEB2' : '#1D1D1F', letterSpacing: '-0.02em' }}>{spent > 0 ? `$${spent.toLocaleString()}` : '—'}</span>
                    </div>
                    <div style={{ height: 3, borderRadius: 100, background: 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                      <motion.div
                        animate={{ width: `${catPct}%` }}
                        transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                        style={{ height: '100%', borderRadius: 100, background: color, opacity: spent === 0 ? 0 : 1 }}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          }
          {!showAllCats && (Object.keys(CAT_LABELS) as Array<keyof typeof CAT_LABELS>).every(c => (budget.breakdown?.[c] ?? 0) === 0) && (
            <div style={{ fontSize: 11, color: '#AEAEB2', fontWeight: 500, textAlign: 'center', padding: '8px 0' }}>No expenses recorded yet</div>
          )}
        </div>
      </div>

      {/* OmniLedger for detailed view */}
      <OmniLedger />
    </div>
  );
}

// ── Calendar tab ──────────────────────────────────────────────────────────────

function CalendarTab({ onNavigateToDay }: { onNavigateToDay?: (dayId: string) => void }) {
  const trip        = useTravelEngine(s => s.trip);
  const days        = useTravelEngine(s => s.days);
  const setActiveDay = useTravelEngine(s => s.setActiveDay);
  // Auto-navigate to trip start month if set, else today
  const [viewMonth, setViewMonth] = useState(() => {
    if (trip.startDate) {
      const d = new Date(trip.startDate + 'T12:00:00');
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  });

  // Sync to trip start month whenever trip.startDate changes
  useEffect(() => {
    if (!trip.startDate) return;
    const d = new Date(trip.startDate + 'T12:00:00');
    if (!isNaN(d.getTime())) setViewMonth(d);
  }, [trip.startDate]);

  const year  = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DAY_NAMES   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

  const tripDayMap = new Map(days.map(d => [d.date, d]));
  const startDate  = trip.startDate ? new Date(trip.startDate + 'T12:00:00') : null;
  const endDate    = trip.endDate   ? new Date(trip.endDate   + 'T12:00:00') : null;

  const CAL_CAT_COLORS: Record<string, string> = {
    flight: '#007AFF', hotel: '#5E5CE6', restaurant: '#FF9F0A',
    activity: '#30D158', transport: '#00C7BE',
  };

  function inTrip(dayNum: number) {
    if (!startDate || !endDate) return false;
    const d = new Date(year, month, dayNum);
    return d >= startDate && d <= endDate;
  }

  function getTripDay(dayNum: number) {
    const iso = `${year}-${String(month + 1).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`;
    return tripDayMap.get(iso) ?? null;
  }

  function hasTripDay(dayNum: number) {
    return getTripDay(dayNum) !== null;
  }

  const today = new Date();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 24 }}>
      <div style={{
        borderRadius: 18, overflow: 'hidden',
        background: 'rgba(255,255,255,0.80)',
        border: '1px solid rgba(255,255,255,0.90)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
      }}>
        {/* Month nav */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
          <button onClick={() => setViewMonth(new Date(year, month - 1))} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 8, fontSize: 16, color: '#6E6E73' }}>‹</button>
          <span style={{ fontSize: 14, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.025em' }}>{MONTH_NAMES[month]} {year}</span>
          <button onClick={() => setViewMonth(new Date(year, month + 1))} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 8, fontSize: 16, color: '#6E6E73' }}>›</button>
        </div>

        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '8px 12px 4px' }}>
          {DAY_NAMES.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#AEAEB2', letterSpacing: '0.04em' }}>{d}</div>
          ))}
        </div>

        {/* Days grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, padding: '4px 12px 14px' }}>
          {/* Empty cells for first week offset */}
          {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}

          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
            const isTodayDay = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
            const inRange    = inTrip(day);
            const tripDay    = getTripDay(day);
            const hasDayData = tripDay !== null;
            const catDots    = hasDayData && tripDay
              ? [...new Set(tripDay.entities.map(e => e.category))].slice(0, 3) : [];
            // today outside trip range — show with a ring
            const todayOutside = isTodayDay && !inRange && !hasDayData;

            const handleDayClick = () => {
              if (tripDay && onNavigateToDay) {
                setActiveDay(tripDay.id);
                onNavigateToDay(tripDay.id);
              }
            };

            return (
              <motion.div
                key={day}
                onClick={handleDayClick}
                whileHover={{ scale: 1.1 }}
                title={hasDayData ? `Day ${tripDay!.dayNumber} — click to open timeline` : undefined}
                style={{
                  aspectRatio: '1',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 8, cursor: hasDayData ? 'pointer' : 'default', position: 'relative',
                  background: isTodayDay && inRange ? AZURE
                    : hasDayData ? 'rgba(0,122,255,0.10)'
                    : inRange ? 'rgba(0,122,255,0.05)'
                    : 'transparent',
                  border: isTodayDay && !inRange ? '2px solid rgba(0,122,255,0.35)'
                    : isTodayDay ? 'none'
                    : hasDayData ? '1px solid rgba(0,122,255,0.25)'
                    : inRange ? '1px solid rgba(0,122,255,0.12)'
                    : '1px solid transparent',
                  boxShadow: todayOutside ? '0 0 0 1px rgba(0,122,255,0.20)' : 'none',
                }}
              >
                <span style={{
                  fontSize: 11, fontWeight: isTodayDay || hasDayData ? 800 : 400,
                  color: isTodayDay && inRange ? '#fff' : isTodayDay ? AZURE : hasDayData ? AZURE : '#3C3C43',
                }}>
                  {day}
                </span>
                {/* Today marker outside trip range */}
                {todayOutside && (
                  <div style={{ position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: AZURE, opacity: 0.6 }} />
                )}
                {/* Category dots */}
                {!isTodayDay && catDots.length > 0 && (
                  <div style={{ position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 2 }}>
                    {catDots.map(cat => (
                      <div key={cat} style={{ width: 3, height: 3, borderRadius: '50%', background: CAL_CAT_COLORS[cat] ?? AZURE }} />
                    ))}
                  </div>
                )}
                {!isTodayDay && hasDayData && catDots.length === 0 && (
                  <div style={{ position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: AZURE }} />
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, padding: '0 2px' }}>
        {[
          { color: AZURE, label: 'Today' },
          { color: 'rgba(0,122,255,0.50)', label: 'Trip day' },
          { color: 'rgba(0,122,255,0.15)', label: 'Trip range' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
            <span style={{ fontSize: 10, fontWeight: 500, color: '#6E6E73' }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Trip days list */}
      {days.length > 0 && (
        <div style={{
          borderRadius: 16, overflow: 'hidden',
          background: 'rgba(255,255,255,0.75)',
          border: '1px solid rgba(255,255,255,0.88)',
          boxShadow: '0 3px 14px rgba(0,0,0,0.05)',
        }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.025em' }}>
              Trip Schedule — {days.length} day{days.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div style={{ padding: '8px 14px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {days.map(day => (
              <div key={day.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 10px', borderRadius: 10,
                background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)',
              }}>
                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: '#1D1D1F', letterSpacing: '-0.02em' }}>
                    Day {day.dayNumber} — {day.destination || 'Destination TBD'}
                  </div>
                  <div style={{ fontSize: 10, color: '#6E6E73', fontWeight: 500, marginTop: 2 }}>
                    {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: AZURE }}>
                    {day.entities.length} item{day.entities.length !== 1 ? 's' : ''}
                  </div>
                  {day.weather?.temp > 0 && (
                    <div style={{ fontSize: 10, color: '#6E6E73', marginTop: 2 }}>
                      {day.weather.icon} {day.weather.temp}°
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Checklist tab ─────────────────────────────────────────────────────────────

type CheckItem = { id: string; text: string; done: boolean; category: string };

const CHECKLIST_LS_KEY = 'unitravel:checklist:v2';

const INITIAL_ITEMS: CheckItem[] = [
  { id: 'p1', text: 'Passport valid (6+ months)',       done: false, category: 'Documents' },
  { id: 'p2', text: 'Travel insurance',                 done: false, category: 'Documents' },
  { id: 'p3', text: 'Visa / entry requirements',        done: false, category: 'Documents' },
  { id: 'p4', text: 'Emergency contacts printed',       done: false, category: 'Documents' },
  { id: 'b1', text: 'Flights booked + confirmed',       done: false, category: 'Bookings'  },
  { id: 'b2', text: 'Accommodation booked',             done: false, category: 'Bookings'  },
  { id: 'b3', text: 'Airport transfers arranged',       done: false, category: 'Bookings'  },
  { id: 'b4', text: 'Travel credit card notified',      done: false, category: 'Bookings'  },
  { id: 'h1', text: 'Required vaccinations up-to-date', done: false, category: 'Health'    },
  { id: 'h2', text: 'Prescription medication packed',   done: false, category: 'Health'    },
  { id: 'h3', text: 'Travel doctor consultation',       done: false, category: 'Health'    },
  { id: 't1', text: 'Local SIM / eSIM arranged',        done: false, category: 'Tech'      },
  { id: 't2', text: 'Offline maps downloaded',          done: false, category: 'Tech'      },
  { id: 't3', text: 'Power adapters packed',            done: false, category: 'Tech'      },
  { id: 't4', text: 'Unitravel app bookmarks saved',    done: false, category: 'Tech'      },
];

const CAT_ACCENT: Record<string, string> = {
  Documents: '#007AFF',
  Bookings:  '#30D158',
  Health:    '#FF453A',
  Tech:      '#BF5AF2',
  Custom:    '#8E8E93',
};

function ChecklistProgressRing({ done, total }: { done: number; total: number }) {
  const R   = 22;
  const circ = 2 * Math.PI * R;
  const pct  = total > 0 ? done / total : 0;
  const color = pct === 1 ? '#30D158' : pct > 0.6 ? '#007AFF' : '#FF9F0A';
  return (
    <div style={{ position: 'relative', width: 56, height: 56, flexShrink: 0 }}>
      <svg width={56} height={56} viewBox="0 0 56 56" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={28} cy={28} r={R} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth={4} />
        <motion.circle
          cx={28} cy={28} r={R} fill="none"
          stroke={color} strokeWidth={4} strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ * (1 - pct) }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 13, fontWeight: 900, color, letterSpacing: '-0.03em', lineHeight: 1 }}>
          {Math.round(pct * 100)}
        </span>
        <span style={{ fontSize: 9, fontWeight: 600, color: '#8E8E93', letterSpacing: '0.02em' }}>%</span>
      </div>
    </div>
  );
}

function ChecklistTab() {
  // Fix hydration: start with static initial state, load from localStorage after mount
  const [items,   setItems]   = useState<CheckItem[]>(INITIAL_ITEMS);
  const [newText, setNewText] = useState('');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CHECKLIST_LS_KEY);
      if (saved) setItems(JSON.parse(saved) as CheckItem[]);
    } catch {}
  }, []);

  const update = useCallback((next: CheckItem[]) => {
    setItems(next);
    try { localStorage.setItem(CHECKLIST_LS_KEY, JSON.stringify(next)); } catch {}
  }, []);

  const toggle  = (id: string) => update(items.map(i => i.id === id ? { ...i, done: !i.done } : i));
  const addItem = () => {
    if (!newText.trim()) return;
    const trimmed = newText.trim().slice(0, 80); // max 80 chars
    update([...items, { id: Date.now().toString(), text: trimmed, done: false, category: 'Custom' }]);
    setNewText('');
  };

  const categories = [...new Set(items.map(i => i.category))];
  const done  = items.filter(i => i.done).length;
  const total = items.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 24 }}>

      {/* Progress card */}
      <div style={{ padding: '14px 16px', borderRadius: 18, background: 'rgba(255,255,255,0.82)', border: '1px solid rgba(255,255,255,0.92)', boxShadow: '0 3px 16px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <ChecklistProgressRing done={done} total={total} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.025em' }}>Pre-trip Checklist</div>
            <div style={{ fontSize: 11, color: '#6E6E73', marginTop: 2, fontWeight: 500 }}>
              {done === total && total > 0
                ? '✓ All done — ready to travel!'
                : `${done} of ${total} completed`}
            </div>
          </div>
        </div>
      </div>

      {/* Add item */}
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            value={newText}
            onChange={e => setNewText(e.target.value.slice(0, 80))}
            onKeyDown={e => e.key === 'Enter' && addItem()}
            placeholder="Add a checklist item…"
            maxLength={80}
            style={{
              width: '100%', padding: '9px 44px 9px 13px', boxSizing: 'border-box',
              borderRadius: 12, fontFamily: 'inherit',
              background: 'rgba(255,255,255,0.82)', border: '1.5px solid rgba(0,0,0,0.08)',
              fontSize: 12, fontWeight: 500, color: '#1D1D1F', outline: 'none',
              backdropFilter: 'blur(12px)',
            }}
          />
          {newText.length > 50 && (
            <span style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              fontSize: 9, fontWeight: 700, color: newText.length > 75 ? '#FF453A' : '#AEAEB2',
            }}>{80 - newText.length}</span>
          )}
        </div>
        <motion.button
          whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
          onClick={addItem}
          style={{
            width: 38, height: 38, borderRadius: 12, cursor: 'pointer',
            background: AZURE, border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 3px 10px rgba(0,122,255,0.30)', flexShrink: 0,
          }}
        >
          <Plus size={16} color="#fff" strokeWidth={2.5} />
        </motion.button>
      </div>

      {/* Items by category */}
      {categories.map(cat => {
        const accent  = CAT_ACCENT[cat] ?? '#8E8E93';
        const catDone = items.filter(i => i.category === cat && i.done).length;
        const catTotal = items.filter(i => i.category === cat).length;
        return (
          <div key={cat} style={{
            borderRadius: 16, overflow: 'hidden',
            background: 'rgba(255,255,255,0.78)',
            border: `1px solid ${accent}14`,
            boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
          }}>
            {/* Category header */}
            <div style={{
              padding: '9px 14px', borderBottom: `1px solid ${accent}10`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: `${accent}06`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: accent, boxShadow: `0 0 6px ${accent}60` }} />
                <span style={{ fontSize: 11.5, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.015em' }}>{cat}</span>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: catDone === catTotal ? '#30D158' : '#AEAEB2' }}>
                {catDone}/{catTotal}
              </span>
            </div>

            <div style={{ padding: '7px 12px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {items.filter(i => i.category === cat).map(item => (
                <motion.button
                  key={item.id}
                  onClick={() => toggle(item.id)}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 9,
                    padding: '7px 8px', borderRadius: 9, cursor: 'pointer', textAlign: 'left',
                    background: item.done ? `${accent}08` : 'rgba(0,0,0,0.02)',
                    border: `1px solid ${item.done ? accent + '22' : 'rgba(0,0,0,0.05)'}`,
                    fontFamily: 'inherit', transition: 'all 0.14s ease',
                  }}
                >
                  {/* Custom checkbox */}
                  <div style={{
                    width: 17, height: 17, borderRadius: 5.5, flexShrink: 0,
                    background: item.done ? accent : 'transparent',
                    border: `2px solid ${item.done ? accent : 'rgba(0,0,0,0.16)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s ease',
                  }}>
                    {item.done && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 600, damping: 20 }}>
                        <CheckSquare size={9} color="#fff" strokeWidth={3} />
                      </motion.div>
                    )}
                  </div>
                  <span style={{
                    fontSize: 11.5, fontWeight: item.done ? 400 : 500, letterSpacing: '-0.01em',
                    color: item.done ? '#8E8E93' : '#1D1D1F',
                    textDecoration: item.done ? 'line-through' : 'none',
                    flex: 1, transition: 'all 0.14s ease',
                  }}>
                    {item.text}
                  </span>
                </motion.button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Schedule / Agenda tab ────────────────────────────────────────────────────

const SCHED_COLORS: Record<string, string> = {
  flight: '#007AFF', hotel: '#5AC8FA', restaurant: '#FF9F0A',
  activity: '#30D158', transport: '#BF5AF2',
};
const SCHED_LABELS: Record<string, string> = {
  flight: 'Flight', hotel: 'Stay', restaurant: 'Dining',
  activity: 'Activity', transport: 'Transit',
};
const SCHED_ICONS: Record<string, React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>> = {
  flight: Plane, hotel: Hotel, restaurant: UtensilsCrossed,
  activity: Compass, transport: Train,
};

function EntityRow({
  entity, dayId, isLast,
}: { entity: PlacedEntity; dayId: string; isLast: boolean }) {
  const removeEntity = useTravelEngine(s => s.removeEntity);
  const color = SCHED_COLORS[entity.category] ?? AZURE;
  const Icon  = SCHED_ICONS[entity.category] ?? Compass;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10, height: 0, marginBottom: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      style={{
        display: 'flex', alignItems: 'center', gap: 11,
        padding: '9px 16px',
        borderBottom: isLast ? 'none' : '1px solid rgba(0,0,0,0.04)',
      }}
    >
      {/* Category icon + vertical connector */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 28, flexShrink: 0 }}>
        <div style={{
          width: 26, height: 26, borderRadius: 8,
          background: `${color}12`, border: `1px solid ${color}22`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={11} color={color} strokeWidth={2} />
        </div>
        {!isLast && (
          <div style={{ width: 1, height: 12, background: `${color}22`, marginTop: 2 }} />
        )}
      </div>

      {/* Title + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12, fontWeight: 700, color: '#1D1D1F',
          letterSpacing: '-0.018em',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {entity.title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
          <span style={{
            fontSize: 9, fontWeight: 700, color,
            background: `${color}10`, padding: '1px 5px', borderRadius: 4,
          }}>
            {SCHED_LABELS[entity.category] ?? entity.category}
          </span>
          {entity.subtitle && (
            <span style={{ fontSize: 10, color: '#6E6E73', letterSpacing: '-0.01em' }}>{entity.subtitle}</span>
          )}
          {entity.time && (
            <span style={{ fontSize: 10, color: '#AEAEB2' }}>· {entity.time}</span>
          )}
        </div>
      </div>

      {/* Price */}
      {entity.price > 0 && (
        <span style={{ fontSize: 12, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.025em', flexShrink: 0 }}>
          ${entity.price.toLocaleString()}
        </span>
      )}

      {/* Remove */}
      <motion.button
        type="button"
        whileHover={{ scale: 1.12, background: 'rgba(255,69,58,0.12)' }}
        whileTap={{ scale: 0.88 }}
        onClick={() => removeEntity(dayId, entity.id)}
        title="Remove from trip"
        style={{
          width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
          background: 'rgba(0,0,0,0.05)', border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'background 0.14s ease',
        }}
      >
        <X size={9} color="#8E8E93" strokeWidth={2.5} />
      </motion.button>
    </motion.div>
  );
}

function DayAgendaCard({ day }: { day: EngineDay }) {
  const daySpend = day.entities.reduce((s, e) => s + e.price, 0);
  const dateStr  = new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING }}
      style={{
        borderRadius: 18, overflow: 'hidden',
        background: 'rgba(255,255,255,0.82)',
        border: '1px solid rgba(255,255,255,0.92)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.95)',
      }}
    >
      {/* Day header */}
      <div style={{
        padding: '11px 16px', borderBottom: '1px solid rgba(0,0,0,0.05)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 9, flexShrink: 0,
            background: day.entities.length > 0 ? 'rgba(0,122,255,0.10)' : 'rgba(0,0,0,0.04)',
            border: `1px solid ${day.entities.length > 0 ? 'rgba(0,122,255,0.22)' : 'rgba(0,0,0,0.07)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 900,
            color: day.entities.length > 0 ? AZURE : '#8E8E93',
          }}>
            {day.dayNumber}
          </div>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.025em' }}>
              {day.destination || `Day ${day.dayNumber}`}
            </div>
            <div style={{ fontSize: 10, color: '#6E6E73', fontWeight: 500, letterSpacing: '-0.01em' }}>
              {dateStr}
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: AZURE }}>
            {day.entities.length} item{day.entities.length !== 1 ? 's' : ''}
          </div>
          {daySpend > 0 && (
            <div style={{ fontSize: 10, color: '#6E6E73', fontWeight: 600 }}>
              ${daySpend.toLocaleString()}
            </div>
          )}
        </div>
      </div>

      {/* Entity list */}
      {day.entities.length === 0 ? (
        <div style={{
          padding: '14px 16px', textAlign: 'center',
          color: '#AEAEB2', fontSize: 11, fontStyle: 'italic',
        }}>
          No items — add from Plan zones
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          {day.entities.map((entity, i) => (
            <EntityRow
              key={entity.id}
              entity={entity}
              dayId={day.id}
              isLast={i === day.entities.length - 1}
            />
          ))}
        </AnimatePresence>
      )}
    </motion.div>
  );
}

function ScheduleTab() {
  const trip = useTravelEngine(s => s.trip);
  const days = useTravelEngine(s => s.days);

  const totalEntities = days.reduce((s, d) => s + d.entities.length, 0);
  const activeDays    = days.filter(d => d.entities.length > 0).length;
  const totalCost     = days.reduce((s, d) => s + d.entities.reduce((es, e) => es + e.price, 0), 0);

  if (!trip.title || days.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 56, gap: 16 }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(255,159,10,0.10)', border: '1px solid rgba(255,159,10,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Clock3 size={22} color="#FF9F0A" strokeWidth={2} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.028em', marginBottom: 6 }}>No trip scheduled</div>
          <div style={{ fontSize: 12, color: '#6E6E73', maxWidth: 230, lineHeight: 1.5 }}>Set up your trip, then add items from the Plan zones.</div>
        </div>
        {/* Navigation shortcuts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 260 }}>
          {[
            { label: 'Search Flights', icon: Plane,           href: '/zone/flights',      color: '#007AFF' },
            { label: 'Find Hotels',    icon: Hotel,           href: '/zone/lodging',      color: '#5E5CE6' },
            { label: 'Discover Dining',icon: UtensilsCrossed, href: '/zone/dining',       color: '#FF9F0A' },
            { label: 'Experiences',    icon: Compass,         href: '/zone/attractions',  color: '#30D158' },
          ].map(({ label, icon: IcoC, href, color }) => (
            <motion.a
              key={label} href={href}
              whileHover={{ x: 3, backgroundColor: `${color}10` }} whileTap={{ scale: 0.97 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', borderRadius: 12, textDecoration: 'none',
                background: `${color}07`, border: `1px solid ${color}18`, cursor: 'pointer',
              }}
            >
              <div style={{ width: 26, height: 26, borderRadius: 8, background: `${color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <IcoC size={12} color={color} strokeWidth={2} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#1D1D1F', letterSpacing: '-0.01em' }}>{label}</span>
            </motion.a>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 28 }}>
      {/* Summary row */}
      <div style={{ display: 'flex', gap: 10 }}>
        {[
          { label: 'Total items',  value: String(totalEntities),            color: '#007AFF' },
          { label: 'Active days',  value: `${activeDays} / ${days.length}`, color: '#5E5CE6' },
          { label: 'Planned cost', value: `$${totalCost.toLocaleString()}`, color: '#30D158' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            flex: 1, padding: '10px 13px', borderRadius: 14,
            background: `${color}07`, border: `1px solid ${color}18`,
          }}>
            <div style={{ fontSize: 9.5, color: '#6E6E73', fontWeight: 500, letterSpacing: '-0.01em' }}>
              {label}
            </div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#1D1D1F', letterSpacing: '-0.035em', marginTop: 2 }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Day cards */}
      {days.map(day => (
        <DayAgendaCard key={day.id} day={day} />
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

// Category filter config for timeline
const CAT_FILTERS: Array<{
  id:    string | null;
  label: string;
  icon:  React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }> | null;
  color: string;
}> = [
  { id: null,         label: 'All',         icon: null,            color: '#1D1D1F' },
  { id: 'flight',     label: 'Flights',     icon: Plane,           color: '#007AFF' },
  { id: 'hotel',      label: 'Stays',       icon: Hotel,           color: '#5AC8FA' },
  { id: 'restaurant', label: 'Dining',      icon: UtensilsCrossed, color: '#FF9F0A' },
  { id: 'activity',   label: 'Experiences', icon: Compass,         color: '#30D158' },
  { id: 'transport',  label: 'Transit',     icon: Train,           color: '#BF5AF2' },
];

const TAB_STORAGE_KEY = 'unitravel:management:tab';
const VALID_TABS = new Set<Tab>(['timeline', 'schedule', 'budget', 'calendar', 'checklist', 'dream', 'pack']);

function getPersistedTab(urlTab: string | null): Tab {
  if (urlTab && VALID_TABS.has(urlTab as Tab)) return urlTab as Tab;
  try {
    const stored = localStorage.getItem(TAB_STORAGE_KEY) as Tab | null;
    if (stored && VALID_TABS.has(stored)) return stored;
  } catch {}
  return 'timeline';
}

function ManagementPageInner() {
  const searchParams  = useSearchParams();
  const urlTab        = searchParams.get('tab');
  // Fix hydration: start with "timeline", load persisted tab from localStorage after mount
  const [activeTab,    setActiveTab]    = useState<Tab>('timeline');
  const [catFilter,    setCatFilter]    = useState<string | null>(null);
  const [importOpen,   setImportOpen]   = useState(false);
  const [commandOpen,  setCommandOpen]  = useState(false);
  const router        = useRouter();

  // ⌘K / Ctrl+K command palette shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandOpen(v => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Load persisted tab after mount (fix hydration mismatch)
  useEffect(() => {
    const fromUrl = urlTab as Tab | null;
    if (fromUrl && VALID_TABS.has(fromUrl)) { setActiveTab(fromUrl); return; }
    try {
      const stored = localStorage.getItem(TAB_STORAGE_KEY) as Tab | null;
      if (stored && VALID_TABS.has(stored)) setActiveTab(stored);
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync URL param → tab (handles sub-nav clicks that only change the URL)
  useEffect(() => {
    if (!urlTab) return;
    const t = urlTab as Tab;
    if (VALID_TABS.has(t) && t !== activeTab) setActiveTab(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlTab]);

  // Persist active tab to localStorage on every change
  useEffect(() => {
    try { localStorage.setItem(TAB_STORAGE_KEY, activeTab); } catch {}
  }, [activeTab]);

  // Welcome banner after setup wizard completion
  const { success: toastSuccess } = useToast();
  useEffect(() => {
    const welcome = sessionStorage.getItem('unitravel-welcome');
    if (welcome) {
      sessionStorage.removeItem('unitravel-welcome');
      setTimeout(() => toastSuccess(`${welcome} is ready — start planning!`), 600);
    }
  }, []); // eslint-disable-line

  const trip          = useTravelEngine(s => s.trip);
  const days          = useTravelEngine(s => s.days);
  const budget        = useTravelEngine(s => s.budget);
  const totalEntities  = days.reduce((sum, d) => sum + d.entities.length, 0);
  const allEntities_   = days.flatMap(d => d.entities);
  const bookedCount    = allEntities_.filter(e => e.booked).length;
  const allFullyBooked = totalEntities > 0 && bookedCount === totalEntities;
  const daysLeft       = useLiveCountdown(trip.startDate ?? null);

  const dateRange = trip.startDate && trip.endDate
    ? `${new Date(trip.startDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(trip.endDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    : null;

  // Dream Zone is accessible even without a trip — it's a sandbox
  if ((activeTab as string) === 'dream') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden' }}>
        <DreamZone />
      </div>
    );
  }

  // Empty state — no trip set up yet (for all other tabs)
  if (!trip.title && days.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 20, padding: '0 40px', textAlign: 'center' }}>
        <div style={{ width: 60, height: 60, borderRadius: 18, background: 'linear-gradient(135deg, #007AFF, #5E5CE6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 28px rgba(0,122,255,0.32)' }}>
          <CalendarDays size={28} color="#fff" strokeWidth={2} />
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#1D1D1F', letterSpacing: '-0.035em', marginBottom: 8 }}>No trip yet</div>
          <div style={{ fontSize: 13, color: '#6E6E73', lineHeight: 1.6, maxWidth: 280, letterSpacing: '-0.01em' }}>
            Set up your trip to unlock the timeline, budget tracker, calendar, and checklist — or try the <strong style={{ color: '#8B5CF6' }}>Dream Zone</strong> to build a dream itinerary.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <motion.button whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.96 }}
            onClick={() => router.push('/zone/flights')}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 16, background: 'linear-gradient(135deg, #007AFF, #5E5CE6)', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 800, color: '#fff', boxShadow: '0 6px 20px rgba(0,122,255,0.35)' }}>
            <Sparkles size={16} strokeWidth={2} />
            Set up my trip
          </motion.button>
          <motion.button whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.96 }}
            onClick={() => setActiveTab('dream')}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 16, background: 'rgba(139,92,246,0.10)', border: '1px solid rgba(139,92,246,0.28)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 800, color: '#8B5CF6' }}>
            <Sparkles size={14} color="#8B5CF6" strokeWidth={2} />
            Dream Zone
          </motion.button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden' }}>

      {/* Booking confetti — fires when everything is booked */}
      <BookingConfetti active={allFullyBooked} />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...SPRING, delay: 0.04 }}
        style={{
          margin: '0 12px', flexShrink: 0, borderRadius: 22,
          background: 'rgba(255,255,255,0.84)',
          backdropFilter: 'blur(48px) saturate(180%)',
          WebkitBackdropFilter: 'blur(48px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.94)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.98)',
          overflow: 'hidden',
        }}
      >
        {/* Top accent gradient line */}
        <div aria-hidden style={{ height: 3, background: 'linear-gradient(90deg, #007AFF, #5E5CE6)', opacity: 0.75 }} />
        <div style={{ padding: '12px 16px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Trip info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ fontSize: 17, fontWeight: 900, color: '#1D1D1F', letterSpacing: '-0.035em', lineHeight: 1.1 }}>
              {trip.title || 'My Trip'}
            </div>
            <div style={{ fontSize: 11, color: '#6E6E73', fontWeight: 500, letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: 5 }}>
              {dateRange ?? 'Set your dates'}
              {days.length > 0 && <span style={{ color: '#AEAEB2' }}> · {days.length}d · {totalEntities} items</span>}
              <LiveClock />
            </div>
          </div>

          {/* Actions + stat chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Live countdown chip */}
            {daysLeft !== null && daysLeft > 0 && daysLeft <= 365 && (() => {
              const d        = daysLeft;
              const critical = d <= 3;
              const urgent   = d <= 7;
              const color    = critical ? '#FF453A' : urgent ? '#FF9F0A' : '#007AFF';
              return (
                <motion.div
                  animate={critical ? { boxShadow: ['0 0 0 0 rgba(255,69,58,0)', '0 0 0 5px rgba(255,69,58,0.18)', '0 0 0 0 rgba(255,69,58,0)'] } : {}}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '4px 9px', borderRadius: 100,
                    background: critical ? 'rgba(255,69,58,0.12)' : urgent ? 'rgba(255,159,10,0.10)' : 'rgba(0,122,255,0.07)',
                    border: `1px solid ${critical ? 'rgba(255,69,58,0.35)' : urgent ? 'rgba(255,159,10,0.28)' : 'rgba(0,122,255,0.18)'}`,
                  }}
                >
                  <Clock3 size={10} color={color} strokeWidth={2.5} />
                  <span style={{ fontSize: 10, fontWeight: 800, color, letterSpacing: '-0.01em' }}>
                    {d === 1 ? 'Tomorrow!' : `${d}d`}
                  </span>
                </motion.div>
              );
            })()}
            {/* Budget left chip */}
            {budget.total > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 100,
                background: 'rgba(48,209,88,0.08)', border: '1px solid rgba(48,209,88,0.20)',
              }}>
                <TrendingUp size={10} color="#30D158" strokeWidth={2.5} />
                <span style={{ fontSize: 10, fontWeight: 700, color: '#30D158' }}>
                  ${Math.max(0, budget.total - budget.spent).toLocaleString()} left
                </span>
              </div>
            )}
            {/* ⌘K Command palette button */}
            <motion.button
              type="button"
              onClick={() => setCommandOpen(true)}
              whileHover={{ scale: 1.06, background: 'rgba(0,122,255,0.10)' }}
              whileTap={{ scale: 0.92 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 10px', borderRadius: 10, cursor: 'pointer',
                background: 'rgba(0,0,0,0.04)',
                border: '1px solid rgba(0,0,0,0.08)',
                fontFamily: 'inherit', transition: 'all 0.14s',
              }}
              title="Command Palette (⌘K)"
            >
              <Keyboard size={11} color="#6E6E73" strokeWidth={2} />
              <span style={{ fontSize: 10, fontWeight: 700, color: '#6E6E73', letterSpacing: '-0.01em' }}>⌘K</span>
            </motion.button>
            {/* Trip Health Score */}
            <TripHealthScore compact />

            {/* Import booking button */}
            <motion.button
              onClick={() => setImportOpen(v => !v)}
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 12px', borderRadius: 100, cursor: 'pointer',
                background: importOpen ? 'rgba(0,122,255,0.10)' : 'rgba(0,0,0,0.05)',
                border: `1px solid ${importOpen ? 'rgba(0,122,255,0.24)' : 'rgba(0,0,0,0.08)'}`,
                fontFamily: 'inherit', transition: 'all 0.16s',
              }}
            >
              <span style={{ fontSize: 10.5, fontWeight: 700, color: importOpen ? '#007AFF' : '#3C3C43', letterSpacing: '-0.01em' }}>
                Import
              </span>
            </motion.button>
            <TripActionsBar />
          </div>
        </div>

        {/* ── Import booking modal ──────────────────────────────────────── */}
        <AnimatePresence>
          {importOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
              style={{ overflow: 'hidden', paddingInline: 14, paddingBottom: 10 }}
            >
              <BookingImport onClose={() => setImportOpen(false)} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Trip readiness bar — weights: flights+hotels 50%, general planned 30%, booked% 20% */}
        {days.length > 0 && (() => {
          const allEntities    = days.flatMap(d => d.entities);
          const hasFlights     = allEntities.some(e => e.category === 'flight');
          const hasHotelDays   = days.filter(d => d.entities.some(e => e.category === 'hotel')).length;
          const planned        = days.filter(d => d.entities.length > 0).length;
          const booked         = allEntities.filter(e => e.booked).length;
          const critScore      = ((hasFlights ? 25 : 0) + Math.min(25, (hasHotelDays / Math.max(1,days.length)) * 25));
          const planScore      = (planned / days.length) * 30;
          const bookScore      = allEntities.length > 0 ? (booked / allEntities.length) * 20 : 0;
          const readiness      = Math.round(critScore + planScore + bookScore);
          const rColor = readiness < 30 ? '#FF9F0A' : readiness < 70 ? '#007AFF' : '#30D158';
          const rLabel = readiness < 30 ? 'Needs flights & hotels' : readiness < 70 ? `${readiness}% ready` : readiness < 90 ? `${readiness}% ready` : 'Trip ready ✓';
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 9, marginBottom: 2 }}>
              <div style={{ flex: 1, height: 4, borderRadius: 100, background: 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                <motion.div
                  initial={{ width: '0%' }}
                  animate={{ width: `${readiness}%` }}
                  transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
                  style={{ height: '100%', borderRadius: 100, background: `linear-gradient(90deg, ${rColor}80, ${rColor})`, willChange: 'width' }}
                />
              </div>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: rColor, letterSpacing: '-0.01em', whiteSpace: 'nowrap', flexShrink: 0, textAlign: 'right' }}>
                {rLabel}
              </span>
            </div>
          );
        })()}

        {/* Tab bar — animated iOS segment control with smart badges */}
        {(() => {
          const unbookedCount = days.flatMap(d => d.entities).filter(e => !e.booked).length;
          const overBudget    = budget.total > 0 && budget.spent > budget.total;
          const checklistDone = (() => {
            try { const s = localStorage.getItem('unitravel:checklist:v2'); if (s) { const items = JSON.parse(s) as Array<{done: boolean}>; return items.filter(i => !i.done).length; } } catch {} return 0;
          })();
          const scheduleItems = days.reduce((s, d) => s + d.entities.length, 0);
          const tabBadges: Record<string, { label: string; color: string } | undefined> = {
            timeline:  unbookedCount > 0 ? { label: String(unbookedCount), color: '#FF9F0A' } : undefined,
            schedule:  scheduleItems > 0 ? { label: String(scheduleItems),  color: '#007AFF' } : undefined,
            budget:    overBudget         ? { label: '!',                    color: '#FF453A' } : undefined,
            checklist: checklistDone > 0  ? { label: String(checklistDone),  color: '#5E5CE6' } : undefined,
          };
          return (
            <div style={{
              display: 'flex', gap: 0, marginTop: 12,
              background: 'rgba(0,0,0,0.055)',
              borderRadius: 12, padding: '3px',
              position: 'relative',
            }}>
              {TABS.map(tab => {
                const Icon    = tab.icon;
                const isActive = activeTab === tab.id;
                const badge   = tabBadges[tab.id];
                return (
                  <motion.button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    whileHover={!isActive ? { scale: 1.03 } : {}}
                    whileTap={{ scale: 0.96 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 34 }}
                    style={{
                      flex: 1, position: 'relative',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                      padding: '7px 6px', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit',
                      background: 'transparent', border: 'none', outline: 'none', zIndex: 1,
                    }}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="seg-pill"
                        style={{
                          position: 'absolute', inset: 0, borderRadius: 9,
                          background: 'rgba(255,255,255,0.98)',
                          boxShadow: `0 2px 8px rgba(0,0,0,0.10), 0 1px 0 rgba(255,255,255,0.95), inset 0 1px 0 rgba(255,255,255,1)`,
                        }}
                        transition={{ type: 'spring', stiffness: 540, damping: 36 }}
                      />
                    )}
                    <span style={{ position: 'relative', zIndex: 1, display: 'flex' }}>
                      <Icon size={12} color={isActive ? tab.color : '#8E8E93'} strokeWidth={isActive ? 2.5 : 2} />
                    </span>
                    <span style={{
                      position: 'relative', zIndex: 1,
                      fontSize: 11.5, fontWeight: isActive ? 700 : 500,
                      color: isActive ? tab.color : '#8E8E93',
                      letterSpacing: '-0.012em', transition: 'color 0.15s ease',
                    }}>
                      {tab.label}
                    </span>
                    {/* Smart badge */}
                    {badge && !isActive && (
                      <motion.span
                        initial={{ scale: 0 }} animate={{ scale: 1 }}
                        style={{
                          position: 'absolute', top: 4, right: 4, zIndex: 2,
                          minWidth: 14, height: 14, borderRadius: 7,
                          background: badge.color, color: '#fff',
                          fontSize: 9, fontWeight: 900, lineHeight: '14px', textAlign: 'center',
                          paddingInline: 3, letterSpacing: 0,
                          boxShadow: `0 1px 4px ${badge.color}55`,
                        }}
                      >{badge.label}</motion.span>
                    )}
                  </motion.button>
                );
              })}
            </div>
          );
        })()}
        </div>{/* end padding */}
      </motion.div>

      {/* ── Command Palette (⌘K) ─────────────────────────────────────────── */}
      <AnimatePresence>
        {commandOpen && (
          <CommandPalette
            onClose={() => setCommandOpen(false)}
            onTabSwitch={(tab) => { setActiveTab(tab as Tab); }}
          />
        )}
      </AnimatePresence>

      {/* ── Tab content ──────────────────────────────────────────────────────── */}
      <div
        className="scroll-fade"
        style={{
          flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden',
          padding: '10px 12px 0',
          scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,0,0,0.08) transparent',
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            {activeTab === 'timeline'  && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <AnimatePresence><AIGapFiller /></AnimatePresence>

                {/* Trip Health + Temporal Navigator */}
                <TripHealthPanel />
                <TemporalFlowNavigator />

                {/* Category filter rail */}
                <div
                  className="no-scrollbar"
                  style={{ display: 'flex', gap: 6, paddingBottom: 10, overflowX: 'auto', flexShrink: 0 }}
                >
                  {CAT_FILTERS.map(f => {
                    const isActive = catFilter === f.id;
                    const FIcon    = f.icon;
                    const count    = f.id === null
                      ? days.length
                      : days.filter(d => d.entities.some(e => e.category === f.id)).length;
                    return (
                      <motion.button
                        key={String(f.id)}
                        onClick={() => setCatFilter(isActive ? null : f.id)}
                        whileTap={{ scale: 0.94 }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 5,
                          padding: '5px 12px', borderRadius: 100,
                          cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
                          background: isActive ? `${f.color}14` : 'rgba(0,0,0,0.04)',
                          border: `1.5px solid ${isActive ? `${f.color}38` : 'transparent'}`,
                          boxShadow: isActive ? `0 0 10px ${f.color}22` : 'none',
                          transition: 'all 0.16s ease',
                        }}
                      >
                        {FIcon && (
                          <FIcon size={10} color={isActive ? f.color : '#6E6E73'} strokeWidth={2} />
                        )}
                        <span style={{
                          fontSize: 10.5, fontWeight: isActive ? 700 : 500,
                          color: isActive ? f.color : '#6E6E73',
                          letterSpacing: '-0.01em',
                        }}>
                          {f.label}
                        </span>
                        {count > 0 && f.id !== null && (
                          <span style={{
                            fontSize: 9, fontWeight: 800, lineHeight: 1,
                            color: isActive ? f.color : '#AEAEB2',
                            background: isActive ? `${f.color}18` : 'rgba(0,0,0,0.06)',
                            borderRadius: 100, minWidth: 14, textAlign: 'center',
                            padding: '1px 4px',
                          }}>
                            {count}
                          </span>
                        )}
                      </motion.button>
                    );
                  })}
                </div>

                {days.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 14, padding: '40px 24px', textAlign: 'center' }}
                  >
                    <div style={{ width: 52, height: 52, borderRadius: 16, background: 'linear-gradient(135deg, rgba(0,122,255,0.12), rgba(94,92,230,0.10))', border: '1px solid rgba(0,122,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Sparkles size={22} color="#007AFF" strokeWidth={1.8} />
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.03em', marginBottom: 6 }}>
                        Your timeline is empty
                      </div>
                      <div style={{ fontSize: 12, color: '#6E6E73', lineHeight: 1.6, maxWidth: 260, letterSpacing: '-0.01em' }}>
                        Ask the AI concierge to plan your trip, or add flights and stays from the search zones.
                      </div>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.97 }}
                      onClick={() => { sessionStorage.setItem('unitravel-ai-prompt', 'Help me plan my trip — suggest flights, hotels, and activities for my dates.'); router.push('/zone/flights'); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 22px', borderRadius: 14, background: 'linear-gradient(135deg, #007AFF, #5E5CE6)', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, color: '#fff', boxShadow: '0 4px 14px rgba(0,122,255,0.30)' }}
                    >
                      <Sparkles size={14} strokeWidth={2} />
                      Let AI plan my trip
                    </motion.button>
                  </motion.div>
                ) : (
                  <LiquidTimeline filterCategory={catFilter} />
                )}
              </div>
            )}
            {activeTab === 'schedule'  && <ScheduleTab />}
            {activeTab === 'budget'    && <BudgetTab />}
            {activeTab === 'calendar'  && (
              <CalendarTab
                onNavigateToDay={id => setActiveTab('timeline')}
              />
            )}
            {activeTab === 'checklist' && <ChecklistTab />}
            {activeTab === 'pack' && <PackingList />}
            {activeTab === 'dream'     && (
              <div style={{ height: '100%', marginBottom: 0, display: 'flex', flexDirection: 'column' }}>
                <DreamZone />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function ManagementPage() {
  return (
    <Suspense fallback={null}>
      <ManagementPageInner />
    </Suspense>
  );
}
