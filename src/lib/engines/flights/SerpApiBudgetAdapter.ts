import type { BentoFlight }                                               from '@/lib/amadeus';
import type { FlightEngineAdapter, FlightSearchParams, FlightEngineResult } from './FlightEngineAdapter';
import { bestFlightUrl }                                                   from '@/utils/deeplinks';

// ── SerpAPI "Budget / Hacker Fares" — occupies the Kiwi slot ─────────────────
// Same SERPAPI_KEY, different strategy:
//   • Searches ±1 day window to surface cheaper dates
//   • Prioritises connecting flights (often 30–60% cheaper)
//   • Returns results sorted cheapest-first
// This replicates the core value of Kiwi (LCC + budget routing) without a
// separate API key.

function toHHMM(datetime: string): string {
  const match = datetime.match(/(\d{1,2}):(\d{2})/);
  if (!match) return datetime.slice(-5);
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

function offsetDate(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformFlight(raw: any, adults: number, dateLabel: string, sp?: { origin: string; destination: string; departureDate: string }): BentoFlight | null {
  try {
    const legs: Array<{
      departure_airport: { id: string; time: string };
      arrival_airport:   { id: string; time: string };
      airline:           string;
      flight_number:     string;
      duration:          number;
    }> = raw.flights ?? [];

    if (!legs.length) return null;

    const first    = legs[0];
    const last     = legs[legs.length - 1];
    const totalMin: number = raw.total_duration ?? legs.reduce((s: number, l: { duration: number }) => s + l.duration, 0);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;

    const layovers = (raw.layovers ?? []).map((lay: { id: string; duration: number }) => {
      const lh = Math.floor(lay.duration / 60);
      const lm = lay.duration % 60;
      return { airport: lay.id, code: lay.id, durationLabel: lh > 0 ? `${lh}h ${lm}m` : `${lm}m`, durationMin: lay.duration };
    });

    const totalPrice     = Math.round(raw.price ?? 0);
    const pricePerPerson = adults > 0 ? Math.round(totalPrice / adults) : totalPrice;
    const allCarriers    = [...new Set(legs.map((l: { airline: string }) => l.airline))];
    const routeIatas     = [first.departure_airport.id, ...layovers.map((l: { code: string }) => l.code), last.arrival_airport.id];

    const co2    = raw.carbon_emissions?.this_flight     ? Math.round(raw.carbon_emissions.this_flight / 1000) : Math.round(totalMin * 0.38);
    const co2Avg = raw.carbon_emissions?.typical_for_this_route ? Math.round(raw.carbon_emissions.typical_for_this_route / 1000) : Math.round(totalMin * 0.45);
    const co2Pct = Math.round(((co2 - co2Avg) / Math.max(1, co2Avg)) * 100);

    // Tag flexible-date results so users know
    const flexNote = dateLabel !== 'exact' ? ` (${dateLabel})` : '';

    return {
      id:            `serp-budget-${raw.booking_token?.slice(0, 14) ?? Math.random().toString(36)}`,
      airline:       allCarriers.join(' + ') + flexNote,
      airlineCode:   legs[0].airline.slice(0, 2),
      flightNumbers: legs.map((l: { airline: string; flight_number: string }) => `${l.airline} ${l.flight_number}`),
      origin:        first.departure_airport.id,
      destination:   last.arrival_airport.id,
      routeLabel:    routeIatas.join(' → '),
      departure:     toHHMM(first.departure_airport.time),
      arrival:       toHHMM(last.arrival_airport.time),
      arrivalNote:   '',
      totalMin,
      durationLabel: h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`,
      stops:         layovers.length,
      layovers,
      cabinClass:    'Economy',
      pricePerPerson,
      totalPrice,
      pax:           adults,
      baggage:       { cabin: '1× carry-on', checked: 'Budget fare — check carrier policy' },
      co2PerPerson:  co2,
      co2Comparison: co2Pct < 0 ? `${Math.abs(co2Pct)}% below route avg` : co2Pct === 0 ? 'At route average' : `${co2Pct}% above route avg`,
      amenities:     ['Budget fare', 'USB power (varies)', 'Carry-on included'],
      bookingUrl:    bestFlightUrl({
        origin:        sp?.origin      ?? legs[0].departure_airport.id,
        destination:   sp?.destination ?? legs[legs.length - 1].arrival_airport.id,
        departureDate: sp?.departureDate ?? '',
        adults,
        cabinClass:    'economy',
        bookingToken:  raw.booking_token,
      }),
      source:        'Google Flights (Budget)',
      offerId:       raw.booking_token ?? '',
    };
  } catch {
    return null;
  }
}

async function serpSearch(
  key:      string,
  origin:   string,
  dest:     string,
  date:     string,
  adults:   number,
  max:      number,
): Promise<{ flights: unknown[]; date: string }> {
  const url = new URL('https://serpapi.com/search');
  url.searchParams.set('engine',         'google_flights');
  url.searchParams.set('departure_id',   origin);
  url.searchParams.set('arrival_id',     dest);
  url.searchParams.set('outbound_date',  date);
  url.searchParams.set('currency',       'USD');
  url.searchParams.set('hl',             'en');
  url.searchParams.set('adults',         String(adults));
  url.searchParams.set('travel_class',   '1'); // economy — cheapest
  url.searchParams.set('type',           '2'); // one-way
  url.searchParams.set('api_key',        key);

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(18_000) });
  if (!res.ok) return { flights: [], date };
  const data = await res.json() as { best_flights?: unknown[]; other_flights?: unknown[] };
  // Prefer other_flights (usually cheaper connecting options)
  const flights = [...(data.other_flights ?? []), ...(data.best_flights ?? [])].slice(0, max);
  return { flights, date };
}

export const SerpApiBudgetAdapter: FlightEngineAdapter = {
  id:   'kiwi',          // occupies the Kiwi UI slot
  name: 'Budget Fares',

  async search(params: FlightSearchParams): Promise<FlightEngineResult> {
    const start = Date.now();
    const key   = process.env.SERPAPI_KEY;

    if (!key) {
      return {
        engineId:     'kiwi',
        engineName:   'Budget Fares',
        status:       'needs_api_key',
        results:      [],
        latencyMs:    0,
        setupUrl:     'https://serpapi.com/users/sign_up',
        setupMessage: 'Add SERPAPI_KEY to .env.local.',
      };
    }

    try {
      const half = Math.ceil(params.maxResults / 2);

      // Search exact date + day after in parallel → cheapest from combined pool
      const [exactResult, plusOneResult] = await Promise.allSettled([
        serpSearch(key, params.origin, params.destination, params.departureDate,               params.adults, params.maxResults),
        serpSearch(key, params.origin, params.destination, offsetDate(params.departureDate, 1), params.adults, half),
      ]);

      const exact   = exactResult.status   === 'fulfilled' ? exactResult.value   : { flights: [], date: params.departureDate };
      const plusOne = plusOneResult.status === 'fulfilled' ? plusOneResult.value : { flights: [], date: '' };

      const labelFor = (d: string) => d === params.departureDate ? 'exact' : `+1 day`;

      const all: BentoFlight[] = [];
      const seen = new Set<string>();

      for (const { flights, date } of [exact, plusOne]) {
        for (const f of flights) {
          const result = transformFlight(f, params.adults, labelFor(date), { origin: params.origin, destination: params.destination, departureDate: date });
          if (!result) continue;
          const key2 = `${result.flightNumbers.join('+')}|${result.departure}`;
          if (!seen.has(key2)) { seen.add(key2); all.push(result); }
        }
      }

      // Sort cheapest first
      all.sort((a, b) => a.pricePerPerson - b.pricePerPerson);

      if (all.length === 0) {
        return { engineId: 'kiwi', engineName: 'Budget Fares', status: 'error', results: [], latencyMs: Date.now() - start, setupMessage: 'No budget flights found for this route' };
      }

      return {
        engineId:   'kiwi',
        engineName: 'Budget Fares',
        status:     'ok',
        results:    all.slice(0, params.maxResults),
        latencyMs:  Date.now() - start,
      };

    } catch (err) {
      return {
        engineId:     'kiwi',
        engineName:   'Budget Fares',
        status:       'error',
        results:      [],
        latencyMs:    Date.now() - start,
        setupMessage: err instanceof Error ? err.message : 'Budget fares search failed',
      };
    }
  },
};
