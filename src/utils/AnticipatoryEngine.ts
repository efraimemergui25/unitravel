// AnticipatoryEngine.ts — Pure crisis-prediction math. No React.
// Watches a day's entity schedule and produces TimelineMutation[] when
// a pivot event (e.g. delayed flight) would cascade into downstream collisions.

import type { PlacedEntity }    from '@/store/useTravelEngine';
import type { TimelineMutation, CrisisEvent, CrisisSeverity } from '@/services/CrisisManager';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ShiftMutation {
  entityId:    string;
  oldTime:     string;
  newTime:     string;
  shiftedByMin: number;
}

export interface ShiftPlan {
  pivotId:      string;
  delayMin:     number;
  affected:     ShiftMutation[];
  unaffected:   string[]; // entity IDs before pivot / no time
  description:  string;
}

export interface TransitGap {
  fromEntityId:  string;
  toEntityId:    string;
  fromEndMin:    number;  // absolute minutes
  toStartMin:    number;
  gapMin:        number;
  needsTransitBlock: boolean;
}

// ── Parsing helpers ───────────────────────────────────────────────────────────

export function parseHHMMtoMin(hhmm: string): number {
  const [h = '0', m = '0'] = hhmm.split(':');
  return parseInt(h, 10) * 60 + parseInt(m, 10);
}

