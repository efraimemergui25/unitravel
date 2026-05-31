// Master drop-event orchestrator — fires the 5-step cascade on every entity placement.

import { useTravelEngine } from '@/store/useTravelEngine';
import { usePlanningBoard } from '@/store/usePlanningBoard';
import { useMultiplayerStore } from '@/store/useMultiplayerStore';
import { CalendarSync } from '@/services/CalendarSync';
import { validateDayTimeline } from '@/utils/TemporalRouter';
import type { TimeBlock } from '@/utils/TemporalRouter';
import type { AggregatedResult, AggregatedFlight } from '@/services/OmniAggregator';

export type DropCascadeResult = {
  entityId:      string;
  dayId:         string;
  broadcastId:   string;
  conflicts:     Array<{ type: string; message: string }>;
  warnings:      string[];
  calendarReady: boolean;
};

function parseDurationToMinutes(duration?: string): number {
  if (!duration) return 60;
  const h = parseInt(duration.match(/(\d+)h/)?.[1] ?? '0', 10);
  const m = parseInt(duration.match(/(\d+)m/)?.[1] ?? '0', 10);
  return h * 60 + m || 60;
}

// ── STEP 1: tactile lock pulse ────────────────────────────────────────────────
// Dispatches a CustomEvent that LiquidTimeline can listen for to play a
// satisfying spring-scale bounce on the target day column.

function emitDropLock(targetDayId: string): void {
  if (typeof document === 'undefined') return;
  document.dispatchEvent(
    new CustomEvent('unitravel:drop-lock', { detail: { dayId: targetDayId } }),
  );
}

// ── STEP 2: multiplayer CRDT broadcast ───────────────────────────────────────

function broadcastDrop(source: AggregatedResult, targetDayId: string): string {
  return useMultiplayerStore.getState().broadcastDrop(source, targetDayId);
}

// ── STEP 3: financial deduction via Zustand FinancialEngine ──────────────────
// placeEntity internally calls calculatePredictiveBudget after insertion.

function executePlacement(source: AggregatedResult, targetDayId: string): void {
  const { placeEntity } = useTravelEngine.getState();

  placeEntity(targetDayId, source);

  // Auto-inject transit block downstream for flights
  if (source.category === 'flight') {
    const flight  = source as AggregatedFlight;
    const [fH = 7, fM = 0] = (flight.departure ?? '07:00').split(':').map(Number);
    const dH = parseInt(flight.durationLabel.match(/(\d+)h/)?.[1] ?? '2', 10);
    const dM = parseInt(flight.durationLabel.match(/(\d+)m/)?.[1] ?? '30', 10);
    const landingMins    = fH * 60 + fM + dH * 60 + dM;
    const transitEndMins = landingMins + 90;
    const fmtTime = (mins: number) =>
      `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

    const transitSource = {
      id:                   `transit-auto-${source.id}`,
      category:             'flight' as const,
      sources:              [] as string[],
      sourceCount:          1,
      aiConfidence:         0.95,
      tags:                 ['auto', 'transit', 'immigration'],
      airline:              '',
      flightNumber:         '',
      route:                'Airport Transit & Immigration',
      origin:               '',
      destination:          '',
      departure:            fmtTime(landingMins),
      arrival:              fmtTime(transitEndMins),
      durationMin:          90,
      durationLabel:        '1h 30m',
      stops:                0,
      class:                'Economy' as const,
      price:                0,
      priceRange:           [0, 0] as [number, number],
      carbonKg:             0,
      carbonLabel:          'Ground transport',
      carbonAlternative:    '',
      priceDropProbability: 0,
      seats:                0,
      refundable:           false,
    } satisfies AggregatedFlight;

    placeEntity(targetDayId, transitSource);
  }

  // Remove from staging board if this entity was staged
  const { staged, removeFromBoard } = usePlanningBoard.getState();
  const stagedItem = staged.find(s => s.source.id === source.id);
  if (stagedItem) removeFromBoard(stagedItem.id);
}

// ── STEP 4: CrisisManager temporal overlap check ─────────────────────────────
// Reads fresh state after placement so the newly-placed entity is included.

function checkTemporalConflicts(targetDayId: string): Pick<DropCascadeResult, 'conflicts' | 'warnings'> {
  const { days } = useTravelEngine.getState();
  const day = days.find(d => d.id === targetDayId);
  if (!day || day.entities.length < 2) return { conflicts: [], warnings: [] };

  const blocks: TimeBlock[] = day.entities.map(e => {
    const [hh = '09', mm = '00'] = (e.time ?? '09:00').split(':');
    const startISO    = `${day.date}T${hh}:${mm}:00.000Z`;
    const durationMin = parseDurationToMinutes(e.duration);
    const endISO      = new Date(
      new Date(startISO).getTime() + durationMin * 60_000,
    ).toISOString();

    return {
      id:          e.id,
      type:        e.category as TimeBlock['type'],
      title:       e.title,
      startISO,
      endISO,
      durationMin,
      dayId:       day.id,
      entityId:    e.id,
    };
  });

  const { valid, conflicts, warnings } = validateDayTimeline(blocks);

  if (!valid && typeof document !== 'undefined') {
    document.dispatchEvent(
      new CustomEvent('unitravel:temporal-conflict', {
        detail: { dayId: targetDayId, conflicts },
      }),
    );
  }

  return {
    conflicts: conflicts.map(c => ({ type: c.type, message: c.message })),
    warnings,
  };
}

// ── STEP 5: Calendar sync preparation ────────────────────────────────────────

function prepareCalendarSync(): boolean {
  return CalendarSync.hasEntities(useTravelEngine.getState().days);
}

// ── Master orchestrator ───────────────────────────────────────────────────────

export async function handleMasterEntityDrop(
  source:      AggregatedResult,
  targetDayId: string,
): Promise<DropCascadeResult> {
  // 1. UI lock — tactile feedback pulse dispatched to LiquidTimeline
  emitDropLock(targetDayId);

  // 2. Multiplayer CRDT broadcast
  const broadcastId = broadcastDrop(source, targetDayId);

  // 3. Financial deduction + transit injection via Zustand FinancialEngine
  executePlacement(source, targetDayId);

  // 4. Temporal overlap check — reads fresh state post-placement
  const { conflicts, warnings } = checkTemporalConflicts(targetDayId);

  // 5. Calendar sync readiness
  const calendarReady = prepareCalendarSync();

  return {
    entityId:    `placed-${source.id}`,
    dayId:       targetDayId,
    broadcastId,
    conflicts,
    warnings,
    calendarReady,
  };
}
