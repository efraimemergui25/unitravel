'use client';

import { create }              from 'zustand';
import { immer }               from 'zustand/middleware/immer';
import { useTravelEngine }     from '@/store/useTravelEngine';
import type { PlacedEntity }   from '@/store/useTravelEngine';
import {
  detectTransitNeeds,
  parseHHMMtoMin,
  parseDurationMin,
} from '@/utils/AnticipatoryEngine';

// ── Provider routing ──────────────────────────────────────────────────────────

const PROVIDER_MAP: Record<string, string> = {
  flight:     'duffel',
  hotel:      'booking',
  restaurant: 'opentable',
  activity:   'viator',
  transport:  'uber',
};

// ── Types ─────────────────────────────────────────────────────────────────────

export type ConflictType = 'overlap' | 'transit_gap';

export interface TemporalConflict {
  id:          string;
  type:        ConflictType;
  dayId:       string;
  entityA:     PlacedEntity;
  entityB:     PlacedEntity;
  description: string;
  gapMinutes?: number; // only for transit_gap
}

export interface ProviderPayload {
  provider: string;
  entities: Array<{
    dayId:      string;
    entity:     PlacedEntity;
    ref:        string;
    date:       string;
    destination:string;
  }>;
}

export interface BookingPayload {
  tripId:      string;
  totalAmount: number;
  travelers:   string[];
  providers:   ProviderPayload[];
  compiledAt:  number;
}

interface CheckoutEngineState {
  isOpen:          boolean;
  isAuthorizing:   boolean;
  isComplete:      boolean;
  conflicts:       TemporalConflict[];
  bookingPayload:  BookingPayload | null;
  pnrs:            Record<string, string>; // entityId → PNR string
  authStep:        string; // human-readable current step during authorize

