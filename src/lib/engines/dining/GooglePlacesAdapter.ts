import type { DiningEngineAdapter, DiningSearchParams, DiningEngineResult, RawDiningSource } from './DiningEngineAdapter';
import { cuisineGradient }         from './DiningEngineAdapter';
import { googleMapsRestaurantUrl } from '@/utils/deeplinks';

// Uses the new Google Places API (v1) — places.googleapis.com
// Old Maps Places API (maps.googleapis.com/maps/api/place) returns REQUEST_DENIED
// without billing enabled; the new v1 API uses X-Goog-Api-Key header.

export const GooglePlacesAdapter: DiningEngineAdapter = {
  id: 'google-places', name: 'Google Places',

  async search(params: DiningSearchParams): Promise<DiningEngineResult> {
    const start = Date.now();
    const key   = process.env.GOOGLE_PLACES_API_KEY;

    if (!key) {
      return {
        engineId: 'google-places', engineName: 'Google Places', status: 'needs_api_key',
        results: [], latencyMs: 0,
        setupUrl: 'https://console.cloud.google.com/apis/library/places-backend.googleapis.com',
        setupMessage: 'Add GOOGLE_PLACES_API_KEY to .env.local to enable Google Places.',
      };
    }

    try {
      // New Google Places API v1 (2024+)
      const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method:  'POST',
        headers: {
          'Content-Type':    'application/json',
          'X-Goog-Api-Key':  key,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.types,places.rating,places.userRatingCount,places.priceLevel,places.formattedAddress,places.editorialSummary',
        },
        body:   JSON.stringify({
          textQuery:        `restaurants in ${params.destination}`,
          maxResultCount:   12,
          languageCode:     'en',
        }),
        signal: AbortSignal.timeout(8_000),
      });

      if (!res.ok) throw new Error(`Google Places v1 HTTP ${res.status}`);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await res.json();
      if (data.error) throw new Error(`Google Places v1: ${data.error.message ?? data.error.status}`);

      // priceLevel in v1: FREE=0, INEXPENSIVE=1, MODERATE=2, EXPENSIVE=3, VERY_EXPENSIVE=4
      const priceMap: Record<string, number> = {
        PRICE_LEVEL_FREE: 0, PRICE_LEVEL_INEXPENSIVE: 25,
        PRICE_LEVEL_MODERATE: 60, PRICE_LEVEL_EXPENSIVE: 120, PRICE_LEVEL_VERY_EXPENSIVE: 220,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results: RawDiningSource[] = (data.places ?? []).slice(0, 12).map((p: any): RawDiningSource => {
        const types: string[] = (p.types ?? []).map((t: string) => t.replace(/_/g, ' ').replace('establishment', '').trim()).filter(Boolean);
        const cuisine = types.find(t => !['restaurant','food','point of interest'].includes(t)) ?? 'Restaurant';
        const name    = p.displayName?.text ?? 'Unknown';
        const addr    = p.formattedAddress ?? params.destination;

        return {
          source:            'google-places',
          name,
          cuisine:           cuisine.replace(/\b\w/g, (c: string) => c.toUpperCase()),
          location:          addr,
          destination:       params.destination,
          pricePerPerson:    priceMap[p.priceLevel ?? 'PRICE_LEVEL_MODERATE'] ?? 60,
          rating:            parseFloat(((p.rating ?? 3.5) * 2).toFixed(1)),
          slots:             [],
          uberMinutes:       0,
          uberCost:          0,
          aiHighlight:       p.editorialSummary?.text ?? `${(p.userRatingCount ?? 0).toLocaleString()} reviews on Google Maps.`,
          reservationWindow: '30 days',
          tags:              types.slice(0, 4),
          imageGradient:     cuisineGradient(p.types ?? []),
          placeId:           p.id,
          reservationUrl:    googleMapsRestaurantUrl({ name, location: addr, placeId: p.id }),
        };
      });

      return { engineId: 'google-places', engineName: 'Google Places', status: 'ok', results, latencyMs: Date.now() - start };
    } catch (err) {
      return {
        engineId: 'google-places', engineName: 'Google Places', status: 'error',
        results: [], latencyMs: Date.now() - start,
        setupMessage: err instanceof Error ? err.message : 'Google Places failed',
      };
    }
  },
};
