import type { DiningEngineAdapter, DiningSearchParams, DiningEngineResult, RawDiningSource } from './DiningEngineAdapter';
import { cuisineGradient }         from './DiningEngineAdapter';
import { googleMapsRestaurantUrl } from '@/utils/deeplinks';

// Foursquare v3 /places/search was deprecated (returns HTTP 410).
// This adapter now uses the Foursquare Places API v3 autocomplete + search
// via the still-active endpoint. If the key is not configured or the API
// changes again, falls back to graceful needs_api_key.

export const FoursquareAdapter: DiningEngineAdapter = {
  id: 'foursquare', name: 'Foursquare',

  async search(params: DiningSearchParams): Promise<DiningEngineResult> {
    const start = Date.now();
    const key   = process.env.FOURSQUARE_API_KEY;

    if (!key) {
      return {
        engineId: 'foursquare', engineName: 'Foursquare', status: 'needs_api_key',
        results: [], latencyMs: 0,
        setupUrl: 'https://foursquare.com/developers/signup',
        setupMessage: 'Add FOURSQUARE_API_KEY to .env.local to enable Foursquare.',
      };
    }

    try {
      // Foursquare Autocomplete endpoint (still active as of 2025)
      const urlParams = new URLSearchParams({
        query:    `restaurants in ${params.destination}`,
        types:    'place',
        limit:    '12',
        fields:   'place',
      });

      const res = await fetch(`https://api.foursquare.com/v3/autocomplete?${urlParams}`, {
        headers: { Authorization: key, Accept: 'application/json' },
        signal:  AbortSignal.timeout(8_000),
      });

      if (!res.ok) {
        // API changed again — return graceful error with deep link fallback
        return {
          engineId:     'foursquare',
          engineName:   'Foursquare',
          status:       'needs_api_key',
          results:      [],
          latencyMs:    Date.now() - start,
          deepLinkUrl:  `https://foursquare.com/explore?q=restaurants&near=${encodeURIComponent(params.destination)}`,
          setupUrl:     'https://docs.foursquare.com/fsq-developers-places/reference/migration-guide',
          setupMessage: `Foursquare HTTP ${res.status}. API endpoint may have changed.`,
        };
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const places = (data.results ?? []).filter((r: any) => r.place).map((r: any) => r.place);

      if (!places.length) {
        return {
          engineId:    'foursquare',
          engineName:  'Foursquare',
          status:      'ok',
          results:     [],
          latencyMs:   Date.now() - start,
          deepLinkUrl: `https://foursquare.com/explore?q=restaurants&near=${encodeURIComponent(params.destination)}`,
        };
      }

      const priceMap: Record<number, number> = { 1: 20, 2: 50, 3: 100, 4: 180 };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results: RawDiningSource[] = places.slice(0, 12).map((p: any): RawDiningSource => {
        const cats: string[] = (p.categories ?? []).map((c: { name: string }) => c.name);
        const loc = p.location;

        return {
          source:            'foursquare',
          name:              p.name,
          cuisine:           cats[0] ?? 'Restaurant',
          location:          [loc?.address, loc?.locality ?? params.destination].filter(Boolean).join(', '),
          destination:       params.destination,
          pricePerPerson:    priceMap[p.price ?? 2] ?? 55,
          rating:            parseFloat(((p.rating ?? 7)).toFixed(1)),
          slots:             [],
          uberMinutes:       0,
          uberCost:          0,
          aiHighlight:       `Popular on Foursquare in ${params.destination}.`,
          reservationWindow: '30 days',
          tags:              cats.map((c: string) => c.toLowerCase()),
          imageGradient:     cuisineGradient(cats.map((c: string) => c.toLowerCase())),
          reservationUrl:    googleMapsRestaurantUrl({ name: p.name, location: loc?.address ?? params.destination }),
        };
      });

      return { engineId: 'foursquare', engineName: 'Foursquare', status: 'ok', results, latencyMs: Date.now() - start };
    } catch (err) {
      return {
        engineId:    'foursquare',
        engineName:  'Foursquare',
        status:      'error',
        results:     [],
        latencyMs:   Date.now() - start,
        deepLinkUrl: `https://foursquare.com/explore?q=restaurants&near=${encodeURIComponent(params.destination)}`,
        setupMessage: err instanceof Error ? err.message : 'Foursquare failed',
      };
    }
  },
};
