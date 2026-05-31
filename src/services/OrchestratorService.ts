// Core orchestration logic — shared between the HTTP route and the AI tool executor.
// Importable on the server side (both app/api/ and services/).

import type { TravelDNA } from '@/utils/FinancialEngine';

// ── Unified entity ─────────────────────────────────────────────────────────────

export interface TravelEntity {
  id:            string;
  category:      'flight' | 'hotel' | 'restaurant' | 'activity' | 'transport';
  source:        string;
  confidence:    number;
  title:         string;
  subtitle:      string;
  location:      string;
  destination:   string;
  price:         number;
  currency:      'USD' | 'EUR' | 'MXN' | 'ILS';
  priceUSD:      number;
  rating?:       number;
  reviewCount?:  number;
  imageUrl?:     string;
  deepLink?:     string;
  tags:          string[];
  availability:  'available' | 'limited' | 'sold_out' | 'unknown';
  dnaScore?:     number;   // 0–1 from DNA-aware ranker
  rawPayload?:   Record<string, unknown>;
}

export type OrchestratorIntent = 'flights' | 'hotels' | 'restaurants' | 'activities' | 'all';

export interface OrchestratorQuery {
  intent:      OrchestratorIntent;
  destination: string;
  origin?:     string;
  checkIn?:    string;
  checkOut?:   string;
  date?:       string;
  adults?:     number;
  budget?:     number;
  currency?:   string;
  tier?:       'economy' | 'premium' | 'luxury' | 'ultra-luxury';
  freeText?:   string;
  dnaProfile?: TravelDNA | null;
}

export interface OrchestratorResponse {
  query:              OrchestratorQuery;
  results:            TravelEntity[];
  distilledTop3:      TravelEntity[];
  totalSources:       number;
  successfulSources:  number;
  failedSources:      number;
  timeoutSources:     number;
  processingMs:       number;
  warnings:           string[];
}

// ── Source endpoints ──────────────────────────────────────────────────────────

interface SourceEndpoint {
  name:     string;
  category: OrchestratorIntent;
  baseUrl:  string;
  timeout:  number;
  weight:   number;
}

const FLIGHT_ENDPOINTS: SourceEndpoint[] = [
  { name: 'Amadeus GDS',    category: 'flights', baseUrl: 'https://test.api.amadeus.com/v2',       timeout: 5000, weight: 0.98 },
  { name: 'Skyscanner',     category: 'flights', baseUrl: 'https://api.skyscanner.net/v3',         timeout: 4000, weight: 0.95 },
  { name: 'Sabre Travel',   category: 'flights', baseUrl: 'https://api.developer.sabre.com/v1',    timeout: 5500, weight: 0.93 },
  { name: 'Google Flights', category: 'flights', baseUrl: 'https://serpapi.com/search',            timeout: 6000, weight: 0.90 },
  { name: 'Hopper AI',      category: 'flights', baseUrl: 'https://api.hopper.com/v1',             timeout: 4000, weight: 0.88 },
  { name: 'Kayak',          category: 'flights', baseUrl: 'https://api.kayak.com/v1',              timeout: 5000, weight: 0.87 },
  { name: 'Kiwi.com',       category: 'flights', baseUrl: 'https://tequila.kiwi.com/v2',           timeout: 4500, weight: 0.85 },
  { name: 'Momondo',        category: 'flights', baseUrl: 'https://api.momondo.net/v1',            timeout: 5000, weight: 0.82 },
  { name: 'Trip.com',       category: 'flights', baseUrl: 'https://api.trip.com/flights',          timeout: 4500, weight: 0.80 },
  { name: 'JetRadar',       category: 'flights', baseUrl: 'https://api.jetradar.com/v1',           timeout: 4000, weight: 0.78 },
];

const HOTEL_ENDPOINTS: SourceEndpoint[] = [
  { name: 'Booking.com',    category: 'hotels', baseUrl: 'https://distribution-xml.booking.com/json/bookings', timeout: 5000, weight: 0.95 },
  { name: 'Marriott',       category: 'hotels', baseUrl: 'https://api.marriott.com/v1',            timeout: 4500, weight: 0.95 },
  { name: 'Virtuoso',       category: 'hotels', baseUrl: 'https://api.virtuoso.com/v1',            timeout: 5000, weight: 0.97 },
  { name: 'Expedia',        category: 'hotels', baseUrl: 'https://api.expediagroup.com/v3',        timeout: 5000, weight: 0.92 },
  { name: 'Mr & Mrs Smith', category: 'hotels', baseUrl: 'https://api.mrandmrssmith.com/v2',       timeout: 4000, weight: 0.93 },
  { name: 'Hotels.com',     category: 'hotels', baseUrl: 'https://api.hotels.com/v2',             timeout: 4500, weight: 0.88 },
  { name: 'Airbnb',         category: 'hotels', baseUrl: 'https://api.airbnb.com/v2',             timeout: 5000, weight: 0.85 },
  { name: 'Agoda',          category: 'hotels', baseUrl: 'https://affiliateapi.agoda.com/v3',     timeout: 4000, weight: 0.84 },
  { name: 'HotelTonight',   category: 'hotels', baseUrl: 'https://api.hoteltonight.com/v9',       timeout: 3500, weight: 0.82 },
  { name: 'Hyatt Direct',   category: 'hotels', baseUrl: 'https://www.hyatt.com/api/v1',          timeout: 4000, weight: 0.96 },
];

