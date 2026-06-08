import type { BentoFlight }                                               from '@/lib/amadeus';
import { airlineName, parseDuration }                                      from '@/lib/amadeus';
import type { FlightEngineAdapter, FlightSearchParams, FlightEngineResult } from './FlightEngineAdapter';

const BASE = 'https://api.duffel.com';

const CABIN_MAP: Record<string, string> = {
  ECONOMY:         'economy',
  PREMIUM_ECONOMY: 'premium_economy',
  BUSINESS:        'business',
  FIRST:           'first',
};

function headers() {
  const key = process.env.DUFFEL_API_KEY;
  if (!key) return null;
  return {
    Authorization:    `Bearer ${key}`,
    'Content-Type':   'application/json',
    'Duffel-Version': 'v2',
    Accept:           'application/json',
  };
}

function toHHMM(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformOffer(offer: any, adults: number): BentoFlight {
  const slice   = offer.slices[0];
  const segs    = slice.segments as Array<{
    departing_at: string; arriving_at: string;
    origin: { iata_code: string }; destination: { iata_code: string };
    marketing_carrier: { name: string; iata_code: string };
    marketing_carrier_flight_number: string;
    stops: number;
  }>;

  const first   = segs[0];
  const last    = segs[segs.length - 1];
  const dur     = parseDuration(slice.duration ?? 'PT0M');

  const depDate = new Date(first.departing_at);
  const arrDate = new Date(last.arriving_at);
  const dayDiff = Math.floor(arrDate.getTime() / 86_400_000) - Math.floor(depDate.getTime() / 86_400_000);

  const layovers = segs.slice(0, -1).map((seg, i) => {
    const next    = segs[i + 1];
    const layMs   = new Date(next.departing_at).getTime() - new Date(seg.arriving_at).getTime();
    const layMin  = Math.round(layMs / 60_000);
    const lh      = Math.floor(layMin / 60);
    const lm      = layMin % 60;
    return {
      airport:       seg.destination.iata_code,
      code:          seg.destination.iata_code,
      durationLabel: lh > 0 ? `${lh}h ${lm}m` : `${lm}m`,
      durationMin:   layMin,
    };
  });

  const allCarriers  = [...new Set(segs.map(s => s.marketing_carrier.iata_code))];
  const airlineLabel = allCarriers.map(c => airlineName(c) || c).join(' + ');
  const routeIatas   = [first.origin.iata_code, ...layovers.map(l => l.code), last.destination.iata_code];

  const totalPrice     = Math.round(parseFloat(offer.total_amount ?? '0'));
  const pricePerPerson = adults > 0 ? Math.round(totalPrice / adults) : totalPrice;

  const cabin       = offer.slices[0]?.segments[0]?.passengers?.[0]?.cabin_class ?? 'economy';
  const cabinLabel  = cabin.replace('_', ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());

  const co2 = Math.round(dur.minutes * 0.42);
  const co2Base = Math.round(dur.minutes * 0.45);
  const co2Pct = Math.round(((co2 - co2Base) / co2Base) * 100);

  const amenities = cabin === 'business' || cabin === 'first'
    ? ['Lie-flat seat', 'Lounge access', 'Premium dining', 'Wi-Fi option']
    : cabin === 'premium_economy'
    ? ['Extra legroom', 'Priority boarding', 'Wi-Fi option']
    : ['Standard seat', 'USB power', 'Wi-Fi option'];

  return {
    id:             offer.id,
    airline:        airlineLabel,
    airlineCode:    first.marketing_carrier.iata_code,
    flightNumbers:  segs.map(s => `${s.marketing_carrier.iata_code}${s.marketing_carrier_flight_number}`),
    origin:         first.origin.iata_code,
    destination:    last.destination.iata_code,
    routeLabel:     routeIatas.join(' → '),
    departure:      toHHMM(first.departing_at),
    arrival:        toHHMM(last.arriving_at),
    arrivalNote:    dayDiff > 0 ? `+${dayDiff}` : '',
    totalMin:       dur.minutes,
    durationLabel:  dur.label,
    stops:          layovers.length,
    layovers,
    cabinClass:     cabinLabel,
    pricePerPerson,
    totalPrice,
    pax:            adults,
    baggage:        { cabin: '1× carry-on', checked: offer.conditions?.change_before_departure?.allowed ? 'Flexible' : 'Subject to fare' },
    co2PerPerson:   co2,
    co2Comparison:  co2Pct < 0 ? `${Math.abs(co2Pct)}% below avg` : co2Pct === 0 ? 'At route average' : `${co2Pct}% above avg`,
    amenities,
    bookingUrl:     `https://app.duffel.com`,
    source:         'Duffel',
    offerId:        offer.id,
  };
}

export const DuffelAdapter: FlightEngineAdapter = {
  id:   'duffel',
  name: 'Duffel',

  async search(params: FlightSearchParams): Promise<FlightEngineResult> {
    const start = Date.now();
    const hdrs  = headers();

    if (!hdrs) {
      return {
        engineId:     'duffel',
        engineName:   'Duffel',
        status:       'needs_api_key',
        results:      [],
        latencyMs:    0,
        setupUrl:     'https://app.duffel.com',
        setupMessage: 'Add DUFFEL_API_KEY to .env.local.',
      };
    }

    try {
      const passengers = Array.from({ length: params.adults }, () => ({ type: 'adult' }));

      const res = await fetch(`${BASE}/air/offer_requests?return_offers=true`, {
        method:  'POST',
        headers: hdrs,
        body:    JSON.stringify({
          data: {
            slices:      [{ origin: params.origin, destination: params.destination, departure_date: params.departureDate }],
            passengers,
            cabin_class: CABIN_MAP[params.travelClass] ?? 'economy',
          },
        }),
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { errors?: Array<{ message: string }> };
        return {
          engineId:     'duffel',
          engineName:   'Duffel',
          status:       'error',
          results:      [],
          latencyMs:    Date.now() - start,
          setupMessage: err.errors?.[0]?.message ?? `Duffel ${res.status}`,
        };
      }

      const json    = await res.json() as { data: { offers: unknown[] } };
      const offers  = (json.data?.offers ?? []).slice(0, params.maxResults);
      const results = offers.map(o => transformOffer(o, params.adults));

      return { engineId: 'duffel', engineName: 'Duffel', status: 'ok', results, latencyMs: Date.now() - start };
    } catch (err) {
      return {
        engineId:     'duffel',
        engineName:   'Duffel',
        status:       'error',
        results:      [],
        latencyMs:    Date.now() - start,
        setupMessage: err instanceof Error ? err.message : 'Duffel search failed',
      };
    }
  },
};
