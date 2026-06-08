'use client';

import { useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import { useEffect }         from 'react';
import { useTravelEngine }   from '@/store/useTravelEngine';

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

const SPRING      = { type: 'spring', stiffness: 300, damping: 28 } as const;
const SPRING_FAST = { type: 'spring', stiffness: 520, damping: 28 } as const;

// ── Animated rolling counter ──────────────────────────────────────────────────

function AnimatedCounter({ value, prefix = '$' }: { value: number; prefix?: string }) {
  const mv      = useMotionValue(0);
  const display = useTransform(mv, v => `${prefix}${Math.round(v).toLocaleString()}`);

  useEffect(() => {
    const ctrl = animate(mv, value, { duration: 1.1, ease: [0.22, 1, 0.36, 1] });
    return ctrl.stop;
  }, [value, mv]);

  return <motion.span>{display}</motion.span>;
}

// ── Category bar (in expanded panel) ─────────────────────────────────────────

function CategoryBar({ label, amount, total, color }: {
  label: string; amount: number; total: number; color: string;
}) {
  const pct = total > 0 ? Math.min(100, (amount / total) * 100) : 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', letterSpacing: '-0.01em' }}>
          {label}
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
          ${amount.toLocaleString()}
        </span>
      </div>
      <div style={{ height: 4, background: 'rgba(0,0,0,0.06)', borderRadius: 2, overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1] }}
          style={{ height: '100%', background: color, borderRadius: 2 }}
        />
      </div>
    </div>
  );
}

// ── Main widget — floating pill ───────────────────────────────────────────────

