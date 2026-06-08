'use client';

// useCulinarySync.ts — Anti-Facade AI-to-UI bridge for culinary/dining filters.
// Single source of truth for the Dining zone. Both the 2/3 workspace (CulinaryDeepFilters)
// and the 1/3 AI Chat write here. When AI fires applyAICulinaryFilter(), the UI
// instantly animates: Michelin switch glows, dietary pills depress.

import { create } from 'zustand';
import { immer }  from 'zustand/middleware/immer';

// ── Types ─────────────────────────────────────────────────────────────────────

export type DietaryRestriction = 'Kosher' | 'Vegan' | 'Vegetarian' | 'Halal' | 'Gluten-Free' | 'Pescatarian' | 'Nut-Free' | 'Dairy-Free';
export type DiningVibe         = 'Romantic' | 'High-Energy' | 'Casual' | 'Business' | 'Family' | 'Solo';
export type CuisineType        = 'Mexican' | 'Italian' | 'Japanese' | 'French' | 'Mediterranean' | 'Seafood' | 'Steakhouse' | 'Fusion';

export interface CulinaryFilters {
  dietaryRestrictions: DietaryRestriction[];
  vibes:               DiningVibe[];
  cuisines:            CuisineType[];
  michelinOnly:        boolean;
  bestIn50Only:        boolean;
  priceRange:          [number, number]; // per person
  minRating:           number;           // 0–5
  reservationRequired: boolean | null;   // null = any
  outdoorSeating:      boolean;
  privateRooms:        boolean;
}

export type AICulinaryPayload = Partial<CulinaryFilters> & {
  addDietary?:    DietaryRestriction;
  removeDietary?: DietaryRestriction;
  addVibe?:       DiningVibe;
  maxPrice?:      number;
};

interface CulinarySyncState {
  filters:      CulinaryFilters;
  lastAISyncAt: number | null;

  toggleDietary:    (d: DietaryRestriction) => void;
  toggleVibe:       (v: DiningVibe) => void;
  toggleCuisine:    (c: CuisineType) => void;
  setMichelinOnly:  (v: boolean) => void;
  setBestIn50:      (v: boolean) => void;
  setPriceRange:    (r: [number, number]) => void;
  setMinRating:     (r: number) => void;
  setFilters:       (p: Partial<CulinaryFilters>) => void;

  applyAICulinaryFilter: (payload: AICulinaryPayload) => void;
  resetFilters:          () => void;
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_FILTERS: CulinaryFilters = {
  dietaryRestrictions: [],
  vibes:               [],
  cuisines:            [],
  michelinOnly:        false,
  bestIn50Only:        false,
  priceRange:          [0, 500],
  minRating:           0,
  reservationRequired: null,
  outdoorSeating:      false,
  privateRooms:        false,
};

// ── Store ─────────────────────────────────────────────────────────────────────

export const useCulinarySync = create<CulinarySyncState>()(
  immer((set) => ({
    filters:      { ...DEFAULT_FILTERS },
    lastAISyncAt: null,

    toggleDietary: (d) =>
      set(s => {
        const i = s.filters.dietaryRestrictions.indexOf(d);
        if (i === -1) s.filters.dietaryRestrictions.push(d);
        else          s.filters.dietaryRestrictions.splice(i, 1);
      }),

    toggleVibe: (v) =>
      set(s => {
        const i = s.filters.vibes.indexOf(v);
        if (i === -1) s.filters.vibes.push(v);
        else          s.filters.vibes.splice(i, 1);
      }),

    toggleCuisine: (c) =>
      set(s => {
        const i = s.filters.cuisines.indexOf(c);
        if (i === -1) s.filters.cuisines.push(c);
        else          s.filters.cuisines.splice(i, 1);
      }),

    setMichelinOnly:  (v) => set(s => { s.filters.michelinOnly  = v; }),
    setBestIn50:      (v) => set(s => { s.filters.bestIn50Only   = v; }),
    setPriceRange:    (r) => set(s => { s.filters.priceRange     = r; }),
    setMinRating:     (r) => set(s => { s.filters.minRating      = r; }),
    setFilters:       (p) => set(s => { Object.assign(s.filters, p); }),

    applyAICulinaryFilter: (payload) =>
      set(s => {
        if (payload.addDietary && !s.filters.dietaryRestrictions.includes(payload.addDietary)) {
          s.filters.dietaryRestrictions.push(payload.addDietary);
        }
        if (payload.removeDietary) {
          s.filters.dietaryRestrictions = s.filters.dietaryRestrictions.filter(d => d !== payload.removeDietary);
        }
        if (payload.addVibe && !s.filters.vibes.includes(payload.addVibe)) {
          s.filters.vibes.push(payload.addVibe);
        }
        if (payload.maxPrice !== undefined) {
          s.filters.priceRange = [s.filters.priceRange[0], payload.maxPrice];
        }
        if (payload.michelinOnly  !== undefined) s.filters.michelinOnly  = payload.michelinOnly;
        if (payload.bestIn50Only  !== undefined) s.filters.bestIn50Only  = payload.bestIn50Only;
        if (payload.dietaryRestrictions) s.filters.dietaryRestrictions = payload.dietaryRestrictions;
        if (payload.vibes)          s.filters.vibes         = payload.vibes;
        if (payload.cuisines)       s.filters.cuisines      = payload.cuisines;
        if (payload.priceRange)     s.filters.priceRange    = payload.priceRange;
        if (payload.minRating !== undefined) s.filters.minRating = payload.minRating;

        s.lastAISyncAt = Date.now();
      }),

    resetFilters: () =>
      set(s => { s.filters = { ...DEFAULT_FILTERS }; s.lastAISyncAt = null; }),
  })),
);
