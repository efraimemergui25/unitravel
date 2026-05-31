'use client';

import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useEffect }                                      from 'react';
import { useTravelEngine }                                from '@/store/useTravelEngine';

// ── Design tokens ─────────────────────────────────────────────────────────────

const AZURE   = '#007AFF';
const AMBER   = '#FF9F0A';
const EMERALD = '#30D158';
const RED     = '#FF453A';

const CATEGORY_COLORS: Record<string, string> = {
  flight:     AZURE,
  hotel:      '#5E5CE6',
  restaurant: AMBER,
  activity:   EMERALD,
  transport:  '#00C7BE',
};

const SPRING = { type: 'spring', stiffness: 300, damping: 28 } as const;

// ── Animated number counter ───────────────────────────────────────────────────

function AnimatedCounter({ value, prefix = '$' }: { value: number; prefix?: string }) {
  const motionVal = useMotionValue(0);
  const display   = useTransform(motionVal, v => `${prefix}${Math.round(v).toLocaleString()}`);

  useEffect(() => {
    const ctrl = animate(motionVal, value, {
      duration: 1.1,
      ease:     [0.22, 1, 0.36, 1],
    });
    return ctrl.stop;
  }, [value, motionVal]);

  return <motion.span>{display}</motion.span>;
}

// ── Category breakdown bar ────────────────────────────────────────────────────

