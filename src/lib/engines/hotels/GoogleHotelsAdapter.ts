import type { BentoHotel }       from '@/app/api/hotels/route';
import type { HotelEngineAdapter, HotelSearchParams, HotelEngineResult } from './index';

// Google Places API v1 — hotels search via nearbySearch + Geoapify geocoding.
// Uses the same GOOGLE_PLACES_API_KEY as the dining adapter.
// Returns real hotels with ratings, addresses, and Google Maps booking links.

// Common 3-letter city codes → canonical city name for geocoding
const CITY_NAMES: Record<string, string> = {
  PAR:'Paris', LON:'London', NYC:'New York', LAX:'Los Angeles',
  TLV:'Tel Aviv', DXB:'Dubai', SIN:'Singapore', NRT:'Tokyo', TYO:'Tokyo',
  MIA:'Miami', BCN:'Barcelona', MAD:'Madrid', FCO:'Rome', ROM:'Rome',
  AMS:'Amsterdam', FRA:'Frankfurt', MUC:'Munich', ZRH:'Zurich',
  IST:'Istanbul', ATH:'Athens', LIS:'Lisbon', PRG:'Prague',
  BKK:'Bangkok', HKG:'Hong Kong', SYD:'Sydney', ICN:'Seoul',
  CDG:'Paris', LHR:'London', JFK:'New York', ORD:'Chicago',
  SFO:'San Francisco', BOS:'Boston', YYZ:'Toronto',
};

async function geocodeToCoords(cityCode: string): Promise<{ lat: number; lng: number } | null> {
  const geoKey = process.env.GEOAPIFY_API_KEY;
  const query  = CITY_NAMES[cityCode.toUpperCase()] ?? cityCode;
  if (!geoKey) return null;
  try {
    const res = await fetch(
      `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(query)}&format=json&limit=1&apiKey=${geoKey}`,
      { signal: AbortSignal.timeout(5_000) },
    );
    if (!res.ok) return null;
    const data = await res.json() as { results: Array<{ lat: number; lon: number }> };
    const r = data.results?.[0];
    return r ? { lat: r.lat, lng: r.lon } : null;
  } catch { return null; }
}

const PRICE_MAP: Record<string, number> = {
  PRICE_LEVEL_FREE:          60,
  PRICE_LEVEL_INEXPENSIVE:   90,
  PRICE_LEVEL_MODERATE:      160,
  PRICE_LEVEL_EXPENSIVE:     320,
  PRICE_LEVEL_VERY_EXPENSIVE:650,
};

export const GoogleHotelsAdapter: HotelEngineAdapter = {
  id:   'google-hotels',
  name: 'Google Hotels',

  async search(params: HotelSearchParams): Promise<HotelEngineResult> {
    const start = Date.now();
    const key   = process.env.GOOGLE_PLACES_API_KEY;

    if (!key) {
      return {
        engineId:     'google-hotels',
        engineName:   'Google Hotels',
        status:       'needs_api_key',
        results:      [],
        latencyMs:    0,
        deepLinkUrl:  `https://www.google.com/travel/hotels/s?q=hotels+in+${encodeURIComponent(params.cityCode)}&checkin=${params.checkInDate}&checkout=${params.checkOutDate}&guests=${params.adults}`,
        setupUrl:     'https://console.cloud.google.com/apis/library/places-backend.googleapis.com',
        setupMessage: 'Add GOOGLE_PLACES_API_KEY to .env.local.',
      };
    }

    const nights = Math.max(1, Math.round(
      (new Date(params.checkOutDate).getTime() - new Date(params.checkInDate).getTime()) / 86_400_000,
    ));

    try {
      // Geocode the city code to lat/lon for more accurate nearbySearch
      const coords = await geocodeToCoords(params.cityCode);
      const fieldMask = 'places.id,places.displayName,places.rating,places.userRatingCount,places.priceLevel,places.formattedAddress,places.location,places.googleMapsUri,places.websiteUri';

      // Prefer nearbySearch when we have coordinates (better coverage)
      let body: object;
      let endpoint: string;
      if (coords) {
        endpoint = 'https://places.googleapis.com/v1/places:searchNearby';
        body = {
          includedTypes:    ['hotel', 'lodging'],
          maxResultCount:   Math.min(params.maxResults, 20),
          languageCode:     'en',
          locationRestriction: {
            circle: {
              center: { latitude: coords.lat, longitude: coords.lng },
              radius: 8000,
            },
          },
        };
      } else {
        endpoint = 'https://places.googleapis.com/v1/places:searchText';
        body = {
          textQuery:      `hotels in ${CITY_NAMES[params.cityCode.toUpperCase()] ?? params.cityCode}`,
          includedType:   'hotel',
          maxResultCount: Math.min(params.maxResults, 20),
          languageCode:   'en',
        };
      }

      const res = await fetch(endpoint, {
        method:  'POST',
        headers: {
          'Content-Type':     'application/json',
          'X-Goog-Api-Key':   key,
          'X-Goog-FieldMask': fieldMask,
        },
        body:   JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) throw new Error(`Google Hotels v1 HTTP ${res.status}`);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await res.json();
      if (data.error) throw new Error(`Google Hotels: ${data.error.message ?? data.error.status}`);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results: BentoHotel[] = (data.places ?? []).map((p: any): BentoHotel => {
        const pricePerNight = PRICE_MAP[p.priceLevel ?? 'PRICE_LEVEL_MODERATE'] ?? 160;
        const name          = p.displayName?.text ?? 'Unknown Hotel';
        const addr          = p.formattedAddress ?? params.cityCode;
        const mapsUrl       = p.googleMapsUri ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name + ' ' + addr)}`;
        const bookingUrl    = p.websiteUri ?? mapsUrl;

        return {
          id:            p.id ?? `goog-${Math.random().toString(36).slice(2)}`,
          name,
          cityCode:      params.cityCode,
          latitude:      p.location?.latitude,
          longitude:     p.location?.longitude,
          rating:        p.rating ? Math.round(p.rating) : undefined,
          amenities:     [],
          pricePerNight,
          totalPrice:    pricePerNight * nights,
          currency:      params.currency,
          checkIn:       params.checkInDate,
          checkOut:      params.checkOutDate,
          nights,
          roomType:      'Standard Room',
          boardType:     'Room Only',
          available:     true,
          bookingUrl,
          source:        'Google Hotels',
          offerId:       p.id ?? '',
        };
      });

      return {
        engineId:   'google-hotels',
        engineName: 'Google Hotels',
        status:     'ok',
        results,
        latencyMs:  Date.now() - start,
      };
    } catch (err) {
      return {
        engineId:    'google-hotels',
        engineName:  'Google Hotels',
        status:      'error',
        results:     [],
        latencyMs:   Date.now() - start,
        deepLinkUrl: `https://www.google.com/travel/hotels/s?q=hotels+in+${encodeURIComponent(params.cityCode)}&checkin=${params.checkInDate}&checkout=${params.checkOutDate}`,
        setupMessage: err instanceof Error ? err.message : 'Google Hotels failed',
      };
    }
  },
};
