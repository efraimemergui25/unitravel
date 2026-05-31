import { NextRequest, NextResponse } from 'next/server';

// ── Unified TravelEntity (normalized output) ──────────────────────────────────

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
  currency:      'USD' | 'EUR' | 'MXN';
  priceUSD:      number;
  rating?:       number;
  reviewCount?:  number;
  imageUrl?:     string;
  deepLink?:     string;
  tags:          string[];
  availability:  'available' | 'limited' | 'sold_out' | 'unknown';
  rawPayload?:   Record<string, unknown>; // original API response
}

export interface OrchestratorQuery {
  intent:      'flights' | 'hotels' | 'restaurants' | 'activities' | 'all';
  destination: string;
  checkIn?:    string;  // ISO date
  checkOut?:   string;
  date?:       string;
  adults?:     number;
  budget?:     number;
  currency?:   string;
  tier?:       'economy' | 'premium' | 'luxury' | 'ultra-luxury';
  freeText?:   string;
}

export interface OrchestratorResponse {
  query:           OrchestratorQuery;
  results:         TravelEntity[];
  totalSources:    number;
  successfulSources: number;
  failedSources:   number;
  timeoutSources:  number;
  processingMs:    number;
  distilledTop3:   TravelEntity[];
  warnings:        string[];
}

// ── Source endpoint definitions ───────────────────────────────────────────────

interface SourceEndpoint {
  name:     string;
  category: OrchestratorQuery['intent'];
  baseUrl:  string;
  timeout:  number; // ms
  weight:   number; // 0-1, for confidence scoring
}

const FLIGHT_ENDPOINTS: SourceEndpoint[] = [
  { name: 'Skyscanner',    category: 'flights',     baseUrl: 'https://api.skyscanner.net/v3',        timeout: 4000, weight: 0.95 },
  { name: 'Amadeus GDS',   category: 'flights',     baseUrl: 'https://test.api.amadeus.com/v2',      timeout: 5000, weight: 0.98 },
  { name: 'Google Flights',category: 'flights',     baseUrl: 'https://serpapi.com/search',           timeout: 6000, weight: 0.90 },
  { name: 'Sabre Travel',  category: 'flights',     baseUrl: 'https://api.developer.sabre.com/v1',   timeout: 5500, weight: 0.93 },
  { name: 'Kiwi.com',      category: 'flights',     baseUrl: 'https://tequila.kiwi.com/v2',          timeout: 4500, weight: 0.85 },
  { name: 'Hopper AI',     category: 'flights',     baseUrl: 'https://api.hopper.com/v1',            timeout: 4000, weight: 0.88 },
  { name: 'Kayak',         category: 'flights',     baseUrl: 'https://api.kayak.com/v1',             timeout: 5000, weight: 0.87 },
  { name: 'Trip.com',      category: 'flights',     baseUrl: 'https://api.trip.com/flights',         timeout: 4500, weight: 0.80 },
  { name: 'Momondo',       category: 'flights',     baseUrl: 'https://api.momondo.net/v1',           timeout: 5000, weight: 0.82 },
  { name: 'JetRadar',      category: 'flights',     baseUrl: 'https://api.jetradar.com/v1',          timeout: 4000, weight: 0.78 },
];

const HOTEL_ENDPOINTS: SourceEndpoint[] = [
  { name: 'Booking.com',   category: 'hotels',      baseUrl: 'https://distribution-xml.booking.com/json/bookings', timeout: 5000, weight: 0.95 },
  { name: 'Expedia',       category: 'hotels',      baseUrl: 'https://api.expediagroup.com/v3',      timeout: 5000, weight: 0.92 },
  { name: 'Hotels.com',    category: 'hotels',      baseUrl: 'https://api.hotels.com/v2',            timeout: 4500, weight: 0.88 },
  { name: 'Airbnb',        category: 'hotels',      baseUrl: 'https://api.airbnb.com/v2',            timeout: 5000, weight: 0.85 },
  { name: 'HotelTonight',  category: 'hotels',      baseUrl: 'https://api.hoteltonight.com/v9',      timeout: 3500, weight: 0.82 },
  { name: 'Hyatt Direct',  category: 'hotels',      baseUrl: 'https://www.hyatt.com/api/v1',         timeout: 4000, weight: 0.96 },
  { name: 'Marriott',      category: 'hotels',      baseUrl: 'https://api.marriott.com/v1',          timeout: 4500, weight: 0.95 },
  { name: 'Agoda',         category: 'hotels',      baseUrl: 'https://affiliateapi.agoda.com/v3',    timeout: 4000, weight: 0.84 },
  { name: 'Virtuoso',      category: 'hotels',      baseUrl: 'https://api.virtuoso.com/v1',          timeout: 5000, weight: 0.97 },
  { name: 'Mr & Mrs Smith',category: 'hotels',      baseUrl: 'https://api.mrandmrssmith.com/v2',     timeout: 4000, weight: 0.93 },
];