const DINING_ENDPOINTS: SourceEndpoint[] = [
  { name: 'Michelin Guide', category: 'restaurants', baseUrl: 'https://api.guide.michelin.com/v1',           timeout: 6000, weight: 0.99 },
  { name: 'W50Best',        category: 'restaurants', baseUrl: 'https://api.worlds50best.com/v1',             timeout: 5000, weight: 0.97 },
  { name: 'OpenTable',      category: 'restaurants', baseUrl: 'https://api.opentable.com/v2',               timeout: 4000, weight: 0.93 },
  { name: 'Resy',           category: 'restaurants', baseUrl: 'https://api.resy.com/3',                     timeout: 3500, weight: 0.91 },
  { name: 'Google Maps',    category: 'restaurants', baseUrl: 'https://maps.googleapis.com/maps/api/place', timeout: 5000, weight: 0.90 },
  { name: 'TheFork',        category: 'restaurants', baseUrl: 'https://api.thefork.com/v1',                 timeout: 4000, weight: 0.88 },
  { name: 'Tock',           category: 'restaurants', baseUrl: 'https://www.exploretock.com/api/v1',         timeout: 3500, weight: 0.89 },
  { name: 'Yelp',           category: 'restaurants', baseUrl: 'https://api.yelp.com/v3',                   timeout: 4500, weight: 0.85 },
  { name: 'TripAdvisor',    category: 'restaurants', baseUrl: 'https://api.tripadvisor.com/api/partner/2.0',timeout: 5000, weight: 0.84 },
  { name: 'Eater',          category: 'restaurants', baseUrl: 'https://api.eater.com/v1',                   timeout: 4000, weight: 0.80 },
];

const ALL_ENDPOINTS = [...FLIGHT_ENDPOINTS, ...HOTEL_ENDPOINTS, ...DINING_ENDPOINTS];

// ── DNA-aware ranker ──────────────────────────────────────────────────────────
// Adjusts confidence score using the user's Travel DNA profile.

function applyDNAScore(entity: TravelEntity, dna: TravelDNA | null): number {
  const base = entity.confidence * 0.6 + ((entity.rating ?? 3) / 5) * 0.4;
  if (!dna) return base;

  let bonus = 0;
  const price = entity.price;

  // Price-tier alignment
  const budgetTier =
    price > 600 ? 'ultra-luxury' :
    price > 250 ? 'luxury' :
    price > 100 ? 'premium' : 'economy';

  if (dna.accommodationTier > 0.7 && budgetTier === 'ultra-luxury') bonus += 0.12;
  if (dna.accommodationTier > 0.7 && budgetTier === 'economy')      bonus -= 0.10;
  if (dna.culinaryAffinity > 0.75 && entity.category === 'restaurant') bonus += 0.08;
  if (dna.flexibilityScore > 0.6  && entity.availability === 'limited') bonus += 0.04;

  return Math.min(1, Math.max(0, base + bonus));
}

// ── Per-source fetch ──────────────────────────────────────────────────────────

interface SourceFetch {
  source:    SourceEndpoint;
  status:    'ok' | 'timeout' | 'error';
  entity:    TravelEntity | null;
  latencyMs: number;
  error?:    string;
}

