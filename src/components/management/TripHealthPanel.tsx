'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter }               from 'next/navigation';
import { useTravelEngine }         from '@/store/useTravelEngine';
import {
  Plane, Hotel, UtensilsCrossed, CheckSquare, Zap,
  AlertTriangle, ArrowRight, TrendingUp, Clock3, Wallet,
} from 'lucide-react';

const AZURE   = '#007AFF';
const EMERALD = '#30D158';
const AMBER   = '#FF9F0A';
const RED     = '#FF453A';
const VIOLET  = '#5E5CE6';

interface HealthItem {
  id:      string;
  label:   string;
  status:  'ok' | 'warn' | 'bad';
  score:   number;   // 0-25 points each
  action?: { label: string; href: string };
  icon:    React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
}

export function TripHealthPanel() {
  const days   = useTravelEngine(s => s.days);
  const budget = useTravelEngine(s => s.budget);
  const trip   = useTravelEngine(s => s.trip);
  const router = useRouter();

  const items = useMemo((): HealthItem[] => {
    const allEntities = days.flatMap(d => d.entities);
    const daysWithEntities = days.filter(d => d.entities.length > 0);

    // 1. Flights check
    const hasFlights = allEntities.some(e => e.category === 'flight');
    const flightsBooked = allEntities.filter(e => e.category === 'flight' && e.booked).length;
    const flightStatus = hasFlights ? (flightsBooked > 0 ? 'ok' : 'warn') : 'bad';

    // 2. Accommodation check
    const daysWithHotel = days.filter(d => d.entities.some(e => e.category === 'hotel')).length;
    const totalDays     = days.length;
    const hotelCoverage = totalDays > 0 ? daysWithHotel / totalDays : 0;
    const hotelStatus   = hotelCoverage >= 0.9 ? 'ok' : hotelCoverage >= 0.5 ? 'warn' : 'bad';

    // 3. Budget check
    const budgetSet = budget.total > 0;
    const budgetPct = budgetSet ? budget.spent / budget.total : 0;
    const budgetStatus = !budgetSet ? 'warn' : budgetPct > 1 ? 'bad' : budgetPct > 0.85 ? 'warn' : 'ok';

    // 4. Planning coverage
    const plannedPct = totalDays > 0 ? daysWithEntities.length / totalDays : 0;
    const planStatus = plannedPct >= 0.8 ? 'ok' : plannedPct >= 0.4 ? 'warn' : 'bad';

    return [
      {
        id: 'flights',
        label: hasFlights
          ? flightsBooked > 0 ? `${flightsBooked} flight${flightsBooked !== 1 ? 's' : ''} booked` : 'Flights added, not booked'
          : 'No flights planned',
        status: flightStatus,
        score: flightStatus === 'ok' ? 25 : flightStatus === 'warn' ? 12 : 0,
        icon: Plane,
        action: !hasFlights ? { label: 'Search flights', href: '/zone/flights' } : undefined,
      },
      {
        id: 'accommodation',
        label: hotelCoverage >= 0.9
          ? 'All nights covered'
          : hotelCoverage > 0
          ? `${Math.round(hotelCoverage * 100)}% of nights have accommodation`
          : 'No accommodation planned',
        status: hotelStatus,
        score: hotelStatus === 'ok' ? 25 : hotelStatus === 'warn' ? 12 : 0,
        icon: Hotel,
        action: hotelCoverage < 0.9 ? { label: 'Find stays', href: '/zone/lodging' } : undefined,
      },
      {
        id: 'budget',
        label: !budgetSet
          ? 'No budget set'
          : budgetPct > 1 ? `Over budget by $${Math.round(budget.spent - budget.total).toLocaleString()}`
          : budgetPct > 0.85 ? `${Math.round(budgetPct * 100)}% of budget used — watch out`
          : `$${Math.max(0, budget.total - budget.spent).toLocaleString()} remaining`,
        status: budgetStatus,
        score: budgetStatus === 'ok' ? 25 : budgetStatus === 'warn' ? 12 : 0,
        icon: Wallet,
        action: !budgetSet ? { label: 'Set budget', href: '/setup' } : undefined,
      },
      {
        id: 'planning',
        label: plannedPct >= 0.8
          ? `${daysWithEntities.length} of ${totalDays} days fully planned`
          : plannedPct > 0
          ? `${totalDays - daysWithEntities.length} day${totalDays - daysWithEntities.length !== 1 ? 's' : ''} still empty`
          : 'No days planned yet',
        status: planStatus,
        score: planStatus === 'ok' ? 25 : planStatus === 'warn' ? 12 : 0,
        icon: CheckSquare,
        action: plannedPct < 0.8 ? { label: 'Plan with AI', href: '/zone/flights' } : undefined,
      },
    ];
  }, [days, budget, trip]);

  const totalScore = items.reduce((s, i) => s + i.score, 0);
  const scoreColor = totalScore >= 80 ? EMERALD : totalScore >= 50 ? AZURE : totalScore >= 25 ? AMBER : RED;
  const scoreLabel = totalScore >= 90 ? 'Trip Ready ✓' : totalScore >= 70 ? 'Almost Ready' : totalScore >= 40 ? 'In Progress' : 'Needs Attention';
  const badItems   = items.filter(i => i.status === 'bad').length;
  const warnItems  = items.filter(i => i.status === 'warn').length;

  if (days.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28, delay: 0.1 }}
      style={{
        borderRadius: 20, overflow: 'hidden', marginBottom: 12,
        background: 'rgba(255,255,255,0.82)',
        backdropFilter: 'blur(32px)',
        border: '1px solid rgba(255,255,255,0.90)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
      }}
    >
      {/* Header row */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 14px 10px',
        borderBottom: '1px solid rgba(0,0,0,0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 11, flexShrink: 0,
            background: `${scoreColor}12`, border: `1px solid ${scoreColor}28`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Zap size={16} color={scoreColor} strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.022em' }}>
              Trip Health
            </div>
            <div style={{ fontSize: 10.5, color: '#6E6E73', fontWeight: 500, marginTop: 1 }}>
              {badItems > 0 ? `${badItems} issue${badItems !== 1 ? 's' : ''} need attention` : warnItems > 0 ? `${warnItems} item${warnItems !== 1 ? 's' : ''} to review` : 'Everything looks good'}
            </div>
          </div>
        </div>

        {/* Score badge */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: scoreColor, letterSpacing: '-0.045em', lineHeight: 1 }}>
            {totalScore}
          </div>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: scoreColor, letterSpacing: '-0.01em', opacity: 0.80 }}>
            / 100 · {scoreLabel}
          </div>
        </div>
      </div>

      {/* Score bar */}
      <div style={{ height: 3, background: 'rgba(0,0,0,0.06)' }}>
        <motion.div
          animate={{ width: `${totalScore}%` }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
          style={{ height: '100%', background: `linear-gradient(90deg, ${scoreColor}80, ${scoreColor})` }}
        />
      </div>

      {/* Health items */}
      <div style={{ padding: '8px 10px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map((item, i) => {
          const Icon = item.icon;
          const color = item.status === 'ok' ? EMERALD : item.status === 'warn' ? AMBER : RED;
          const dot   = item.status === 'ok' ? '✓' : item.status === 'warn' ? '!' : '×';
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.06, type: 'spring', stiffness: 400, damping: 28 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 11,
                background: `${color}06`,
                border: `1px solid ${color}16`,
              }}
            >
              <div style={{
                width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                background: `${color}12`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={12} color={color} strokeWidth={2} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: '#1D1D1F', letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.label}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                  background: `${color}14`, border: `1.5px solid ${color}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 900, color,
                }}>
                  {dot}
                </div>
                {item.action && (
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                    onClick={() => router.push(item.action!.href)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '4px 9px', borderRadius: 8, cursor: 'pointer',
                      background: `${color}10`, border: `1px solid ${color}28`,
                      fontFamily: 'inherit', fontSize: 10, fontWeight: 700, color,
                    }}
                  >
                    {item.action.label}
                    <ArrowRight size={9} strokeWidth={2.5} />
                  </motion.button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
