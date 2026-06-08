// useUserDNA.ts — SaaS profiling store
// Captures WHO the user is from their first NL prompt.
// Separate from useTravelEngine (which tracks the active trip).
// AI follow-up questions update this store silently to sharpen all 30-engine queries.

import { create }  from 'zustand';
import { persist } from 'zustand/middleware';
import { immer }   from 'zustand/middleware/immer';

// ── Types ─────────────────────────────────────────────────────────────────────

export type PartyType   = 'solo' | 'couple' | 'family' | 'friends' | 'group';
export type BudgetRange = 'economy' | 'standard' | 'premium' | 'luxury';
export type FlightPref  = 'non-stop' | 'any' | 'cheapest';
export type TripPace    = 'relaxed' | 'moderate' | 'fast' | 'packed';

export type BudgetTier =
  | 'Ultra-Luxury'
  | 'Luxury'
  | 'Premium'
  | 'Business'
  | 'Smart-Value'
  | 'Economy';

export interface UserDNAProfile {
  // ── Original fields (used by InitialHandshake) ────────────────────────────
  partyType:       PartyType | null;
  budgetRange:     BudgetRange | null;
  flightPref:      FlightPref | null;
  tripPace:        TripPace | null;
  interests:       string[];
  firstPrompt:     string | null;
  parsedDest:      string | null;
  parsedDates:     { start: string; end: string } | null;
  parsedPartySize: number | null;
  detectedZones:   string[];

  // ── Extended identity fields (learned from AI conversations) ─────────────
  preferredAirlines:    string[];
  bannedAirlines:       string[];
  budgetTier:           BudgetTier | null;
  dietaryRestrictions:  string[];
  maxLayoverHours:      number | null;
  preferredHotelChains: string[];
  bannedHotelChains:    string[];
  homeCurrency:         string | null;
  homeCityCode:         string | null;
  seatPreference:       'window' | 'aisle' | 'middle' | null;
  loyaltyPrograms:      string[];
}

// ── Mutable trait keys ────────────────────────────────────────────────────────

export type DNATrait = keyof UserDNAProfile;

interface UserDNAState {
  profile:        UserDNAProfile;

  // Original actions (preserved — used by InitialHandshake)
  setFirstPrompt: (prompt: string) => void;
  setParsed:      (parsed: Partial<UserDNAProfile>) => void;
  setPartyType:   (type: PartyType) => void;
  setBudgetRange: (range: BudgetRange) => void;
  setFlightPref:  (pref: FlightPref) => void;
  setTripPace:    (pace: TripPace) => void;
  toggleInterest: (interest: string) => void;

  // Generic mutation — used by DNAExtractor interceptor
  mutateDNA:      (trait: DNATrait, value: UserDNAProfile[DNATrait]) => void;

  reset:          () => void;
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const EMPTY_PROFILE: UserDNAProfile = {
  partyType:            null,
  budgetRange:          null,
  flightPref:           null,
  tripPace:             null,
  interests:            [],
  firstPrompt:          null,
  parsedDest:           null,
  parsedDates:          null,
  parsedPartySize:      null,
  detectedZones:        [],
  preferredAirlines:    [],
  bannedAirlines:       [],
  budgetTier:           null,
  dietaryRestrictions:  [],
  maxLayoverHours:      null,
  preferredHotelChains: [],
  bannedHotelChains:    [],
  homeCurrency:         null,
  homeCityCode:         null,
  seatPreference:       null,
  loyaltyPrograms:      [],
};

// ── Store ─────────────────────────────────────────────────────────────────────

export const useUserDNA = create<UserDNAState>()(
  persist(
    immer((set) => ({
      profile: { ...EMPTY_PROFILE },

      setFirstPrompt: (prompt) =>
        set(s => { s.profile.firstPrompt = prompt; }),

      setParsed: (parsed) =>
        set(s => { Object.assign(s.profile, parsed); }),

      setPartyType:   (type)  => set(s => { s.profile.partyType   = type;  }),
      setBudgetRange: (range) => set(s => { s.profile.budgetRange = range; }),
      setFlightPref:  (pref)  => set(s => { s.profile.flightPref  = pref;  }),
      setTripPace:    (pace)  => set(s => { s.profile.tripPace    = pace;  }),

      toggleInterest: (interest) =>
        set(s => {
          const idx = s.profile.interests.indexOf(interest);
          if (idx === -1) s.profile.interests.push(interest);
          else            s.profile.interests.splice(idx, 1);
        }),

      mutateDNA: (trait, value) =>
        set(s => {
          // Merge arrays instead of replacing them
          const current = s.profile[trait];
          if (Array.isArray(current) && Array.isArray(value)) {
            const merged = Array.from(new Set([...current, ...(value as string[])]));
            (s.profile as Record<string, unknown>)[trait] = merged;
          } else {
            (s.profile as Record<string, unknown>)[trait] = value;
          }
        }),

      reset: () => set(s => { s.profile = { ...EMPTY_PROFILE }; }),
    })),
    {
      name:       'unitravel-user-dna',
      partialize: (state) => ({ profile: state.profile }),
    },
  ),
);