export function minToHHMM(totalMin: number): string {
  const clamped = ((totalMin % 1440) + 1440) % 1440; // wrap 0–1439
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`;
}

export function parseDurationMin(duration?: string): number {
  if (!duration) return 60;
  const h = parseInt(duration.match(/(\d+)h/)?.[1] ?? '0', 10);
  const m = parseInt(duration.match(/(\d+)m/)?.[1] ?? '0', 10);
  return (h * 60 + m) || 60;
}

// ── Core shift logic ──────────────────────────────────────────────────────────

// Given a list of entities, compute what needs to shift if `pivotId`
// now has a new arrival at `newArrivalHHMM` (string "HH:MM").
// `transitBufferMin` is added after the pivot's end before the next event.
export function computeShiftPlan(
  entities:         PlacedEntity[],
  pivotId:          string,
  newArrivalHHMM:   string,
  transitBufferMin: number = 30,
): ShiftPlan | null {
  const pivot = entities.find(e => e.id === pivotId);
  if (!pivot) return null;

  const pivotArrivalMin = parseHHMMtoMin(newArrivalHHMM);
  const pivotDurMin     = parseDurationMin(pivot.duration);
  const pivotEndMin     = pivotArrivalMin + pivotDurMin;

  const oldPivotMin = pivot.time ? parseHHMMtoMin(pivot.time) : pivotArrivalMin;
  const delayMin    = pivotArrivalMin - oldPivotMin;

  // Sort timed entities chronologically
  const timed = entities
    .filter(e => e.time)
    .sort((a, b) => parseHHMMtoMin(a.time!) - parseHHMMtoMin(b.time!));

  const pivotIndex = timed.findIndex(e => e.id === pivotId);
  if (pivotIndex === -1) return null;

  // Only entities scheduled AFTER the pivot
  const downstream = timed.slice(pivotIndex + 1);

  const affected: ShiftMutation[] = [];
  const unaffected: string[]      = [];

  // Walk downstream; propagate the running "latest safe start"
  let safeMin = pivotEndMin + transitBufferMin;

  for (const entity of downstream) {
    const entityStartMin = parseHHMMtoMin(entity.time!);
    const entityDurMin   = parseDurationMin(entity.duration);

    if (entityStartMin < safeMin) {
      // Collision — push forward
      affected.push({
        entityId:     entity.id,
        oldTime:      entity.time!,
        newTime:      minToHHMM(safeMin),
        shiftedByMin: safeMin - entityStartMin,
      });
      safeMin = safeMin + entityDurMin + transitBufferMin;
    } else {
      unaffected.push(entity.id);
      safeMin = entityStartMin + entityDurMin + transitBufferMin;
    }
  }

  // Build human-readable description
  const affectedTitles = affected
    .map(a => entities.find(e => e.id === a.entityId)?.title ?? a.entityId)
    .slice(0, 2)
    .join(', ');
  const extra = affected.length > 2 ? ` +${affected.length - 2} more` : '';
  const description = affected.length === 0
    ? 'No downstream conflicts detected.'
    : `AI shifted: ${affectedTitles}${extra} to avoid collision.`;

  return { pivotId, delayMin, affected, unaffected, description };
}

// ── Crisis event builder ──────────────────────────────────────────────────────

// Converts a ShiftPlan into the TimelineMutation[] + CrisisEvent the store expects.
export function shiftPlanToMutations(
  plan:    ShiftPlan,
  dayId:   string,
  context: { pivotTitle: string; newArrivalHHMM: string },
): { mutations: TimelineMutation[]; crisisEvent: CrisisEvent } {
  const mutations: TimelineMutation[] = plan.affected.map(a => ({
    id:       `mut-anticipatory-${a.entityId}-${Date.now()}`,
    dayId,
    entityId: a.entityId,
    field:    'time' as const,
    oldValue: a.oldTime,
    newValue: a.newTime,
  }));

  const severity: CrisisSeverity =
    plan.delayMin > 120 ? 'critical' :
    plan.delayMin > 60  ? 'high'     :
    plan.delayMin > 30  ? 'medium'   : 'low';

  const crisisEvent: CrisisEvent = {
    id:          `crisis-anticipatory-${Date.now()}`,
    type:        'FLIGHT_DELAY',
    severity,
    triggeredAt: Date.now(),
    title:       `${context.pivotTitle} delayed ${plan.delayMin}m`,
    resolution:  plan.description,
    strategy:    'PUSH_DOWNSTREAM',
    mutations,
    canUndo:     true,
    undone:      false,
  };

  return { mutations, crisisEvent };
}

// ── Transit gap detection ─────────────────────────────────────────────────────

// Scans entity pairs and finds gaps too short to include a transit block.
// Returns pairs that need an auto-injected TransitBlock.
export function detectTransitNeeds(
  entities:       PlacedEntity[],
  transitGapMin:  number = 30, // minimum gap before a transit block is needed
): TransitGap[] {
  const timed = entities
    .filter(e => e.time)
    .sort((a, b) => parseHHMMtoMin(a.time!) - parseHHMMtoMin(b.time!));

  const gaps: TransitGap[] = [];

  for (let i = 0; i < timed.length - 1; i++) {
    const cur  = timed[i]!;
    const next = timed[i + 1]!;

    const curEndMin   = parseHHMMtoMin(cur.time!) + parseDurationMin(cur.duration);
    const nextStartMin = parseHHMMtoMin(next.time!);
    const gapMin       = nextStartMin - curEndMin;

    // Flag as needing transit block if:
    // - gap is positive (entities don't overlap)
    // - gap is less than transitGapMin (not enough buffer already)
    // - neither entity is a transport/transit itself
    if (gapMin > 0 && gapMin < transitGapMin &&
        cur.category !== 'transport' && next.category !== 'transport') {
      gaps.push({
        fromEntityId:      cur.id,
        toEntityId:        next.id,
        fromEndMin:        curEndMin,
        toStartMin:        nextStartMin,
        gapMin,
        needsTransitBlock: true,
      });
    }
  }

  return gaps;
}

// ── calculateTemporalShifts — spec entry point ────────────────────────────────

export interface TemporalNewEvent {
  id:        string;
  title:     string;
  time:      string;   // HH:MM
  duration?: string;   // "2h 30m"
  category?: string;
}

export interface TemporalShiftResult {
  timeline:     PlacedEntity[];  // mutated, time-shifted array
  shifts:       ShiftMutation[]; // which entities moved and by how much
  transitNeeds: TransitGap[];    // pairs that still need transit buffer injection
  description:  string;
}

// Injects newEvent into the timeline, cascades temporal shifts for every
// downstream reservation that would overlap, injects transit buffers,
// and returns the fully mutated timeline ready to commit to the store.
export function calculateTemporalShifts(
  timelineEntities: PlacedEntity[],
  newEvent:         TemporalNewEvent,
  transitBufferMin: number = 30,
): TemporalShiftResult {
  const injected: PlacedEntity = {
    id:           newEvent.id,
    title:        newEvent.title,
    subtitle:     '',
    time:         newEvent.time,
    duration:     newEvent.duration,
    category:     (newEvent.category ?? 'activity') as PlacedEntity['category'],
    price:        0,
    booked:       false,
    tags:         [],
    sourceId:     'anticipatory',
    sourceCount:  1,
    aiConfidence: 1,
    details:      {},
    placedAt:     Date.now(),
  };

  const withNew = [...timelineEntities, injected];

  const plan    = computeShiftPlan(withNew, newEvent.id, newEvent.time, transitBufferMin);
  const shiftMap = new Map<string, string>();
  if (plan) for (const m of plan.affected) shiftMap.set(m.entityId, m.newTime);

  const timeline = withNew.map(e => {
    const shifted = shiftMap.get(e.id);
    return shifted ? { ...e, time: shifted } : e;
  });

  const sorted      = timeline.filter(e => e.time).sort((a, b) => parseHHMMtoMin(a.time!) - parseHHMMtoMin(b.time!));
  const transitNeeds = detectTransitNeeds(sorted, transitBufferMin);

  return {
    timeline,
    shifts:       plan?.affected ?? [],
    transitNeeds,
    description:  plan?.description ?? `${newEvent.title} added without downstream conflicts.`,
  };
}

// ── Flight delay simulation API ───────────────────────────────────────────────

// Entry point called externally (e.g. from CrisisManager or a webhook).
// Given a dayId's entities, a flight entity, and a delay in minutes,
// returns a ready-to-apply ShiftPlan.
export function anticipateFlightDelay(
  entities:  PlacedEntity[],
  flightId:  string,
  delayMin:  number,
  transitBufferMin: number = 30,
): ShiftPlan | null {
  const flight = entities.find(e => e.id === flightId);
  if (!flight?.time) return null;

  const newArrivalMin = parseHHMMtoMin(flight.time) + delayMin;
  const newArrivalHHMM = minToHHMM(newArrivalMin);

  return computeShiftPlan(entities, flightId, newArrivalHHMM, transitBufferMin);
}
