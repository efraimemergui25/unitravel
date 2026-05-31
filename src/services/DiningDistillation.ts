import type { AggregatedDining } from '@/services/OmniAggregator';
import type { DiningEntity, EngineAvailability, TimeSlot, ReservationDifficulty } from '@/types/dining';

// ── RNG ───────────────────────────────────────────────────────────────────────

const seededRand = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
};

// ── Time slots ────────────────────────────────────────────────────────────────

const TIME_LABELS = [
  '18:00','18:30','19:00','19:30','20:00','20:30','21:00','21:30','22:00','22:30',
];

const MATCH_LABELS = new Set(['19:00','19:30','20:00','20:30']);

// ── Booking engines (have table availability) ─────────────────────────────────

const BOOKING_ENGINE_IDS = new Set([
  'opentable','resy','thefork','tock','quandoo','zomato',
  'lafourchette','eatwith','google-maps-d',
]);

const BOOKING_ENGINE_NAMES: Record<string, string> = {
  'opentable':    'OpenTable',
  'resy':         'Resy',
  'thefork':      'TheFork',
  'tock':         'Tock',
  'quandoo':      'Quandoo',
  'zomato':       'Zomato',
  'lafourchette': 'LaFourchette',
  'eatwith':      'EatWith',
  'google-maps-d':'Google Tables',
};

const DEFAULT_BOOKING = ['opentable', 'resy', 'thefork', 'tock'];

// ── Reservation difficulty ────────────────────────────────────────────────────

function computeDifficulty(raw: AggregatedDining): ReservationDifficulty {
  if ((raw.michelinStars ?? 0) >= 2 && (raw.bestIn50 ?? 999) <= 20) return 'impossible';
  if ((raw.michelinStars ?? 0) >= 1 || (raw.bestIn50 ?? 999) <= 50) return 'hard';
  if (raw.rating >= 4.85) return 'moderate';
  return 'easy';
}

// ── Engine availability ───────────────────────────────────────────────────────

const BASE_AVAIL: Record<ReservationDifficulty, number> = {
  easy: 0.80, moderate: 0.52, hard: 0.22, impossible: 0.06,
};

function buildEngineAvailability(
  difficulty: ReservationDifficulty,
  engineIds: string[],
  rand: () => number,
): EngineAvailability[] {
  const base = BASE_AVAIL[difficulty];
  return engineIds.map(engineId => {
    const slots: TimeSlot[] = TIME_LABELS.map(label => {
      const isPeak   = label >= '19:00' && label <= '20:30';
      const isLate   = label >= '21:30';
      const modifier = isPeak ? -0.28 : isLate ? 0.06 : 0.10;
      return {
        label,
        available: rand() < Math.max(0.03, base + modifier),
        isMatch:   MATCH_LABELS.has(label),
        partySize: 2,
      };
    });
    return {
      engineId,
      engineName: BOOKING_ENGINE_NAMES[engineId] ?? engineId,
      slots,
    };
  });
}

// ── Metadata tables ───────────────────────────────────────────────────────────

const WINE_PROGRAMS: Record<string, string> = {
  'Pujol':                   'Cellar of 800+ labels · Mezcal pairing menu · Sommelier-guided at $180/pp',
  'Quintonil':               'Mexican wine focus · Award-winning natural wine selection · Biodynamic producers',
  'Hartwood':                'Wood-fire mezcal menu · Natural wines · Biodynamic Mexican growers',
  'Rosewood Casa Marina':    'Curated cellar by Vincent Chaperon · Local Baja producers · Tequila flights',
  'El Farallon':             'Sea-to-glass cellar · Baja California vintners · Premium tequila selection',
  'Manta by Enrique Olvera': 'Nobu-curated cellar · Japanese-Mexican wine pairing · Sake menu',
};

const DRESS_CODES: Record<string, string> = {
  'Pujol':                   'Smart Casual — jackets appreciated',
  'Quintonil':               'Smart Casual',
  'Hartwood':                'Casual — outdoor jungle setting',
  'Rosewood Casa Marina':    'Resort Elegant',
  'El Farallon':             'Smart Casual',
  'Manta by Enrique Olvera': 'Resort Casual',
};

const OUTDOOR_SEATING: Record<string, boolean> = {
  'Pujol': false, 'Quintonil': false,
  'Hartwood': true, 'Rosewood Casa Marina': true, 'El Farallon': true, 'Manta by Enrique Olvera': true,
};

const RECOMMENDED_DAYS: Record<string, string> = {
  'Mexico City':  'Day 2 · Mexico City',
  'Tulum':        'Day 4 · Tulum',
  'Riviera Maya': 'Day 6 · Riviera Maya',
  'Cabo San Lucas': 'Day 8 · Cabo San Lucas',
};

// ── Main export ───────────────────────────────────────────────────────────────

export function distillDining(
  rawDining:         AggregatedDining[],
  selectedEngineIds: string[],
): DiningEntity[] {
  const bookingEngines = selectedEngineIds.filter(id => BOOKING_ENGINE_IDS.has(id));
  const engines        = bookingEngines.length > 0 ? bookingEngines : DEFAULT_BOOKING;

  return rawDining.map((raw, idx) => {
    const rand       = seededRand(Math.round(raw.pricePerPerson * 100) + idx * 7919);
    const difficulty = computeDifficulty(raw);

    return {
      ...raw,
      engineAvailability:    buildEngineAvailability(difficulty, engines, rand),
      reservationDifficulty: difficulty,
      wineProgram:           WINE_PROGRAMS[raw.name]         ?? 'Carefully curated wine & spirits selection',
      dressCode:             DRESS_CODES[raw.name]           ?? 'Smart Casual',
      outdoorSeating:        OUTDOOR_SEATING[raw.name]       ?? false,
      chefTable:             (raw.michelinStars ?? 0) >= 1,
      matchScore:            Math.min(1, raw.aiConfidence + rand() * 0.1),
      recommendedDay:        RECOMMENDED_DAYS[raw.destination] ?? 'Day 1',
    };
  });
}
