import type { AttractionEntity }                                                from '@/types/attractions';
import type { AttractionEngineAdapter, AttractionSearchParams, AttractionEngineResult } from './index';

const BASE = 'https://api.geoapify.com/v2/places';

const CATEGORIES = [
  'tourism.sights',
  'entertainment.museum',
  'entertainment.culture',
  'entertainment.activity_park',
  'leisure.park',
  'natural',
  'tourism.attraction',
].join(',');

// ── Geocode destination via Google ────────────────────────────────────────────
async function geocode(destination: string): Promise<{ lat: number; lng: number } | null> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return null;
  try {
    const res  = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(destination)}&key=${key}`,
      { signal: AbortSignal.timeout(5_000) },
    );
    const data = await res.json() as { results: Array<{ geometry: { location: { lat: number; lng: number } } }> };
    const loc  = data.results?.[0]?.geometry?.location;
    return loc ? { lat: loc.lat, lng: loc.lng } : null;
  } catch {
    return null;
  }
}

const CAT_TYPE_MAP: Record<string, 'cultural' | 'outdoor' | 'culinary' | 'adventure' | 'wellness'> = {
  museum:    'cultural',
  culture:   'cultural',
  sights:    'cultural',
  park:      'outdoor',
  natural:   'outdoor',
  activity:  'adventure',
  leisure:   'outdoor',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformPlace(place: any, destination: string): AttractionEntity {
  const props = place.properties ?? {};
  const cats  = (props.categories ?? []) as string[];

  const lastSeg = cats[0]?.split('.').pop() ?? '';
  const type    = CAT_TYPE_MAP[lastSeg] ?? 'cultural';
  const label   = lastSeg.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());

  return {
    id:                props.place_id ?? `geo-${Math.random().toString(36).slice(2)}`,
    title:             props.name ?? 'Unnamed Place',
    description:       props.address_line1 ?? destination,
    type,
    destination,
    city:              props.city ?? destination,
    lat:               place.geometry?.coordinates?.[1] ?? undefined,
    lon:               place.geometry?.coordinates?.[0] ?? undefined,
    durationHours:     2,
    groupSizeMax:      50,
    pricePerPerson:    0,
    difficulty:        'easy',
    weatherDependency: 'none',
    bestTimeOfDay:     'anytime',
    instantBook:       false,
    rating:            props.datasource?.raw?.stars ? parseFloat(props.datasource.raw.stars) : 0,
    reviewCount:       0,
    aiHighlight:       `${label} in ${destination}`,
    weatherMatch:      null,
    gradient:          'linear-gradient(135deg, #1B5E20 0%, #43A047 100%)',
    tags:              cats.map((c: string) => c.split('.').pop() ?? c).filter(Boolean),
    aiConfidence:      0.7,
    providers:         ['Geoapify'],
    sourceCount:       1,
  };
}

export const GeoapifyAdapter: AttractionEngineAdapter = {
  id:   'geoapify',
  name: 'Geoapify',

  async search(params: AttractionSearchParams): Promise<AttractionEngineResult> {
    const start = Date.now();
    const key   = process.env.GEOAPIFY_API_KEY;

    if (!key) {
      return {
        engineId:     'geoapify',
        engineName:   'Geoapify',
        status:       'needs_api_key',
        results:      [],
        latencyMs:    0,
        setupUrl:     'https://www.geoapify.com/get-started-with-maps-api',
        setupMessage: 'Add GEOAPIFY_API_KEY to .env.local.',
      };
    }

    const coords = await geocode(params.destination);
    if (!coords) {
      return {
        engineId:     'geoapify',
        engineName:   'Geoapify',
        status:       'error',
        results:      [],
        latencyMs:    Date.now() - start,
        setupMessage: `Could not geocode "${params.destination}".`,
      };
    }

    try {
      const url = new URL(BASE);
      url.searchParams.set('categories', CATEGORIES);
      url.searchParams.set('filter',     `circle:${coords.lng},${coords.lat},10000`);
      url.searchParams.set('bias',       `proximity:${coords.lng},${coords.lat}`);
      url.searchParams.set('limit',      String(Math.min(params.maxResults, 50)));
      url.searchParams.set('apiKey',     key);

      const res  = await fetch(url.toString(), { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) {
        return {
          engineId:     'geoapify',
          engineName:   'Geoapify',
          status:       'error',
          results:      [],
          latencyMs:    Date.now() - start,
          setupMessage: `Geoapify ${res.status}`,
        };
      }

      const data    = await res.json() as { features: unknown[] };
      const results = (data.features ?? [])
        .filter((f: unknown) => (f as { properties: { name?: string } }).properties?.name)
        .map(f => transformPlace(f, params.destination, params.currency));

      return { engineId: 'geoapify', engineName: 'Geoapify', status: 'ok', results, latencyMs: Date.now() - start };
    } catch (err) {
      return {
        engineId:     'geoapify',
        engineName:   'Geoapify',
        status:       'error',
        results:      [],
        latencyMs:    Date.now() - start,
        setupMessage: err instanceof Error ? err.message : 'Geoapify search failed',
      };
    }
  },
};
