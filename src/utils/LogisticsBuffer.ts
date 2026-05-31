// Collision-prevention utility for drag-to-timeline transit blocks.
// Validates temporal placement, finds the nearest valid slot, and
// dispatches a shake event when a drop must be denied.

import { detectOverlap, validateDayTimeline } from '@/utils/TemporalRouter';
import type { TimeBlock, ConflictType }        from '@/utils/TemporalRouter';

// ── Constants ─────────────────────────────────────────────────────────────────

const MIN_BUFFER_MINS  = 10;  // minimum gap between any two blocks
const DAY_START_HOUR   = 6;   // 06:00 — earliest valid auto-slot
const DAY_END_HOUR     = 23;  // 23:00 — latest valid auto-slot end

// ── Types ─────────────────────────────────────────────────────────────────────

export type BufferAllowed = {
  allowed:      true;
  startISO:     string;
  endISO:       string;
};

export type BufferDenied = {
  allowed:        false;
  conflictWith:   TimeBlock;
  conflictType:   ConflictType;
  message:        string;
  suggestedStart: string;   // ISO datetime of next valid slot
  suggestedEnd:   string;
  shakeTarget?:   string;   // DOM element id to animate
};

export type BufferResult = BufferAllowed | BufferDenied;

// ── ISO helpers ───────────────────────────────────────────────────────────────

function addMins(iso: string, mins: number): string {
  return new Date(new Date(iso).getTime() + mins * 60_000).toISOString();
}

function toMins(iso: string): number {
  return new Date(iso).getTime() / 60_000;
}

function fromMins(mins: number): string {
  return new Date(mins * 60_000).toISOString();
}

function buildEndISO(startISO: string, durationMin: number): string {
  return addMins(startISO, durationMin);
}

// ── Core: can this block be dropped at the given start time? ──────────────────

export function canDropTransitBlock(
  incoming:       Omit<TimeBlock, 'id'> & { id?: string },
  existingBlocks: TimeBlock[],
  targetStartISO: string,
  shakeTarget?:   string,
): BufferResult {
  const id      = incoming.id ?? `transit-check-${Date.now()}`;
  const endISO  = buildEndISO(targetStartISO, incoming.durationMin);

  const candidate: TimeBlock = {
    ...incoming,
    id,
    startISO: targetStartISO,
    endISO,
  };

  // Check hard overlap with every existing block on the same day
  for (const block of existingBlocks.filter(b => b.dayId === incoming.dayId)) {
    if (detectOverlap(candidate, block)) {
      const suggested = findNextValidSlot(incoming, existingBlocks, targetStartISO);
      return {
        allowed:        false,
        conflictWith:   block,
        conflictType:   'OVERLAPPING_EVENTS',
        message:        `"${incoming.title}" overlaps "${block.title}" — dropped ${formatGap(
          toMins(targetStartISO), toMins(block.endISO),
        )} too early`,
        suggestedStart: suggested.startISO,
        suggestedEnd:   suggested.endISO,
        shakeTarget,
      };
    }

    // Soft buffer: reject if gap is less than MIN_BUFFER_MINS after any block
    const gapAfterBlock  = toMins(targetStartISO) - toMins(block.endISO);
    const gapBeforeBlock = toMins(block.startISO) - toMins(endISO);

    if (gapAfterBlock >= 0 && gapAfterBlock < MIN_BUFFER_MINS) {
      const suggested = findNextValidSlot(incoming, existingBlocks, targetStartISO);
      return {
        allowed:        false,
        conflictWith:   block,
        conflictType:   'INSUFFICIENT_TRANSIT',
        message:        `Only ${Math.round(gapAfterBlock)}min buffer after "${block.title}" — need at least ${MIN_BUFFER_MINS}min`,
        suggestedStart: suggested.startISO,
        suggestedEnd:   suggested.endISO,
        shakeTarget,
      };
    }

    if (gapBeforeBlock >= 0 && gapBeforeBlock < MIN_BUFFER_MINS) {
      const suggested = findNextValidSlot(incoming, existingBlocks, targetStartISO);
      return {
        allowed:        false,
        conflictWith:   block,
        conflictType:   'INSUFFICIENT_TRANSIT',
        message:        `Only ${Math.round(gapBeforeBlock)}min buffer before "${block.title}" — need at least ${MIN_BUFFER_MINS}min`,
        suggestedStart: suggested.startISO,
        suggestedEnd:   suggested.endISO,
        shakeTarget,
      };
    }
  }

  // Day boundary check
  const dayDate   = targetStartISO.split('T')[0];
  const dayStart  = `${dayDate}T${String(DAY_START_HOUR).padStart(2, '0')}:00:00.000Z`;
  const dayEnd    = `${dayDate}T${String(DAY_END_HOUR).padStart(2, '0')}:00:00.000Z`;

  if (toMins(targetStartISO) < toMins(dayStart)) {
    return {
      allowed:        false,
      conflictWith:   { id: 'day-boundary', type: 'buffer', title: 'Day boundary', startISO: dayStart, endISO: dayStart, durationMin: 0, dayId: incoming.dayId },
      conflictType:   'OVERLAPPING_EVENTS',
      message:        `Cannot place transit before ${DAY_START_HOUR}:00`,
      suggestedStart: dayStart,
      suggestedEnd:   buildEndISO(dayStart, incoming.durationMin),
      shakeTarget,
    };
  }

  if (toMins(endISO) > toMins(dayEnd)) {
    return {
      allowed:        false,
      conflictWith:   { id: 'day-end', type: 'buffer', title: 'Day end', startISO: dayEnd, endISO: dayEnd, durationMin: 0, dayId: incoming.dayId },
      conflictType:   'OVERLAPPING_EVENTS',
      message:        `Transit block ends after ${DAY_END_HOUR}:00`,
      suggestedStart: addMins(dayEnd, -incoming.durationMin - MIN_BUFFER_MINS),
      suggestedEnd:   addMins(dayEnd, -MIN_BUFFER_MINS),
      shakeTarget,
    };
  }

  return { allowed: true, startISO: targetStartISO, endISO };
}

