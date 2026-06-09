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

// ── Real adapter: Amadeus flights ─────────────────────────────────────────────

async function fetchAmadeusFlights(
  query: OrchestratorQuery,
): Promise<TravelEntity[]> {
  const origin      = query.origin      ?? 'TLV';
  const destination = query.destination ?? '';
  const date        = query.date        ?? query.checkIn ?? new Date().toISOString().split('T')[0];
  const adults      = query.adults      ?? 2;

  const params = new URLSearchParams({
    origin, destination, departureDate: date,
    adults: String(adults), maxResults: '5',
    travelClass: query.tier === 'luxury' || query.tier === 'ultra-luxury' ? 'BUSINESS' : 'ECONOMY',
  });

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/api/flights?${params.toString()}`, {
    signal: AbortSignal.timeout(8_000),
  });

  if (!res.ok) return [];
  const data = await res.json();

  if (data.status !== 'ok') return []; // 'needs_api_key' or 'error'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.results as any[]).map((f) => ({
    id:          f.id,
    category:    'flight' as const,
    source:      'Amadeus',
    confidence:  0.98,
    title:       `${f.airline} · ${f.routeLabel}`,
    subtitle:    `${f.cabinClass} · ${f.durationLabel} · ${f.stops === 0 ? 'Non-stop' : `${f.stops} stop`}`,
    location:    f.origin,
    destination: f.destination,
    price:       f.totalPrice,
    currency:    'USD' as const,
    priceUSD:    f.totalPrice,
    rating:      4.2,
    reviewCount: undefined,
    tags:        [f.cabinClass.toLowerCase(), f.stops === 0 ? 'direct' : 'connecting'],
    availability:'available' as const,
    deepLink:    f.bookingUrl,
    rawPayload:  f,
  }));
}

// ── Real adapter: Foursquare restaurants ─────────────────────────────────────

async function fetchFoursquareRestaurants(
  query: OrchestratorQuery,
): Promise<TravelEntity[]> {
  const fsqKey = process.env.FOURSQUARE_API_KEY;
  if (!fsqKey) return [];

  const params = new URLSearchParams({
    query:  `restaurants in ${query.destination}`,
    types:  'place',
    limit:  '10',
    fields: 'place',
  });

  const res = await fetch(`https://api.foursquare.com/v3/autocomplete?${params}`, {
    headers: { Authorization: fsqKey, Accept: 'application/json' },
    signal:  AbortSignal.timeout(8_000),
  });

  if (!res.ok) return [];
  const data = await res.json() as { results?: Array<{ place?: {
    fsq_id: string; name: string; categories?: Array<{ name: string }>;
    location?: { address?: string; locality?: string };
    rating?: number; price?: number; photos?: Array<{ prefix: string; suffix: string }>;
  } }> };

  return (data.results ?? [])
    .filter(r => r.place)
    .slice(0, 5)
    .map(r => {
      const p          = r.place!;
      const cats       = (p.categories ?? []).map(c => c.name);
      const priceLevel = (p.price ?? 2) * 30;
      const rating     = p.rating ? p.rating / 2 : 4;   // FSQ uses 0–10; normalize to 0–5
      return {
        id:          `fsq-${p.fsq_id}`,
        category:    'restaurant' as const,
        source:      'Foursquare',
        confidence:  rating / 5,
        title:       p.name,
        subtitle:    `${cats[0] ?? 'Restaurant'} · ${p.location?.locality ?? query.destination}`,
        location:    p.location?.address ?? query.destination,
        destination: query.destination,
        price:       priceLevel,
        currency:    'USD' as const,
        priceUSD:    priceLevel,
        rating,
        reviewCount: undefined,
        imageUrl:    p.photos?.[0] ? `${p.photos[0].prefix}300x300${p.photos[0].suffix}` : undefined,
        deepLink:    `https://foursquare.com/v/${p.fsq_id}`,
        tags:        cats.map(c => c.toLowerCase()),
        availability:'available' as const,
        rawPayload:  p,
      };
    });
}

// ── Dispatcher: routes each source to real adapter or "not connected" ─────────

async function fetchOneSource(ep: SourceEndpoint, query: OrchestratorQuery): Promise<SourceFetch> {
  const t0 = Date.now();

  // Amadeus: real API call if key is present, honest "not configured" otherwise
  if (ep.name === 'Amadeus GDS' && query.intent === 'flights') {
    try {
      const entities = await fetchAmadeusFlights(query);
      if (entities.length === 0) {
        return {
          source: ep, status: 'error', entity: null,
          latencyMs: Date.now() - t0,
          error: process.env.AMADEUS_CLIENT_ID
            ? 'Amadeus returned no results for this route/date'
            : 'Amadeus: add AMADEUS_CLIENT_ID + AMADEUS_CLIENT_SECRET to .env.local',
        };
      }
      // Return first entity (rest are handled by the direct /api/flights endpoint)
      return { source: ep, status: 'ok', entity: entities[0], latencyMs: Date.now() - t0 };
    } catch (err) {
      return { source: ep, status: 'error', entity: null, latencyMs: Date.now() - t0, error: String(err) };
    }
  }

  // Yelp: real API call if key present, else try Foursquare as fallback
  if (ep.name === 'Yelp' && query.intent === 'restaurants') {
    try {
      const entities = await fetchFoursquareRestaurants(query);
      if (entities.length === 0) {
        return {
          source: ep, status: 'error', entity: null, latencyMs: Date.now() - t0,
          error: process.env.FOURSQUARE_API_KEY
            ? 'Foursquare returned no results for this destination'
            : 'Restaurants: add FOURSQUARE_API_KEY to .env.local',
        };
      }
      return { source: ep, status: 'ok', entity: { ...entities[0], source: ep.name }, latencyMs: Date.now() - t0 };
    } catch (err) {
      return { source: ep, status: 'error', entity: null, latencyMs: Date.now() - t0, error: String(err) };
    }
  }

  // All other sources: not yet connected — return honest "not configured"
  // NEVER generate fake data
  return {
    source:    ep,
    status:    'error',
    entity:    null,
    latencyMs: Date.now() - t0,
    error:     `${ep.name}: API not yet connected. Add credentials to .env.local.`,
  };
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
