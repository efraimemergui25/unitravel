'use client';

import { useMemo }             from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTravelEngine }     from '@/store/useTravelEngine';
import type { PlacedEntity }   from '@/store/useTravelEngine';

// ── Constants ─────────────────────────────────────────────────────────────────

const SPRING_POP = { type: 'spring', stiffness: 500, damping: 24 } as const;
const GREEN      = '#30D158';
const AMBER      = '#FF9F0A';
const AZURE      = '#007AFF';
const RED        = '#FF453A';

// ── Milestone model ───────────────────────────────────────────────────────────

export type MilestoneStatus = 'paid' | 'upcoming' | 'due-soon' | 'overdue';

export interface PaymentMilestone {
  id:          string;
  entityId:    string;
  entityTitle: string;
  category:    string;
  label:       string;    // "Deposit" | "Full Payment" | "Final Balance"
  amount:      number;
  dueDate:     string;    // ISO date string
  status:      MilestoneStatus;
  isPaid:      boolean;
}

// ── Milestone derivation ──────────────────────────────────────────────────────

function daysUntil(isoDate: string): number {
  return Math.ceil((new Date(isoDate).getTime() - Date.now()) / 86_400_000);
}

function statusFromDays(days: number, booked: boolean): MilestoneStatus {
  if (booked)     return 'paid';
  if (days < 0)   return 'overdue';
  if (days <= 30) return 'due-soon';
  return 'upcoming';
}

function deriveMilestones(
  entities: PlacedEntity[],
  tripStartDate: string,
): PaymentMilestone[] {
  const milestones: PaymentMilestone[] = [];

  for (const entity of entities) {
    if (entity.price <= 0) continue;

    const category  = entity.category;
    const startISO  = tripStartDate;

    if (category === 'hotel') {
      // Deposit (20%) due now, balance 3 days before check-in
      const depositAmt = Math.round(entity.price * 0.20);
      const balanceAmt = entity.price - depositAmt;

      const depositDue = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
      const balanceDue = new Date(new Date(startISO).getTime() - 3 * 86_400_000).toISOString().slice(0, 10);

      milestones.push({
        id:          `${entity.id}-deposit`,
        entityId:    entity.id,
        entityTitle: entity.title,
        category,
        label:       'Deposit (20%)',
        amount:      depositAmt,
        dueDate:     depositDue,
        status:      statusFromDays(daysUntil(depositDue), entity.booked),
        isPaid:      entity.booked,
      });

      milestones.push({
        id:          `${entity.id}-balance`,
        entityId:    entity.id,
        entityTitle: entity.title,
        category,
        label:       'Final Balance',
        amount:      balanceAmt,
        dueDate:     balanceDue,
        status:      statusFromDays(daysUntil(balanceDue), entity.booked),
        isPaid:      entity.booked,
      });

    } else if (category === 'flight') {
      // Flights: full payment immediately
      milestones.push({
        id:          `${entity.id}-full`,
        entityId:    entity.id,
        entityTitle: entity.title,
        category,
        label:       'Full Payment',
        amount:      entity.price,
        dueDate:     new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10),
        status:      statusFromDays(2, entity.booked),
        isPaid:      entity.booked,
      });

    } else if (category === 'restaurant') {
      // Restaurants: deposit if price > $200/person (Michelin-tier)
      if (entity.price > 200) {
        milestones.push({
          id:          `${entity.id}-deposit`,
          entityId:    entity.id,
          entityTitle: entity.title,
          category,
          label:       'Reservation Deposit',
          amount:      Math.round(entity.price * 0.25),
          dueDate:     new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10),
          status:      statusFromDays(14, entity.booked),
          isPaid:      entity.booked,
        });
      }

    } else if (category === 'activity') {
      milestones.push({
        id:          `${entity.id}-deposit`,
        entityId:    entity.id,
        entityTitle: entity.title,
        category,
        label:       'Activity Deposit (30%)',
        amount:      Math.round(entity.price * 0.30),
        dueDate:     new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10),
        status:      statusFromDays(10, entity.booked),
        isPaid:      entity.booked,
      });
    }
  }

  // Sort: overdue first, then due-soon, then upcoming, then paid
  const ORDER: Record<MilestoneStatus, number> = { overdue: 0, 'due-soon': 1, upcoming: 2, paid: 3 };
  return milestones.sort((a, b) => ORDER[a.status] - ORDER[b.status] || daysUntil(a.dueDate) - daysUntil(b.dueDate));
}

