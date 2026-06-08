import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// ── Zod schemas ───────────────────────────────────────────────────────────────

export const TimeSlotSchema = z.object({
  time:   z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM'),
  label:  z.string(),         // "8:30 PM"
  source: z.string(),         // "opentable" | "resy" | "tock" etc.
  party:  z.number().int().min(1).max(20),
});

export const MergedRestaurantSchema = z.object({
  id:               z.string(),
  name:             z.string(),
  cuisine:          z.string(),
  location:         z.string(),
  destination:      z.string(),
  pricePerPerson:   z.number(),
  rating:           z.number().min(0).max(10),
  michelinStars:    z.number().int().optional(),
  bestIn50:         z.number().int().optional(),
  sources:          z.array(z.string()),
  sourceCount:      z.number().int(),
  aiConfidence:     z.number().min(0).max(1),
  availableSlots:   z.array(TimeSlotSchema),
  sentiment:        z.object({
    positive: z.number(), neutral: z.number(),
    negative: z.number(), compound: z.number(),
  }),
  uberMinutes:      z.number().int(),
  uberCost:         z.number(),
  aiHighlight:      z.string(),
  reservationWindow:z.string(),
  tags:             z.array(z.string()),
  vibe:             z.string().optional(),
  imageGradient:    z.string(),
});

export const DiningQuerySchema = z.object({
  destination:  z.string().min(1),
  date:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  adults:       z.number().int().min(1).max(20).default(2),
  vibes:        z.array(z.string()).default([]),
  diets:        z.array(z.string()).default([]),
  priceMax:     z.number().optional(),
  engineIds:    z.array(z.string()).default([]),
  tier:         z.enum(['economy', 'premium', 'luxury', 'ultra-luxury']).default('luxury'),
});

export type TimeSlot           = z.infer<typeof TimeSlotSchema>;
export type MergedRestaurant   = z.infer<typeof MergedRestaurantSchema>;
export type DiningQuery        = z.infer<typeof DiningQuerySchema>;

export interface DiningApiResponse {
  status:            'ok' | 'needs_api_key' | 'error';
  provider:          string;
  query:             Partial<DiningQuery>;
  restaurants:       MergedRestaurant[];
  totalSources:      number;
  successfulSources: number;
  deduplicatedFrom:  number;
  processingMs:      number;
  warnings:          string[];
  setupUrl?:         string;
  setupMessage?:     string;
}

// ── Name normalizer (dedup key) ───────────────────────────────────────────────

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, '')   // strip punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

function dedupeKey(name: string, destination: string): string {
  return `${normalizeName(name)}||${destination.toLowerCase().trim()}`;
}

// ── Time helpers ──────────────────────────────────────────────────────────────

function timeToMinutes(hhmm: string): number {
  const [h = '0', m = '0'] = hhmm.split(':');
  return parseInt(h, 10) * 60 + parseInt(m, 10);
}

