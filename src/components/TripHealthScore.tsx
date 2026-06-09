'use client';

/**
 * TripHealthScore — Hopper-inspired live readiness score.
 * Calculates a 0–100 score from 5 weighted factors:
 *   30% — flight(s) booked
 *   25% — hotel(s) confirmed
 *   20% — budget health (not over by >20%)
 *   15% — timeline density (≥1 activity per day)
 *   10% — no scheduling conflicts
 *
 * The ring animates to the score, color-coded green → amber → red.
 * Clicking expands a breakdown drawer.
 */

import { useState, useMemo }       from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTravelEngine }         from '@/store/useTravelEngine';
import { ChevronDown, Check, AlertTriangle, X as XIcon } from 'lucide-react';

// ── Score calculation ─────────────────────────────────────────────────────────

interface HealthFactor {
  id:      string;
  label:   string;
  weight:  number;   // percentage contribution
  score:   number;   // 0–1 (how well this factor is met)
  detail:  string;
  status:  'ok' | 'warn' | 'missing';
}

function useHealthScore() {
  const days   = useTravelEngine(s => s.days);
  const budget = useTravelEngine(s => s.budget);

  return useMemo((): { total: number; factors: HealthFactor[] } => {
    if (days.length === 0) return { total: 0, factors: [] };

    const allEntities  = days.flatMap(d => d.entities);
    const hasFlights   = allEntities.some(e => e.category === 'flight');
    const hasHotels    = allEntities.some(e => e.category === 'hotel');
    const bookedFlights = allEntities.filter(e => e.category === 'flight' && e.booked).length;
    const flightCount  = allEntities.filter(e => e.category === 'flight').length;
    const hotelCount   = allEntities.filter(e => e.category === 'hotel').length;
    const bookedHotels = allEntities.filter(e => e.category === 'hotel' && e.booked).length;

    const daysWithActivity = days.filter(d => d.entities.length > 0).length;
    const densityScore     = days.length > 0 ? daysWithActivity / days.length : 0;

    const budgetScore = (() => {
      if (!budget.total) return 0.5;
      const ratio = budget.spent / budget.total;
      if (ratio > 1.2) return 0;
      if (ratio > 1.0) return 0.3;
      if (ratio > 0.9) return 0.7;
      return 1;
    })();

    // Simple conflict detection: entities with overlapping times on same day
    let hasConflicts = false;
    for (const day of days) {
      const timed = day.entities.filter(e => e.time).sort((a, b) => (a.time! > b.time! ? 1 : -1));
      for (let i = 1; i < timed.length; i++) {
        const prev = timed[i - 1]!;
        const cur  = timed[i]!;
        const prevMins = timeToMins(prev.time!);
        const curMins  = timeToMins(cur.time!);
        if (curMins < prevMins + 60) { hasConflicts = true; break; }
      }
      if (hasConflicts) break;
    }

    const flightS = hasFlights ? (flightCount > 0 ? bookedFlights / flightCount : 0.5) : 0;
    const hotelS  = hasHotels  ? (hotelCount > 0 ? bookedHotels / hotelCount   : 0.5) : 0;

    const factors: HealthFactor[] = [
      {
        id:     'flights',
        label:  'Flights',
        weight: 30,
        score:  flightS,
        detail: !hasFlights
          ? 'No flights added to timeline'
          : flightCount === bookedFlights
          ? `${flightCount} flight${flightCount > 1 ? 's' : ''} confirmed`
          : `${bookedFlights}/${flightCount} flights booked`,
        status: !hasFlights ? 'missing' : bookedFlights < flightCount ? 'warn' : 'ok',
      },
      {
        id:     'hotels',
        label:  'Hotels',
        weight: 25,
        score:  hotelS,
        detail: !hasHotels
          ? 'No accommodation added'
          : bookedHotels === hotelCount
          ? `${hotelCount} stay${hotelCount > 1 ? 's' : ''} confirmed`
          : `${bookedHotels}/${hotelCount} stays booked`,
        status: !hasHotels ? 'missing' : bookedHotels < hotelCount ? 'warn' : 'ok',
      },
      {
        id:     'budget',
        label:  'Budget',
        weight: 20,
        score:  budgetScore,
        detail: !budget.total
          ? 'No budget set'
          : budget.spent > budget.total
          ? `Over budget by $${(budget.spent - budget.total).toLocaleString()}`
          : `$${Math.max(0, budget.total - budget.spent).toLocaleString()} remaining`,
        status: !budget.total ? 'missing' : budget.spent > budget.total * 1.05 ? 'warn' : 'ok',
      },
      {
        id:     'timeline',
        label:  'Timeline',
        weight: 15,
        score:  densityScore,
        detail: densityScore === 0
          ? 'No activities planned'
          : densityScore < 0.5
          ? `${daysWithActivity}/${days.length} days have activities`
          : `${daysWithActivity}/${days.length} days planned`,
        status: densityScore === 0 ? 'missing' : densityScore < 0.5 ? 'warn' : 'ok',
      },
      {
        id:     'conflicts',
        label:  'No Conflicts',
        weight: 10,
        score:  hasConflicts ? 0 : 1,
        detail: hasConflicts ? 'Scheduling conflicts detected' : 'Schedule looks clean',
        status: hasConflicts ? 'warn' : 'ok',
      },
    ];

    const total = Math.round(factors.reduce((s, f) => s + f.score * f.weight, 0));
    return { total, factors };
  }, [days, budget]);
}

