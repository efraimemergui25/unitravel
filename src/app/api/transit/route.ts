import { NextRequest, NextResponse } from 'next/server';
import { z }                         from 'zod';
import { TRANSIT_ADAPTERS }          from '@/lib/engines/transit';
import type { TransitEngineResult }  from '@/lib/engines/transit';
import type { TransitQuery }         from '@/types/transit';

// ── Schema ─────────────────────────────────────────────────────────────────────

const TransitSearchSchema = z.object({
  origin:      z.string().min(1),
  destination: z.string().min(1),
  date:        z.string().optional(),
  adults:      z.coerce.number().int().min(1).max(9).default(2),
  engines:     z.string().optional(), // comma-separated engine IDs from OmniSelectorConsole
});

export interface TransitEngineStatus {
  engineId:      string;
  engineName:    string;
  status:        'ok' | 'needs_api_key' | 'error';
  count:         number;
  latencyMs:     number;
  deepLinkUrl?:  string;
  setupUrl?:     string;
  setupMessage?: string;
}

export interface TransitSearchResponse {
  status:        'ok' | 'needs_api_key' | 'error';
  results:       TransitQuery[];
  provider:      string;
  checkedAt:     number;
  engineStatus?: TransitEngineStatus[];
  setupUrl?:     string;
  setupMessage?: string;
}

// ── POST handler ────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse<TransitSearchResponse>> {
  const body   = await req.json().catch(() => ({}));
  const parsed = TransitSearchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({
      status: 'error', results: [], provider: 'none', checkedAt: Date.now(),
      setupMessage: parsed.error.flatten().fieldErrors.toString(),
    }, { status: 400 });
  }

  const q = parsed.data;

  // ── Resolve adapters from selected engine IDs ──────────────────────────────
  const engineIds = q.engines ? q.engines.split(',').filter(Boolean) : ['google-maps'];
  const adapters  = engineIds.map(id => TRANSIT_ADAPTERS[id]).filter(Boolean);

  if (adapters.length === 0) {
    return NextResponse.json({
      status: 'error', results: [], provider: 'none', checkedAt: Date.now(),
      setupMessage: 'No valid transit engines selected.',
    }, { status: 400 });
  }

  const searchParams = {
    origin:      q.origin,
    destination: q.destination,
    date:        q.date,
    adults:      q.adults,
  };

  // ── Promise.allSettled — real parallel search ──────────────────────────────
  const settled = await Promise.allSettled(
    adapters.map(a => a.search(searchParams)),
  );

  const allResults: TransitQuery[] = [];
  const engineStatus: TransitEngineStatus[] = settled.map((r, i): TransitEngineStatus => {
    const adapter = adapters[i]!;
    if (r.status === 'fulfilled') {
      const val: TransitEngineResult = r.value;
      if (val.status === 'ok') allResults.push(...val.results);
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
    return {
      engineId:    adapter.id,
      engineName:  adapter.name,
      status:      'error',
      count:       0,
      latencyMs:   0,
      setupMessage: r.reason instanceof Error ? r.reason.message : 'Unknown error',
    };
  });

  const allNeedKey   = engineStatus.every(e => e.status === 'needs_api_key');
  const providerNames = engineStatus.filter(e => e.status === 'ok').map(e => e.engineName);

  if (allNeedKey) {
    return NextResponse.json({
      status:       'needs_api_key',
      results:      [],
      provider:     adapters.map(a => a.name).join(', '),
      checkedAt:    Date.now(),
      engineStatus,
      setupUrl:     'https://console.cloud.google.com/apis/library/directions-backend.googleapis.com',
      setupMessage: `Add API keys for: ${engineIds.join(', ')}. Start with GOOGLE_MAPS_API_KEY (Google Maps Directions).`,
    });
  }

  return NextResponse.json(
    {
      status:       'ok',
      results:      allResults,
      provider:     providerNames.join(', ') || 'none',
      checkedAt:    Date.now(),
      engineStatus,
    },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' } },
  );
}

// ── GET — healthcheck ──────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    service: 'Unitravel Transit Orchestrator',
    version: '2.0.0',
    engines: Object.keys(TRANSIT_ADAPTERS),
    schema:  'POST with { origin, destination, adults, engines? }',
  });
}
