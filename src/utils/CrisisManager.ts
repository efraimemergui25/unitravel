'use client';

import { useEffect, useRef, useCallback }                   from 'react';
import { CrisisManager as CrisisManagerService }             from '@/services/CrisisManager';
import type { CrisisEvent, TimelineMutation }                 from '@/services/CrisisManager';
import { useTravelEngine }                                   from '@/store/useTravelEngine';
import type { PlacedEntity, EngineDay }                      from '@/store/useTravelEngine';
import { useToastStore }                                     from '@/store/useToastStore';
import { handleTemporalDisruption }                          from '@/utils/TemporalRouter';
import type { TimeBlock }                                    from '@/utils/TemporalRouter';

export type { CrisisEvent, TimelineMutation } from '@/services/CrisisManager';

// ── ISO ↔ HH:MM helpers ──────────────────────────────────────────────────────

function parseDurationToMinutes(duration: string): number {
  const h = parseInt(duration.match(/(\d+)h/)?.[1] ?? '0');
  const m = parseInt(duration.match(/(\d+)m/)?.[1] ?? '0');
  return h * 60 + m;
}

function isoToHHMM(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

// Convert PlacedEntity to a TimeBlock using the day's date as the ISO anchor.
// Treats HH:MM as UTC-relative for cascade math (only deltas matter).
function entityToTimeBlock(entity: PlacedEntity, day: EngineDay): TimeBlock | null {
  if (!entity.time) return null;
  const [h, m] = entity.time.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  const baseMs  = new Date(`${day.date}T00:00:00Z`).getTime();
  const startMs = baseMs + (h * 60 + m) * 60_000;
  const durMins = entity.duration ? parseDurationToMinutes(entity.duration) : 60;
  const endMs   = startMs + durMins * 60_000;
  return {
    id:          entity.id,
    type:        entity.category as TimeBlock['type'],
    title:       entity.title,
    startISO:    new Date(startMs).toISOString(),
    endISO:      new Date(endMs).toISOString(),
    durationMin: durMins,
    dayId:       day.id,
    entityId:    entity.id,
  };
}

// ── ISO-aware cascade mutation builder ───────────────────────────────────────
// Feeds entities into TemporalRouter's handleTemporalDisruption so the full
// day's cascade logic (restaurant reservation flags, flight gate risk, hotel
// check-in notifications) runs before mutations are stored.

function buildISOAwareMutations(
  disruptedEntityId: string,
  delayMinutes:      number,
  days:              EngineDay[],
): TimelineMutation[] {
  for (const day of days) {
    if (!day.entities.find(e => e.id === disruptedEntityId)) continue;

    const timeBlocks: TimeBlock[] = day.entities
      .map(e => entityToTimeBlock(e, day))
      .filter((b): b is TimeBlock => b !== null);

    const disruption = handleTemporalDisruption(timeBlocks, disruptedEntityId, delayMinutes);

    return disruption.shiftedBlocks.map(shifted => {
      const original = timeBlocks.find(b => b.id === shifted.id);
      return {
        id:       `mut-${shifted.id}-${Date.now()}`,
        dayId:    day.id,
        entityId: shifted.id,
        field:    'time' as const,
        oldValue: original ? isoToHHMM(original.startISO) : '??:??',
        newValue: isoToHHMM(shifted.startISO),
      };
    });
  }
  return [];
}

// ── External flight-status poll (token-gated, graceful no-op on 404/error) ──

interface FlightStatusPayload {
  flightNumber: string;
  delayMinutes: number;
  status:       'on-time' | 'delayed' | 'cancelled' | 'boarding';
}

async function pollFlightStatus(
  flightNumber: string,
  scheduledISO: string,
): Promise<FlightStatusPayload | null> {
  try {
    const url = new URL('/api/flights/status', window.location.origin);
    url.searchParams.set('flight', flightNumber);
    url.searchParams.set('scheduled', scheduledISO);
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return null;
    return (await res.json()) as FlightStatusPayload;
  } catch {
    return null;
  }
}

// ── useCrisisManager hook ────────────────────────────────────────────────────

export function useCrisisManager() {
  const days            = useTravelEngine(s => s.days);
  const applyMutations  = useTravelEngine(s => s.applyMutations);
  const addToast        = useToastStore(s => s.addToast);

  // Stable refs so the manager's internal interval always sees current state
  const daysRef            = useRef(days);
  const applyMutationsRef  = useRef(applyMutations);
  const addToastRef        = useRef(addToast);
  useEffect(() => { daysRef.current = days; }, [days]);
  useEffect(() => { applyMutationsRef.current = applyMutations; }, [applyMutations]);
  useEffect(() => { addToastRef.current = addToast; }, [addToast]);

  const managerRef = useRef<CrisisManagerService | null>(null);

  useEffect(() => {
    const onCrisis = (event: CrisisEvent, rawMutations: TimelineMutation[]) => {
      // Derive delay from first mutation's HH:MM delta
      let delayMins = 47;
      const firstMut = rawMutations[0];
      if (firstMut?.field === 'time') {
        const [oH, oM] = firstMut.oldValue.split(':').map(Number);
        const [nH, nM] = firstMut.newValue.split(':').map(Number);
        let d = (nH * 60 + nM) - (oH * 60 + oM);
        if (d < 0) d += 24 * 60;
        if (d > 0) delayMins = d;
      }

      // Replace HH:MM mutations with ISO-cascade-aware mutations
      const isoMutations = firstMut?.entityId
        ? buildISOAwareMutations(firstMut.entityId, delayMins, daysRef.current)
        : rawMutations;

      const finalEvent: CrisisEvent = {
        ...event,
        mutations: isoMutations.length > 0 ? isoMutations : rawMutations,
      };

      applyMutationsRef.current(finalEvent.mutations, finalEvent);
      addToastRef.current(finalEvent);
    };

    managerRef.current = new CrisisManagerService(
      () => daysRef.current,
      onCrisis,
    );
    managerRef.current.start(55_000);

    return () => {
      managerRef.current?.stop();
      managerRef.current = null;
    };
  }, []); // intentionally mount-only — state flows through refs

  // Manual trigger for demos / testing
  const triggerDemo = useCallback(() => {
    managerRef.current?.simulateCrisis();
  }, []);

  // On-demand flight poll (called from FlightCard or zone page)
  const pollFlight = useCallback(async (
    flightNumber: string,
    scheduledISO: string,
    entityId:     string,
  ) => {
    const status = await pollFlightStatus(flightNumber, scheduledISO);
    if (!status || status.status === 'on-time' || status.delayMinutes === 0) return;

    const mutations = buildISOAwareMutations(entityId, status.delayMinutes, daysRef.current);
    const event: CrisisEvent = {
      id:          `crisis-${flightNumber}-${Date.now()}`,
      type:        'FLIGHT_DELAY',
      severity:    status.delayMinutes >= 60 ? 'critical' : status.delayMinutes >= 30 ? 'high' : 'medium',
      triggeredAt: Date.now(),
      title:       `${flightNumber} delayed ${status.delayMinutes}m`,
      resolution:  `${mutations.length} downstream ${mutations.length === 1 ? 'event' : 'events'} rescheduled autonomously.`,
      strategy:    'PUSH_DOWNSTREAM',
      mutations,
      canUndo:     true,
      undone:      false,
    };
    applyMutationsRef.current(mutations, event);
    addToastRef.current(event);
  }, []);

  return { triggerDemo, pollFlight };
}
