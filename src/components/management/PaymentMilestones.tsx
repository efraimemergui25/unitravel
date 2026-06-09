'use client';

import { useMemo, useState }        from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarX, Plane, Hotel, UtensilsCrossed, Compass, Car } from 'lucide-react';
import { useTravelEngine }      from '@/store/useTravelEngine';
import type { PlacedEntity }    from '@/store/useTravelEngine';

// ── Design tokens ─────────────────────────────────────────────────────────────

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
  label:       string;
  amount:      number;
  dueDate:     string;
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

function deriveMilestones(entities: PlacedEntity[], tripStartDate: string): PaymentMilestone[] {
  const milestones: PaymentMilestone[] = [];

  for (const entity of entities) {
    if (entity.price <= 0) continue;
    const { category } = entity;

    if (category === 'hotel') {
      const depositAmt = Math.round(entity.price * 0.20);
      const balanceAmt = entity.price - depositAmt;
      const depositDue = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
      const balanceDue = new Date(new Date(tripStartDate).getTime() - 3 * 86_400_000).toISOString().slice(0, 10);

      milestones.push({
        id: `${entity.id}-deposit`, entityId: entity.id, entityTitle: entity.title, category,
        label: 'Deposit (20%)', amount: depositAmt, dueDate: depositDue,
        status: statusFromDays(daysUntil(depositDue), entity.booked), isPaid: entity.booked,
      });
      milestones.push({
        id: `${entity.id}-balance`, entityId: entity.id, entityTitle: entity.title, category,
        label: 'Final Balance', amount: balanceAmt, dueDate: balanceDue,
        status: statusFromDays(daysUntil(balanceDue), entity.booked), isPaid: entity.booked,
      });

    } else if (category === 'flight') {
      milestones.push({
        id: `${entity.id}-full`, entityId: entity.id, entityTitle: entity.title, category,
        label: 'Full Payment', amount: entity.price,
        dueDate: new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10),
        status: statusFromDays(2, entity.booked), isPaid: entity.booked,
      });

    } else if (category === 'restaurant' && entity.price > 200) {
      milestones.push({
        id: `${entity.id}-deposit`, entityId: entity.id, entityTitle: entity.title, category,
        label: 'Reservation Deposit', amount: Math.round(entity.price * 0.25),
        dueDate: new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10),
        status: statusFromDays(14, entity.booked), isPaid: entity.booked,
      });

    } else if (category === 'activity') {
      milestones.push({
        id: `${entity.id}-deposit`, entityId: entity.id, entityTitle: entity.title, category,
        label: 'Activity Deposit (30%)', amount: Math.round(entity.price * 0.30),
        dueDate: new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10),
        status: statusFromDays(10, entity.booked), isPaid: entity.booked,
      });
    }
  }

  const ORDER: Record<MilestoneStatus, number> = { overdue: 0, 'due-soon': 1, upcoming: 2, paid: 3 };
  return milestones.sort((a, b) => ORDER[a.status] - ORDER[b.status] || daysUntil(a.dueDate) - daysUntil(b.dueDate));
}

// ── Paid SVG checkmark ────────────────────────────────────────────────────────

