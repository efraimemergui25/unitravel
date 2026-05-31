// Unitravel Dining Orchestrator — parallel fetches + mathematical deduplication.
// When the same restaurant appears on OpenTable AND Resy, the backend merges
// both availableSlots arrays into a single deduplicated, time-sorted record.

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
  query:              DiningQuery;
  restaurants:        MergedRestaurant[];
  totalSources:       number;
  successfulSources:  number;
  deduplicatedFrom:   number;
  processingMs:       number;
  warnings:           string[];
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

// ── Generate mock slots per source ───────────────────────────────────────────
// In production: replace with real OpenTable / Resy API calls.

function generateSlots(
  source:     string,
  startMins:  number,
  endMins:    number,
  intervalMin:number,
  party:      number,
  availability: number, // 0-1, probability each slot exists
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  for (let m = startMins; m <= endMins; m += intervalMin) {
    if (Math.random() < availability) {
      slots.push({
        time:   formatTime(m),
        label:  minutesToLabel(m),
        source,
        party,
      });
    }
  }
  return slots;
}

// ── Per-engine fetch simulation ───────────────────────────────────────────────

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

async function fetchDiningSource(
  engineId: string,
  query:    DiningQuery,
): Promise<RawDiningSource[]> {
  // Simulate network latency + 7% error rate
  await new Promise(r => setTimeout(r, 80 + Math.random() * 250));
  if (Math.random() < 0.07) throw new Error(`${engineId}: upstream timeout`);

  const dest = query.destination.toLowerCase();
  const party = query.adults;

  // Produce engine-specific restaurant data with overlapping names for dedup demo
  const RESTAURANTS_BY_ENGINE: Record<string, RawDiningSource[]> = {
    opentable: [
      {
        source: 'opentable', name: 'Hartwood', cuisine: 'Mexican Wood-Fire',
        location: 'Tulum', destination: query.destination,
        pricePerPerson: 120, rating: 9.4, michelinStars: undefined,
        slots: [
          ...generateSlots('opentable', 18*60,     18*60+30, 30, party, 0.4),
          ...generateSlots('opentable', 19*60, 21*60+30, 30, party, 0.75),
        ],
        uberMinutes: 12, uberCost: 8,
        aiHighlight: 'Open-fire kitchen in the jungle — no electricity, no freezers. Reservations 90 days in advance.',
        reservationWindow: '90 days',
        tags: ['romantic', 'outdoor', 'wood-fire', 'honeymoon'],
        imageGradient: 'linear-gradient(135deg, #6B4226 0%, #2D4A1E 50%, #1A2E10 100%)',
      },
      {
        source: 'opentable', name: 'Catch Miami', cuisine: 'Global Bites & Seafood',
        location: 'Miami Beach', destination: query.destination,
        pricePerPerson: 95, rating: 8.6,
        slots: generateSlots('opentable', 19*60, 22*60+30, 30, party, 0.65),
        uberMinutes: 8, uberCost: 14,
        aiHighlight: 'Signature aerial display. Reserve the rooftop for sunset over the bay.',
        reservationWindow: '30 days',
        tags: ['party', 'rooftop', 'seafood', 'miami'],
        imageGradient: 'linear-gradient(135deg, #AD1457 0%, #F06292 50%, #FFB74D 100%)',
      },
    ],
    resy: [
      {
        source: 'resy', name: 'Catch Miami', cuisine: 'Global Bites & Seafood',
        location: 'Miami Beach', destination: query.destination,
        pricePerPerson: 95, rating: 8.7,
        slots: generateSlots('resy', 18*60+30, 22*60, 30, party, 0.60),
        uberMinutes: 8, uberCost: 14,
        aiHighlight: 'Exclusive Resy access to chef\'s table — 6 seats only.',
        reservationWindow: '21 days',
        tags: ['party', 'rooftop', 'seafood', 'miami'],
        imageGradient: 'linear-gradient(135deg, #AD1457 0%, #F06292 50%, #FFB74D 100%)',
      },
      {
        source: 'resy', name: 'Expendio de Maíz', cuisine: 'Contemporary Mexican Tasting',
        location: 'Mexico City', destination: query.destination,
        pricePerPerson: 85, rating: 9.1,
        slots: generateSlots('resy', 19*60, 21*60, 60, party, 0.50),
        uberMinutes: 18, uberCost: 6,
        aiHighlight: '10-course corn-origin tasting menu. Location changes weekly — AI tracks it.',
        reservationWindow: '14 days',
        tags: ['intimate', 'tasting-menu', 'cdmx', 'hidden'],
        imageGradient: 'linear-gradient(135deg, #8B4513 0%, #CD853F 50%, #4A2511 100%)',
      },
    ],
    michelin: [
      {
        source: 'michelin', name: 'Expendio de Maíz', cuisine: 'Contemporary Mexican Tasting',
        location: 'Mexico City', destination: query.destination,
        pricePerPerson: 90, rating: 9.3, michelinStars: undefined,
        slots: [],  // Michelin doesn't handle reservations directly
        uberMinutes: 18, uberCost: 6,
        aiHighlight: 'Michelin Bib Gourmand 2024. One of CDMX\'s most unique dining experiences.',
        reservationWindow: '14 days',
        tags: ['intimate', 'tasting-menu', 'cdmx', 'hidden', 'michelin-bib'],
        imageGradient: 'linear-gradient(135deg, #8B4513 0%, #CD853F 50%, #4A2511 100%)',
      },
    ],
    tock: [
      {
        source: 'tock', name: 'Manta Los Cabos', cuisine: 'Pacific Rim & Mexican Seafood',
        location: 'Los Cabos', destination: query.destination,
        pricePerPerson: 140, rating: 9.0,
        slots: generateSlots('tock', 17*60, 21*60, 30, party, 0.70),
        uberMinutes: 5, uberCost: 12,
        aiHighlight: 'Pacific panorama dining at The Cape hotel. Best sunset table in Cabo.',
        reservationWindow: '60 days',
        tags: ['romantic', 'ocean-view', 'seafood', 'sunset', 'honeymoon'],
        imageGradient: 'linear-gradient(135deg, #1565C0 0%, #00838F 50%, #80DEEA 100%)',
      },
    ],
  };

  // Return data for this engine, or fallback generic result
  const data = RESTAURANTS_BY_ENGINE[engineId];
  if (data) return data;

  // Generic fallback for other engines
  const destLabel = dest.includes('tulum') ? 'Tulum' : dest.includes('cab') ? 'Los Cabos' : 'Mexico City';
  return [{
    source: engineId, name: `${engineId} Pick · ${destLabel}`,
    cuisine: 'International', location: destLabel, destination: query.destination,
    pricePerPerson: 80 + Math.random() * 80, rating: 7 + Math.random() * 2,
    slots: generateSlots(engineId, 19*60, 21*60+30, 30, party, 0.5),
    uberMinutes: Math.floor(10 + Math.random() * 15), uberCost: 8 + Math.random() * 12,
    aiHighlight: `Top-rated on ${engineId} for ${destLabel}.`,
    reservationWindow: '30 days',
    tags: ['international', destLabel.toLowerCase()],
    imageGradient: 'linear-gradient(135deg, #1B5E20 0%, #388E3C 50%, #81C784 100%)',
  }];
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

  // Select engines — use provided list or default to top tier
  const engines = query.engineIds.length > 0
    ? query.engineIds
    : ['opentable', 'resy', 'michelin', 'tock', 'thefork', 'zagat', 'infatuation'];

  // Fan out in parallel — never block on one failure
  const settled = await Promise.allSettled(
    engines.map(id => fetchDiningSource(id, query))
  );

  const allRaw:    RawDiningSource[] = [];
  const warnings:  string[]          = [];
  let   successful = 0, failed = 0;

  for (const [i, result] of settled.entries()) {
    if (result.status === 'fulfilled') {
      successful++;
      allRaw.push(...result.value);
    } else {
      failed++;
      warnings.push(`${engines[i]}: ${result.reason instanceof Error ? result.reason.message : 'failed'}`);
    }
  }

  const rawCount    = allRaw.length;
  const restaurants = deduplicateAndMerge(allRaw, query);

  if (failed / engines.length > 0.3) {
    warnings.push(`⚠️ ${Math.round(failed / engines.length * 100)}% of sources degraded`);
  }

  const response: DiningApiResponse = {
    query,
    restaurants,
    totalSources:      engines.length,
    successfulSources: successful,
    deduplicatedFrom:  rawCount,
    processingMs:      Date.now() - t0,
    warnings,
  };

  return NextResponse.json(response, {
    headers: {
      'Cache-Control':        'public, s-maxage=45, stale-while-revalidate=90',
      'X-Restaurants-Raw':    String(rawCount),
      'X-Restaurants-Merged': String(restaurants.length),
      'X-Processing-Ms':      String(Date.now() - t0),
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