// ── Find next valid slot ──────────────────────────────────────────────────────
// Scans forward from the target start (or from the end of the conflicting block)
// to find the earliest time that fits the incoming block with proper buffers.

export function findNextValidSlot(
  incoming:       Omit<TimeBlock, 'id' | 'startISO' | 'endISO'>,
  existingBlocks: TimeBlock[],
  fromISO:        string,
): { startISO: string; endISO: string } {
  const dayId     = incoming.dayId;
  const dayBlocks = existingBlocks
    .filter(b => b.dayId === dayId)
    .sort((a, b) => toMins(a.startISO) - toMins(b.startISO));

  const needed    = incoming.durationMin + MIN_BUFFER_MINS;
  const dayDate   = fromISO.split('T')[0];
  const dayEndISO = `${dayDate}T${String(DAY_END_HOUR).padStart(2, '0')}:00:00.000Z`;

  // Build candidate slots: after each existing block + buffer
  const candidateStarts: string[] = [
    `${dayDate}T${String(DAY_START_HOUR).padStart(2, '0')}:00:00.000Z`,
    ...dayBlocks.map(b => addMins(b.endISO, MIN_BUFFER_MINS)),
  ];

  for (const candidateStart of candidateStarts) {
    // Must be at or after fromISO
    if (toMins(candidateStart) < toMins(fromISO)) continue;

    const candidateEnd = buildEndISO(candidateStart, incoming.durationMin);

    // Must end before day end
    if (toMins(candidateEnd) > toMins(dayEndISO)) break;

    // Must not overlap any existing block
    const trial: TimeBlock = {
      id:          'trial',
      type:        incoming.type,
      title:       incoming.title,
      startISO:    candidateStart,
      endISO:      candidateEnd,
      durationMin: incoming.durationMin,
      dayId,
    };

    const hasConflict = dayBlocks.some(b => detectOverlap(trial, b));
    if (!hasConflict) {
      return { startISO: candidateStart, endISO: candidateEnd };
    }
  }

  // Fallback: slot at end of day even if it slightly violates boundary
  const fallbackStart = addMins(dayEndISO, -(incoming.durationMin + MIN_BUFFER_MINS));
  return { startISO: fallbackStart, endISO: addMins(fallbackStart, incoming.durationMin) };
}

// ── Shake event dispatcher ────────────────────────────────────────────────────
// Fires a CustomEvent that the Timeline drop zone can listen for to play
// a Framer Motion denial shake animation on the target element.

export function dispatchShakeAnimation(elementId: string, denied: BufferDenied): void {
  if (typeof document === 'undefined') return;
  document.dispatchEvent(
    new CustomEvent('unitravel:drop-denied', {
      detail: {
        elementId,
        message:        denied.message,
        suggestedStart: denied.suggestedStart,
      },
      bubbles: true,
    }),
  );
}

// ── Bulk validate a full day ──────────────────────────────────────────────────
// Thin wrapper around TemporalRouter.validateDayTimeline that also checks
// buffer gaps — useful for final-commit validation before persisting to store.

export function validateLogisticsDay(blocks: TimeBlock[]): {
  valid:    boolean;
  issues:   string[];
} {
  const result = validateDayTimeline(blocks);
  const issues: string[] = [
    ...result.conflicts.map(c => c.message),
    ...result.warnings,
  ];
  return { valid: result.valid, issues };
}

// ── Framer Motion shake variant (export for drop zones) ───────────────────────

export const SHAKE_VARIANT = {
  idle:  { x: 0 },
  shake: {
    x:          [0, -10, 10, -8, 8, -5, 5, 0],
    transition: { duration: 0.5, ease: 'easeInOut' },
  },
};

// ── Internal helpers ──────────────────────────────────────────────────────────

function formatGap(a: number, b: number): string {
  const diff = Math.abs(Math.round(b - a));
  return diff >= 60
    ? `${Math.floor(diff / 60)}h ${diff % 60}m`
    : `${diff}m`;
}