  open:                  () => void;
  close:                 () => void;
  validateTimeline:      () => TemporalConflict[];
  compileBookingPayload: () => BookingPayload;
  authorize:             () => Promise<void>;
  clearConflicts:        () => void;
  reset:                 () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function generatePNR(): string {
  const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useCheckoutEngine = create<CheckoutEngineState>()(
  immer((set, get) => ({
    isOpen:         false,
    isAuthorizing:  false,
    isComplete:     false,
    conflicts:      [],
    bookingPayload: null,
    pnrs:           {},
    authStep:       '',

    open:  () => set(s => { s.isOpen = true; }),
    close: () => set(s => { s.isOpen = false; }),

    clearConflicts: () => set(s => { s.conflicts = []; }),

    reset: () => set(s => {
      s.isOpen         = false;
      s.isAuthorizing  = false;
      s.isComplete     = false;
      s.conflicts      = [];
      s.bookingPayload = null;
      s.pnrs           = {};
      s.authStep       = '';
    }),

    // ── Validate ────────────────────────────────────────────────────────────

    validateTimeline: () => {
      const { days } = useTravelEngine.getState();
      const conflicts: TemporalConflict[] = [];

      for (const day of days) {
        const timed = [...day.entities]
          .filter(e => e.time)
          .sort((a, b) => parseHHMMtoMin(a.time!) - parseHHMMtoMin(b.time!));

        // 1. Overlap detection
        for (let i = 1; i < timed.length; i++) {
          const prev = timed[i - 1]!;
          const cur  = timed[i]!;
          const prevEnd  = parseHHMMtoMin(prev.time!) + parseDurationMin(prev.duration);
          const curStart = parseHHMMtoMin(cur.time!);

          if (curStart < prevEnd) {
            const overlapMin = prevEnd - curStart;
            conflicts.push({
              id:    `conflict-overlap-${prev.id}-${cur.id}`,
              type:  'overlap',
              dayId: day.id,
              entityA: prev,
              entityB: cur,
              description: `${prev.title} ends at ${minToHHMM(prevEnd)}, but ${cur.title} starts ${overlapMin}min earlier at ${cur.time}`,
            });
          }
        }

        // 2. Insufficient transit gap detection (min 20min for spatial shifts)
        const gaps = detectTransitNeeds(timed, 20);
        for (const gap of gaps) {
          const fromEntity = timed.find(e => e.id === gap.fromEntityId);
          const toEntity   = timed.find(e => e.id === gap.toEntityId);
          if (!fromEntity || !toEntity) continue;

          conflicts.push({
            id:          `conflict-transit-${gap.fromEntityId}-${gap.toEntityId}`,
            type:        'transit_gap',
            dayId:       day.id,
            entityA:     fromEntity,
            entityB:     toEntity,
            description: `Only ${gap.gapMin}min between ${fromEntity.title} and ${toEntity.title} — transit needs at least 20min`,
            gapMinutes:  gap.gapMin,
          });
        }
      }

      set(s => { s.conflicts = conflicts; });
      return conflicts;
    },

    // ── Compile ─────────────────────────────────────────────────────────────

    compileBookingPayload: () => {
      const engine   = useTravelEngine.getState();
      const { days, trip } = engine;

      // Group all entities by provider
      const providerMap = new Map<string, ProviderPayload['entities']>();

      for (const day of days) {
        for (const entity of day.entities) {
          const provider = PROVIDER_MAP[entity.category] ?? 'unitravel';
          if (!providerMap.has(provider)) providerMap.set(provider, []);
          providerMap.get(provider)!.push({
            dayId:       day.id,
            entity,
            ref:         `UNI-${entity.id.slice(-6).toUpperCase()}`,
            date:        day.date,
            destination: day.destination,
          });
        }
      }

      const providers: ProviderPayload[] = Array.from(providerMap.entries()).map(
        ([provider, entities]) => ({ provider, entities }),
      );

      const totalAmount = days.flatMap(d => d.entities).reduce((s, e) => s + e.price, 0);

      const payload: BookingPayload = {
        tripId:      trip.id || `trip-${Date.now()}`,
        totalAmount,
        travelers:   trip.travelers,
        providers,
        compiledAt:  Date.now(),
      };

      set(s => { s.bookingPayload = payload; });
      return payload;
    },

    // ── Authorize ────────────────────────────────────────────────────────────

    authorize: async () => {
      const { validateTimeline, compileBookingPayload } = get();

      // Validate first — abort if there are unresolved conflicts
      const conflicts = validateTimeline();
      if (conflicts.length > 0) return;

      set(s => { s.isAuthorizing = true; s.authStep = 'Compiling booking manifest…'; });

      const payload   = compileBookingPayload();
      const engine    = useTravelEngine.getState();
      const allRows   = engine.days.flatMap(d =>
        d.entities.map(e => ({ entity: e, dayId: d.id }))
      );

      // Stagger engine connections with realistic auth steps
      const steps = [
        'Connecting to Duffel Aviation…',
        'Handshake with Booking.com…',
        'Reserving OpenTable slot…',
        'Confirming Viator activities…',
        'Finalizing payment ledger…',
        'Generating booking references…',
      ];

      for (let i = 0; i < steps.length; i++) {
        set(s => { s.authStep = steps[i]!; });
        await new Promise(r => setTimeout(r, 420 + i * 180));
      }

      // Generate PNRs and mark all entities booked
      const pnrs: Record<string, string> = {};
      for (const { entity, dayId } of allRows) {
        pnrs[entity.id] = generatePNR();
        engine.toggleBooked(dayId, entity.id);
        await new Promise(r => setTimeout(r, 240));
      }

      set(s => {
        s.pnrs         = pnrs;
        s.isAuthorizing = false;
        s.isComplete    = true;
        s.authStep      = '';
      });
    },
  })),
);

// ── Helper exported for CollisionResolver ────────────────────────────────────

function minToHHMM(totalMin: number): string {
  const clamped = ((totalMin % 1440) + 1440) % 1440;
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`;
}

export { minToHHMM as checkoutMinToHHMM };
