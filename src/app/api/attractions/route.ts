import { NextRequest, NextResponse } from 'next/server';
import { z }                         from 'zod';
import { runOrchestratorSearch }     from '@/services/OrchestratorService';
import { enrichAttractionsWithWeather, geocodeDestination } from '@/utils/WeatherSyncEngine';
import type { AttractionEntity, ExperienceType, WeatherDependency } from '@/types/attractions';

// ── Request schema ─────────────────────────────────────────────────────────────

const QuerySchema = z.object({
  destination:     z.string().min(2),
  engineIds:       z.array(z.string()).min(1).max(30),
  adults:          z.number().int().min(1).max(20).default(2),
  startDate:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  effortLevels:    z.array(z.enum(['easy', 'moderate', 'challenging', 'extreme'])).optional(),
  experienceTypes: z.array(z.string()).optional(),
  currency:        z.enum(['USD', 'ILS']).default('USD'),
});

type AttractionQuery = z.infer<typeof QuerySchema>;

// ── Attraction result normaliser ──────────────────────────────────────────────

function normalizeDifficulty(raw: string): 'easy' | 'moderate' | 'challenging' {
  const l = raw.toLowerCase();
  if (l.includes('easy') || l.includes('light') || l.includes('gentle')) return 'easy';
  if (l.includes('hard') || l.includes('challenge') || l.includes('stren'))  return 'challenging';
  return 'moderate';
}

function inferWeatherDependency(tags: string[], type: ExperienceType): WeatherDependency {
  const outdoor = ['outdoor', 'adventure'].includes(type);
  const sensitive = tags.some(t => /beach|dive|snorkel|boat|tour|hike|zip|kayak|surf|swim/.test(t.toLowerCase()));
  if (outdoor && sensitive) return 'high';
  if (outdoor || sensitive) return 'moderate';
  if (type === 'culinary' || type === 'cultural') return 'none';
  return 'low';
}

const TYPE_GRADIENTS: Record<ExperienceType, string> = {
  cultural:  'linear-gradient(135deg, #5E5CE6 0%, #007AFF 100%)',
  outdoor:   'linear-gradient(135deg, #007AFF 0%, #00C7BE 100%)',
  culinary:  'linear-gradient(135deg, #FF9F0A 0%, #FF453A 100%)',
  adventure: 'linear-gradient(135deg, #FF453A 0%, #BF5AF2 100%)',
  wellness:  'linear-gradient(135deg, #00C7BE 0%, #30D158 100%)',
};

// ── Parallel engine fetch ─────────────────────────────────────────────────────
// Delegates to OrchestratorService (same machinery used by flights/hotels).
// Each engine result is normalised into AttractionEntity shape.

async function fetchFromEngines(query: AttractionQuery): Promise<AttractionEntity[]> {
  const orchestratorResult = await runOrchestratorSearch({
    intent:      'activities',
    destination: query.destination,
    adults:      query.adults,
    tier:        'premium',
    currency:    query.currency,
  });

  return orchestratorResult.results
    .filter(r => r.category === 'activity')
    .map((r, i) => {
      const rawType  = (r.tags?.find(t => ['cultural','outdoor','culinary','adventure','wellness'].includes(t)) ?? 'outdoor') as ExperienceType;
      const diff     = normalizeDifficulty(r.tags?.find(t => /easy|moderate|hard|stren|challenge|light/.test(t)) ?? '');
      const dep      = inferWeatherDependency(r.tags ?? [], rawType);
      // Extra fields are in rawPayload if the source API returns them
      const raw      = r.rawPayload ?? {};

      return {
        id:                r.id,
        title:             r.title,
        description:       (raw['description'] as string | undefined) ?? r.subtitle ?? '',
        type:              rawType,
        destination:       r.destination,
        city:              (raw['city'] as string | undefined) ?? r.location ?? r.destination,
        lat:               raw['lat'] as number | undefined,
        lon:               raw['lon'] as number | undefined,
        durationHours:     (raw['durationHours'] as number | undefined) ?? 3,
        groupSizeMax:      (raw['groupSizeMax'] as number | undefined) ?? 15,
        pricePerPerson:    r.price,
        difficulty:        diff,
        weatherDependency: dep,
        bestTimeOfDay:     'anytime',
        instantBook:       (raw['instantBook'] as boolean | undefined) ?? false,
        rating:            r.rating ?? 4.5,
        reviewCount:       r.reviewCount ?? 100,
        aiHighlight:       (raw['aiHighlight'] as string | undefined) ?? r.subtitle ?? '',
        weatherMatch:      null,
        gradient:          TYPE_GRADIENTS[rawType],
        tags:              r.tags ?? [],
        aiConfidence:      r.confidence,
        providers:         [r.source],
        sourceCount:       1,
      } satisfies AttractionEntity;
    });
}

// ── Generate date sequence ────────────────────────────────────────────────────

function dateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const cur = new Date(`${start}T12:00:00Z`);
  const fin = new Date(`${end}T12:00:00Z`);
  while (cur <= fin) {
    dates.push(cur.toISOString().split('T')[0]);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

// ── POST handler ───────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.json().catch(() => null);
  const parsed = QuerySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
  }

  const query = parsed.data;

  // 1. Fetch attractions from selected engines in parallel
  const rawEntities = await fetchFromEngines(query).catch((): AttractionEntity[] => []);

  // 2. Apply effort filter if specified
  const filtered = query.effortLevels?.length
    ? rawEntities.filter(e => (query.effortLevels as string[]).includes(e.difficulty))
    : rawEntities;

  // 3. Geocode destination for coordinates reference
  const geo = await geocodeDestination(query.destination);

  // 4. Distribute entities across date range for weather enrichment
  const dates = dateRange(query.startDate, query.endDate);
  const scheduledDates = filtered.map((_, i) => dates[i % dates.length]);

  // 5. Enrich with live weather from Open-Meteo
  const enriched = await enrichAttractionsWithWeather(filtered, query.destination, scheduledDates);

  // 6. Sort: perfect windows first, warnings last
  const qualityOrder: Record<string, number> = { perfect: 0, good: 1, fair: 2, available: 3, warning: 4 };
  enriched.sort((a, b) => {
    const qa = qualityOrder[a.weatherMatch?.quality ?? 'available'];
    const qb = qualityOrder[b.weatherMatch?.quality ?? 'available'];
    if (qa !== qb) return qa - qb;
    return b.aiConfidence - a.aiConfidence;
  });

  return NextResponse.json(
    {
      destination: query.destination,
      geo:         geo ? { lat: geo.lat, lon: geo.lon } : null,
      count:       enriched.length,
      results:     enriched,
      weatherSynced:  geo !== null,
      engineCount:    query.engineIds.length,
      generatedAt:    Date.now(),
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=180, stale-while-revalidate=60',
      },
    },
  );
}
