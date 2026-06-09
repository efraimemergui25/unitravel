// useUserDNA.ts — SaaS profiling store
// Captures WHO the user is from their first NL prompt.
// Separate from useTravelEngine (which tracks the active trip).
// AI follow-up questions update this store silently to sharpen all 30-engine queries.

import { create }  from 'zustand';
import { persist } from 'zustand/middleware';
import { immer }   from 'zustand/middleware/immer';
import { getSupabaseClient } from '@/lib/supabaseClient';

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

  // ── Traveler identity (names + destinations wishlist) ────────────────────
  names:                string[];   // e.g. ['Effi', 'Nofar']
  targetDestinations:   string[];   // recurring destinations across trips

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

// ── Budget tier: TypeScript enum → DB CHECK enum ─────────────────────────────
// DB allows only: 'budget' | 'mid' | 'luxury' | 'ultra'

const TO_DB_BUDGET_TIER: Record<string, 'budget' | 'mid' | 'luxury' | 'ultra'> = {
  'Ultra-Luxury': 'ultra',
  'Luxury':       'luxury',
  'Premium':      'luxury',
  'Business':     'mid',
  'Smart-Value':  'mid',
  'Economy':      'budget',
};

// ── Supabase background sync ──────────────────────────────────────────────────
// Columns match 0000_initial_schema.sql exactly:
// id (PK=user.id), preferred_airlines, banned_airlines, dietary_needs, budget_tier

async function patchDNAToSupabase(profile: UserDNAProfile): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  const { data: { user } } = await client.auth.getUser();
  if (!user) return;
  await client
    .from('users_dna')
    .upsert({
      id:                 user.id,
      preferred_airlines: profile.preferredAirlines,
      banned_airlines:    profile.bannedAirlines,
      dietary_needs:      profile.dietaryRestrictions,
      budget_tier:        TO_DB_BUDGET_TIER[profile.budgetTier ?? ''] ?? 'mid',
    });
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
  names:                [],
  targetDestinations:   [],
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

// Dev-seed profile — overridden by real data once Supabase auth is live.
// Provides realistic defaults so every component renders meaningfully from day one.
const DEV_SEED_PROFILE: UserDNAProfile = {
  ...EMPTY_PROFILE,
  names:              ['Effi', 'Nofar'],
  targetDestinations: ['Mexico', 'Miami', 'Bahamas'],
  budgetTier:         'Luxury',
  partyType:          'couple',
  tripPace:           'moderate',
  maxLayoverHours:    3,
};

// ── Store ─────────────────────────────────────────────────────────────────────

export const useUserDNA = create<UserDNAState>()(
  persist(
    immer((set) => ({
      profile: { ...DEV_SEED_PROFILE },

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

      mutateDNA: (trait, value) => {
        set(s => {
          // Merge arrays instead of replacing them so bans/prefs accumulate
          const current = s.profile[trait];
          if (Array.isArray(current) && Array.isArray(value)) {
            const merged = Array.from(new Set([...current, ...(value as string[])]));
            (s.profile as Record<string, unknown>)[trait] = merged;
          } else {
            (s.profile as Record<string, unknown>)[trait] = value;
          }
        });
        // Fire-and-forget background patch to Supabase users_dna table.
        // Non-blocking: never throws, silently no-ops when auth is not connected.
        void patchDNAToSupabase(useUserDNA.getState().profile);
      },

      reset: () => set(s => { s.profile = { ...DEV_SEED_PROFILE }; }),
    })),
    {
      name:       'unitravel-user-dna',
      partialize: (state) => ({ profile: state.profile }),
    },
  ),
);
