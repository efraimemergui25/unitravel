'use client';

import { useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence }         from 'framer-motion';
import { Users }                           from 'lucide-react';
import { useTravelEngine }                 from '@/store/useTravelEngine';
import { useMonetizationEngine }           from '@/store/useMonetizationEngine';
import { PaymentMilestones }               from '@/components/management/PaymentMilestones';
import type { EntityCategory }             from '@/store/useTravelEngine';

// ── Constants ─────────────────────────────────────────────────────────────────

const SPRING     = { type: 'spring', stiffness: 380, damping: 30 } as const;
const SPRING_POP = { type: 'spring', stiffness: 500, damping: 24 } as const;

const CATEGORY_COLORS: Record<EntityCategory, string> = {
  flight:     '#007AFF',
  hotel:      '#5E5CE6',
  restaurant: '#FF9F0A',
  activity:   '#30D158',
  transport:  '#00C7BE',
};

const CATEGORY_LABELS: Record<EntityCategory, string> = {
  flight:     'Flights',
  hotel:      'Hotels',
  restaurant: 'Dining',
  activity:   'Activities',
  transport:  'Transport',
};

const TRAVELER_COLORS = [
  '#007AFF', '#BF5AF2', '#30D158', '#FF9F0A', '#FF453A', '#00C7BE',
];

// ── SVG donut arc math ────────────────────────────────────────────────────────

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg - 90) * (Math.PI / 180); // −90° so 0° = top
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function arcPath(
  cx: number, cy: number, r: number,
  startDeg: number, endDeg: number,
): string {
  // Clamp to avoid a degenerate single-point arc at 360°
  const clampedEnd = Math.min(endDeg, startDeg + 359.99);
  const s = polarToCartesian(cx, cy, r, startDeg);
  const e = polarToCartesian(cx, cy, r, clampedEnd);
  const largeArc = clampedEnd - startDeg > 180 ? 1 : 0;
  return (
    `M ${s.x.toFixed(3)} ${s.y.toFixed(3)} ` +
    `A ${r} ${r} 0 ${largeArc} 1 ${e.x.toFixed(3)} ${e.y.toFixed(3)}`
  );
}

// ── Bespoke glass donut chart ─────────────────────────────────────────────────

interface DonutSeg { label: string; value: number; color: string }

