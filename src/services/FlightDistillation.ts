import type { AggregatedFlight } from '@/services/OmniAggregator';
import { FLIGHT_SOURCES }        from '@/services/OmniAggregator';
import type {
  AviationEntity, AirportInfo, LuggagePolicy,
  PricePrediction, CarbonData, LayoverCognitiveLoad,
  SourceMatch, FlightAlliance, RecommendationAction,
} from '@/types/aviation';

// ── Airport DB ───────────────────────────────────────────────────────────────

const AIRPORTS: Record<string, AirportInfo> = {
  TLV: { iata: 'TLV', city: 'Tel Aviv',     country: 'Israel',  lat: 32.01,  lon: 34.89 },
  MEX: { iata: 'MEX', city: 'Mexico City',   country: 'Mexico',  lat: 19.44,  lon: -99.07 },
  MAD: { iata: 'MAD', city: 'Madrid',        country: 'Spain',   lat: 40.47,  lon: -3.56 },
  FRA: { iata: 'FRA', city: 'Frankfurt',     country: 'Germany', lat: 50.03,  lon: 8.57 },
  JFK: { iata: 'JFK', city: 'New York',      country: 'USA',     lat: 40.64,  lon: -73.78 },
  CDG: { iata: 'CDG', city: 'Paris',         country: 'France',  lat: 49.01,  lon: 2.55 },
};

const resolveAirport = (iata: string): AirportInfo =>
  AIRPORTS[iata] ?? { iata, city: iata, country: '—', lat: 0, lon: 0 };

// ── Alliance lookup ──────────────────────────────────────────────────────────

const ALLIANCE_MAP: Record<string, FlightAlliance> = {
  'El Al':      'Independent',
  'Iberia':     'Oneworld',
  'Lufthansa':  'Star Alliance',
  'AeroMéxico': 'SkyTeam',
  'United':     'Star Alliance',
  'Delta':      'SkyTeam',
  'LATAM':      'Oneworld',
  'Azul':       'Independent',
};

const resolveAlliance = (airline: string): FlightAlliance => {
  for (const [key, val] of Object.entries(ALLIANCE_MAP)) {
    if (airline.includes(key)) return val;
  }
  return 'Independent';
};

// ── Luggage policies by airline ──────────────────────────────────────────────

const LUGGAGE_POLICIES: Record<string, LuggagePolicy> = {
  default: { carryOnKg: 10, carryOnCm: [55, 40, 23], checkedKg: 32, checkedCm: [90, 75, 43], included: true, extraFeeUSD: 0 },
  'El Al': { carryOnKg: 8,  carryOnCm: [56, 45, 25], checkedKg: 32, checkedCm: [90, 75, 45], included: true, extraFeeUSD: 0 },
  Iberia:  { carryOnKg: 10, carryOnCm: [55, 40, 20], checkedKg: 32, checkedCm: [90, 75, 43], included: true, extraFeeUSD: 0 },
};

const resolveLuggage = (airline: string): LuggagePolicy => {
  for (const [key, policy] of Object.entries(LUGGAGE_POLICIES)) {
    if (airline.includes(key)) return policy;
  }
  return LUGGAGE_POLICIES.default;
};

// ── Deterministic seeded random (no Math.random for stable hydration) ─────────

const seededRand = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
};

// ── Sparkline generator ──────────────────────────────────────────────────────

function buildSparkline(basePrice: number, dropProb: number, seed: number): number[] {
  const rand = seededRand(seed);
  const pts: number[] = [];
  let cur = 0.55 + rand() * 0.2;
  for (let i = 0; i < 14; i++) {
    const drift = dropProb > 0.4 ? -0.015 : 0.01;
    cur = Math.max(0.1, Math.min(1, cur + drift + (rand() - 0.5) * 0.1));
    pts.push(parseFloat(cur.toFixed(3)));
  }
  // last point is current price normalised to range
  pts[13] = 0.5;
  void basePrice;
  return pts;
}

// ── Layover cognitive load ───────────────────────────────────────────────────

const LAYOVER_AIRPORTS: Record<string, { stressBase: number; loungeAccess: boolean; transitVisa: boolean }> = {
  MAD: { stressBase: 0.28, loungeAccess: true,  transitVisa: false },
  FRA: { stressBase: 0.22, loungeAccess: true,  transitVisa: false },
  JFK: { stressBase: 0.61, loungeAccess: true,  transitVisa: true  },
  CDG: { stressBase: 0.34, loungeAccess: true,  transitVisa: false },
};

function buildLayoverLoad(
  airline: string,
  durationMin: number,
  seed: number,
): LayoverCognitiveLoad | null {
  if (durationMin === 0) return null;

  const rand    = seededRand(seed);
  const layover = airline.includes('Iberia')   ? LAYOVER_AIRPORTS.MAD :
                  airline.includes('Lufthansa') ? LAYOVER_AIRPORTS.FRA :
                  airline.includes('El Al')     ? LAYOVER_AIRPORTS.MAD :
                  LAYOVER_AIRPORTS.MAD;

  const iata    = airline.includes('Iberia')   ? 'MAD' :
                  airline.includes('Lufthansa') ? 'FRA' : 'MAD';

  const tightConnection = durationMin < 90;
  const longWait        = durationMin > 240;

  const factors: string[] = [];
  if (tightConnection) factors.push('Tight connection (<90min)');
  if (longWait)        factors.push('Long wait (4h+)');
  if (layover.transitVisa) factors.push('Transit visa required');
  if (!layover.loungeAccess) factors.push('No lounge access');
  if (rand() > 0.6)    factors.push('Terminal change required');

  const score = Math.min(1, layover.stressBase
    + (tightConnection ? 0.3 : 0)
    + (longWait ? 0.1 : 0)
    + (layover.transitVisa ? 0.25 : 0)
    + rand() * 0.05,
  );

  return {
    durationMin,
    airport:      resolveAirport(iata),
    score:        parseFloat(score.toFixed(2)),
    factors,
    loungeAccess: layover.loungeAccess,
    transitVisa:  layover.transitVisa,
  };
}

