'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { ZONE_ENGINES, ZoneId } from '@/lib/zoneEngines';

type EngineMap = Record<string, boolean>;

// ── Preset types ──────────────────────────────────────────────────────────────

export interface ZonePreset {
  id:          string;
  label:       string;
  description: string;
  icon:        string;
  engines:     Partial<Record<ZoneId, string[]>>;
  isBuiltIn:   boolean;
}

// ── State & actions ───────────────────────────────────────────────────────────

interface ZoneState {
  selected:      Record<ZoneId, EngineMap>;
  presets:       ZonePreset[];
  activePresetId:string | null;
}

interface ZoneActions {
  toggleEngine:  (zone: ZoneId, engineId: string) => void;
  selectAll:     (zone: ZoneId) => void;
  selectTop5:    (zone: ZoneId) => void;
  clearAll:      (zone: ZoneId) => void;
  isSelected:    (zone: ZoneId, engineId: string) => boolean;
  selectedCount: (zone: ZoneId) => number;
  selectedIds:   (zone: ZoneId) => string[];
  // Preset actions
  savePreset:    (preset: Omit<ZonePreset, 'id' | 'isBuiltIn'>) => string;
  applyPreset:   (presetId: string) => void;
  deletePreset:  (presetId: string) => void;
}

// ── Built-in presets ──────────────────────────────────────────────────────────

const BUILT_IN_PRESETS: ZonePreset[] = [
  {
    id:          'preset-luxury',
    label:       'Luxury Combo',
    description: 'Best-in-class engines for every zone. No compromises.',
    icon:        '💎',
    isBuiltIn:   true,
    engines: {
      flights:     ['amadeus', 'skyscanner', 'google-flights', 'kayak', 'hopper'],
      lodging:     ['virtuoso', 'mrsmith', 'booking', 'hyatt', 'marriott'],
      dining:      ['michelin', 'w50best', 'resy', 'tock', 'opentable'],
      attractions: ['viator', 'getyourguide', 'klook', 'airbnb-exp'],
      transit:     ['rome2rio', 'uber', 'google-maps-transit', 'rentalcars'],
    },
  },
  {
    id:          'preset-budget',
    label:       'Budget Hunter',
    description: 'Widest spread of low-cost engines to find the best deal.',
    icon:        '💰',
    isBuiltIn:   true,
    engines: {
      flights:     ['skyscanner', 'kiwi', 'momondo', 'jetradar', 'google-flights'],
      lodging:     ['booking', 'agoda', 'hoteltonight', 'hostelworld', 'airbnb'],
      dining:      ['yelp', 'google-maps-d', 'zomato', 'thefork', 'tripadvisor-d'],
      attractions: ['viator', 'getyourguide', 'klook'],
      transit:     ['rome2rio', 'busbud', 'blablacar', 'flixbus'],
    },
  },
  {
    id:          'preset-honeymoon',
    label:       'Honeymoon Suite',
    description: 'Romance-first curation. Intimate hotels, top dining, private experiences.',
    icon:        '🌹',
    isBuiltIn:   true,
    engines: {
      flights:     ['amadeus', 'google-flights', 'kayak', 'hopper'],
      lodging:     ['virtuoso', 'mrsmith', 'smallluxury', 'relais', 'booking'],
      dining:      ['michelin', 'w50best', 'resy', 'tock', 'opentable'],
      attractions: ['airbnb-exp', 'viator', 'getyourguide'],
      transit:     ['uber', 'rentalcars', 'turo', 'rome2rio'],
    },
  },
  {
    id:          'preset-speed',
    label:       'Speed Seeker',
    description: 'Fastest results with the highest-uptime engines only.',
    icon:        '⚡',
    isBuiltIn:   true,
    engines: {
      flights:     ['skyscanner', 'google-flights', 'amadeus'],
      lodging:     ['booking', 'expedia', 'hotels-com'],
      dining:      ['opentable', 'google-maps-d', 'yelp'],
      attractions: ['tripadvisor', 'viator'],
      transit:     ['google-maps-transit', 'uber'],
    },
  },
];

function buildInitialSelected(): Record<ZoneId, EngineMap> {
  const zones: ZoneId[] = ['flights', 'lodging', 'dining', 'attractions', 'transit'];
  return Object.fromEntries(
    zones.map(zone => [
      zone,
      Object.fromEntries(
        ZONE_ENGINES[zone].filter(e => e.tier === 1).map(e => [e.id, true]),
      ),
    ]),
  ) as Record<ZoneId, EngineMap>;
}

export const useZoneStore = create<ZoneState & ZoneActions>()(
  persist(
    (set, get) => ({
      selected:       buildInitialSelected(),
      presets:        BUILT_IN_PRESETS,
      activePresetId: null,

      toggleEngine: (zone, engineId) =>
        set(s => ({
          selected: {
            ...s.selected,
            [zone]: { ...s.selected[zone], [engineId]: !s.selected[zone]?.[engineId] },
          },
          activePresetId: null, // custom selection breaks preset
        })),

      selectAll: (zone) =>
        set(s => ({
          selected: {
            ...s.selected,
            [zone]: Object.fromEntries(ZONE_ENGINES[zone].map(e => [e.id, true])),
          },
          activePresetId: null,
        })),

      selectTop5: (zone) =>
        set(s => ({
          selected: {
            ...s.selected,
            [zone]: Object.fromEntries(ZONE_ENGINES[zone].map(e => [e.id, e.tier === 1])),
          },
          activePresetId: null,
        })),

      clearAll: (zone) =>
        set(s => ({ selected: { ...s.selected, [zone]: {} }, activePresetId: null })),

      isSelected:    (zone, engineId) => !!get().selected[zone]?.[engineId],
      selectedCount: (zone) => Object.values(get().selected[zone] ?? {}).filter(Boolean).length,
      selectedIds:   (zone) =>
        Object.entries(get().selected[zone] ?? {})
          .filter(([, v]) => v)
          .map(([k]) => k),

      savePreset: (partial) => {
        const id = `preset-custom-${Date.now()}`;
        const preset: ZonePreset = { ...partial, id, isBuiltIn: false };
        set(s => ({ presets: [...s.presets, preset], activePresetId: id }));
        return id;
      },

      applyPreset: (presetId) => {
        const preset = get().presets.find(p => p.id === presetId);
        if (!preset) return;
        const zones: ZoneId[] = ['flights', 'lodging', 'dining', 'attractions', 'transit'];
        const newSelected = { ...get().selected };
        for (const zone of zones) {
          const ids = preset.engines[zone];
          if (ids) {
            // Keep any existing engines, enable preset engines
            const map: EngineMap = {};
            for (const e of ZONE_ENGINES[zone]) {
              map[e.id] = ids.includes(e.id);
            }
            newSelected[zone] = map;
          }
        }
        set({ selected: newSelected, activePresetId: presetId });
      },

      deletePreset: (presetId) => {
        const preset = get().presets.find(p => p.id === presetId);
        if (!preset || preset.isBuiltIn) return; // cannot delete built-ins
        set(s => ({
          presets:        s.presets.filter(p => p.id !== presetId),
          activePresetId: s.activePresetId === presetId ? null : s.activePresetId,
        }));
      },
    }),
    {
      name:    'unitravel-zone-engines',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined'
          ? localStorage
          : { getItem: () => null, setItem: () => {}, removeItem: () => {}, length: 0, clear: () => {}, key: () => null } as Storage,
      ),
    },
  ),
);
