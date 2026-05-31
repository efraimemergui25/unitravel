// True drag-and-drop physics: bounding box intersection → Zustand commit → FinancialEngine.
// Wire onDragEndWithPhysics to Framer Motion's onDragEnd on every draggable entity card.

import { useCallback, useRef }   from 'react';
import { handleEntityDrop }      from '@/utils/TimelineSync';
import type { TimelineDropPayload } from '@/utils/TimelineSync';

// ── Geometry ──────────────────────────────────────────────────────────────────

/**
 * Overlap area of `drag` rect divided by drag rect area.
 * Returns 0–1; 1 = drag is fully inside drop zone.
 */
export function computeIntersectionRatio(drag: DOMRect, drop: DOMRect): number {
  const xOverlap    = Math.max(0, Math.min(drag.right, drop.right)   - Math.max(drag.left, drop.left));
  const yOverlap    = Math.max(0, Math.min(drag.bottom, drop.bottom) - Math.max(drag.top, drop.top));
  const intersection = xOverlap * yOverlap;
  const dragArea     = drag.width * drag.height;
  return dragArea > 0 ? intersection / dragArea : 0;
}

export function isPointInRect(x: number, y: number, rect: DOMRect): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

// ── Drop zone registry ────────────────────────────────────────────────────────
// Day cards in LiquidTimeline call registerDropZone on mount.

export interface RegisteredDropZone {
  dayId:       string;
  date:        string;
  destination: string;
  element:     HTMLElement;
}

const ZONE_REGISTRY = new Map<string, RegisteredDropZone>();

export function registerDropZone(zone: RegisteredDropZone): void {
  ZONE_REGISTRY.set(zone.dayId, zone);
}

export function unregisterDropZone(dayId: string): void {
  ZONE_REGISTRY.delete(dayId);
}

// ── Best zone resolver ────────────────────────────────────────────────────────

export function resolveBestDropZone(
  dragBounds: DOMRect,
  pointerX:   number,
  pointerY:   number,
  areaThreshold = 0.08,
): RegisteredDropZone | null {
  for (const zone of ZONE_REGISTRY.values()) {
    const rect = zone.element.getBoundingClientRect();
    // Pointer containment → unambiguous match, return immediately
    if (isPointInRect(pointerX, pointerY, rect)) return zone;
  }

  // Fall back to best area-intersection above threshold
  let best: { zone: RegisteredDropZone; ratio: number } | null = null;
  for (const zone of ZONE_REGISTRY.values()) {
    const rect  = zone.element.getBoundingClientRect();
    const ratio = computeIntersectionRatio(dragBounds, rect);
    if (ratio >= areaThreshold && (!best || ratio > best.ratio)) {
      best = { zone, ratio };
    }
  }
  return best?.zone ?? null;
}

// ── Drop result ───────────────────────────────────────────────────────────────

export interface PhysicsDropResult {
  committed:   boolean;
  dayId:       string | null;
  entityTitle: string;
  message:     string;
}

// ── Master handler ────────────────────────────────────────────────────────────
// Attach to Framer Motion's `onDragEnd` callback:
//   <motion.div drag onDragEnd={(e, info) => onDragEndWithPhysics(info, dragRef.current, payload)} />

export async function onDragEndWithPhysics(
  event:     { point: { x: number; y: number } } | { clientX: number; clientY: number },
  dragRef:   HTMLElement | null,
  entity:    TimelineDropPayload,
  timeHint?: string,
): Promise<PhysicsDropResult> {

  // Pointer position — Framer passes `info.point`; native MouseEvent has clientX/Y
  const pointerX = 'point' in event ? event.point.x : event.clientX;
  const pointerY = 'point' in event ? event.point.y : event.clientY;

  // Build drag bounds: real element rect if available, else 1×1 at pointer
  const dragBounds = dragRef?.getBoundingClientRect()
    ?? new DOMRect(pointerX - 60, pointerY - 32, 120, 64);

  const match = resolveBestDropZone(dragBounds, pointerX, pointerY);

  if (!match) {
    // dragSnapToOrigin on the Framer element handles visual snap-back
    return {
      committed:   false,
      dayId:       null,
      entityTitle: entity.title,
      message:     'No drop zone intersected — entity returned to origin',
    };
  }

  // Emit drop-lock so the target day card plays its spring-bounce animation
  document.dispatchEvent(
    new CustomEvent('unitravel:drop-lock', {
      detail:  { dayId: match.dayId },
      bubbles: true,
    })
  );

  try {
    // handleEntityDrop: auto-injects transit buffer for restaurants, runs DropCascade,
    // calls useTravelEngine.placeEntity → calculatePredictiveBudget (FinancialEngine)
    await handleEntityDrop(entity, match.dayId, timeHint);

    return {
      committed:   true,
      dayId:       match.dayId,
      entityTitle: entity.title,
      message:     `"${entity.title}" committed to ${match.date} · ${match.destination}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      committed:   false,
      dayId:       match.dayId,
      entityTitle: entity.title,
      message:     `Cascade failed: ${msg}`,
    };
  }
}

// ── React hook ────────────────────────────────────────────────────────────────
// Usage in a drag component:
//   const { setDragRef, handleDragEnd } = useDropPhysics();
//   <motion.div ref={el => setDragRef(entity.id, el)} drag
//     onDragEnd={(e, info) => handleDragEnd(info, entity.id, payload)} />

export function useDropPhysics(timeHint?: string) {
  const refs = useRef(new Map<string, HTMLElement>());

  const setDragRef = useCallback((entityId: string, el: HTMLElement | null) => {
    if (el) refs.current.set(entityId, el);
    else    refs.current.delete(entityId);
  }, []);

  const handleDragEnd = useCallback(
    (
      event:    { point: { x: number; y: number } } | { clientX: number; clientY: number },
      entityId: string,
      entity:   TimelineDropPayload,
    ) => onDragEndWithPhysics(event, refs.current.get(entityId) ?? null, entity, timeHint),
    [timeHint],
  );

  return { setDragRef, handleDragEnd };
}