const DINING_ENDPOINTS: SourceEndpoint[] = [
  { name: 'OpenTable',     category: 'restaurants', baseUrl: 'https://api.opentable.com/v2',         timeout: 4000, weight: 0.93 },
  { name: 'Resy',          category: 'restaurants', baseUrl: 'https://api.resy.com/3',               timeout: 3500, weight: 0.91 },
  { name: 'TheFork',       category: 'restaurants', baseUrl: 'https://api.thefork.com/v1',           timeout: 4000, weight: 0.88 },
  { name: 'Google Maps',   category: 'restaurants', baseUrl: 'https://maps.googleapis.com/maps/api/place', timeout: 5000, weight: 0.90 },
  { name: 'Yelp',          category: 'restaurants', baseUrl: 'https://api.yelp.com/v3',              timeout: 4500, weight: 0.85 },
  { name: 'TripAdvisor',   category: 'restaurants', baseUrl: 'https://api.tripadvisor.com/api/partner/2.0', timeout: 5000, weight: 0.84 },
  { name: 'Michelin Guide',category: 'restaurants', baseUrl: 'https://api.guide.michelin.com/v1',    timeout: 6000, weight: 0.99 },
  { name: 'Tock',          category: 'restaurants', baseUrl: 'https://www.exploretock.com/api/v1',   timeout: 3500, weight: 0.89 },
  { name: 'Eater',         category: 'restaurants', baseUrl: 'https://api.eater.com/v1',             timeout: 4000, weight: 0.80 },
  { name: 'W50Best',       category: 'restaurants', baseUrl: 'https://api.worlds50best.com/v1',      timeout: 5000, weight: 0.97 },
];

const ALL_ENDPOINTS = [...FLIGHT_ENDPOINTS, ...HOTEL_ENDPOINTS, ...DINING_ENDPOINTS];

// ── Response normalizers ──────────────────────────────────────────────────────

