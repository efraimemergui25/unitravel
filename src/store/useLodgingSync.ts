'use client';

// useLodgingSync.ts — Anti-Facade AI-to-UI bridge for lodging filters
// Single source of truth shared between the AI Chat and LodgingDeepFilters UI.
// When the AI says "balcony, quiet zone", applyAILodgingFilter() mutates this store
// and the UI immediately reflects: pill depresses, heatmap pans to teal zone.

import { create } from 'zustand';
import { immer }  from 'zustand/middleware/immer';

// ── Types ─────────────────────────────────────────────────────────────────────

export type VibeZone      = 'culinary' | 'nightlife' | 'quiet' | 'family' | 'business';
export type LodgingTier   = 'Ultra-Luxury' | '5★' | '4★' | '3★' | 'Budget';
export type BedType       = 'King' | 'Queen' | 'Twin' | 'Double' | 'Bunk';
export type BoardType     = 'Room Only' | 'B&B' | 'Half Board' | 'Full Board' | 'All Inclusive';

export const AMENITY_LIST = [
  'Pool', 'Spa', 'Gym', 'Ocean View', 'Beach Access', 'Balcony',
  'Rooftop', 'Restaurant', 'Bar', 'Pet-Friendly', 'Free WiFi',
  'Parking', 'EV Charging', 'Kids Club', 'Airport Transfer',
] as const;

export type Amenity = typeof AMENITY_LIST[number];

export interface LodgingFilters {
  amenities:         Amenity[];
  vibeZones:         VibeZone[];
  tiers:             LodgingTier[];
  bedTypes:          BedType[];
  boardTypes:        BoardType[];
  priceRange:        [number, number];    // per night USD
  distanceRange:     [number, number];    // km from city center 0–20
  minRating:         number;              // 0–5
  freeCancel:        boolean;
  breakfastIncluded: boolean;
  petsAllowed:       boolean;
  focusedZone:       VibeZone | null;     // heatmap focus
}

// Partial payload the AI sends
export type AILodgingPayload = Partial<LodgingFilters> & {
  // Shorthand
  addAmenity?:    Amenity;
  removeAmenity?: Amenity;
  focusZone?:     VibeZone;
  maxPrice?:      number;
  maxDistance?:   number;
};

interface LodgingSyncState {
  filters:      LodgingFilters;
  lastAISyncAt: number | null;

  // UI setters
  toggleAmenity:    (a: Amenity) => void;
  toggleVibeZone:   (z: VibeZone) => void;
  toggleTier:       (t: LodgingTier) => void;
  setPriceRange:    (r: [number, number]) => void;
  setDistanceRange: (r: [number, number]) => void;
  setFocusedZone:   (z: VibeZone | null) => void;
  setMinRating:     (r: number) => void;
  setFilters:       (p: Partial<LodgingFilters>) => void;

  // AI bridge
  applyAILodgingFilter: (payload: AILodgingPayload) => void;

  resetFilters: () => void;
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_FILTERS: LodgingFilters = {
  amenities:         [],
  vibeZones:         [],
  tiers:             [],
  bedTypes:          [],
  boardTypes:        [],
  priceRange:        [0, 2000],
  distanceRange:     [0, 20],
  minRating:         0,
  freeCancel:        false,
  breakfastIncluded: false,
  petsAllowed:       false,
  focusedZone:       null,
};

// ── Store ─────────────────────────────────────────────────────────────────────

export const useLodgingSync = create<LodgingSyncState>()(
  immer((set) => ({
    filters:      { ...DEFAULT_FILTERS },
    lastAISyncAt: null,

    toggleAmenity: (a) =>
      set(s => {
        const i = s.filters.amenities.indexOf(a);
        if (i === -1) s.filters.amenities.push(a);
        else          s.filters.amenities.splice(i, 1);
      }),

    toggleVibeZone: (z) =>
      set(s => {
        const i = s.filters.vibeZones.indexOf(z);
        if (i === -1) { s.filters.vibeZones.push(z); s.filters.focusedZone = z; }
        else          { s.filters.vibeZones.splice(i, 1); s.filters.focusedZone = null; }
      }),

    toggleTier: (t) =>
      set(s => {
        const i = s.filters.tiers.indexOf(t);
        if (i === -1) s.filters.tiers.push(t);
        else          s.filters.tiers.splice(i, 1);
      }),

    setPriceRange:    (r) => set(s => { s.filters.priceRange    = r; }),
    setDistanceRange: (r) => set(s => { s.filters.distanceRange = r; }),
    setFocusedZone:   (z) => set(s => { s.filters.focusedZone  = z; }),
    setMinRating:     (r) => set(s => { s.filters.minRating     = r; }),
    setFilters:       (p) => set(s => { Object.assign(s.filters, p); }),

    applyAILodgingFilter: (payload) =>
      set(s => {
        if (payload.addAmenity && !s.filters.amenities.includes(payload.addAmenity)) {
          s.filters.amenities.push(payload.addAmenity);
        }
        if (payload.removeAmenity) {
          s.filters.amenities = s.filters.amenities.filter(a => a !== payload.removeAmenity);
        }
        if (payload.focusZone) {
          s.filters.focusedZone = payload.focusZone;
          if (!s.filters.vibeZones.includes(payload.focusZone)) {
            s.filters.vibeZones.push(payload.focusZone);
          }
        }
        if (payload.maxPrice !== undefined) {
          s.filters.priceRange = [s.filters.priceRange[0], payload.maxPrice];
        }
        if (payload.maxDistance !== undefined) {
          s.filters.distanceRange = [s.filters.distanceRange[0], payload.maxDistance];
        }
        // Direct field overrides
        if (payload.amenities)    s.filters.amenities    = payload.amenities;
        if (payload.vibeZones)    s.filters.vibeZones    = payload.vibeZones;
        if (payload.tiers)        s.filters.tiers        = payload.tiers;
        if (payload.priceRange)   s.filters.priceRange   = payload.priceRange;
        if (payload.distanceRange) s.filters.distanceRange = payload.distanceRange;
        if (payload.minRating !== undefined) s.filters.minRating = payload.minRating;
        if (payload.freeCancel !== undefined) s.filters.freeCancel = payload.freeCancel;
        if (payload.focusedZone !== undefined) s.filters.focusedZone = payload.focusedZone;

        s.lastAISyncAt = Date.now();
      }),

    resetFilters: () =>
      set(s => { s.filters = { ...DEFAULT_FILTERS }; s.lastAISyncAt = null; }),
  })),
);
