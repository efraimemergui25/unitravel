import type { AggregatedDining } from '@/services/OmniAggregator';

export type { AggregatedDining };

export interface TimeSlot {
  label:     string;  // "19:00"
  available: boolean;
  isMatch:   boolean; // falls within dinner prime window
  partySize: number;
}

export interface EngineAvailability {
  engineId:   string;
  engineName: string;
  slots:      TimeSlot[];
}

export type ReservationDifficulty = 'easy' | 'moderate' | 'hard' | 'impossible';

export interface DiningEntity extends AggregatedDining {
  engineAvailability:    EngineAvailability[];
  reservationDifficulty: ReservationDifficulty;
  wineProgram:           string;
  dressCode:             string;
  outdoorSeating:        boolean;
  chefTable:             boolean;
  matchScore:            number;  // 0–1
  recommendedDay:        string;  // "Day 2 · Mexico City"
}
