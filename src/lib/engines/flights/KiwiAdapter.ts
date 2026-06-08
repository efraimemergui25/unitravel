import type { BentoFlight }                                          from '@/lib/amadeus';
import { airlineName }                                               from '@/lib/amadeus';
import type { FlightEngineAdapter, FlightSearchParams, FlightEngineResult } from './FlightEngineAdapter';

// ── Cabin code map ─────────────────────────────────────────────────────────────
const CABIN_MAP: Record<string, string> = {
  ECONOMY:          'M',
  PREMIUM_ECONOMY:  'W',
  BUSINESS:         'C',
  FIRST:            'F',
};

// ── Kiwi date format: YYYY-MM-DD → DD/MM/YYYY ─────────────────────────────────
function toKiwiDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// ── HH:MM from ISO datetime string ───────────────────────────────────────────
function toHHMM(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ── Kiwi flight → BentoFlight ─────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformKiwiFlight(flight: any, adults: number, currency: string): BentoFlight {
  const route = flight.route as Array<{
    airline: string; flight_no: number;
    flyFrom: string; flyTo: string;
    local_departure: string; local_arrival: string;
  }>;

  const first   = route[0];
  const last    = route[route.length - 1];
  const stops   = route.length - 1;

  const depDate = new Date(first.local_departure);
  const arrDate = new Date(last.local_arrival);
  const depDay  = Math.floor(depDate.getTime() / 86_400_000);
  const arrDay  = Math.floor(arrDate.getTime() / 86_400_000);
  const dayDiff = arrDay - depDay;

  const totalMin = Math.round((flight.duration?.departure ?? flight.duration?.total ?? 0) / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const durationLabel = h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;

  const layovers = route.slice(0, -1).map((seg, i) => {
    const next       = route[i + 1];
    const layoverMs  = new Date(next.local_departure).getTime() - new Date(seg.local_arrival).getTime();
    const layMin     = Math.round(layoverMs / 60_000);
    const lh = Math.floor(layMin / 60);
    const lm = layMin % 60;
    return {
      airport:       seg.flyTo,
      code:          seg.flyTo,
      durationLabel: lh > 0 ? `${lh}h ${lm}m` : `${lm}m`,
      durationMin:   layMin,
    };
  });

  const allCarriers  = [...new Set(route.map(r => r.airline))];
  const airlineLabel = allCarriers.map(airlineName).join(' + ');
  const routeIatas   = [first.flyFrom, ...layovers.map(l => l.code), last.flyTo];

  const totalPrice     = Math.round(flight.price ?? 0);
  const pricePerPerson = adults > 0 ? Math.round(totalPrice / adults) : totalPrice;

  const co2PerPerson  = Math.round(totalMin * 0.42);
  const co2Base       = Math.round(totalMin * 0.45);
  const co2Pct        = Math.round(((co2PerPerson - co2Base) / co2Base) * 100);
  const co2Comparison = co2Pct < 0
    ? `${Math.abs(co2Pct)}% below route avg`
    : co2Pct === 0 ? 'At route average' : `${co2Pct}% above route avg`;

  const cabin       = flight.selected_cabins ?? 'M';
  const cabinLabels: Record<string, string> = { M: 'Economy', W: 'Premium Economy', C: 'Business', F: 'First' };
  const cabinLabel  = cabinLabels[cabin] ?? 'Economy';
  const amenities   = cabin === 'C' || cabin === 'F'
    ? ['Lie-flat seat', 'Lounge access', 'Premium dining', 'In-flight Wi-Fi option']
    : cabin === 'W'
    ? ['Extra legroom', 'Priority boarding', 'Enhanced meals', 'In-flight Wi-Fi option']
    : ['Standard seat', 'USB-A power', 'In-flight Wi-Fi option'];

  return {
    id:             flight.id,
    airline:        airlineLabel,
    airlineCode:    first.airline,
    flightNumbers:  route.map(r => `${r.airline} ${r.flight_no}`),
    origin:         first.flyFrom,
    destination:    last.flyTo,
    routeLabel:     routeIatas.join(' → '),
    departure:      toHHMM(first.local_departure),
    arrival:        toHHMM(last.local_arrival),
    arrivalNote:    dayDiff > 0 ? `+${dayDiff}` : '',
    totalMin,
    durationLabel,
    stops,
    layovers,
    cabinClass:     cabinLabel,
    pricePerPerson,
    totalPrice,
    pax:            adults,
    baggage:        { cabin: '1× carry-on 10 kg', checked: 'Subject to fare rules' },
    co2PerPerson,
    co2Comparison,
    amenities,
    bookingUrl:     flight.deep_link ?? `https://www.kiwi.com/en/booking`,
    source:         'Kiwi.com',
    offerId:        flight.id,
  };
}

// ── Adapter ───────────────────────────────────────────────────────────────────

export const KiwiAdapter: FlightEngineAdapter = {
  id:   'kiwi',
  name: 'Kiwi.com',

  async search(params: FlightSearchParams): Promise<FlightEngineResult> {
    const start = Date.now();
    const key   = process.env.KIWI_API_KEY;

    if (!key) {
      return {
        engineId:     'kiwi',
        engineName:   'Kiwi.com',
        status:       'needs_api_key',
        results:      [],
        latencyMs:    0,
        setupUrl:     'https://tequila.kiwi.com',
        setupMessage: 'Add KIWI_API_KEY to .env.local. Register free at tequila.kiwi.com.',
      };
    }

    try {
      const url = new URL('https://tequila.kiwi.com/v2/search');
      url.searchParams.set('fly_from',        params.origin);
      url.searchParams.set('fly_to',          params.destination);
      url.searchParams.set('date_from',       toKiwiDate(params.departureDate));
      url.searchParams.set('date_to',         toKiwiDate(params.departureDate));
      url.searchParams.set('adults',          String(params.adults));
      url.searchParams.set('selected_cabins', CABIN_MAP[params.travelClass] ?? 'M');
      url.searchParams.set('curr',            params.currencyCode);
      url.searchParams.set('limit',           String(params.maxResults));
      url.searchParams.set('sort',            'price');
      if (params.nonStop) url.searchParams.set('max_stopovers', '0');

      const res  = await fetch(url.toString(), {
        headers: { apikey: key },
        signal:  AbortSignal.timeout(12_000),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return {
          engineId:     'kiwi',
          engineName:   'Kiwi.com',
          status:       'error',
          results:      [],
          latencyMs:    Date.now() - start,
          setupMessage: `Kiwi API ${res.status}: ${text.slice(0, 120)}`,
        };
      }

      const data = await res.json() as { data: unknown[] };
      const results = (data.data ?? []).map(f => transformKiwiFlight(f, params.adults, params.currencyCode));

      return {
        engineId:   'kiwi',
        engineName: 'Kiwi.com',
        status:     'ok',
        results,
        latencyMs:  Date.now() - start,
      };
    } catch (err) {
      return {
        engineId:     'kiwi',
        engineName:   'Kiwi.com',
        status:       'error',
        results:      [],
        latencyMs:    Date.now() - start,
        setupMessage: err instanceof Error ? err.message : 'Kiwi search failed',
      };
    }
  },
};