function CheckSVG() {
  return (
    <svg width={14} height={14} viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M2.5 7L5.5 10L11.5 4"
        stroke={GREEN}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Timeline milestone node ───────────────────────────────────────────────────

type LucideC = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
const CATEGORY_ICONS: Record<string, LucideC> = {
  flight: Plane, hotel: Hotel, restaurant: UtensilsCrossed, activity: Compass, transport: Car,
};

function MilestoneNode({ ms, index, isLast }: {
  ms:     PaymentMilestone;
  index:  number;
  isLast: boolean;
}) {
  const days = daysUntil(ms.dueDate);

  const dueLabel = ms.isPaid  ? 'Paid'
    : days < 0   ? `${Math.abs(days)}d overdue`
    : days === 0 ? 'Due today'
    : days === 1 ? 'Due tomorrow'
    : `Due in ${days}d`;

  const statusColor =
    ms.status === 'paid'     ? GREEN  :
    ms.status === 'overdue'  ? RED    :
    ms.status === 'due-soon' ? AMBER  : AZURE;

  const isDueSoon = ms.status === 'due-soon';
  const isOverdue = ms.status === 'overdue';

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1,  x: 0   }}
      exit={{    opacity: 0,  x: -10 }}
      transition={{ ...SPRING_POP, delay: index * 0.07 }}
      style={{ position: 'relative', paddingBottom: isLast ? 0 : 16 }}
    >
      {/* ── Timeline node dot ───────────────────────────────────────────── */}
      <div style={{
        position:  'absolute',
        left:      -28,  // sits on the border-l-2 line
        top:       14,
        width:     14, height: 14,
        borderRadius: '50%',
        background:   ms.isPaid ? GREEN : statusColor,
        border:       '2px solid white',
        boxShadow:    `0 0 0 2px ${statusColor}40, 0 0 10px ${statusColor}50`,
        zIndex:       1,
      }} />

      {/* Pulse ring for urgent items */}
      {(isDueSoon || isOverdue) && (
        <motion.div
          animate={{ scale: [1, 1.8, 1], opacity: [0.7, 0, 0.7] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
          style={{
            position:     'absolute',
            left:         -33,
            top:          9,
            width:        24, height: 24,
            borderRadius: '50%',
            background:   `${statusColor}30`,
            pointerEvents: 'none',
            zIndex:        0,
          }}
        />
      )}

      {/* ── Glass pill ──────────────────────────────────────────────────── */}
      <motion.div
        whileHover={{ scale: 1.01 }}
        transition={SPRING_POP}
        style={{
          display:              'flex',
          alignItems:           'center',
          gap:                  12,
          paddingBlock:         10,
          paddingInline:        14,
          borderRadius:         14,
          background:           ms.isPaid
            ? 'rgba(48,209,88,0.06)'
            : isDueSoon
            ? 'rgba(255,159,10,0.06)'
            : 'rgba(255,255,255,0.60)',
          backdropFilter:       'blur(16px) saturate(1.6)',
          WebkitBackdropFilter: 'blur(16px) saturate(1.6)',
          border:               `1.5px solid ${statusColor}22`,
          // Spec: pending items pulse a soft amber glow
          boxShadow: isDueSoon
            ? '0 0 15px rgba(251,191,36,0.3), inset 0 1px 0 rgba(255,255,255,0.9)'
            : isOverdue
            ? '0 0 15px rgba(255,69,58,0.22), inset 0 1px 0 rgba(255,255,255,0.9)'
            : ms.isPaid
            ? '0 2px 10px rgba(48,209,88,0.10), inset 0 1px 0 rgba(255,255,255,0.9)'
            : '0 2px 10px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.9)',
        }}
      >
        {/* Status indicator */}
        <div style={{ flexShrink: 0 }}>
          {ms.isPaid ? (
            // Spec: "Solid crisp green checkmark SVG with bg-green-500/20"
            <div style={{
              width:          26, height: 26,
              borderRadius:   '50%',
              background:     'rgba(34,197,94,0.20)',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              border:         `1.5px solid ${GREEN}40`,
            }}>
              <CheckSVG />
            </div>
          ) : (
            (() => {
              const CatIcon = CATEGORY_ICONS[ms.category];
              return (
                <div style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: `${statusColor}14`, border: `1.5px solid ${statusColor}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {CatIcon
                    ? <CatIcon size={12} color={statusColor} strokeWidth={2} />
                    : <span style={{ fontSize: 10, color: statusColor }}>·</span>
                  }
                </div>
              );
            })()
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
          <div style={{ fontSize: 9.5, fontWeight: 500, color: '#6E6E73', letterSpacing: '-0.01em', marginTop: 1 }}>
            {ms.label}
          </div>
        </div>

        {/* Amount + due tag */}
        <div style={{ textAlign: 'end', flexShrink: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: statusColor, letterSpacing: '-0.03em' }}>
            ${ms.amount.toLocaleString()}
          </div>
          <div style={{
            display:       'inline-block',
            marginTop:     3,
            fontSize:      8.5, fontWeight: 700,
            color:         ms.isPaid ? GREEN : statusColor,
            background:    `${statusColor}10`,
            border:        `1px solid ${statusColor}25`,
            borderRadius:  5, paddingBlock: 1.5, paddingInline: 6,
            whiteSpace:    'nowrap', letterSpacing: '-0.01em',
          }}>
            {dueLabel}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

type MilestoneFilter = 'all' | 'overdue' | 'upcoming' | 'paid';

export function PaymentMilestones() {
  const days = useTravelEngine(s => s.days);
  const trip = useTravelEngine(s => s.trip);
  const [filter, setFilter] = useState<MilestoneFilter>('all');

  const milestones = useMemo(() => {
    const allEntities = days.flatMap(d => d.entities);
    return deriveMilestones(allEntities, trip.startDate || new Date().toISOString().slice(0, 10));
  }, [days, trip.startDate]);

  if (milestones.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, paddingBlock: 20 }}>
        <CalendarX size={20} color="#C7C7CC" strokeWidth={1.5} />
        <span style={{ fontSize: 11, fontWeight: 500, color: '#8E8E93', fontFamily: 'inherit' }}>
          No payments yet
        </span>
      </div>
    );
  }

  const filtered = filter === 'all' ? milestones
    : filter === 'overdue'  ? milestones.filter(m => m.status === 'overdue')
    : filter === 'upcoming' ? milestones.filter(m => m.status === 'upcoming' || m.status === 'due-soon')
    : milestones.filter(m => m.isPaid);

  const overdueCount  = milestones.filter(m => m.status === 'overdue').length;
  const dueSoonCount  = milestones.filter(m => m.status === 'due-soon').length;
  const paidCount     = milestones.filter(m => m.isPaid).length;

  const FILTER_OPTIONS: Array<{ id: MilestoneFilter; label: string; count: number; color: string }> = [
    { id: 'all',      label: 'All',      count: milestones.length, color: '#6E6E73' },
    { id: 'overdue',  label: 'Overdue',  count: overdueCount,       color: RED },
    { id: 'upcoming', label: 'Upcoming', count: dueSoonCount,        color: AMBER },
    { id: 'paid',     label: 'Paid',     count: paidCount,           color: GREEN },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 5, paddingBottom: 4 }}>
        {FILTER_OPTIONS.map(f => (
          <motion.button
            key={f.id}
            onClick={() => setFilter(f.id)}
            whileTap={{ scale: 0.94 }}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '4px 9px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
              background: filter === f.id ? `${f.color}14` : 'rgba(0,0,0,0.04)',
              border: `1px solid ${filter === f.id ? `${f.color}30` : 'rgba(0,0,0,0.07)'}`,
              transition: 'all 0.15s ease',
            }}
          >
            <span style={{ fontSize: 10, fontWeight: filter === f.id ? 800 : 600, color: filter === f.id ? f.color : '#6E6E73' }}>
              {f.label}
            </span>
            {f.count > 0 && (
              <span style={{
                fontSize: 9, fontWeight: 800, color: filter === f.id ? f.color : '#AEAEB2',
                background: filter === f.id ? `${f.color}18` : 'rgba(0,0,0,0.06)',
                borderRadius: 5, padding: '1px 4px',
              }}>{f.count}</span>
            )}
          </motion.button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ fontSize: 11, color: '#AEAEB2', fontWeight: 500, textAlign: 'center', padding: '12px 0' }}>
          No {filter} payments
        </div>
      ) : (
        <div className="border-l-2 border-white/30 ml-4 pl-6 relative" style={{ paddingTop: 4 }}>
          <AnimatePresence>
            {filtered.map((ms, i) => (
              <MilestoneNode key={ms.id} ms={ms} index={i} isLast={i === filtered.length - 1} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