function timeToMins(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

// ── Score colour ──────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 80) return '#30D158';
  if (score >= 55) return '#FF9F0A';
  return '#FF453A';
}

function scoreLabel(score: number): string {
  if (score >= 90) return 'Trip Ready';
  if (score >= 70) return 'On Track';
  if (score >= 45) return 'Needs Work';
  if (score >= 20) return 'Early Stage';
  return 'Not Started';
}

// ── Animated SVG ring ─────────────────────────────────────────────────────────

function ScoreRing({ score, size = 38 }: { score: number; size?: number }) {
  const r   = (size - 5) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = scoreColor(score);

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth={4.5} />
        {/* Progress */}
        <motion.circle
          cx={size/2} cy={size/2} r={r}
          fill="none"
          stroke={color}
          strokeWidth={4.5}
          strokeLinecap="round"
          strokeDasharray={`${circ}`}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - dash }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          style={{ filter: `drop-shadow(0 0 4px ${color}88)` }}
        />
      </svg>
      {/* Score number */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size < 44 ? 10 : 13, fontWeight: 900, color,
        letterSpacing: '-0.02em',
      }}>
        {score}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function TripHealthScore({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const { total, factors } = useHealthScore();

  const color = scoreColor(total);
  const label = scoreLabel(total);

  if (factors.length === 0) return null;

  return (
    <div style={{ position: 'relative' }}>
      {/* Trigger pill */}
      <motion.button
        onClick={() => setOpen(v => !v)}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: compact ? '4px 10px 4px 6px' : '5px 12px 5px 7px',
          borderRadius: 100, cursor: 'pointer',
          background: `${color}14`,
          border: `1px solid ${color}30`,
          fontFamily: 'inherit', transition: 'background 0.2s, border-color 0.2s',
        }}
      >
        <ScoreRing score={total} size={compact ? 32 : 36} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, alignItems: 'flex-start' }}>
          <span style={{ fontSize: compact ? 9.5 : 10, fontWeight: 800, color, letterSpacing: '-0.01em', lineHeight: 1 }}>
            {label}
          </span>
          <span style={{ fontSize: compact ? 8.5 : 9, fontWeight: 500, color: `${color}aa`, letterSpacing: '-0.005em', lineHeight: 1, marginTop: 1 }}>
            Trip Health
          </span>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={11} color={color} strokeWidth={2.5} />
        </motion.div>
      </motion.button>

      {/* Dropdown breakdown */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 49 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 420, damping: 28 }}
              style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                width: 260, zIndex: 50,
                borderRadius: 18,
                background: 'rgba(255,255,255,0.96)',
                backdropFilter: 'blur(48px) saturate(200%)',
                WebkitBackdropFilter: 'blur(48px) saturate(200%)',
                border: '1px solid rgba(255,255,255,0.98)',
                boxShadow: '0 16px 48px rgba(0,0,0,0.14), 0 4px 12px rgba(0,0,0,0.07), inset 0 1.5px 0 rgba(255,255,255,1)',
                overflow: 'hidden',
              }}
            >
              {/* Header */}
              <div style={{
                padding: '14px 16px 10px',
                borderBottom: '1px solid rgba(0,0,0,0.05)',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <ScoreRing score={total} size={42} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color, letterSpacing: '-0.025em' }}>{label}</div>
                  <div style={{ fontSize: 10, color: '#8E8E93', fontWeight: 500 }}>{total}/100 trip readiness</div>
                </div>
              </div>

              {/* Factors */}
              <div style={{ padding: '8px 14px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {factors.map(f => {
                  const fColor = f.status === 'ok' ? '#30D158' : f.status === 'warn' ? '#FF9F0A' : '#FF453A';
                  const pct    = Math.round(f.score * f.weight);
                  return (
                    <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {/* Status icon */}
                      <div style={{
                        width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                        background: `${fColor}14`, border: `1px solid ${fColor}30`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {f.status === 'ok'
                          ? <Check size={10} color={fColor} strokeWidth={2.5} />
                          : f.status === 'warn'
                          ? <AlertTriangle size={9} color={fColor} strokeWidth={2.5} />
                          : <XIcon size={9} color={fColor} strokeWidth={2.5} />
                        }
                      </div>
                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#1D1D1F', letterSpacing: '-0.01em' }}>{f.label}</span>
                          <span style={{ fontSize: 10, fontWeight: 800, color: fColor }}>{pct}/{f.weight}</span>
                        </div>
                        {/* Progress bar */}
                        <div style={{ height: 3, borderRadius: 100, background: 'rgba(0,0,0,0.06)', overflow: 'hidden', marginTop: 3 }}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${f.score * 100}%` }}
                            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                            style={{ height: '100%', borderRadius: 100, background: fColor }}
                          />
                        </div>
                        <div style={{ fontSize: 9.5, color: '#6E6E73', marginTop: 2, fontWeight: 500 }}>{f.detail}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