function normalizeResponse(
  raw:      unknown,
  source:   SourceEndpoint,
  query:    OrchestratorQuery
): TravelEntity[] {
  // In production, each source has a dedicated normalizer.
  // Here we generate mock entities that represent what the real API would return.
  if (!raw || typeof raw !== 'object') return [];

  const id        = `${source.name.toLowerCase().replace(/\s/g, '-')}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const basePrice = query.tier === 'ultra-luxury' ? 900 + Math.random() * 800
                  : query.tier === 'luxury'       ? 400 + Math.random() * 500
                  : 100 + Math.random() * 300;

  return [{
    id,
    category:    source.category === 'flights'     ? 'flight'     :
                 source.category === 'hotels'      ? 'hotel'      :
                 source.category === 'restaurants' ? 'restaurant' : 'activity',
    source:      source.name,
    confidence:  source.weight * (0.85 + Math.random() * 0.15),
    title:       `${source.name} result for ${query.destination}`,
    subtitle:    query.freeText || `${query.tier || 'luxury'} option`,
    location:    query.destination,
    destination: query.destination,
    price:       Math.round(basePrice),
    currency:    'USD',
    priceUSD:    Math.round(basePrice),
    rating:      3.5 + Math.random() * 1.5,
    reviewCount: Math.floor(100 + Math.random() * 5000),
    tags:        [query.tier || 'luxury', source.category, query.destination],
    availability:'available',
    rawPayload:  raw as Record<string, unknown>,
  }];
}

// ── Fetch single source with timeout ─────────────────────────────────────────

interface SourceResult {
  source:    SourceEndpoint;
  status:    'fulfilled' | 'timeout' | 'error';
  entities:  TravelEntity[];
  latencyMs: number;
  error?:    string;
}

async function fetchSource(
  endpoint: SourceEndpoint,
  query:    OrchestratorQuery
): Promise<SourceResult> {
  const t0 = Date.now();

  // Build query params (production: use real API schemas)
  const params = new URLSearchParams({
    destination: query.destination,
    adults:      String(query.adults ?? 2),
    ...(query.checkIn  && { checkIn:  query.checkIn  }),
    ...(query.checkOut && { checkOut: query.checkOut }),
    ...(query.date     && { date:     query.date     }),
    ...(query.budget   && { maxPrice: String(query.budget) }),
    currency:    query.currency ?? 'USD',
  });

  const url = `${endpoint.baseUrl}/search?${params}`;

  try {
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), endpoint.timeout);

    // In production: real fetch. In dev: simulate with mock data.
    const response = await Promise.race([
      (async () => {
        await new Promise(r => setTimeout(r, 100 + Math.random() * 300));
        // Simulate 8% failure rate per source
        if (Math.random() < 0.08) throw new Error(`${endpoint.name}: 429 Rate Limited`);
        return { ok: true, json: async () => ({ results: [], source: endpoint.name }) };
      })(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`${endpoint.name}: timeout after ${endpoint.timeout}ms`)), endpoint.timeout)
      ),
    ]);

    clearTimeout(timeoutId);
    void url; // suppress unused warning

    const data = await (response as { ok: boolean; json: () => Promise<unknown> }).json();
    return {
      source:    endpoint,
      status:    'fulfilled',
      entities:  normalizeResponse(data, endpoint, query),
      latencyMs: Date.now() - t0,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const isTimeout = msg.includes('timeout') || (err instanceof Error && err.name === 'AbortError');
    return {
      source:    endpoint,
      status:    isTimeout ? 'timeout' : 'error',
      entities:  [],
      latencyMs: Date.now() - t0,
      error:     msg,
    };
  }
}

// ── Distillation: top 3 by confidence × rating ───────────────────────────────

function distillTop3(entities: TravelEntity[]): TravelEntity[] {
  return [...entities]
    .sort((a, b) => {
      const scoreA = a.confidence * 0.6 + ((a.rating ?? 3) / 5) * 0.4;
      const scoreB = b.confidence * 0.6 + ((b.rating ?? 3) / 5) * 0.4;
      return scoreB - scoreA;
    })
    .slice(0, 3);
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const t0 = Date.now();

  let query: OrchestratorQuery;
  try {
    query = await req.json() as OrchestratorQuery;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Validate required fields
  if (!query.destination || typeof query.destination !== 'string') {
    return NextResponse.json({ error: 'destination is required' }, { status: 422 });
  }

  // Select endpoints based on intent
  const endpoints =
    query.intent === 'flights'     ? FLIGHT_ENDPOINTS :
    query.intent === 'hotels'      ? HOTEL_ENDPOINTS  :
    query.intent === 'restaurants' ? DINING_ENDPOINTS :
    ALL_ENDPOINTS;

  // Fire all sources in parallel — never block on one failure
  const settled = await Promise.allSettled(
    endpoints.map(ep => fetchSource(ep, query))
  );

  const results:  SourceResult[] = settled
    .map(r => r.status === 'fulfilled' ? r.value : null)
    .filter((r): r is SourceResult => r !== null);

  const warnings: string[] = [];

  // Aggregate stats
  let successful = 0, failed = 0, timedOut = 0;
  const allEntities: TravelEntity[] = [];

  for (const r of results) {
    if (r.status === 'fulfilled')  { successful++; allEntities.push(...r.entities); }
    else if (r.status === 'timeout') {
      timedOut++;
      warnings.push(`${r.source.name} timed out after ${r.source.timeout}ms — excluded from results`);
    } else {
      failed++;
      if (r.error) warnings.push(`${r.source.name} error: ${r.error}`);
    }
  }

  // Warn if > 30% of sources failed
  const failureRate = (failed + timedOut) / endpoints.length;
  if (failureRate > 0.3) {
    warnings.push(`⚠️ ${Math.round(failureRate * 100)}% of sources failed — results may be incomplete`);
  }

  const response: OrchestratorResponse = {
    query,
    results:             allEntities,
    totalSources:        endpoints.length,
    successfulSources:   successful,
    failedSources:       failed,
    timeoutSources:      timedOut,
    processingMs:        Date.now() - t0,
    distilledTop3:       distillTop3(allEntities),
    warnings,
  };

  return NextResponse.json(response, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      'X-Sources-Queried': String(endpoints.length),
      'X-Processing-Ms':   String(Date.now() - t0),
    },
  });
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    service:       'Unitravel OmniOrchestrator',
    version:       '1.0.0',
    totalSources:  ALL_ENDPOINTS.length,
    categories:    ['flights', 'hotels', 'restaurants', 'activities', 'all'],
    tiers:         ['economy', 'premium', 'luxury', 'ultra-luxury'],
    documentation: 'POST /api/orchestrator with OrchestratorQuery body',
  });
}
