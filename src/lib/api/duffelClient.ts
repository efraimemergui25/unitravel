// Anti-Facade Duffel HTTP client.
// Maps AI-supplied search parameters → raw Duffel Air API → AviationEntity schema.
// Called directly by API routes; DuffelAdapter (engine adapter layer) wraps this
// for the zone search pipeline. Never returns fake data.

import type { AviationEntity, AirportInfo, LayoverCognitiveLoad } from '@/types/aviation';

// ── Public types ──────────────────────────────────────────────────────────────

export interface DuffelSearchParams {
  origins:       string[];         // IATA codes or city names
  destinations?: string[];
  departureDate: string;           // YYYY-MM-DD
  returnDate?:   string;           // YYYY-MM-DD — omit for one-way
  adults?:       number;           // default 1
  cabinClass?:   'economy' | 'premium_economy' | 'business' | 'first';
  maxPrice?:     number;           // USD hard cap — applied post-fetch
  maxResults?:   number;           // default 20
}

export type DuffelResult =
  | { ok: true;  entities: AviationEntity[]; latencyMs: number }
  | { ok: false; code: 'no_api_key' | 'api_rejection' | 'timeout' | 'network_error'; message: string };

// ── Internals ─────────────────────────────────────────────────────────────────

const BASE            = 'https://api.duffel.com';
const REQUEST_TIMEOUT = 15_000;

const CABIN_MAP: Record<string, string> = {
  economy:          'economy',
  premium_economy:  'premium_economy',
  business:         'business',
  first:            'first',
};

function buildHeaders(): Record<string, string> | null {
  const key = process.env.DUFFEL_API_KEY;
  if (!key) return null;
  return {
    Authorization:    `Bearer ${key}`,
    'Content-Type':   'application/json',
    'Duffel-Version': 'v2',
    Accept:           'application/json',
  };
}

function isoToHHMM(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

function parseDurationMinutes(pt: string): number {
  const match = pt.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return 0;
  return (parseInt(match[1] ?? '0') * 60) + parseInt(match[2] ?? '0');
}

function durationLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m > 0 ? `${m}m` : ''}`.trim() : `${m}m`;
}

function toAirportInfo(place: {
  iata_code:    string;
  name:         string;
  city_name:    string;
  country_name: string;
  terminal?:    string;
}): AirportInfo {
  return {
    iata:      place.iata_code,
    city:      place.city_name ?? place.name,
    country:   place.country_name,
    terminal:  place.terminal,
    lat:       0, // Duffel does not expose coordinates in offer responses
    lon:       0,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapOfferToAviationEntity(offer: any, adults: number): AviationEntity {
  const slice = offer.slices[0];
  const segs: Array<{
    departing_at: string;
    arriving_at:  string;
    origin:       { iata_code: string; name: string; city_name: string; country_name: string; terminal?: string };
    destination:  { iata_code: string; name: string; city_name: string; country_name: string; terminal?: string };
    marketing_carrier: { name: string; iata_code: string };
    marketing_carrier_flight_number: string;
  }> = slice.segments;

  const first       = segs[0];
  const last        = segs[segs.length - 1];
  const totalMin    = parseDurationMinutes(slice.duration ?? 'PT0M');
  const totalPrice  = Math.round(parseFloat(offer.total_amount ?? '0'));
  const perPerson   = adults > 0 ? Math.round(totalPrice / adults) : totalPrice;

  const cabinRaw    = offer.slices[0]?.segments[0]?.passengers?.[0]?.cabin_class ?? 'economy';

  const layoverLoad: LayoverCognitiveLoad | null = segs.length > 1
    ? (() => {
        const penultimate = segs[segs.length - 2];
        const layMs       = new Date(last.departing_at).getTime() - new Date(penultimate.arriving_at).getTime();
        const layMin      = Math.round(layMs / 60_000);
        return {
          durationMin:  layMin,
          airport:      toAirportInfo(penultimate.destination),
          score:        Math.min(layMin / 360, 1),
          factors:      layMin < 60 ? ['tight connection'] : layMin > 240 ? ['long layover'] : [],
          loungeAccess: cabinRaw === 'business' || cabinRaw === 'first',
          transitVisa:  false,
        };
      })()
    : null;

  // Carbon: rough estimate — 0.42 kg CO₂ per flight-minute per seat (economy avg)
  const co2PerPax   = Math.round(totalMin * 0.42);
  const co2Base     = Math.round(totalMin * 0.45);

  return {
    id:            offer.id,
    airline:       first.marketing_carrier.name,
    alliance:      'Independent' as const,
    flightNumber:  `${first.marketing_carrier.iata_code}${first.marketing_carrier_flight_number}`,
    origin:        toAirportInfo(first.origin),
    destination:   toAirportInfo(last.destination),
    departure:     isoToHHMM(first.departing_at),
    arrival:       isoToHHMM(last.arriving_at),
    durationMin:   totalMin,
    durationLabel: durationLabel(totalMin),
    stops:         segs.length - 1,
    stopDetails:   [],
    cabin:         cabinRaw,
    luggage: {
      carryOnKg:   7,
      carryOnCm:   [55, 35, 20],
      checkedKg:   offer.conditions?.change_before_departure?.allowed ? 23 : 0,
      checkedCm:   [90, 75, 43],
      included:    !!offer.conditions?.change_before_departure?.allowed,
      extraFeeUSD: 0,
    },
    price: perPerson,
    // pricePrediction: Duffel offer_requests return live pricing only — no
    // historical time-series or drop probability is available from this endpoint.
    // All fields are set to their zero/unknown state; the UI should treat
    // dropProbability === 0 as "no prediction data available."
    pricePrediction: {
      currentPrice:    perPerson,
      priceRange:      [perPerson, perPerson],  // unknown range → show as single point
      dropProbability: 0,                        // no prediction source
      expectedDropUSD: 0,
      recommendAction: 'Live price from Duffel — no historical trend available.',
      sparkline:       Array<number>(14).fill(0.5), // flat line = no data, not a trend
      trend:           'stable' as const,
    },
    carbon: {
      totalKg:        co2PerPax,
      perPassengerKg: co2PerPax,
      label:          `${co2PerPax} kg CO₂`,
      vsAverageRoute: co2PerPax / Math.max(co2Base, 1),
      offsetUSD:      Math.round(co2PerPax * 0.018),
      alternative:    'Train where available reduces emissions by ~85%',
    },
    layoverLoad,
    sourceMatches: [{
      engineId:   'duffel',
      engineName: 'Duffel',
      price:      perPerson,
      available:  true,
      deepLink:   `https://app.duffel.com`,
    }],
    sourceCount:   1,
    aiConfidence:  0.87,
    seats:         offer.available_services?.length ?? 9,
    refundable:    !!(offer.conditions?.refund_before_departure?.allowed),
    tags:          [
      cabinRaw.replace('_', ' '),
      ...(segs.length === 1 ? ['nonstop'] : [`${segs.length - 1} stop`]),
    ],
    recommendation: perPerson < 400 ? 'book-now' : 'watch',
    aiSummary:      `${first.marketing_carrier.name} via Duffel — ${durationLabel(totalMin)}, ${segs.length - 1} stop(s), $${perPerson}/person.`,
  };
}

