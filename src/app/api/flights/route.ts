import { NextRequest, NextResponse }              from 'next/server';
import { z }                                       from 'zod';
import type { BentoFlight }                        from '@/lib/amadeus';
import { FLIGHT_ADAPTERS }                         from '@/lib/engines/flights';
import type { FlightEngineResult }                 from '@/lib/engines/flights';

// ── Request schema ─────────────────────────────────────────────────────────────

const FlightSearchSchema = z.object({
  origin:        z.string().min(2).max(4).toUpperCase(),
  destination:   z.string().min(2).max(4).toUpperCase(),
  departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  returnDate:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  adults:        z.coerce.number().int().min(1).max(9).default(2),
  travelClass:   z.enum(['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST']).default('ECONOMY'),
  nonStop:       z.coerce.boolean().default(false),
  maxResults:    z.coerce.number().int().min(1).max(20).default(10),
  currencyCode:  z.string().length(3).default('USD'),
  engines:       z.string().optional(), // comma-separated engine IDs from OmniSelectorConsole
});

export type FlightSearchParams = z.infer<typeof FlightSearchSchema>;

// ── Response shape ─────────────────────────────────────────────────────────────

export interface EngineStatus {
  engineId:     string;
  engineName:   string;
  status:       'ok' | 'needs_api_key' | 'error';
  count:        number;
  latencyMs:    number;
  setupUrl?:    string;
  setupMessage?: string;
}

export interface FlightSearchResponse {
  status:        'ok' | 'needs_api_key' | 'error';
  provider:      string;
  results:       BentoFlight[];
  count:         number;
  searchedAt:    number;
  query:         Partial<FlightSearchParams>;
  engineStatus?: EngineStatus[];
  setupUrl?:     string;
  setupMessage?: string;
}

// ── Deduplication (same route + price band within $20) ─────────────────────────

function deduplicateFlights(flights: BentoFlight[]): BentoFlight[] {
  const seen = new Map<string, BentoFlight>();
  for (const f of flights) {
    const key = `${f.origin}-${f.destination}-${f.departure}-${f.arrival}-${Math.round(f.totalPrice / 20)}`;
    if (!seen.has(key)) seen.set(key, f);
  }
  return [...seen.values()];
}

// ── GET handler ────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse<FlightSearchResponse>> {
  const p = req.nextUrl.searchParams;

  const parsed = FlightSearchSchema.safeParse({
    origin:        p.get('origin')        ?? '',
    destination:   p.get('destination')   ?? '',
    departureDate: p.get('departureDate') ?? '',
    returnDate:    p.get('returnDate')    ?? undefined,
    adults:        p.get('adults'),
    travelClass:   p.get('travelClass')   ?? 'ECONOMY',
    nonStop:       p.get('nonStop'),
    maxResults:    p.get('maxResults'),
    currencyCode:  p.get('currencyCode')  ?? 'USD',
    engines:       p.get('engines')       ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { status: 'error', provider: 'none', results: [], count: 0, searchedAt: Date.now(),
        query: {}, setupMessage: parsed.error.flatten().fieldErrors.toString() },
      { status: 400 },
    );
  }

  const q = parsed.data;

  // ── Resolve adapters from selected engine IDs ──────────────────────────────
  const engineIds = q.engines ? q.engines.split(',').filter(Boolean) : ['duffel'];
  const adapters  = engineIds.map(id => FLIGHT_ADAPTERS[id]).filter(Boolean);

  if (adapters.length === 0) {
    return NextResponse.json({
      status: 'error', provider: 'none', results: [], count: 0,
      searchedAt: Date.now(), query: q,
      setupMessage: 'No valid engines selected.',
    }, { status: 400 });
  }

  const searchParams = {
    origin:        q.origin,
    destination:   q.destination,
    departureDate: q.departureDate,
    returnDate:    q.returnDate,
    adults:        q.adults,
    travelClass:   q.travelClass,
    nonStop:       q.nonStop,
    maxResults:    q.maxResults,
    currencyCode:  q.currencyCode,
  };

  // ── Promise.allSettled — real parallel search ──────────────────────────────
  const settled = await Promise.allSettled(
    adapters.map(a => a.search(searchParams)),
  );

  const allResults: BentoFlight[] = [];
  const engineStatus: EngineStatus[] = settled.map((r, i): EngineStatus => {
    if (r.status === 'fulfilled') {
      const val: FlightEngineResult = r.value;
      if (val.status === 'ok') allResults.push(...val.results);
      return {
        engineId:     val.engineId,
        engineName:   val.engineName,
        status:       val.status === 'ok' ? 'ok' : val.status === 'needs_api_key' ? 'needs_api_key' : 'error',
        count:        val.results.length,
        latencyMs:    val.latencyMs,
        setupUrl:     val.setupUrl,
        setupMessage: val.setupMessage,
      };
    }
    return {
      engineId:   adapters[i].id,
      engineName: adapters[i].name,
      status:     'error',
      count:      0,
      latencyMs:  0,
      setupMessage: r.reason instanceof Error ? r.reason.message : 'Unknown error',
    };
  });

  const deduped = deduplicateFlights(allResults);
  const hasResults = deduped.length > 0;
  const allNeedKey = engineStatus.every(e => e.status === 'needs_api_key');

  return NextResponse.json(
    {
      status:       hasResults ? 'ok' : allNeedKey ? 'needs_api_key' : 'ok',
      provider:     adapters.map(a => a.name).join(', '),
      results:      deduped,
      count:        deduped.length,
      searchedAt:   Date.now(),
      query:        q,
      engineStatus,
      setupUrl:     allNeedKey ? 'https://tequila.kiwi.com' : undefined,
      setupMessage: allNeedKey
        ? `Select "Kiwi.com" or add API keys for: ${engineIds.join(', ')}.`
        : undefined,
    },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' } },
  );
}

// ── POST — same search, body as JSON ──────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse<FlightSearchResponse>> {
  const body   = await req.json().catch(() => ({}));
  const params = new URLSearchParams(
    Object.entries(body).reduce((acc, [k, v]) => {
      acc[k] = String(v);
      return acc;
    }, {} as Record<string, string>),
  );
  const fakeReq = new NextRequest(
    new URL(`${req.nextUrl.origin}/api/flights?${params.toString()}`),
  );
  return GET(fakeReq);
}
