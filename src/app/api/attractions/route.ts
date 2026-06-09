import { NextRequest, NextResponse }                          from 'next/server';
import { z }                                                  from 'zod';
import { ATTRACTION_ADAPTERS }                                from '@/lib/engines/attractions';
import type { AttractionEngineResult }                        from '@/lib/engines/attractions';
import { enrichAttractionsWithWeather, geocodeDestination }   from '@/utils/WeatherSyncEngine';
import type { AttractionEntity }                              from '@/types/attractions';

// ── Request schema ─────────────────────────────────────────────────────────────

const QuerySchema = z.object({
  destination:     z.string().min(2),
  engineIds:       z.array(z.string()).min(1).max(30).default(['getyourguide']),
  adults:          z.coerce.number().int().min(1).max(20).default(2),
  startDate:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  effortLevels:    z.array(z.enum(['easy', 'moderate', 'challenging', 'extreme'])).optional(),
  experienceTypes: z.array(z.string()).optional(),
  currency:        z.enum(['USD', 'ILS']).default('USD'),
  maxResults:      z.coerce.number().int().min(1).max(50).default(20),
});

export interface AttractionEngineStatus {
  engineId:     string;
  engineName:   string;
  status:       'ok' | 'needs_api_key' | 'error';
  count:        number;
  deepLinkUrl?: string;
  setupUrl?:    string;
}

export interface AttractionsSearchResponse {
  status:        'ok' | 'needs_api_key' | 'error';
  destination:   string;
  count:         number;
  results:       AttractionEntity[];
  engineStatus:  AttractionEngineStatus[];
  weatherSynced: boolean;
  generatedAt:   number;
  setupMessage?: string;
}

// ── Date range helper ─────────────────────────────────────────────────────────

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

export async function POST(req: NextRequest): Promise<NextResponse<AttractionsSearchResponse>> {
  const body   = await req.json().catch(() => null);
  const parsed = QuerySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        status: 'error', destination: '', count: 0, results: [],
        engineStatus: [], weatherSynced: false, generatedAt: Date.now(),
        setupMessage: JSON.stringify(parsed.error.flatten().fieldErrors),
      },
      { status: 400 },
    );
  }

  const q = parsed.data;

  const adapters = q.engineIds.map(id => ATTRACTION_ADAPTERS[id]).filter(Boolean);

  if (adapters.length === 0) {
    return NextResponse.json(
      {
        status: 'error', destination: q.destination, count: 0, results: [],
        engineStatus: [], weatherSynced: false, generatedAt: Date.now(),
        setupMessage: 'No valid attraction engines selected.',
      },
      { status: 400 },
    );
  }

  const searchParams = {
    destination: q.destination,
    startDate:   q.startDate,
    endDate:     q.endDate,
    adults:      q.adults,
    currency:    q.currency,
    maxResults:  q.maxResults,
  };

  const settled = await Promise.allSettled(
    adapters.map(a => a.search(searchParams)),
  );

  const allEntities: AttractionEntity[] = [];
  const engineStatus: AttractionEngineStatus[] = settled.map((r, i): AttractionEngineStatus => {
    if (r.status === 'fulfilled') {
      const val: AttractionEngineResult = r.value;
      if (val.status === 'ok') allEntities.push(...val.results);
      return {
        engineId:    val.engineId,
        engineName:  val.engineName,
        status:      val.status,
        count:       val.results.length,
        deepLinkUrl: val.deepLinkUrl,
        setupUrl:    val.setupUrl,
      };
    }
    return { engineId: adapters[i].id, engineName: adapters[i].name, status: 'error', count: 0 };
  });

  const allNeedKey = engineStatus.every(e => e.status === 'needs_api_key');

  if (allNeedKey) {
    const first = engineStatus.find(e => e.setupUrl);
    return NextResponse.json(
      {
        status:        'needs_api_key',
        destination:   q.destination,
        count:         0,
        results:       [],
        engineStatus,
        weatherSynced: false,
        generatedAt:   Date.now(),
        setupMessage:  `Add API keys for: ${q.engineIds.join(', ')}. Click an engine's Connect button to get started.`,
        ...(first?.setupUrl ? { setupUrl: first.setupUrl } : {}),
      } as AttractionsSearchResponse & { setupUrl?: string },
    );
  }

  // Apply effort filter
  const filtered = q.effortLevels?.length
    ? allEntities.filter(e => (q.effortLevels as string[]).includes(e.difficulty))
    : allEntities;

  // Weather enrichment
  const geo = await geocodeDestination(q.destination);
  const dates = dateRange(q.startDate, q.endDate);
  const scheduledDates = filtered.map((_, i) => dates[i % dates.length]);
  const enriched = await enrichAttractionsWithWeather(filtered, q.destination, scheduledDates);

  const qualityOrder: Record<string, number> = { perfect: 0, good: 1, fair: 2, available: 3, warning: 4 };
  enriched.sort((a, b) => {
    const qa = qualityOrder[a.weatherMatch?.quality ?? 'available'];
    const qb = qualityOrder[b.weatherMatch?.quality ?? 'available'];
    return qa !== qb ? qa - qb : (b.aiConfidence ?? 0) - (a.aiConfidence ?? 0);
  });

  return NextResponse.json(
    {
      status:        'ok',
      destination:   q.destination,
      count:         enriched.length,
      results:       enriched.slice(0, q.maxResults),
      engineStatus,
      weatherSynced: geo !== null,
      generatedAt:   Date.now(),
    },
    { headers: { 'Cache-Control': 'public, s-maxage=180, stale-while-revalidate=60' } },
  );
}