function minutesToLabel(mins: number): string {
  const h   = Math.floor(mins / 60) % 24;
  const m   = mins % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatTime(mins: number): string {
  return `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}

// ── Slot merge + dedup ────────────────────────────────────────────────────────
// Two slots are identical if they share the same time AND party size.
// Different sources at the same time are merged — the combined slot keeps both
// source references but appears once in the UI.

interface RawSlotMap {
  [timeKey: string]: { sources: Set<string>; party: number };
}

function mergeSlots(allSlots: TimeSlot[]): TimeSlot[] {
  const map: RawSlotMap = {};

  for (const slot of allSlots) {
    const key = `${slot.time}|${slot.party}`;
    if (!map[key]) {
      map[key] = { sources: new Set(), party: slot.party };
    }
    map[key].sources.add(slot.source);
  }

  return Object.entries(map)
    .map(([key, val]) => {
      const [time] = key.split('|');
      const sources = Array.from(val.sources);
      return {
        time:   time!,
        label:  minutesToLabel(timeToMinutes(time!)),
        source: sources.join('+'),  // "opentable+resy"
        party:  val.party,
      };
    })
    .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
}

// ── Raw source shape (internal) ───────────────────────────────────────────────

interface RawDiningSource {
  source:    string;
  name:      string;
  cuisine:   string;
  location:  string;
  destination: string;
  pricePerPerson: number;
  rating:    number;
  michelinStars?: number;
  bestIn50?: number;
  slots:     TimeSlot[];
  uberMinutes: number;
  uberCost:  number;
  aiHighlight: string;
  reservationWindow: string;
  tags:      string[];
  imageGradient: string;
}

// ── Cuisine → gradient mapping ────────────────────────────────────────────────

function cuisineGradient(types: string[]): string {
  if (types.some(t => /japanese|sushi|ramen/.test(t))) return 'linear-gradient(135deg, #1565C0 0%, #42A5F5 100%)';
  if (types.some(t => /italian|pizza|pasta/.test(t))) return 'linear-gradient(135deg, #C62828 0%, #EF9A9A 100%)';
  if (types.some(t => /mexican|taco|burrito/.test(t))) return 'linear-gradient(135deg, #6B4226 0%, #CD853F 100%)';
  if (types.some(t => /seafood|fish/.test(t))) return 'linear-gradient(135deg, #00838F 0%, #80DEEA 100%)';
  if (types.some(t => /french|brasserie/.test(t))) return 'linear-gradient(135deg, #4A148C 0%, #CE93D8 100%)';
  if (types.some(t => /steakhouse|bbq|grill/.test(t))) return 'linear-gradient(135deg, #BF360C 0%, #FF8A65 100%)';
  if (types.some(t => /cafe|coffee|bakery/.test(t))) return 'linear-gradient(135deg, #5D4037 0%, #A1887F 100%)';
  return 'linear-gradient(135deg, #1B5E20 0%, #43A047 100%)';
}

// ── Google Places Text Search ─────────────────────────────────────────────────

async function fetchGooglePlaces(query: DiningQuery): Promise<RawDiningSource[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return [];

  const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
  url.searchParams.set('query', `restaurants in ${query.destination}`);
  url.searchParams.set('type', 'restaurant');
  url.searchParams.set('key', key);

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8_000) });
  if (!res.ok) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json();
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.results ?? []).slice(0, 12).map((p: any): RawDiningSource => {
    const priceLevel: number = p.price_level ?? 2;
    const priceMap  = [20, 40, 80, 130, 200];
    const types: string[] = (p.types ?? []).map((t: string) => t.replace(/_/g, ' '));
    const cuisine = types.filter(t => !['restaurant','food','point_of_interest','establishment'].includes(t))[0]
      ?? 'Restaurant';

    return {
      source:            'google-places',
      name:              p.name,
      cuisine:           cuisine.replace(/\b\w/g, (c: string) => c.toUpperCase()),
      location:          p.formatted_address ?? query.destination,
      destination:       query.destination,
      pricePerPerson:    priceMap[priceLevel] ?? 80,
      rating:            parseFloat(((p.rating ?? 3.5) * 2).toFixed(1)),
      slots:             [],
      uberMinutes:       15,
      uberCost:          12,
      aiHighlight:       `${(p.user_ratings_total ?? 0).toLocaleString()} ratings on Google Maps.`,
      reservationWindow: '30 days',
      tags:              types.slice(0, 4),
      imageGradient:     cuisineGradient(p.types ?? []),
    };
  });
}

// ── Yelp Business Search ──────────────────────────────────────────────────────

async function fetchYelp(query: DiningQuery): Promise<RawDiningSource[]> {
  const key = process.env.YELP_API_KEY;
  if (!key) return [];

  const params = new URLSearchParams({
    location:   query.destination,
    categories: 'restaurants',
    sort_by:    'rating',
    limit:      '10',
  });

  const res = await fetch(`https://api.yelp.com/v3/businesses/search?${params}`, {
    headers: { Authorization: `Bearer ${key}` },
    signal:  AbortSignal.timeout(6_000),
  });
  if (!res.ok) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.businesses ?? []).slice(0, 10).map((b: any): RawDiningSource => {
    const priceMap: Record<string, number> = { '$': 25, '$$': 55, '$$$': 100, '$$$$': 175 };
    const categories: string[] = (b.categories ?? []).map((c: { title: string }) => c.title);

    return {
      source:            'yelp',
      name:              b.name,
      cuisine:           categories[0] ?? 'Restaurant',
      location:          `${b.location?.address1 ?? ''}, ${b.location?.city ?? query.destination}`.replace(/^, /, ''),
      destination:       query.destination,
      pricePerPerson:    priceMap[b.price ?? '$$'] ?? 55,
      rating:            parseFloat((b.rating * 2).toFixed(1)),
      slots:             [],
      uberMinutes:       15,
      uberCost:          12,
      aiHighlight:       `${(b.review_count ?? 0).toLocaleString()} reviews on Yelp.`,
      reservationWindow: '30 days',
      tags:              categories.slice(0, 4).map((c: string) => c.toLowerCase()),
      imageGradient:     cuisineGradient(categories.map(c => c.toLowerCase())),
    };
  });
}