async function fetchOneSource(ep: SourceEndpoint, query: OrchestratorQuery): Promise<SourceFetch> {
  const t0 = Date.now();

  try {
    // In production: replace simulation with real fetch to ep.baseUrl
    await new Promise(r => setTimeout(r, 80 + Math.random() * 280));

    if (Math.random() < 0.08) throw new Error(`${ep.name}: 429 Rate Limited`);

    const basePriceMap = {
      'ultra-luxury': 800 + Math.random() * 900,
      luxury:         350 + Math.random() * 450,
      premium:        150 + Math.random() * 200,
      economy:         60 + Math.random() * 100,
    };
    const tier  = query.tier ?? 'luxury';
    const price = Math.round(basePriceMap[tier]);

    const entity: TravelEntity = {
      id:          `${ep.name.toLowerCase().replace(/[\s&.]/g, '-')}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      category:    ep.category === 'flights'     ? 'flight'
                 : ep.category === 'hotels'      ? 'hotel'
                 : ep.category === 'restaurants' ? 'restaurant'
                 : 'activity',
      source:      ep.name,
      confidence:  ep.weight * (0.85 + Math.random() * 0.15),
      title:       `${ep.name} · ${query.destination}`,
      subtitle:    query.freeText ?? `${tier} option`,
      location:    query.destination,
      destination: query.destination,
      price,
      currency:    'USD',
      priceUSD:    price,
      rating:      3.5 + Math.random() * 1.5,
      reviewCount: Math.floor(80 + Math.random() * 4500),
      tags:        [tier, ep.category, query.destination],
      availability:'available',
    };

    return { source: ep, status: 'ok', entity, latencyMs: Date.now() - t0 };
  } catch (err: unknown) {
    const msg     = err instanceof Error ? err.message : String(err);
    const isTimeout = msg.includes('timeout');
    return { source: ep, status: isTimeout ? 'timeout' : 'error', entity: null, latencyMs: Date.now() - t0, error: msg };
  }
}

// ── Distillation ───────────────────────────────────────────────────────────────

function distillTop3(entities: TravelEntity[], dna: TravelDNA | null): TravelEntity[] {
  return [...entities]
    .map(e => ({ ...e, dnaScore: applyDNAScore(e, dna) }))
    .sort((a, b) => (b.dnaScore ?? 0) - (a.dnaScore ?? 0))
    .slice(0, 3);
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function runOrchestratorSearch(query: OrchestratorQuery): Promise<OrchestratorResponse> {
  const t0 = Date.now();

  const endpoints =
    query.intent === 'flights'     ? FLIGHT_ENDPOINTS :
    query.intent === 'hotels'      ? HOTEL_ENDPOINTS  :
    query.intent === 'restaurants' ? DINING_ENDPOINTS :
    ALL_ENDPOINTS;

  const settled = await Promise.allSettled(
    endpoints.map(ep => fetchOneSource(ep, query))
  );

  const fetches: SourceFetch[] = settled
    .map(r => r.status === 'fulfilled' ? r.value : null)
    .filter((r): r is SourceFetch => r !== null);

  let successful = 0, failed = 0, timedOut = 0;
  const allEntities: TravelEntity[] = [];
  const warnings:    string[]       = [];

  for (const f of fetches) {
    if (f.status === 'ok' && f.entity) {
      successful++;
      allEntities.push(f.entity);
    } else if (f.status === 'timeout') {
      timedOut++;
      warnings.push(`${f.source.name} timed out after ${f.source.timeout}ms`);
    } else {
      failed++;
      if (f.error) warnings.push(`${f.source.name}: ${f.error}`);
    }
  }

  const failureRate = (failed + timedOut) / endpoints.length;
  if (failureRate > 0.3) {
    warnings.push(`⚠️ ${Math.round(failureRate * 100)}% of sources degraded — results may be incomplete`);
  }

  const dna = query.dnaProfile ?? null;

  return {
    query,
    results:           allEntities,
    distilledTop3:     distillTop3(allEntities, dna),
    totalSources:      endpoints.length,
    successfulSources: successful,
    failedSources:     failed,
    timeoutSources:    timedOut,
    processingMs:      Date.now() - t0,
    warnings,
  };
}

// ── Streaming variant ─────────────────────────────────────────────────────────
// Yields one SSE event per source result. Useful for live progress UI.
// Usage in route: for await (const event of streamOrchestratorSearch(query)) { ... }

export async function* streamOrchestratorSearch(
  query: OrchestratorQuery,
): AsyncGenerator<string> {
  const endpoints =
    query.intent === 'flights'     ? FLIGHT_ENDPOINTS :
    query.intent === 'hotels'      ? HOTEL_ENDPOINTS  :
    query.intent === 'restaurants' ? DINING_ENDPOINTS :
    ALL_ENDPOINTS;

  const dna    = query.dnaProfile ?? null;
  const total  = endpoints.length;
  let completed = 0;

  yield `data: ${JSON.stringify({ type: 'start', total, intent: query.intent, destination: query.destination })}\n\n`;

  // Fan out — process each source and yield as it resolves
  const promises = endpoints.map(ep =>
    fetchOneSource(ep, query).then(result => ({ ep, result }))
  );

  for (const p of promises) {
    const { result } = await p;
    completed++;

    if (result.status === 'ok' && result.entity) {
      const scored = { ...result.entity, dnaScore: applyDNAScore(result.entity, dna) };
      yield `data: ${JSON.stringify({
        type:      'result',
        source:    result.source.name,
        entity:    scored,
        latencyMs: result.latencyMs,
        progress:  { completed, total },
      })}\n\n`;
    } else {
      yield `data: ${JSON.stringify({
        type:      'source_error',
        source:    result.source.name,
        status:    result.status,
        error:     result.error ?? null,
        progress:  { completed, total },
      })}\n\n`;
    }
  }

  yield `data: ${JSON.stringify({ type: 'done', completed, total })}\n\n`;
}

// ── Re-exports for the HTTP route ─────────────────────────────────────────────

export { ALL_ENDPOINTS, FLIGHT_ENDPOINTS, HOTEL_ENDPOINTS, DINING_ENDPOINTS };
export type { SourceEndpoint };
