import { NextRequest, NextResponse }        from 'next/server';
import { z }                               from 'zod';
import { HOTEL_ADAPTERS }                  from '@/lib/engines/hotels';
import type { HotelEngineResult }          from '@/lib/engines/hotels';

// ── Request schema ────────────────────────────────────────────────────────────

const HotelSearchSchema = z.object({
  cityCode:     z.string().min(3).max(3).toUpperCase(),
  checkInDate:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  adults:       z.coerce.number().int().min(1).max(9).default(2),
  roomQuantity: z.coerce.number().int().min(1).max(9).default(1),
  currency:     z.string().length(3).default('USD'),
  maxResults:   z.coerce.number().int().min(1).max(20).default(10),
  engines:      z.string().optional(), // comma-separated engine IDs from OmniSelectorConsole
});

export type HotelSearchParams = z.infer<typeof HotelSearchSchema>;

// ── Hotel result shape ────────────────────────────────────────────────────────

export interface BentoHotel {
  id:              string;
  name:            string;
  chainCode?:      string;
  cityCode:        string;
  latitude?:       number;
  longitude?:      number;
  rating?:         number;
  amenities:       string[];
  pricePerNight:   number;
  totalPrice:      number;
  currency:        string;
  checkIn:         string;
  checkOut:        string;
  nights:          number;
  roomType:        string;
  boardType:       string;
  available:       boolean;
  bookingUrl:      string;
  source:          string;
  offerId:         string;
}

// ── Response shape ─────────────────────────────────────────────────────────────

export interface HotelEngineStatus {
  engineId:  string;
  status:    'ok' | 'needs_api_key' | 'error';
  count:     number;
  setupUrl?: string;
}

export interface HotelSearchResponse {
  status:        'ok' | 'needs_api_key' | 'error';
  provider:      string;
  results:       BentoHotel[];
  count:         number;
  searchedAt:    number;
  query:         Partial<HotelSearchParams>;
  engineStatus?: HotelEngineStatus[];
  setupUrl?:     string;
  setupMessage?: string;
}

// ── GET handler ───────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse<HotelSearchResponse>> {
  const p = req.nextUrl.searchParams;

  const parsed = HotelSearchSchema.safeParse({
    cityCode:     p.get('cityCode')     ?? '',
    checkInDate:  p.get('checkInDate')  ?? '',
    checkOutDate: p.get('checkOutDate') ?? '',
    adults:       p.get('adults'),
    roomQuantity: p.get('roomQuantity'),
    currency:     p.get('currency')     ?? 'USD',
    maxResults:   p.get('maxResults'),
    engines:      p.get('engines')      ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { status: 'error', provider: 'none', results: [], count: 0, searchedAt: Date.now(),
        query: {}, setupMessage: 'Please provide valid check-in/check-out dates and guest count.' },
      { status: 400 },
    );
  }

  const q = parsed.data;

  const engineIds = q.engines ? q.engines.split(',').filter(Boolean) : ['duffel-stays'];
  const adapters  = engineIds.map(id => HOTEL_ADAPTERS[id]).filter(Boolean);

  if (adapters.length === 0) {
    return NextResponse.json(
      { status: 'error', provider: 'none', results: [], count: 0, searchedAt: Date.now(),
        query: q, setupMessage: 'No valid hotel engines selected.' },
      { status: 400 },
    );
  }

  const searchParams = {
    cityCode:     q.cityCode,
    checkInDate:  q.checkInDate,
    checkOutDate: q.checkOutDate,
    adults:       q.adults,
    roomQuantity: q.roomQuantity,
    currency:     q.currency,
    maxResults:   q.maxResults,
  };

  const settled = await Promise.allSettled(
    adapters.map(a => a.search(searchParams)),
  );

  const allResults: BentoHotel[] = [];
  const engineStatus: HotelEngineStatus[] = settled.map((r, i): HotelEngineStatus => {
    if (r.status === 'fulfilled') {
      const val: HotelEngineResult = r.value;
      if (val.status === 'ok') allResults.push(...val.results);
      return {
        engineId: val.engineId,
        status:   val.status === 'ok' ? 'ok' : val.status === 'needs_api_key' ? 'needs_api_key' : 'error',
        count:    val.results.length,
        setupUrl: val.setupUrl,
      };
    }
    return {
      engineId: adapters[i].id,
      status:   'error',
      count:    0,
    };
  });

  const hasResults = allResults.length > 0;
  const allNeedKey = engineStatus.every(e => e.status === 'needs_api_key');

  return NextResponse.json(
    {
      status:       hasResults ? 'ok' : allNeedKey ? 'needs_api_key' : 'ok',
      provider:     adapters.map(a => a.name).join(', '),
      results:      allResults.slice(0, q.maxResults),
      count:        Math.min(allResults.length, q.maxResults),
      searchedAt:   Date.now(),
      query:        q,
      engineStatus,
      setupUrl:     allNeedKey ? 'https://developers.amadeus.com/register' : undefined,
      setupMessage: allNeedKey
        ? `Select "Amadeus Hotels" or add API keys for: ${engineIds.join(', ')}.`
        : undefined,
    },
    { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=60' } },
  );
}

// ── POST — same search, body as JSON ─────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse<HotelSearchResponse>> {
  const body   = await req.json().catch(() => ({}));
  const params = new URLSearchParams(
    Object.entries(body).reduce((acc, [k, v]) => {
      acc[k] = String(v);
      return acc;
    }, {} as Record<string, string>),
  );
  const fakeReq = new NextRequest(
    new URL(`${req.nextUrl.origin}/api/hotels?${params.toString()}`),
  );
  return GET(fakeReq);
}