export function FinancialWidget() {
  const [expanded, setExpanded] = useState(false);

  const budget      = useTravelEngine(s => s.budget);
  const burnSchedule = useTravelEngine(s => s.burnSchedule);

  const isOverBudget = !!budget.overBudgetBy;
  const isCritical   = budget.burnRate > 0.75;
  const isWarning    = budget.burnRate > 0.5;
  const burnPct      = Math.min(100, budget.burnRate * 100);
  const burnColor    = isCritical ? AMBER : isWarning ? '#5E5CE6' : AZURE;
  const severity     = burnSchedule?.severity ?? 'none';

  return (
    <div
      style={{
        position:  'absolute',
        top:       16,
        left:      '50%',
        transform: 'translateX(-50%)',
        zIndex:    50,
      }}
    >
      {/* ── Compact pill ── */}
      <motion.button
        onClick={() => setExpanded(v => !v)}
        animate={{
          boxShadow: isOverBudget
            ? '0 8px 40px rgba(255,149,10,0.35), 0 2px 12px rgba(255,149,10,0.15), inset 0 1px 0 rgba(255,255,255,0.9)'
            : '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.9)',
        }}
        whileHover={{ scale: 1.025 }}
        whileTap={{ scale: 0.97 }}
        transition={{ ...SPRING, boxShadow: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } }}
        style={{
          display:              'flex',
          alignItems:           'center',
          gap:                  16,
          paddingBlock:         10,
          paddingInline:        28,
          borderRadius:         999,
          background:           'rgba(255,255,255,0.50)',
          backdropFilter:       'blur(48px) saturate(2)',
          WebkitBackdropFilter: 'blur(48px) saturate(2)',
          border:               `1.5px solid ${isOverBudget ? 'rgba(255,149,10,0.30)' : 'rgba(255,255,255,0.60)'}`,
          cursor:               'pointer',
          fontFamily:           'inherit',
          whiteSpace:           'nowrap',
        }}
      >
        {/* Spent + total */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
          <span style={{
            fontSize:      20,
            fontWeight:    800,
            letterSpacing: '-0.04em',
            color:         isOverBudget ? AMBER : 'var(--text-primary)',
            lineHeight:    1,
          }}>
            <AnimatedCounter value={budget.spent} />
          </span>
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>
            of ${budget.total.toLocaleString()}
          </span>
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 20, background: 'rgba(0,0,0,0.10)', flexShrink: 0 }} aria-hidden />

        {/* Burn mini-bar + pct */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 52, height: 4, background: 'rgba(0,0,0,0.08)', borderRadius: 2, overflow: 'hidden' }}>
            <motion.div
              animate={{ width: `${burnPct}%`, background: burnColor }}
              transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1] }}
              style={{ height: '100%', borderRadius: 2 }}
            />
          </div>
          <motion.span
            animate={{ color: burnColor }}
            transition={{ duration: 0.4 }}
            style={{ fontSize: 11, fontWeight: 800, letterSpacing: '-0.01em' }}
          >
            {burnPct.toFixed(0)}%
          </motion.span>
        </div>

        {/* Expand chevron */}
        <motion.span
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={SPRING_FAST}
          style={{ fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1, display: 'inline-block' }}
          aria-hidden
        >
          ▾
        </motion.span>
      </motion.button>

      {/* ── Expanded detail panel ── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            key="fw-detail"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 8,  scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ ...SPRING_FAST, opacity: { duration: 0.18 } }}
            style={{
              position:             'absolute',
              top:                  '100%',
              left:                 '50%',
              transform:            'translateX(-50%)',
              background:           'rgba(255,255,255,0.92)',
              backdropFilter:       'blur(48px) saturate(1.9)',
              WebkitBackdropFilter: 'blur(48px) saturate(1.9)',
              borderRadius:         20,
              border:               '1.5px solid rgba(255,255,255,0.95)',
              padding:              '18px 20px 16px',
              display:              'flex',
              flexDirection:        'column',
              gap:                  14,
              width:                280,
              boxShadow:            '0 16px 64px rgba(0,0,0,0.14), 0 4px 16px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,1)',
            }}
          >
            {/* Projected row */}
            <div style={{
              display:       'flex',
              justifyContent: 'space-between',
              alignItems:    'center',
              paddingBlock:  9, paddingInline: 12,
              background:    'rgba(0,0,0,0.03)',
              borderRadius:  12, border: '1px solid rgba(0,0,0,0.05)',
            }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', marginBottom: 2 }}>
                  Projected total
                </div>
                <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.03em', color: isOverBudget ? AMBER : AZURE }}>
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

            {/* Category breakdown */}
            {budget.spent > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
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
                  ))}
              </div>
            ) : (
              <div style={{
                paddingBlock: 12, textAlign: 'center',
                fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500,
                border: '1.5px dashed rgba(0,0,0,0.09)', borderRadius: 12,
              }}>
                No spending tracked yet
              </div>
            )}

            {/* Committed vs spent */}
            {budget.committed > 0 && (
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { label: 'Spent',     value: budget.spent,     color: AZURE },
                  { label: 'Committed', value: budget.committed, color: '#5E5CE6' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{
                    flex: 1, paddingBlock: 8, paddingInline: 10,
                    background: 'rgba(0,0,0,0.03)', borderRadius: 10,
                    border: '1px solid rgba(0,0,0,0.05)', textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 9, color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 3, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                      {label}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 800, color, letterSpacing: '-0.02em' }}>
                      ${value.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Severity badge */}
            {severity !== 'none' && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={SPRING}
                style={{
                  fontSize:      10, fontWeight: 700,
                  color:         severity === 'critical' ? RED : AMBER,
                  background:    severity === 'critical' ? 'rgba(255,69,58,0.08)' : 'rgba(255,149,0,0.08)',
                  border:        `1px solid ${severity === 'critical' ? 'rgba(255,69,58,0.2)' : 'rgba(255,149,0,0.2)'}`,
                  borderRadius:  10, paddingBlock: 7, paddingInline: 12,
                  textAlign:     'center', letterSpacing: '-0.01em', lineHeight: 1.4,
                }}
              >
                {severity === 'critical'
                  ? '⚡ Critical burn pressure — throttle spending'
                  : '○ Watch burn pressure — pace increasing'}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