function InlineDonutChart({
  segments,
  size        = 200,
  innerLabel,
  innerSub,
}: {
  segments:    DonutSeg[];
  size?:       number;
  innerLabel?: string;
  innerSub?:   string;
}) {
  const CX = 100, CY = 100, R = 68;
  const GAP_DEG = 4;

  const total = segments.reduce((s, d) => s + d.value, 0);

  const computed = useMemo(() => {
    let cursor = 0;
    return segments.map(seg => {
      const fraction = total > 0 ? seg.value / total : 0;
      const spanDeg  = fraction * (360 - GAP_DEG * segments.length);
      const startDeg = cursor;
      cursor += spanDeg + GAP_DEG;
      return { ...seg, startDeg, endDeg: startDeg + spanDeg };
    });
  }, [segments, total]);

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg
        viewBox="0 0 200 200"
        width={size}
        height={size}
        style={{ overflow: 'visible' }}
      >
        <defs>
          {computed.map(seg => (
            <filter
              key={`gf-${seg.label}`}
              id={`gf-omni-${seg.label.replace(/\s+/g, '-')}`}
              x="-40%" y="-40%" width="180%" height="180%"
            >
              <feDropShadow
                dx="0" dy="0" stdDeviation="5"
                floodColor={seg.color} floodOpacity="0.5"
              />
            </filter>
          ))}
        </defs>

        {/* Background ring */}
        <circle
          cx={CX} cy={CY} r={R}
          fill="none"
          stroke="rgba(0,0,0,0.05)"
          strokeWidth={12}
        />

        {/*
          Animated arc segments using explicit strokeDasharray / strokeDashoffset math.
          Arc length for a circular arc = R × θ (radians).
          θ = (endDeg − startDeg) × π/180
          strokeDasharray = arcLength  (dash = exactly the arc)
          Animate strokeDashoffset from arcLength → 0 (reveals the stroke).
          The gap value (9999) exceeds the full circumference so the dash never wraps.
        */}
        {computed.map((seg, i) => {
          const spanRad  = (seg.endDeg - seg.startDeg) * (Math.PI / 180);
          const arcLen   = parseFloat((R * spanRad).toFixed(4)); // viewBox units
          return (
            <motion.path
              key={seg.label}
              d={arcPath(CX, CY, R, seg.startDeg, seg.endDeg)}
              fill="none"
              stroke={seg.color}
              strokeWidth={12}
              strokeLinecap="round"
              strokeDasharray={`${arcLen} 9999`}
              filter={`url(#gf-omni-${seg.label.replace(/\s+/g, '-')})`}
              style={{ opacity: 0.85 }}
              initial={{ strokeDashoffset: arcLen }}
              animate={{ strokeDashoffset: 0 }}
              transition={{
                duration: 1.25,
                delay:    i * 0.15,
                ease:     [0.22, 1, 0.36, 1],
              }}
            />
          );
        })}

        {/* Inner label */}
        {innerLabel && (
          <text
            x={CX} y={CY - 6}
            textAnchor="middle"
            dominantBaseline="middle"
            style={{
              fontSize:      22,
              fontWeight:    800,
              fill:          '#1C1C1E',
              fontFamily:    '-apple-system, "SF Pro Display", Inter, sans-serif',
              letterSpacing: '-0.03em',
            }}
          >
            {innerLabel}
          </text>
        )}
        {innerSub && (
          <text
            x={CX} y={CY + 16}
            textAnchor="middle"
            dominantBaseline="middle"
            style={{
              fontSize:      10,
              fontWeight:    500,
              fill:          '#8E8E93',
              fontFamily:    '-apple-system, "SF Pro Display", Inter, sans-serif',
              letterSpacing: '-0.01em',
            }}
          >
            {innerSub}
          </text>
        )}
      </svg>

      {/* Legend */}
      <div style={{
        position:         'absolute',
        insetBlockEnd:    -(segments.length > 4 ? 88 : 72),
        insetInlineStart: '50%',
        transform:        'translateX(-50%)',
        display:          'flex',
        flexWrap:         'wrap',
        justifyContent:   'center',
        gap:              8,
        width:            240,
      }}>
        {computed.map(seg => (
          <div key={seg.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{
              width:        8, height: 8,
              borderRadius: '50%',
              background:   seg.color,
              boxShadow:    `0 0 5px ${seg.color}99`,
              flexShrink:   0,
            }} />
            <span style={{
              fontSize:      10,
              fontWeight:    600,
              color:         '#6E6E73',
              fontFamily:    'inherit',
              letterSpacing: '-0.01em',
              whiteSpace:    'nowrap',
            }}>
              {seg.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Collaborative split row ───────────────────────────────────────────────────

function TravelerSplitRow({ name, share, total, color }: {
  name: string; share: number; total: number; color: string;
}) {
  const pct = total > 0 ? Math.min(100, (share / total) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{
            width: 26, height: 26, borderRadius: '50%',
            background: `${color}20`, border: `1.5px solid ${color}50`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 800, color,
            fontFamily: 'inherit',
          }}>
            {name.charAt(0).toUpperCase()}
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#1C1C1E', fontFamily: 'inherit', letterSpacing: '-0.01em' }}>
            {name}
          </span>
        </div>
        <span style={{ fontSize: 12, fontWeight: 900, color, fontFamily: 'inherit', letterSpacing: '-0.02em' }}>
          ${share.toLocaleString()}
        </span>
      </div>
      <div style={{ height: 5, background: 'rgba(0,0,0,0.06)', borderRadius: 3, overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1] }}
          style={{ height: '100%', background: `linear-gradient(90deg, ${color}99, ${color})`, borderRadius: 3 }}
        />
      </div>
    </div>
  );
}

// ── Admin revenue overlay ─────────────────────────────────────────────────────

function AdminRevenuePanel() {
  const { total, byCategory, records, show, toggle } = useMonetizationEngine(s => ({
    total:      s.totalRevenue,
    byCategory: s.revenueByCategory,
    records:    Object.values(s.commissions).sort((a, b) => b.amount - a.amount).slice(0, 8),
    show:       s.showAdminPanel,
    toggle:     s.toggleAdminPanel,
  }));

  const handleKey = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'M') {
      e.preventDefault();
      toggle();
    }
  }, [toggle]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 12 }}
          animate={{ opacity: 1, scale: 1,    y: 0  }}
          exit={{    opacity: 0, scale: 0.90, y: 12 }}
          transition={SPRING_POP}
          style={{
            position:             'absolute',
            insetBlockEnd:        16,
            insetInlineEnd:       16,
            zIndex:               999,
            width:                300,
            padding:              16,
            borderRadius:         16,
            background:           'rgba(0,0,0,0.82)',
            backdropFilter:       'blur(40px) saturate(1.8)',
            WebkitBackdropFilter: 'blur(40px) saturate(1.8)',
            border:               '1px solid rgba(255,255,255,0.10)',
            boxShadow:            '0 20px 60px rgba(0,0,0,0.4)',
            fontFamily:           '"SF Mono", "Fira Code", monospace',
            color:                '#4ADE80',
            fontSize:             11,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#86EFAC', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              ⬡ Admin · Revenue Intelligence
            </span>
            <button
              onClick={toggle}
              style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}
            >
              ✕
            </button>
          </div>

          <div style={{ marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: 9, color: '#6B7280', marginBottom: 3 }}>PROJECTED AFFILIATE REVENUE</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#4ADE80', letterSpacing: '-0.02em' }}>
              ${total.toFixed(2)}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
            {(Object.entries(byCategory) as [EntityCategory, number][])
              .filter(([, v]) => v > 0)
              .map(([cat, rev]) => (
                <div key={cat} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#9CA3AF' }}>{cat}</span>
                  <span style={{ color: '#4ADE80' }}>${rev.toFixed(2)}</span>
                </div>
              ))
            }
          </div>

          {records.length > 0 && (
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8 }}>
              <div style={{ fontSize: 9, color: '#6B7280', marginBottom: 5 }}>TOP COMMISSIONS</div>
              {records.map(r => (
                <div key={r.entityId} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 10 }}>
                  <span style={{ color: '#D1D5DB', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                    {r.title}
                  </span>
                  <span style={{ color: '#4ADE80', flexShrink: 0, marginLeft: 6 }}>
                    ${r.amount.toFixed(2)} ({(r.rate * 100).toFixed(0)}%)
                  </span>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 8, fontSize: 9, color: '#374151', letterSpacing: '0.02em' }}>
            ⌘⇧M to toggle · Admin view only
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface OmniLedgerProps {
  onClose?: () => void;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function OmniLedger({ onClose }: OmniLedgerProps) {
  const budget = useTravelEngine(s => s.budget);
  const trip   = useTravelEngine(s => s.trip);
  const days   = useTravelEngine(s => s.days);

  const recordPlacement = useMonetizationEngine(s => s.recordPlacement);
  useEffect(() => {
    days.flatMap(d => d.entities).forEach(e => {
      recordPlacement({ id: e.id, title: e.title, category: e.category, price: e.price, tags: e.tags });
    });
  }, [days, recordPlacement]);

  // Build donut segments from budget breakdown
  const segments = useMemo((): DonutSeg[] =>
    (Object.entries(budget.breakdown) as [EntityCategory, number][])
      .filter(([, v]) => v > 0)
      .map(([cat, amount]) => ({
        label: CATEGORY_LABELS[cat],
        value: amount,
        color: CATEGORY_COLORS[cat],
      })),
    [budget.breakdown],
  );

  const totalSpent  = budget.spent;
  const totalBudget = budget.total;
  const remaining   = Math.max(0, totalBudget - totalSpent);
  const travelers   = trip.travelers;
  const perPerson   = travelers.length > 0 ? Math.round(totalSpent / travelers.length) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 12 }}
      animate={{ opacity: 1, scale: 1,    y: 0  }}
      exit={{    opacity: 0, scale: 0.94, y: 8  }}
      transition={SPRING}
      style={{
        position:             'relative',
        width:                '100%',
        padding:              22,
        borderRadius:         48,
        background:           'rgba(255,255,255,0.40)',
        backdropFilter:       'blur(40px) saturate(1.9)',
        WebkitBackdropFilter: 'blur(40px) saturate(1.9)',
        border:               '1.5px solid rgba(255,255,255,0.60)',
        boxShadow:            '0 20px 50px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,1)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#1C1C1E', letterSpacing: '-0.03em', fontFamily: 'inherit' }}>
            Omni Ledger
          </h2>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 500, color: '#8E8E93', fontFamily: 'inherit', marginTop: 2 }}>
            {trip.title || 'Your Trip'} · {trip.nights} nights
          </p>
        </div>
        {onClose && (
          <motion.button
            onClick={onClose}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'rgba(0,0,0,0.06)', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: 14, color: '#6E6E73', fontFamily: 'inherit',
            }}
          >
            ✕
          </motion.button>
        )}
      </div>

      {/* Bespoke SVG donut chart — centered */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 56 }}>
        <InlineDonutChart
          segments={segments.length > 0 ? segments : [{ label: 'Unallocated', value: 1, color: 'rgba(0,0,0,0.08)' }]}
          size={200}
          innerLabel={`$${totalSpent.toLocaleString()}`}
          innerSub="total spent"
        />
      </div>

      {/* Budget summary pills */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 28 }}>
        {[
          { label: 'Budget',    value: `$${totalBudget.toLocaleString()}`,         color: '#007AFF' },
          { label: 'Spent',     value: `$${totalSpent.toLocaleString()}`,           color: '#FF9F0A' },
          { label: 'Remaining', value: `$${remaining.toLocaleString()}`,            color: '#30D158' },
          { label: 'Committed', value: `$${budget.committed.toLocaleString()}`,     color: '#BF5AF2' },
        ].map(pill => (
          <div key={pill.label} style={{
            flex:                 1, minWidth: 100,
            paddingBlock:         10, paddingInline: 14,
            borderRadius:         16,
            background:           `${pill.color}08`,
            border:               `1.5px solid ${pill.color}20`,
            backdropFilter:       'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            display:              'flex', flexDirection: 'column', gap: 2,
          }}>
            <span style={{ fontSize: 9, fontWeight: 800, color: pill.color, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'inherit' }}>
              {pill.label}
            </span>
            <span style={{ fontSize: 16, fontWeight: 900, color: '#1C1C1E', letterSpacing: '-0.03em', fontFamily: 'inherit' }}>
              {pill.value}
            </span>
          </div>
        ))}
      </div>

      {/* ── Multiplayer glass split pill ───────────────────────────────────── */}
      {travelers.length >= 2 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING, delay: 0.25 }}
          style={{
            display:              'flex',
            alignItems:           'center',
            justifyContent:       'center',
            flexWrap:             'wrap',
            gap:                  6,
            paddingBlock:         10,
            paddingInline:        20,
            borderRadius:         999,
            background:           'rgba(255,255,255,0.60)',
            backdropFilter:       'blur(24px) saturate(1.8)',
            WebkitBackdropFilter: 'blur(24px) saturate(1.8)',
            border:               '1.5px solid rgba(255,255,255,0.85)',
            boxShadow:            '0 4px 20px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.95)',
            marginBottom:         24,
          }}
        >
          {travelers.map((name, i) => (
            <>
              {i > 0 && (
                <span
                  key={`sep-${i}`}
                  style={{ color: '#C7C7CC', fontSize: 13, fontWeight: 300 }}
                >
                  |
                </span>
              )}
              <span
                key={name}
                style={{
                  fontSize:      12,
                  fontWeight:    800,
                  color:         TRAVELER_COLORS[i % TRAVELER_COLORS.length],
                  letterSpacing: '-0.02em',
                  fontFamily:    'inherit',
                  whiteSpace:    'nowrap',
                }}
              >
                {name}&apos;s Share:&nbsp;
                <span style={{ fontWeight: 900 }}>
                  ${perPerson.toLocaleString()}
                </span>
              </span>
            </>
          ))}
        </motion.div>
      )}

      {/* Bottom grid: Payment Milestones + Collaborative Split */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Payment Milestones */}
        <div>
          <p style={{ margin: 0, marginBottom: 10, fontSize: 9.5, fontWeight: 800, color: '#6E6E73', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'inherit' }}>
            Payment Milestones
          </p>
          <PaymentMilestones />
        </div>

        {/* Per-traveler split rows */}
        <div>
          <p style={{ margin: 0, marginBottom: 10, fontSize: 9.5, fontWeight: 800, color: '#6E6E73', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'inherit' }}>
            Collaborative Split
          </p>
          {travelers.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, paddingBlock: 20 }}>
              <Users size={20} color="#C7C7CC" strokeWidth={1.5} />
              <span style={{ fontSize: 11, fontWeight: 500, color: '#8E8E93', fontFamily: 'inherit' }}>No travelers added</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {travelers.map((name, i) => (
                <TravelerSplitRow
                  key={name}
                  name={name}
                  share={perPerson}
                  total={totalSpent}
                  color={TRAVELER_COLORS[i % TRAVELER_COLORS.length]!}
                />
              ))}
              <div style={{
                marginTop:      4,
                paddingTop:     10,
                borderTop:      '1px solid rgba(0,0,0,0.06)',
                display:        'flex',
                justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#6E6E73', fontFamily: 'inherit' }}>Per person</span>
                <span style={{ fontSize: 12, fontWeight: 900, color: '#1C1C1E', fontFamily: 'inherit', letterSpacing: '-0.02em' }}>
                  ${perPerson.toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Admin overlay */}
      <AdminRevenuePanel />
    </motion.div>
  );
}