// ── Carbon data ──────────────────────────────────────────────────────────────

function buildCarbonData(raw: AggregatedFlight): CarbonData {
  const AVG_TLV_MEX = 1200;
  return {
    totalKg:        raw.carbonKg,
    perPassengerKg: Math.round(raw.carbonKg / 2),
    label:          raw.carbonLabel,
    vsAverageRoute: parseFloat((raw.carbonKg / AVG_TLV_MEX).toFixed(2)),
    offsetUSD:      Math.round(raw.carbonKg * 0.018),
    alternative:    raw.carbonAlternative,
  };
}

// ── Source matches ───────────────────────────────────────────────────────────

function buildSourceMatches(
  raw: AggregatedFlight,
  activeEngineIds: string[],
): SourceMatch[] {
  const rand  = seededRand(raw.price);
  return raw.sources
    .filter(name => {
      const idx = FLIGHT_SOURCES.indexOf(name as typeof FLIGHT_SOURCES[number]);
      const engineId = `flight-engine-${idx}`;
      return activeEngineIds.length === 0 || activeEngineIds.includes(engineId);
    })
    .slice(0, 12)
    .map(name => {
      const priceDelta = (rand() - 0.48) * 180;
      return {
        engineId:   `flight-engine-${FLIGHT_SOURCES.indexOf(name as typeof FLIGHT_SOURCES[number])}`,
        engineName: name,
        price:      Math.max(raw.priceRange[0], Math.round(raw.price + priceDelta)),
        available:  rand() > 0.08,
      };
    });
}

// ── Recommendation logic ─────────────────────────────────────────────────────

function resolveRecommendation(
  dropProb: number,
  confidence: number,
  seats: number,
): RecommendationAction {
  if (seats <= 2 && confidence > 0.85) return 'book-now';
  if (dropProb > 0.45)                 return 'wait';
  if (dropProb > 0.25)                 return 'watch';
  return 'book-now';
}

// ── AI summary ───────────────────────────────────────────────────────────────

const SUMMARIES: Record<string, string> = {
  'El Al':     'Only direct Israel–Mexico itinerary. Highest leg comfort, EL AL Business fully-flat beds, AeroMéxico Clase Premier at MEX.',
  'Iberia':    'Best overall value. Madrid stopover is stress-low (T4S lounge included). Iberia flagship long-haul Business.',
  'Lufthansa': 'Premium award space. Frankfurt stop adds 40min but Lufthansa First Class terminal access elevates layover.',
};

const resolveAISummary = (airline: string): string => {
  for (const [key, s] of Object.entries(SUMMARIES)) {
    if (airline.includes(key)) return s;
  }
  return `Distilled from multiple sources. ${airline} service with competitive pricing on this route.`;
};

// ── Main distillation ────────────────────────────────────────────────────────

export function distill(
  rawFlights:      AggregatedFlight[],
  activeEngineIds: string[],
): AviationEntity[] {
  return rawFlights.map((raw, idx) => {
    const rand       = seededRand(raw.price + idx * 7919);
    const layoverMin = raw.stops > 0 ? Math.round(80 + rand() * 160) : 0;

    const dropProb = raw.priceDropProbability;
    const sparkline = buildSparkline(raw.price, dropProb, raw.price + idx);

    const pricePrediction: PricePrediction = {
      currentPrice:    raw.price,
      priceRange:      raw.priceRange,
      dropProbability: dropProb,
      expectedDropUSD: Math.round(raw.price * dropProb * 0.18),
      recommendAction: dropProb > 0.4
        ? `Wait ~${Math.round(10 + rand() * 8)} days — likely $${Math.round(raw.price * dropProb * 0.18)} drop`
        : 'Book now — price trend is rising',
      sparkline,
      trend: dropProb > 0.4 ? 'falling' : dropProb > 0.22 ? 'stable' : 'rising',
    };

    return {
      id:            raw.id,
      airline:       raw.airline,
      alliance:      resolveAlliance(raw.airline),
      flightNumber:  raw.flightNumber,
      origin:        resolveAirport(raw.origin),
      destination:   resolveAirport(raw.destination),
      departure:     raw.departure,
      arrival:       raw.arrival,
      durationMin:   raw.durationMin,
      durationLabel: raw.durationLabel,
      stops:         raw.stops,
      stopDetails:   [],
      cabin:         raw.class,
      luggage:       resolveLuggage(raw.airline),
      price:         raw.price,
      pricePrediction,
      carbon:        buildCarbonData(raw),
      layoverLoad:   buildLayoverLoad(raw.airline, layoverMin, raw.price + idx * 31),
      sourceMatches: buildSourceMatches(raw, activeEngineIds),
      sourceCount:   raw.sourceCount,
      aiConfidence:  raw.aiConfidence,
      seats:         raw.seats,
      refundable:    raw.refundable,
      tags:          raw.tags,
      recommendation: resolveRecommendation(dropProb, raw.aiConfidence, raw.seats),
      aiSummary:     resolveAISummary(raw.airline),
    };
  });
}
