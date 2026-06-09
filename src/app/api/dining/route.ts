import { NextRequest, NextResponse }  from 'next/server';
import { z }                          from 'zod';
import { DINING_ADAPTERS }            from '@/lib/engines/dining';
import type { DiningEngineResult, RawDiningSource, RawTimeSlot } from '@/lib/engines/dining';

// ── Zod schemas ───────────────────────────────────────────────────────────────

export const TimeSlotSchema = z.object({
  time:   z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM'),
  label:  z.string(),
  source: z.string(),
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
  uberMinutes:       z.number().int(),
  uberCost:          z.number(),
  aiHighlight:       z.string(),
  reservationWindow: z.string(),
  tags:              z.array(z.string()),
  vibe:              z.string().optional(),
  imageGradient:     z.string(),
  reservationUrl:    z.string().url().optional(),  // deeplink to external reservation
  lat:               z.number().optional(),
  lon:               z.number().optional(),
});

export const DiningQuerySchema = z.object({
  destination: z.string().min(1),
  date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  adults:      z.number().int().min(1).max(20).default(2),
  vibes:       z.array(z.string()).default([]),
  diets:       z.array(z.string()).default([]),
  priceMax:    z.number().optional(),
  engineIds:   z.array(z.string()).default(['google-places', 'yelp', 'foursquare']),
  tier:        z.enum(['economy', 'premium', 'luxury', 'ultra-luxury']).default('luxury'),
});

export type TimeSlot         = z.infer<typeof TimeSlotSchema>;
export type MergedRestaurant = z.infer<typeof MergedRestaurantSchema>;
export type DiningQuery      = z.infer<typeof DiningQuerySchema>;

export interface DiningEngineStatus {
  engineId:      string;
  engineName:    string;
  status:        'ok' | 'needs_api_key' | 'error';
  count:         number;
  latencyMs:     number;
  deepLinkUrl?:  string;
  setupUrl?:     string;
  setupMessage?: string;
}

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
  engineStatus:      DiningEngineStatus[];
  setupUrl?:         string;
  setupMessage?:     string;
}

// ── Name normalizer (dedup key) ───────────────────────────────────────────────

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
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
  const h    = Math.floor(mins / 60) % 24;
  const m    = mins % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12  = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

// ── Slot merge ────────────────────────────────────────────────────────────────

function mergeSlots(allSlots: RawTimeSlot[]): TimeSlot[] {
  const map: Record<string, { sources: Set<string>; party: number }> = {};
  for (const slot of allSlots) {
    const key = `${slot.time}|${slot.party}`;
    if (!map[key]) map[key] = { sources: new Set(), party: slot.party };
    map[key]!.sources.add(slot.source);
  }
  return Object.entries(map)
    .map(([key, val]) => {
      const [time] = key.split('|');
      return {
        time:   time!,
        label:  minutesToLabel(timeToMinutes(time!)),
        source: Array.from(val.sources).join('+'),
        party:  val.party,
      };
    })
    .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
}

// ── Deduplication + merge ─────────────────────────────────────────────────────

