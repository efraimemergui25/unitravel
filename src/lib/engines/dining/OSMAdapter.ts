import type { DiningEngineAdapter, DiningEngineResult, DiningSearchParams, RawDiningSource, RawTimeSlot } from './DiningEngineAdapter';
import { cuisineGradient }         from './DiningEngineAdapter';
import { googleMapsRestaurantUrl } from '@/utils/deeplinks';

// ── OpenStreetMap (Nominatim + Overpass) — Yelp slot replacement ──────────────
// Zero registration. Zero API key. Completely free. Global coverage.
//
// Flow:
//   1. Nominatim  → geocode city name → lat/lon
//   2. Overpass   → fetch restaurants/cafes within 3km radius
//   3. Transform  → RawDiningSource[]

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const OVERPASS  = 'https://overpass-api.de/api/interpreter';

// ── Nominatim geocode ─────────────────────────────────────────────────────────

async function geocode(city: string): Promise<{ lat: number; lon: number } | null> {
  const url = `${NOMINATIM}?q=${encodeURIComponent(city)}&format=json&limit=1`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Unitravel/1.0 (travel planning app)' },
    signal:  AbortSignal.timeout(6_000),
  });
  if (!res.ok) return null;
  const data = await res.json() as Array<{ lat: string; lon: string }>;
  if (!data.length) return null;
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
}

// ── Overpass restaurant query ─────────────────────────────────────────────────

interface OSMNode {
  id:   number;
  lat:  number;
  lon:  number;
  tags: Record<string, string>;
}

async function fetchRestaurants(lat: number, lon: number, radius = 1500): Promise<OSMNode[]> {
  // Simplified query: nodes only, tighter radius, explicit timeout — avoids 504s
  const query = `[out:json][timeout:20];(node["amenity"~"^(restaurant|cafe|bar|bistro)$"]["name"](around:${radius},${lat},${lon}););out 30;`;

  const res = await fetch(OVERPASS, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Unitravel/1.0 (travel planning)' },
    body:    `data=${encodeURIComponent(query)}`,
    signal:  AbortSignal.timeout(22_000),
  });
  if (!res.ok) return [];
  const data = await res.json() as { elements: OSMNode[] };
  return (data.elements ?? []).map(e => ({
    id:   e.id,
    lat:  e.lat ?? 0,
    lon:  e.lon ?? 0,
    tags: e.tags ?? {},
  }));
}

// ── OSM cuisine tag → normalised string ──────────────────────────────────────

function normaliseCuisine(raw = ''): string {
  const c = raw.toLowerCase().replace(/_/g, ' ');
  if (!c || c === 'yes') return 'International';
  // Capitalise first letter of each word
  return c.replace(/\b\w/g, l => l.toUpperCase());
}

// ── Derive price per person from OSM stars / price_range tag ─────────────────

function derivePrice(tags: Record<string, string>, tier: string): number {
  if (tags['price_range']) {
    const symbols = (tags['price_range'].match(/\$/g) ?? []).length;
    if (symbols === 1) return 15;
    if (symbols === 2) return 35;
    if (symbols === 3) return 75;
    if (symbols >= 4)  return 150;
  }
  if (tags['stars']) {
    const s = parseInt(tags['stars']);
    if (s >= 4) return 120;
    if (s === 3) return 70;
    if (s === 2) return 40;
  }
  // Fallback from tier
  if (tier === 'ultra-luxury') return 180;
  if (tier === 'luxury')       return 90;
  if (tier === 'premium')      return 45;
  return 20;
}

// ── Synthesise realistic time slots ──────────────────────────────────────────

function makeSlots(date: string, adults: number, amenity: string): RawTimeSlot[] {
  const isBar  = amenity === 'bar';
  const isCafe = amenity === 'cafe';
  const times  = isBar  ? ['19:30', '20:00', '21:00', '22:00']
               : isCafe ? ['09:00', '10:30', '12:00', '14:00']
               : ['12:00', '13:00', '19:00', '19:30', '20:00', '20:30'];

  return times.slice(0, 4).map(time => ({
    time,
    label:  time < '15:00' ? 'Lunch' : 'Dinner',
    source: 'OpenStreetMap',
    party:  adults,
  }));
}

// ── AI highlight from tags ────────────────────────────────────────────────────

function aiHighlight(tags: Record<string, string>, cuisine: string): string {
  if (tags['stars'] && parseInt(tags['stars']) >= 4) return `${tags['stars']}-star rated — highly acclaimed`;
  if (tags['michelin:stars'])                         return `Michelin ${tags['michelin:stars']}★ — world-class`;
  if (tags['outdoor_seating'] === 'yes')              return `Outdoor seating · ${cuisine} cuisine`;
  if (tags['diet:vegan'] === 'yes')                   return `Vegan-friendly ${cuisine}`;
  if (tags['delivery'] === 'yes')                     return `${cuisine} · delivery available`;
  if (tags['takeaway'] === 'yes')                     return `${cuisine} · takeaway available`;
  return `Local ${cuisine.toLowerCase()} — discovered via OpenStreetMap`;
}

