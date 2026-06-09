import type { BentoFlight }                                               from '@/lib/amadeus';
import type { FlightEngineAdapter, FlightSearchParams, FlightEngineResult } from './FlightEngineAdapter';
import { bestFlightUrl }                                                   from '@/utils/deeplinks';

// ── SerpAPI Google Flights — direct Amadeus replacement ───────────────────────
// No GDS contract, no airline agreements needed.
// Free tier: 100 searches/month. Register at serpapi.com (email only, 30s).
// Env var: SERPAPI_KEY

function toHHMM(datetime: string): string {
  // SerpAPI returns "2026-07-01 14:30" or "14:30"
  const match = datetime.match(/(\d{1,2}):(\d{2})(?:\s|$)/);
  if (!match) return datetime.slice(-5);
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

function dayDiff(dep: string, arr: string): number {
  try {
    const d1 = new Date(dep.length > 5 ? dep : `2026-01-01 ${dep}`);
    const d2 = new Date(arr.length > 5 ? arr : `2026-01-01 ${arr}`);
    return Math.floor((d2.getTime() - d1.getTime()) / 86_400_000);
  } catch { return 0; }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformFlight(raw: any, adults: number, searchParams?: { origin: string; destination: string; departureDate: string; travelClass: string }): BentoFlight {
  const legs: Array<{
    departure_airport: { id: string; time: string; name?: string };
    arrival_airport:   { id: string; time: string; name?: string };
    airline:           string;
    flight_number:     string;
    duration:          number;
    extensions?:       string[];
  }> = raw.flights ?? [];

  const first = legs[0];
  const last  = legs[legs.length - 1];
  if (!first || !last) throw new Error('no legs');

  const stops = legs.length - 1;
  const totalMin: number = raw.total_duration ?? legs.reduce((s: number, l: { duration: number }) => s + l.duration, 0);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;

  const layovers = (raw.layovers ?? []).map((lay: { id: string; duration: number }) => {
    const lh = Math.floor(lay.duration / 60);
    const lm = lay.duration % 60;
    return {
      airport: lay.id,
      code: lay.id,
      durationLabel: lh > 0 ? `${lh}h ${lm}m` : `${lm}m`,
      durationMin: lay.duration,
    };
  });

  const priceTotal     = Math.round(raw.price ?? 0);
  const pricePerPerson = adults > 0 ? Math.round(priceTotal / adults) : priceTotal;

  const co2   = raw.carbon_emissions?.this_flight     ? Math.round(raw.carbon_emissions.this_flight / 1000) : Math.round(totalMin * 0.42);
  const co2Avg = raw.carbon_emissions?.typical_for_this_route ? Math.round(raw.carbon_emissions.typical_for_this_route / 1000) : Math.round(totalMin * 0.45);
  const co2Pct = Math.round(((co2 - co2Avg) / Math.max(1, co2Avg)) * 100);

  const allCarriers   = [...new Set(legs.map((l: { airline: string }) => l.airline))];
  const airlineLabel  = allCarriers.join(' + ');
  const flightNumbers = legs.map((l: { airline: string; flight_number: string }) => `${l.airline} ${l.flight_number}`);
  const routeIatas    = [first.departure_airport.id, ...layovers.map((l: { code: string }) => l.code), last.arrival_airport.id];

  const extensions: string[] = first.extensions ?? [];
  const amenities = extensions.length
    ? extensions.slice(0, 4)
    : ['Standard seat', 'USB power', 'Wi-Fi option'];

  const depTime = first.departure_airport.time;
  const arrTime = last.arrival_airport.time;
  const diff    = dayDiff(depTime, arrTime);

  return {
    id:            `serp-${raw.booking_token?.slice(0, 16) ?? Math.random().toString(36)}`,
    airline:       airlineLabel,
    airlineCode:   legs[0]?.airline?.slice(0, 2) ?? '',
    flightNumbers,
    origin:        first.departure_airport.id,
    destination:   last.arrival_airport.id,
    routeLabel:    routeIatas.join(' → '),
    departure:     toHHMM(depTime),
    arrival:       toHHMM(arrTime),
    arrivalNote:   diff > 0 ? `+${diff}` : '',
    totalMin,
    durationLabel: h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`,
    stops,
    layovers,
    cabinClass:    'Economy',
    pricePerPerson,
    totalPrice:    priceTotal,
    pax:           adults,
    baggage:       { cabin: '1× carry-on', checked: 'Subject to fare' },
    co2PerPerson:  co2,
    co2Comparison: co2Pct < 0 ? `${Math.abs(co2Pct)}% below route avg` : co2Pct === 0 ? 'At route average' : `${co2Pct}% above route avg`,
    amenities,
    bookingUrl:    bestFlightUrl({
      origin:        searchParams?.origin      ?? first.departure_airport.id,
      destination:   searchParams?.destination ?? last.arrival_airport.id,
      departureDate: searchParams?.departureDate ?? '',
      adults,
      cabinClass:   (searchParams?.travelClass?.toLowerCase() ?? 'economy') as 'economy' | 'premium_economy' | 'business' | 'first',
      flightNumbers: legs.map((l: { airline: string; flight_number: string }) => `${l.airline} ${l.flight_number}`),
      bookingToken:  raw.booking_token,
    }),
    source:        'Google Flights',
    offerId:       raw.booking_token ?? '',
  };
}

export const SerpApiAdapter: FlightEngineAdapter = {
  id:   'serp-google',
  name: 'Google Flights',

  async search(params: FlightSearchParams): Promise<FlightEngineResult> {
    const start = Date.now();
    const key   = process.env.SERPAPI_KEY;

    if (!key) {
      return {
        engineId:     'serp-google',
        engineName:   'Google Flights',
        status:       'needs_api_key',
        results:      [],
        latencyMs:    0,
        setupUrl:     'https://serpapi.com/users/sign_up',
        setupMessage: 'Add SERPAPI_KEY to .env.local. Free tier: 100 searches/month — serpapi.com (email signup only).',
      };
    }

    try {
      const url = new URL('https://serpapi.com/search');
      url.searchParams.set('engine',          'google_flights');
      url.searchParams.set('departure_id',    params.origin);
      url.searchParams.set('arrival_id',      params.destination);
      url.searchParams.set('outbound_date',   params.departureDate);
      url.searchParams.set('currency',        params.currencyCode);
      url.searchParams.set('hl',              'en');
      url.searchParams.set('adults',          String(params.adults));
      url.searchParams.set('travel_class',    params.travelClass === 'ECONOMY' ? '1' : params.travelClass === 'PREMIUM_ECONOMY' ? '2' : params.travelClass === 'BUSINESS' ? '3' : '4');
      url.searchParams.set('type',            params.returnDate ? '1' : '2'); // 1=round, 2=one-way
      if (params.returnDate) url.searchParams.set('return_date', params.returnDate);
      url.searchParams.set('api_key',         key);

      const res  = await fetch(url.toString(), { signal: AbortSignal.timeout(20_000) });
      if (!res.ok) {
        return {
          engineId:     'serp-google',
          engineName:   'Google Flights',
          status:       'error',
          results:      [],
          latencyMs:    Date.now() - start,
          setupMessage: `SerpAPI ${res.status}`,
        };
      }

      const data = await res.json() as {
        best_flights?:  unknown[];
        other_flights?: unknown[];
        error?:         string;
      };

      if (data.error) {
        return { engineId: 'serp-google', engineName: 'Google Flights', status: 'error', results: [], latencyMs: Date.now() - start, setupMessage: data.error };
      }

      const raw     = [...(data.best_flights ?? []), ...(data.other_flights ?? [])].slice(0, params.maxResults);
      const results: BentoFlight[] = [];

      for (const f of raw) {
        const sp = { origin: params.origin, destination: params.destination, departureDate: params.departureDate, travelClass: params.travelClass };
        try { results.push(transformFlight(f, params.adults, sp)); } catch { /* skip malformed */ }
      }

      return { engineId: 'serp-google', engineName: 'Google Flights', status: 'ok', results, latencyMs: Date.now() - start };

    } catch (err) {
      return {
        engineId:     'serp-google',
        engineName:   'Google Flights',
        status:       'error',
        results:      [],
        latencyMs:    Date.now() - start,
        setupMessage: err instanceof Error ? err.message : 'SerpAPI request failed',
      };
    }
  },
};
