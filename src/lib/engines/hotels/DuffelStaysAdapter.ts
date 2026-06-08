import type { BentoHotel }       from '@/app/api/hotels/route';
import type { HotelEngineAdapter, HotelSearchParams, HotelEngineResult } from './index';

const BASE = 'https://api.duffel.com';

// ── Major IATA city → coordinates ─────────────────────────────────────────────
const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  NYC: { lat: 40.7128, lng: -74.0060 }, JFK: { lat: 40.6413, lng: -73.7781 },
  LAX: { lat: 34.0522, lng: -118.2437}, SFO: { lat: 37.7749, lng: -122.4194},
  LHR: { lat: 51.5074, lng: -0.1278 },  CDG: { lat: 48.8566, lng: 2.3522  },
  TLV: { lat: 32.0853, lng: 34.7818 },  AMS: { lat: 52.3676, lng: 4.9041  },
  MEX: { lat: 19.4326, lng: -99.1332},  CUN: { lat: 21.1619, lng: -86.8515},
  MIA: { lat: 25.7617, lng: -80.1918},  ORD: { lat: 41.8781, lng: -87.6298},
  DXB: { lat: 25.2048, lng: 55.2708 },  SIN: { lat: 1.3521,  lng: 103.8198},
  NRT: { lat: 35.6762, lng: 139.6503},  HKG: { lat: 22.3193, lng: 114.1694},
  BCN: { lat: 41.3851, lng: 2.1734  },  MAD: { lat: 40.4168, lng: -3.7038 },
  FCO: { lat: 41.9028, lng: 12.4964 },  MXP: { lat: 45.4642, lng: 9.1900  },
  BKK: { lat: 13.7563, lng: 100.5018},  SYD: { lat: -33.8688, lng: 151.2093},
  GRU: { lat: -23.5505, lng: -46.6333}, BOG: { lat: 4.7110, lng: -74.0721 },
  YYZ: { lat: 43.6532, lng: -79.3832},  ICN: { lat: 37.5665, lng: 126.9780},
  IST: { lat: 41.0082, lng: 28.9784 },  CAI: { lat: 30.0444, lng: 31.2357 },
  MUC: { lat: 48.1351, lng: 11.5820 },  ZRH: { lat: 47.3769, lng: 8.5417  },
  VIE: { lat: 48.2082, lng: 16.3738 },  PRG: { lat: 50.0755, lng: 14.4378 },
  WAW: { lat: 52.2297, lng: 21.0122 },  BUD: { lat: 47.4979, lng: 19.0402 },
  CPH: { lat: 55.6761, lng: 12.5683 },  OSL: { lat: 59.9139, lng: 10.7522 },
  HEL: { lat: 60.1699, lng: 24.9384 },  ARN: { lat: 59.3293, lng: 18.0686 },
  LIS: { lat: 38.7223, lng: -9.1393 },  ATH: { lat: 37.9838, lng: 23.7275 },
};

async function geocodeCity(cityCode: string): Promise<{ lat: number; lng: number } | null> {
  const coords = CITY_COORDS[cityCode.toUpperCase()];
  if (coords) return coords;

  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return null;
  try {
    const res  = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(cityCode)}&key=${key}`,
      { signal: AbortSignal.timeout(5_000) },
    );
    const data = await res.json() as { results: Array<{ geometry: { location: { lat: number; lng: number } } }> };
    const loc  = data.results?.[0]?.geometry?.location;
    if (loc) return { lat: loc.lat, lng: loc.lng };
  } catch { /* fall through */ }
  return null;
}

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformAccommodation(acc: any, params: HotelSearchParams): BentoHotel {
  const checkIn  = params.checkInDate;
  const checkOut = params.checkOutDate;
  const nights   = Math.max(1, Math.round(
    (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000,
  ));

  const cheapestRate  = acc.cheapest_rate_public_amount
    ? parseFloat(acc.cheapest_rate_public_amount)
    : 0;
  const pricePerNight = nights > 0 ? Math.round(cheapestRate / nights) : Math.round(cheapestRate);
  const amenityCodes  = (acc.amenities ?? []) as string[];
  const amenities     = amenityCodes.slice(0, 6).map((a: string) =>
    a.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase()),
  );

  return {
    id:            acc.accommodation?.id ?? acc.id ?? `duffel-${Math.random()}`,
    name:          acc.accommodation?.name ?? 'Unknown Hotel',
    chainCode:     acc.accommodation?.chain?.name,
    cityCode:      params.cityCode,
    latitude:      acc.accommodation?.location?.geographic_coordinates?.latitude,
    longitude:     acc.accommodation?.location?.geographic_coordinates?.longitude,
    rating:        acc.accommodation?.rating ? parseInt(acc.accommodation.rating) : undefined,
    amenities,
    pricePerNight,
    totalPrice:    Math.round(cheapestRate),
    currency:      params.currency,
    checkIn,
    checkOut,
    nights,
    roomType:      acc.cheapest_rate_currency ?? 'Standard Room',
    boardType:     'Room Only',
    available:     true,
    bookingUrl:    `https://app.duffel.com`,
    source:        'Duffel Stays',
    offerId:       acc.id ?? '',
  };
}

export const DuffelStaysAdapter: HotelEngineAdapter = {
  id:   'duffel-stays',
  name: 'Duffel Stays',

  async search(params: HotelSearchParams): Promise<HotelEngineResult> {
    const start = Date.now();
    const hdrs  = headers();

    if (!hdrs) {
      return {
        engineId:     'duffel-stays',
        engineName:   'Duffel Stays',
        status:       'needs_api_key',
        results:      [],
        latencyMs:    0,
        setupUrl:     'https://app.duffel.com',
        setupMessage: 'Add DUFFEL_API_KEY to .env.local.',
      };
    }

    const coords = await geocodeCity(params.cityCode);
    if (!coords) {
      return {
        engineId:     'duffel-stays',
        engineName:   'Duffel Stays',
        status:       'error',
        results:      [],
        latencyMs:    Date.now() - start,
        setupMessage: `Could not resolve coordinates for "${params.cityCode}".`,
      };
    }

    try {
      const guests = Array.from({ length: params.adults }, () => ({ type: 'adult' }));

      const res = await fetch(`${BASE}/stays/search`, {
        method:  'POST',
        headers: hdrs,
        body:    JSON.stringify({
          data: {
            check_in_date:  params.checkInDate,
            check_out_date: params.checkOutDate,
            rooms:          params.roomQuantity,
            guests,
            location: {
              geographic_coordinates: { latitude: coords.lat, longitude: coords.lng },
              radius: 15,
              unit:   'km',
            },
          },
        }),
        signal: AbortSignal.timeout(20_000),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { errors?: Array<{ message: string }> };
        return {
          engineId:     'duffel-stays',
          engineName:   'Duffel Stays',
          status:       'error',
          results:      [],
          latencyMs:    Date.now() - start,
          setupMessage: err.errors?.[0]?.message ?? `Duffel Stays ${res.status}`,
        };
      }

      const json    = await res.json() as { data: unknown[] };
      const results = (json.data ?? [])
        .slice(0, params.maxResults)
        .map(a => transformAccommodation(a, params));

      return { engineId: 'duffel-stays', engineName: 'Duffel Stays', status: 'ok', results, latencyMs: Date.now() - start };
    } catch (err) {
      return {
        engineId:     'duffel-stays',
        engineName:   'Duffel Stays',
        status:       'error',
        results:      [],
        latencyMs:    Date.now() - start,
        setupMessage: err instanceof Error ? err.message : 'Duffel Stays search failed',
      };
    }
  },
};