// ── Milestone node ────────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, string> = {
  flight: '✈', hotel: '🏨', restaurant: '🍽', activity: '🎭', transport: '🚕',
};

function MilestoneNode({ ms, index }: { ms: PaymentMilestone; index: number }) {
  const days     = daysUntil(ms.dueDate);
  const dueLabel = ms.isPaid  ? 'Paid'
    : days < 0   ? `${Math.abs(days)}d overdue`
    : days === 0 ? 'Due today'
    : days === 1 ? 'Due tomorrow'
    : `Due in ${days}d`;

  const statusColor =
    ms.status === 'paid'     ? GREEN  :
    ms.status === 'overdue'  ? RED    :
    ms.status === 'due-soon' ? AMBER  : AZURE;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8 }}
      transition={{ ...SPRING_POP, delay: index * 0.06 }}
      style={{
        display:              'flex',
        alignItems:           'center',
        gap:                  12,
        paddingBlock:         10,
        paddingInline:        14,
        borderRadius:         16,
        background:           'rgba(255,255,255,0.50)',
        backdropFilter:       'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border:               `1.5px solid ${statusColor}25`,
        boxShadow:            `0 2px 12px ${statusColor}10, inset 0 1px 0 rgba(255,255,255,0.9)`,
      }}
    >
      {/* Status dot */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        {ms.status === 'paid' ? (
          <div style={{
            width: 24, height: 24, borderRadius: '50%',
            background: `${GREEN}18`, border: `1.5px solid ${GREEN}50`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, color: GREEN,
          }}>
            ✓
          </div>
        ) : (
          <>
            <div style={{
              width: 24, height: 24, borderRadius: '50%',
              background: `${statusColor}15`, border: `1.5px solid ${statusColor}40`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12,
            }}>
              {CATEGORY_ICONS[ms.category] ?? '·'}
            </div>
            {(ms.status === 'due-soon' || ms.status === 'overdue') && (
              <motion.div
                animate={{ scale: [1, 1.5, 1], opacity: [0.8, 0.3, 0.8] }}
                transition={{ duration: 1.8, repeat: Infinity }}
                style={{
                  position:    'absolute',
                  inset:       -3,
                  borderRadius: '50%',
                  border:      `1.5px solid ${statusColor}`,
                  pointerEvents: 'none',
                }}
              />
            )}
          </>
        )}
      </div>

      {/* Details */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize:      11, fontWeight: 800,
          color:         '#1C1C1E', letterSpacing: '-0.02em',
          overflow:      'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {ms.entityTitle}
        </div>
        <div style={{ fontSize: 9.5, fontWeight: 500, color: '#6E6E73', letterSpacing: '-0.01em' }}>
          {ms.label}
        </div>
      </div>

      {/* Amount + due */}
      <div style={{ textAlign: 'end', flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: statusColor, letterSpacing: '-0.03em' }}>
          ${ms.amount.toLocaleString()}
        </div>
        <div style={{
          fontSize:   9, fontWeight: 700,
          color:      statusColor,
          background: `${statusColor}10`, border: `1px solid ${statusColor}25`,
          borderRadius: 6, paddingBlock: 1, paddingInline: 5,
          whiteSpace: 'nowrap',
        }}>
          {dueLabel}
        </div>
      </div>
    </motion.div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function PaymentMilestones() {
  const days    = useTravelEngine(s => s.days);
  const trip    = useTravelEngine(s => s.trip);

  const milestones = useMemo(() => {
    const allEntities = days.flatMap(d => d.entities);
    return deriveMilestones(allEntities, trip.startDate || new Date().toISOString().slice(0, 10));
  }, [days, trip.startDate]);

  if (milestones.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, paddingBlock: 24 }}>
        <span style={{ fontSize: 22 }}>📅</span>
        <span style={{ fontSize: 11, fontWeight: 500, color: '#8E8E93', fontFamily: 'inherit' }}>
          No payments yet
        </span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <AnimatePresence>
        {milestones.map((ms, i) => (
          <MilestoneNode key={ms.id} ms={ms} index={i} />
        ))}
      </AnimatePresence>
    </div>
  );
}