function deduplicateAndMerge(
  rawSources: RawDiningSource[],
  query:      DiningQuery,
): MergedRestaurant[] {
  const groups = new Map<string, RawDiningSource[]>();
  for (const r of rawSources) {
    const key    = dedupeKey(r.name, r.destination);
    const bucket = groups.get(key) ?? [];
    bucket.push(r);
    groups.set(key, bucket);
  }

  const merged: MergedRestaurant[] = [];

  for (const [, group] of groups) {
    const primary    = group[0]!;
    const allSources = [...new Set(group.map(g => g.source))];
    const allSlots   = group.flatMap(g => g.slots);

    const confidence = Math.min(0.99,
      0.72 + allSources.length * 0.06 + (primary.rating / 10) * 0.08,
    );

    const ratingNorm = primary.rating / 10;
    const positive   = parseFloat((ratingNorm * 0.88 + 0.05).toFixed(2));
    const negative   = parseFloat((Math.max(0, 0.3 - ratingNorm * 0.28)).toFixed(2));
    const neutral    = parseFloat((1 - positive - negative).toFixed(2));

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
      reservationUrl:   group.find(g => g.reservationUrl)?.reservationUrl,
      lat:              group.find(g => g.lat)?.lat,
      lon:              group.find(g => g.lon)?.lon,
    });
  }

  return merged.sort((a, b) => b.aiConfidence - a.aiConfidence);
}

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse<DiningApiResponse>> {
  const t0 = Date.now();

  let rawBody: unknown;
  try { rawBody = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' } as unknown as DiningApiResponse, { status: 400 }); }

  const parsed = DiningQuerySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues } as unknown as DiningApiResponse,
      { status: 422 },
    );
  }

  const query = parsed.data;

  // ── Resolve adapters from selected engine IDs ──────────────────────────────
  const adapters = query.engineIds
    .map(id => DINING_ADAPTERS[id])
    .filter(Boolean);

  if (adapters.length === 0) {
    return NextResponse.json({
      status: 'error', provider: 'none', query,
      restaurants: [], totalSources: 0, successfulSources: 0,
      deduplicatedFrom: 0, processingMs: Date.now() - t0,
      warnings: ['No valid dining engines selected.'], engineStatus: [],
    });
  }

  const searchParams = {
    destination: query.destination,
    date:        query.date,
    adults:      query.adults,
    vibes:       query.vibes,
    diets:       query.diets,
    priceMax:    query.priceMax,
    tier:        query.tier,
  };

  // ── Promise.allSettled — real parallel search ──────────────────────────────
  const settled = await Promise.allSettled(
    adapters.map(a => a.search(searchParams)),
  );

  const allRaw: RawDiningSource[] = [];
  const warnings: string[]         = [];
  const engineStatus: DiningEngineStatus[] = settled.map((r, i): DiningEngineStatus => {
    const adapter = adapters[i]!;
    if (r.status === 'fulfilled') {
      const val: DiningEngineResult = r.value;
      if (val.status === 'ok') allRaw.push(...val.results);
      if (val.status === 'needs_api_key') warnings.push(`${val.engineName}: ${val.setupMessage}`);
      return {
        engineId:    val.engineId,
        engineName:  val.engineName,
        status:      val.status,
        count:       val.results.length,
        latencyMs:   val.latencyMs,
        deepLinkUrl: val.deepLinkUrl,
        setupUrl:    val.setupUrl,
        setupMessage: val.setupMessage,
      };
    }
    warnings.push(`${adapter.name}: ${r.reason instanceof Error ? r.reason.message : 'Failed'}`);
    return {
      engineId:    adapter.id,
      engineName:  adapter.name,
      status:      'error',
      count:       0,
      latencyMs:   0,
      setupMessage: r.reason instanceof Error ? r.reason.message : 'Unknown error',
    };
  });

  const rawCount    = allRaw.length;
  const restaurants = deduplicateAndMerge(allRaw, query);

  const allNeedKey   = engineStatus.every(e => e.status === 'needs_api_key');
  const anyOk        = engineStatus.some(e => e.status === 'ok');
  const activeSources = engineStatus.filter(e => e.status === 'ok').map(e => e.engineName);

  return NextResponse.json({
    status:            anyOk ? 'ok' : allNeedKey ? 'needs_api_key' : 'ok',
    provider:          activeSources.join(' + ') || 'none',
    query,
    restaurants,
    totalSources:      adapters.length,
    successfulSources: engineStatus.filter(e => e.status === 'ok').length,
    deduplicatedFrom:  rawCount,
    processingMs:      Date.now() - t0,
    warnings,
    engineStatus,
    setupUrl:          allNeedKey ? 'https://console.cloud.google.com/apis/library/places-backend.googleapis.com' : undefined,
    setupMessage:      allNeedKey ? 'Add GOOGLE_PLACES_API_KEY or YELP_API_KEY to .env.local to enable live restaurant search.' : undefined,
  }, {
    headers: {
      'Cache-Control':        'public, s-maxage=60, stale-while-revalidate=90',
      'X-Restaurants-Raw':    String(rawCount),
      'X-Restaurants-Merged': String(restaurants.length),
    },
  });
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    service:  'Unitravel Dining Orchestrator',
    version:  '2.0.0',
    engines:  Object.keys(DINING_ADAPTERS),
    schema:   'POST with DiningQuery body — see DiningQuerySchema',
  });
}