function CategoryBar({
  label,
  amount,
  total,
  color,
}: {
  label:  string;
  amount: number;
  total:  number;
  color:  string;
}) {
  const pct = total > 0 ? Math.min(100, (amount / total) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{
          fontSize: 11, fontWeight: 500,
          color: 'var(--text-secondary)', letterSpacing: '-0.01em',
        }}>
          {label}
        </span>
        <span style={{
          fontSize: 11, fontWeight: 700,
          color: 'var(--text-primary)', letterSpacing: '-0.01em',
        }}>
          ${amount.toLocaleString()}
        </span>
      </div>
      <div style={{ height: 4, background: 'rgba(0,0,0,0.06)', borderRadius: 2, overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          style={{ height: '100%', background: color, borderRadius: 2 }}
        />
      </div>
    </div>
  );
}

// ── Main widget ───────────────────────────────────────────────────────────────

export function FinancialWidget() {
  const budget      = useTravelEngine(s => s.budget);
  const burnSchedule = useTravelEngine(s => s.burnSchedule);

  const isOverBudget = !!budget.overBudgetBy;
  const isCritical   = budget.burnRate > 0.75;
  const isWarning    = budget.burnRate > 0.5;

  const burnPct   = Math.min(100, budget.burnRate * 100);
  const burnColor = isCritical ? AMBER : isWarning ? '#5E5CE6' : AZURE;

  const shadowColor = isCritical
    ? 'rgba(255,149,0,0.28)'
    : isWarning
    ? 'rgba(94,92,230,0.18)'
    : 'rgba(0,122,255,0.14)';

  const severity = burnSchedule?.severity ?? 'none';

  return (
    <motion.div
      layout
      animate={{
        boxShadow: `0 8px 32px ${shadowColor}, 0 2px 8px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,1)`,
      }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      style={{
        background:           'rgba(255,255,255,0.92)',
        backdropFilter:       'blur(48px) saturate(1.9)',
        WebkitBackdropFilter: 'blur(48px) saturate(1.9)',
        borderRadius:         20,
        border:               '1.5px solid rgba(255,255,255,0.95)',
        padding:              '18px 18px 16px',
        display:              'flex',
        flexDirection:        'column',
        gap:                  14,
        position:             'relative',
        overflow:             'hidden',
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.07em',
            color: 'var(--text-tertiary)', textTransform: 'uppercase',
          }}>
            Budget Intelligence
          </span>
          {isOverBudget && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={SPRING}
              style={{
                fontSize:      9, fontWeight: 800,
                background:    'rgba(255,149,0,0.12)',
                border:        '1px solid rgba(255,149,0,0.3)',
                color:         AMBER,
                borderRadius:  6,
                paddingBlock:  2, paddingInline: 6,
                letterSpacing: '0.04em',
              }}
            >
              ⚠ OVER
            </motion.span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{
            fontSize:      30, fontWeight: 800,
            letterSpacing: '-0.04em',
            color:         'var(--text-primary)', lineHeight: 1,
          }}>
            <AnimatedCounter value={budget.spent} />
          </span>
          <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)' }}>
            of ${budget.total.toLocaleString()}
          </span>
        </div>
      </div>

      {/* ── Burn rate bar ───────────────────────────────────────────────────── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>
            Burn rate
          </span>
          <motion.span
            animate={{ color: burnColor }}
            transition={{ duration: 0.4 }}
            style={{ fontSize: 11, fontWeight: 800, letterSpacing: '-0.01em' }}
          >
            {burnPct.toFixed(1)}%
          </motion.span>
        </div>
        <div style={{ height: 6, background: 'rgba(0,0,0,0.06)', borderRadius: 3, overflow: 'hidden' }}>
          <motion.div
            animate={{ width: `${burnPct}%`, background: burnColor }}
            transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1] }}
            style={{ height: '100%', borderRadius: 3 }}
          />
        </div>
      </div>

      {/* ── Projected row ───────────────────────────────────────────────────── */}
      <div style={{
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'center',
        paddingBlock:   9,
        paddingInline:  12,
        background:     'rgba(0,0,0,0.03)',
        borderRadius:   12,
        border:         '1px solid rgba(0,0,0,0.05)',
      }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', marginBottom: 2 }}>
            Projected total
          </div>
          <span style={{
            fontSize:      16, fontWeight: 800,
            letterSpacing: '-0.03em',
            color:         isOverBudget ? AMBER : AZURE,
          }}>
            <AnimatedCounter value={budget.projected || budget.spent} />
          </span>
        </div>
        {budget.dailyAllowance > 0 && (
          <div style={{ textAlign: 'end' }}>
            <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', marginBottom: 2 }}>
              Daily allowance
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '-0.02em' }}>
              ${Math.round(budget.dailyAllowance).toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {/* ── Category breakdown ──────────────────────────────────────────────── */}
      {budget.spent > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
            color: 'var(--text-tertiary)', textTransform: 'uppercase',
          }}>
            By Category
          </span>
          {(Object.entries(budget.breakdown) as [string, number][])
            .filter(([, v]) => v > 0)
            .sort(([, a], [, b]) => b - a)
            .map(([cat, amount]) => (
              <CategoryBar
                key={cat}
                label={cat.charAt(0).toUpperCase() + cat.slice(1)}
                amount={amount}
                total={budget.spent}
                color={CATEGORY_COLORS[cat] ?? AZURE}
              />
            ))
          }
        </div>
      ) : (
        <div style={{
          paddingBlock: 14, textAlign: 'center',
          fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500,
          border: '1.5px dashed rgba(0,0,0,0.09)', borderRadius: 12,
        }}>
          No spending tracked yet
        </div>
      )}

      {/* ── Burn schedule severity badge ────────────────────────────────────── */}
      {severity !== 'none' && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING}
          style={{
            fontSize:      10, fontWeight: 700,
            color:         severity === 'critical' ? RED : AMBER,
            background:    severity === 'critical' ? 'rgba(255,69,58,0.08)'  : 'rgba(255,149,0,0.08)',
            border:        `1px solid ${severity === 'critical' ? 'rgba(255,69,58,0.2)' : 'rgba(255,149,0,0.2)'}`,
            borderRadius:  10,
            paddingBlock:  7, paddingInline: 12,
            textAlign:     'center',
            letterSpacing: '-0.01em',
            lineHeight:    1.4,
          }}
        >
          {severity === 'critical'
            ? '⚡ Critical burn pressure — throttle spending'
            : '○ Watch burn pressure — pace increasing'
          }
        </motion.div>
      )}

      {/* ── Committed vs spent split ─────────────────────────────────────────── */}
      {budget.committed > 0 && (
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{
            flex: 1, paddingBlock: 8, paddingInline: 10,
            background: 'rgba(0,0,0,0.03)', borderRadius: 10,
            border: '1px solid rgba(0,0,0,0.05)', textAlign: 'center',
          }}>
            <div style={{ fontSize: 9, color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 3, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Spent
            </div>
            <span style={{ fontSize: 13, fontWeight: 800, color: AZURE, letterSpacing: '-0.02em' }}>
              ${budget.spent.toLocaleString()}
            </span>
          </div>
          <div style={{
            flex: 1, paddingBlock: 8, paddingInline: 10,
            background: 'rgba(0,0,0,0.03)', borderRadius: 10,
            border: '1px solid rgba(0,0,0,0.05)', textAlign: 'center',
          }}>
            <div style={{ fontSize: 9, color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 3, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Committed
            </div>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#5E5CE6', letterSpacing: '-0.02em' }}>
              ${budget.committed.toLocaleString()}
            </span>
          </div>
        </div>
      )}
    </motion.div>
  );
}
