'use client';

import { create } from 'zustand';

export type HubMode   = 'home' | 'concierge' | 'zones' | null;
export type ZoneType  = 'flights' | 'hotels' | 'restaurants' | 'attractions' | 'transit' | null;

interface NavigationState {
  hubMode:    HubMode;
  activeZone: ZoneType;
}

interface NavigationActions {
  openHub:       () => void;
  closeHub:      () => void;
  setHubMode:    (mode: HubMode) => void;
  openZone:      (zone: ZoneType) => void;
  closeZone:     () => void;
  reset:         () => void;
}

export const useNavigationStore = create<NavigationState & NavigationActions>()((set) => ({
  hubMode:    null,
  activeZone: null,

  openHub:    () => set({ hubMode: 'home', activeZone: null }),
  closeHub:   () => set({ hubMode: null,   activeZone: null }),
  setHubMode: (mode) => set({ hubMode: mode }),
  openZone:   (zone) => set({ hubMode: 'zones', activeZone: zone }),
  closeZone:  () => set({ activeZone: null, hubMode: 'zones' }),
  reset:      () => set({ hubMode: null, activeZone: null }),
}));
