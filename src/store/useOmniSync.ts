'use client';

// useOmniSync.ts — Anti-Facade AI-to-UI bridge
// Single source of truth for all aviation deep filters.
// Both the 2/3 Workspace (AviationDeepFilters) and the 1/3 AI Chat write to this store.
// When the AI says "only direct flights after 18:00", syncFiltersFromAI() mutates this
// store — the UI observes and physically animates to the new state.

import { create } from 'zustand';
import { immer }  from 'zustand/middleware/immer';

// ── Types ─────────────────────────────────────────────────────────────────────

export type RouteType  = 'one-way' | 'round-trip' | 'multi-city';
export type StopsOption = 'direct' | '1-stop' | '2-plus';

export interface MultiCityLeg {
  id:   string;
  from: string;
  to:   string;
  date: string;
}

export interface AviationFilters {
  routeType:          RouteType;
  departureTimeRange: [number, number]; // hours 0–23
  arrivalTimeRange:   [number, number]; // hours 0–23
  stopsFilter:        StopsOption[];    // empty = all
  multiCityLegs:      MultiCityLeg[];
  cabinClass:         'ECONOMY' | 'PREMIUM_ECONOMY' | 'BUSINESS' | 'FIRST' | null;
  maxPrice:           number | null;
  preferredAirlines:  string[];
  bannedAirlines:     string[];
}

// Partial payload the AI can send — only the keys it wants to change
export type AISyncPayload = Partial<AviationFilters> & {
  // Shorthand the AI can use
  directOnly?:         boolean;
  departureAfter?:     number; // shorthand for departureTimeRange[0]
  departureBefore?:    number;
  arrivalAfter?:       number;
  arrivalBefore?:      number;
};

interface OmniSyncState {
  filters:   AviationFilters;
  // Timestamp of last AI-triggered mutation, used to trigger UI animations
  lastAISyncAt: number | null;

  // Full filter setter (from UI)
  setFilters:       (patch: Partial<AviationFilters>) => void;

  // Granular setters (from UI components)
  setRouteType:     (t: RouteType) => void;
  setDepartureTime: (range: [number, number]) => void;
  setArrivalTime:   (range: [number, number]) => void;
  toggleStop:       (stop: StopsOption) => void;
  setStops:         (stops: StopsOption[]) => void;
  setMultiCityLegs: (legs: MultiCityLeg[]) => void;

  // AI-to-UI bridge — AI calls this when user says e.g. "direct only after 18:00"
  syncFiltersFromAI: (payload: AISyncPayload) => void;

  resetFilters: () => void;
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_FILTERS: AviationFilters = {
  routeType:          'round-trip',
  departureTimeRange: [0, 23],
  arrivalTimeRange:   [0, 23],
  stopsFilter:        [],
  multiCityLegs:      [
    { id: 'leg-0', from: '', to: '', date: '' },
    { id: 'leg-1', from: '', to: '', date: '' },
  ],
  cabinClass:         null,
  maxPrice:           null,
  preferredAirlines:  [],
  bannedAirlines:     [],
};

// ── Store ─────────────────────────────────────────────────────────────────────

export const useOmniSync = create<OmniSyncState>()(
  immer((set) => ({
    filters:      { ...DEFAULT_FILTERS },
    lastAISyncAt: null,

    setFilters: (patch) =>
      set(s => { Object.assign(s.filters, patch); }),

    setRouteType: (t) =>
      set(s => { s.filters.routeType = t; }),

    setDepartureTime: (range) =>
      set(s => { s.filters.departureTimeRange = range; }),

    setArrivalTime: (range) =>
      set(s => { s.filters.arrivalTimeRange = range; }),

    toggleStop: (stop) =>
      set(s => {
        const idx = s.filters.stopsFilter.indexOf(stop);
        if (idx === -1) s.filters.stopsFilter.push(stop);
        else            s.filters.stopsFilter.splice(idx, 1);
      }),

    setStops: (stops) =>
      set(s => { s.filters.stopsFilter = stops; }),

    setMultiCityLegs: (legs) =>
      set(s => { s.filters.multiCityLegs = legs; }),

    syncFiltersFromAI: (payload) =>
      set(s => {
        // Expand AI shorthand into canonical filter fields
        if (payload.directOnly === true) {
          s.filters.stopsFilter = ['direct'];
        } else if (payload.directOnly === false) {
          s.filters.stopsFilter = [];
        }

        if (payload.departureAfter !== undefined) {
          s.filters.departureTimeRange[0] = Math.max(0, Math.min(23, payload.departureAfter));
        }
        if (payload.departureBefore !== undefined) {
          s.filters.departureTimeRange[1] = Math.max(0, Math.min(23, payload.departureBefore));
        }
        if (payload.arrivalAfter !== undefined) {
          s.filters.arrivalTimeRange[0] = Math.max(0, Math.min(23, payload.arrivalAfter));
        }
        if (payload.arrivalBefore !== undefined) {
          s.filters.arrivalTimeRange[1] = Math.max(0, Math.min(23, payload.arrivalBefore));
        }

        // Apply canonical fields directly
        if (payload.routeType)          s.filters.routeType          = payload.routeType;
        if (payload.departureTimeRange) s.filters.departureTimeRange = payload.departureTimeRange;
        if (payload.arrivalTimeRange)   s.filters.arrivalTimeRange   = payload.arrivalTimeRange;
        if (payload.stopsFilter)        s.filters.stopsFilter        = payload.stopsFilter;
        if (payload.cabinClass !== undefined) s.filters.cabinClass   = payload.cabinClass;
        if (payload.maxPrice   !== undefined) s.filters.maxPrice     = payload.maxPrice;
        if (payload.preferredAirlines)  s.filters.preferredAirlines  = payload.preferredAirlines;
        if (payload.bannedAirlines)     s.filters.bannedAirlines     = payload.bannedAirlines;
        if (payload.multiCityLegs)      s.filters.multiCityLegs      = payload.multiCityLegs;

        s.lastAISyncAt = Date.now();
      }),

    resetFilters: () =>
      set(s => { s.filters = { ...DEFAULT_FILTERS }; s.lastAISyncAt = null; }),
  })),
);