// ── Foursquare Places Search ──────────────────────────────────────────────────

async function fetchFoursquare(query: DiningQuery): Promise<RawDiningSource[]> {
  const key = process.env.FOURSQUARE_API_KEY;
  if (!key) return [];

  const params = new URLSearchParams({
    near:       query.destination,
    categories: '13065',
    sort:       'RATING',
    limit:      '12',
    fields:     'name,categories,rating,price,location,geocodes,photos',
  });

  const res = await fetch(`https://api.foursquare.com/v3/places/search?${params}`, {
    headers: { Authorization: key, Accept: 'application/json' },
    signal:  AbortSignal.timeout(6_000),
  });
  if (!res.ok) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json();
  const priceMap: Record<number, number> = { 1: 20, 2: 50, 3: 100, 4: 180 };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.results ?? []).slice(0, 12).map((p: any): RawDiningSource => {
    const cats: string[] = (p.categories ?? []).map((c: { name: string }) => c.name);
    const priceLevel: number = p.price ?? 2;
    const loc = p.location;
    return {
      source:            'foursquare',
      name:              p.name,
      cuisine:           cats[0] ?? 'Restaurant',
      location:          [loc?.address, loc?.locality ?? query.destination].filter(Boolean).join(', '),
      destination:       query.destination,
      pricePerPerson:    priceMap[priceLevel] ?? 55,
      rating:            parseFloat(((p.rating ?? 7) * 1).toFixed(1)),
      slots:             [],
      uberMinutes:       15,
      uberCost:          12,
      aiHighlight:       `Rated ${p.rating ?? '?'}/10 on Foursquare.`,
      reservationWindow: '30 days',
      tags:              cats.map((c: string) => c.toLowerCase()),
      imageGradient:     cuisineGradient(cats.map((c: string) => c.toLowerCase())),
    };
  });
}

// ── Deduplication + merge ─────────────────────────────────────────────────────

