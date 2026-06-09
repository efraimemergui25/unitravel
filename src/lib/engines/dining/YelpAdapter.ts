import type { DiningEngineAdapter, DiningSearchParams, DiningEngineResult, RawDiningSource } from './DiningEngineAdapter';
import { cuisineGradient } from './DiningEngineAdapter';

export const YelpAdapter: DiningEngineAdapter = {
  id: 'yelp', name: 'Yelp Fusion',

  async search(params: DiningSearchParams): Promise<DiningEngineResult> {
    const start = Date.now();
    const key   = process.env.YELP_API_KEY;

    if (!key) {
      return {
        engineId:    'yelp',
        engineName:  'Yelp Fusion',
        status:      'needs_api_key',
        results:     [],
        latencyMs:   0,
        deepLinkUrl: `https://www.yelp.com/search?find_desc=Restaurants&find_loc=${encodeURIComponent(params.destination)}`,
        setupUrl:    'https://www.yelp.com/developers/v3/manage_app',
        setupMessage: 'Add YELP_API_KEY to .env.local to enable Yelp Fusion (free, 500 req/day).',
      };
    }

    try {
      const urlParams = new URLSearchParams({
        location:   params.destination,
        categories: 'restaurants',
        sort_by:    'rating',
        limit:      '10',
      });

      const res = await fetch(`https://api.yelp.com/v3/businesses/search?${urlParams}`, {
        headers: { Authorization: `Bearer ${key}` },
        signal:  AbortSignal.timeout(6_000),
      });
      if (!res.ok) throw new Error(`Yelp HTTP ${res.status}`);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await res.json();
      const priceMap: Record<string, number> = { '$': 25, '$$': 55, '$$$': 100, '$$$$': 175 };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results: RawDiningSource[] = (data.businesses ?? []).slice(0, 10).map((b: any): RawDiningSource => {
        const categories: string[] = (b.categories ?? []).map((c: { title: string }) => c.title);
        return {
          source:            'yelp',
          name:              b.name,
          cuisine:           categories[0] ?? 'Restaurant',
          location:          `${b.location?.address1 ?? ''}, ${b.location?.city ?? params.destination}`.replace(/^, /, ''),
          destination:       params.destination,
          pricePerPerson:    priceMap[b.price ?? '$$'] ?? 55,
          rating:            parseFloat((b.rating * 2).toFixed(1)),
          slots:             [],
          uberMinutes:       0,
          uberCost:          0,
          aiHighlight:       `${(b.review_count ?? 0).toLocaleString()} reviews on Yelp.`,
          reservationWindow: '30 days',
          tags:              categories.slice(0, 4).map((c: string) => c.toLowerCase()),
          imageGradient:     cuisineGradient(categories.map(c => c.toLowerCase())),
        };
      });

      return { engineId: 'yelp', engineName: 'Yelp Fusion', status: 'ok', results, latencyMs: Date.now() - start };
    } catch (err) {
      return {
        engineId: 'yelp', engineName: 'Yelp Fusion', status: 'error',
        results: [], latencyMs: Date.now() - start,
        setupMessage: err instanceof Error ? err.message : 'Yelp failed',
      };
    }
  },
};