// ── Transform OSM node → RawDiningSource ─────────────────────────────────────

function transformNode(node: OSMNode, destination: string, params: DiningSearchParams): RawDiningSource {
  const t        = node.tags;
  const cuisine  = normaliseCuisine(t['cuisine']);
  const amenity  = t['amenity'] ?? 'restaurant';
  const street   = [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' ');
  const location = street || t['addr:city'] || destination;

  return {
    source:            'OpenStreetMap',
    name:              t['name'] ?? 'Unnamed',
    cuisine,
    location,
    destination,
    pricePerPerson:    derivePrice(t, params.tier),
    rating:            t['stars'] ? Math.min(5, parseFloat(t['stars'])) : 3.8 + (node.id % 12) * 0.1,
    slots:             makeSlots(params.date, params.adults, amenity),
    uberMinutes:       0,
    uberCost:          0,
    aiHighlight:       aiHighlight(t, cuisine),
    reservationWindow: '30–60 min',
    tags:              [
      cuisine.toLowerCase(),
      amenity,
      ...(t['outdoor_seating'] === 'yes' ? ['outdoor'] : []),
      ...(t['diet:vegan'] === 'yes'       ? ['vegan']   : []),
      ...(t['diet:vegetarian'] === 'yes'  ? ['veggie']  : []),
      ...(t['wheelchair'] === 'yes'       ? ['accessible'] : []),
    ].filter(Boolean),
    imageGradient:     cuisineGradient([cuisine.toLowerCase()]),
    lat:               node.lat || undefined,
    lon:               node.lon || undefined,
    reservationUrl:    googleMapsRestaurantUrl({
      name:     t['name'] ?? '',
      location: location,
      lat:      node.lat || undefined,
      lon:      node.lon || undefined,
    }),
  };
}

// ── Adapter ───────────────────────────────────────────────────────────────────

export const OSMAdapter: DiningEngineAdapter = {
  id:   'yelp',          // occupies the Yelp UI slot
  name: 'Local Discovery',

  async search(params: DiningSearchParams): Promise<DiningEngineResult> {
    const start = Date.now();

    try {
      // Step 1 — geocode destination
      const coords = await geocode(params.destination);
      if (!coords) {
        return {
          engineId:     'yelp',
          engineName:   'Local Discovery',
          status:       'error',
          results:      [],
          latencyMs:    Date.now() - start,
          setupMessage: `Could not geocode "${params.destination}"`,
        };
      }

      // Step 2 — fetch OSM restaurants; fall back to Google Places if Overpass is unavailable
      let nodes = await fetchRestaurants(coords.lat, coords.lon);

      if (!nodes.length) {
        // Overpass unavailable — try Google Places as silent fallback
        const googleKey = process.env.GOOGLE_PLACES_API_KEY;
        if (googleKey) {
          const { GooglePlacesAdapter } = await import('./GooglePlacesAdapter');
          const gpResult = await GooglePlacesAdapter.search(params);
          if (gpResult.status === 'ok' && gpResult.results.length) {
            return { ...gpResult, engineId: 'yelp', engineName: 'Local Discovery' };
          }
        }
        return {
          engineId:    'yelp',
          engineName:  'Local Discovery',
          status:      'needs_api_key',
          results:     [],
          latencyMs:   Date.now() - start,
          deepLinkUrl: `https://www.yelp.com/search?find_desc=restaurants&find_loc=${encodeURIComponent(params.destination)}`,
          setupMessage: `OpenStreetMap Overpass unavailable for ${params.destination}.`,
        };
      }

      // Step 3 — transform & filter
      let results = nodes
        .filter(n => n.tags['name'])             // must have a name
        .map(n => transformNode(n, params.destination, params));

      // Apply vibe/diet filters
      if (params.vibes.length) {
        const vibeTerms = params.vibes.join(' ').toLowerCase();
        results = results.filter(r =>
          r.tags.some(tag => vibeTerms.includes(tag)) || vibeTerms.includes(r.cuisine.toLowerCase()),
        );
      }
      if (params.diets.includes('vegan')) {
        results = results.filter(r => r.tags.includes('vegan') || r.tags.includes('veggie'));
      }

      // Sort by rating desc
      results.sort((a, b) => b.rating - a.rating);

      return {
        engineId:   'yelp',
        engineName: 'Local Discovery',
        status:     'ok',
        results:    results.slice(0, 12),
        latencyMs:  Date.now() - start,
      };

    } catch (err) {
      return {
        engineId:     'yelp',
        engineName:   'Local Discovery',
        status:       'error',
        results:      [],
        latencyMs:    Date.now() - start,
        setupMessage: err instanceof Error ? err.message : 'OSM search failed',
      };
    }
  },
};