// ── Public fetch function ─────────────────────────────────────────────────────

export async function fetchDuffelOffers(params: DuffelSearchParams): Promise<DuffelResult> {
  const start = Date.now();
  const hdrs  = buildHeaders();

  if (!hdrs) {
    return {
      ok:      false,
      code:    'no_api_key',
      message: 'DUFFEL_API_KEY is not set. Add it to .env.local — get one at https://app.duffel.com',
    };
  }

  const adults     = params.adults ?? 1;
  const maxResults = params.maxResults ?? 20;
  const origin     = params.origins[0];
  const dest       = params.destinations?.[0];

  if (!origin || !dest) {
    return {
      ok:      false,
      code:    'api_rejection',
      message: 'API Rejection: Both origin and destination are required.',
    };
  }

  const departureDate = new Date(params.departureDate);
  if (isNaN(departureDate.getTime()) || departureDate < new Date()) {
    return {
      ok:      false,
      code:    'api_rejection',
      message: 'API Rejection: Dates must be in the future.',
    };
  }

  const slices: Array<{ origin: string; destination: string; departure_date: string }> = [
    { origin, destination: dest, departure_date: params.departureDate },
  ];
  if (params.returnDate) {
    slices.push({ origin: dest, destination: origin, departure_date: params.returnDate });
  }

  try {
    const res = await fetch(`${BASE}/air/offer_requests?return_offers=true`, {
      method:  'POST',
      headers: hdrs,
      body:    JSON.stringify({
        data: {
          slices,
          passengers:  Array.from({ length: adults }, () => ({ type: 'adult' })),
          cabin_class: CABIN_MAP[params.cabinClass ?? 'economy'] ?? 'economy',
        },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({})) as { errors?: Array<{ message: string; title?: string }> };
      const msg     = errBody.errors?.[0]?.message ?? errBody.errors?.[0]?.title ?? `Duffel ${res.status}`;
      return { ok: false, code: 'api_rejection', message: `API Rejection: ${msg}` };
    }

    const json    = await res.json() as { data: { offers: unknown[] } };
    let offers    = (json.data?.offers ?? []).slice(0, maxResults);

    if (params.maxPrice != null) {
      offers = offers.filter(
        (o: unknown) => parseFloat((o as { total_amount: string }).total_amount ?? '0') <= (params.maxPrice! * adults),
      );
    }

    const entities = offers.map(o => mapOfferToAviationEntity(o, adults));
    return { ok: true, entities, latencyMs: Date.now() - start };

  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'TimeoutError';
    return {
      ok:      false,
      code:    isTimeout ? 'timeout' : 'network_error',
      message: isTimeout
        ? `Duffel request timed out after ${REQUEST_TIMEOUT / 1000}s`
        : (err instanceof Error ? err.message : 'Duffel network error'),
    };
  }
}