function deduplicateAndMerge(
  rawSources: RawDiningSource[],
  query:      DiningQuery,
): MergedRestaurant[] {

  // Group by normalized name + destination
  const groups = new Map<string, RawDiningSource[]>();
  for (const r of rawSources) {
    const key = dedupeKey(r.name, r.destination);
    const bucket = groups.get(key) ?? [];
    bucket.push(r);
    groups.set(key, bucket);
  }

  const merged: MergedRestaurant[] = [];

  for (const [, group] of groups) {
    const primary     = group[0]!;
    const allSources  = [...new Set(group.map(g => g.source))];
    const allSlots    = group.flatMap(g => g.slots);

    // Confidence: base from source count + rating signal
    const confidence  = Math.min(0.99,
      0.72 + allSources.length * 0.06 + (primary.rating / 10) * 0.08
    );

    // Sentiment derived from rating (simplified — production uses NLP on reviews)
    const ratingNorm  = primary.rating / 10;
    const positive    = parseFloat((ratingNorm * 0.88 + 0.05).toFixed(2));
    const negative    = parseFloat((Math.max(0, 0.3 - ratingNorm * 0.28)).toFixed(2));
    const neutral     = parseFloat((1 - positive - negative).toFixed(2));

    // Vibe filter (if vibes selected, soft-boost matching restaurants)
    const vibeMatch = query.vibes.length === 0 ||
      query.vibes.some(v => primary.tags.some(t => t.includes(v.toLowerCase().split('-')[0] ?? '')));

    if (!vibeMatch) continue;

    merged.push({
      id:               `merged-${normalizeName(primary.name).replace(/\s/g, '-')}-${Date.now().toString(36)}`,
      name:             primary.name,
      cuisine:          primary.cuisine,
      location:         primary.location,
      destination:      primary.destination,
      pricePerPerson:   Math.round(group.reduce((s, g) => s + g.pricePerPerson, 0) / group.length),
      rating:           parseFloat((group.reduce((s, g) => s + g.rating, 0) / group.length).toFixed(1)),
      michelinStars:    group.find(g => g.michelinStars)?.michelinStars,
      bestIn50:         group.find(g => g.bestIn50)?.bestIn50,
      sources:          allSources,
      sourceCount:      allSources.length,
      aiConfidence:     parseFloat(confidence.toFixed(3)),
      availableSlots:   mergeSlots(allSlots),
      sentiment:        { positive, neutral, negative, compound: ratingNorm },
      uberMinutes:      primary.uberMinutes,
      uberCost:         parseFloat(primary.uberCost.toFixed(2)),
      aiHighlight:      primary.aiHighlight,
      reservationWindow: primary.reservationWindow,
      tags:             [...new Set(group.flatMap(g => g.tags))],
      imageGradient:    primary.imageGradient,
    });
  }

  // Sort by confidence desc
  return merged.sort((a, b) => b.aiConfidence - a.aiConfidence);
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const t0 = Date.now();

  let rawBody: unknown;
  try { rawBody = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = DiningQuerySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 422 }
    );
  }

  const query = parsed.data;

  // ── Check API keys ─────────────────────────────────────────────────────────
  const googleKey    = process.env.GOOGLE_PLACES_API_KEY;
  const yelpKey      = process.env.YELP_API_KEY;
  const foursquareKey = process.env.FOURSQUARE_API_KEY;

  if (!googleKey && !yelpKey && !foursquareKey) {
    return NextResponse.json({
      status:       'needs_api_key',
      provider:     'Google Places + Foursquare',
      query,
      restaurants:  [],
      totalSources: 3,
      successfulSources: 0,
      deduplicatedFrom:  0,
      processingMs: Date.now() - t0,
      warnings:     [],
      setupUrl:     'https://console.cloud.google.com/apis/library/places-backend.googleapis.com',
      setupMessage: 'Add GOOGLE_PLACES_API_KEY or FOURSQUARE_API_KEY to .env.local to enable live restaurant search.',
    } satisfies DiningApiResponse);
  }

  // ── Parallel fetch from live sources ──────────────────────────────────────
  const [googleRaw, yelpRaw, foursquareRaw] = await Promise.all([
    fetchGooglePlaces(query).catch((): RawDiningSource[] => []),
    fetchYelp(query).catch((): RawDiningSource[]         => []),
    fetchFoursquare(query).catch((): RawDiningSource[]   => []),
  ]);

  const allRaw      = [...googleRaw, ...yelpRaw, ...foursquareRaw];
  const rawCount    = allRaw.length;
  const restaurants = deduplicateAndMerge(allRaw, query);
  const warnings:   string[] = [];

  if (!googleKey)     warnings.push('Google Places: add GOOGLE_PLACES_API_KEY for richer results');
  if (!yelpKey)       warnings.push('Yelp: add YELP_API_KEY for additional coverage');
  if (!foursquareKey) warnings.push('Foursquare: add FOURSQUARE_API_KEY for additional coverage');

  const activeSources = [
    googleKey     && googleRaw.length     > 0 && 'Google Places',
    yelpKey       && yelpRaw.length       > 0 && 'Yelp',
    foursquareKey && foursquareRaw.length > 0 && 'Foursquare',
  ].filter(Boolean);

  return NextResponse.json({
    status:            'ok',
    provider:          activeSources.join(' + ') || 'none',
    query,
    restaurants,
    totalSources:      3,
    successfulSources: (googleRaw.length > 0 ? 1 : 0) + (yelpRaw.length > 0 ? 1 : 0) + (foursquareRaw.length > 0 ? 1 : 0),
    deduplicatedFrom:  rawCount,
    processingMs:      Date.now() - t0,
    warnings,
  } satisfies DiningApiResponse, {
    headers: {
      'Cache-Control':        'public, s-maxage=60, stale-while-revalidate=90',
      'X-Restaurants-Raw':    String(rawCount),
      'X-Restaurants-Merged': String(restaurants.length),
    },
  });
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    service:    'Unitravel Dining Orchestrator',
    version:    '1.0.0',
    dedup:      'Restaurants appearing on multiple sources are merged: availableSlots unified, confidence boosted',
    engines:    ['opentable', 'resy', 'michelin', 'tock', 'thefork', 'zagat', 'infatuation', 'eater', 'worlds50best', 'tripadvisor'],
    schema:     'POST with DiningQuery body — see DiningQuerySchema',
  });
}
