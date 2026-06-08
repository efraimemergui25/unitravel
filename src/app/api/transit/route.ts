import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { TransitQuery, RouteOption, TransitSegment, TransitMode } from '@/types/transit';

// ── Schema ─────────────────────────────────────────────────────────────────────

const TransitSearchSchema = z.object({
  origin:      z.string().min(1),
  destination: z.string().min(1),
  date:        z.string().optional(),
  adults:      z.number().int().min(1).max(9).default(2),
});

export interface TransitSearchResponse {
  status:       'ok' | 'needs_api_key' | 'error';
  results:      TransitQuery[];
  provider:     string;
  checkedAt:    number;
  setupUrl?:    string;
  setupMessage?: string;
}

// ── Google Maps Directions adapter ─────────────────────────────────────────────

const GMAPS_BASE = 'https://maps.googleapis.com/maps/api/directions/json';

type GmapsStep = {
  travel_mode:   string;
  duration:      { value: number };
  html_instructions: string;
  transit_details?: {
    line?: { vehicle?: { type?: string }; name?: string; short_name?: string };
    num_stops?: number;
    departure_time?: { text?: string };
    arrival_time?:   { text?: string };
  };
};

type GmapsLeg = {
  duration:        { value: number; text: string };
  distance:        { text: string };
  start_address:   string;
  end_address:     string;
  steps:           GmapsStep[];
};

type GmapsRoute = {
  legs: GmapsLeg[];
  summary: string;
};

type GmapsResponse = {
  status: string;
  routes: GmapsRoute[];
};

// Converts a Google Maps transit step into our TransitSegment
function stepToSegment(step: GmapsStep, adults: number): TransitSegment {
  const durationMin = Math.round(step.duration.value / 60);

  if (step.travel_mode === 'WALKING') {
    return {
      mode:        'walk',
      provider:    'On foot',
      label:       'Walk',
      durationMin,
      cost:        0,
      walkEffort:  durationMin > 10 ? 'moderate' : 'flat',
    };
  }

  if (step.travel_mode === 'TRANSIT') {
    const td = step.transit_details;
    const vehicleType = td?.line?.vehicle?.type?.toLowerCase() ?? '';
    const mode: TransitMode =
      vehicleType.includes('subway') || vehicleType.includes('metro') ? 'train' :
      vehicleType.includes('bus')    ? 'bus'  :
      vehicleType.includes('train')  ? 'train': 'bus';

    const provider = td?.line?.name ?? td?.line?.short_name ?? 'Transit';
    return {
      mode,
      provider,
      label:       `${provider} (${td?.num_stops ?? 1} stop${(td?.num_stops ?? 1) > 1 ? 's' : ''})`,
      durationMin,
      cost:        mode === 'train' ? 3 * adults : 2 * adults,
      departTime:  td?.departure_time?.text,
      arriveTime:  td?.arrival_time?.text,
    };
  }

  // DRIVING
  return {
    mode:        'rideshare',
    provider:    'Uber / Taxi',
    label:       'Drive',
    durationMin,
    cost:        Math.round((durationMin / 60) * 35 * adults),
  };
}

async function fetchGoogleMapsRoutes(
  origin: string,
  destination: string,
  adults: number,
): Promise<TransitQuery | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;

  // Fetch transit route
  const [transitRes, drivingRes] = await Promise.allSettled([
    fetch(`${GMAPS_BASE}?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&mode=transit&key=${key}`, { signal: AbortSignal.timeout(8_000) }).then(r => r.json() as Promise<GmapsResponse>),
    fetch(`${GMAPS_BASE}?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&mode=driving&key=${key}`, { signal: AbortSignal.timeout(8_000) }).then(r => r.json() as Promise<GmapsResponse>),
  ]);

  const options: RouteOption[] = [];

  // Transit option
  if (transitRes.status === 'fulfilled' && transitRes.value.status === 'OK' && transitRes.value.routes[0]) {
    const leg = transitRes.value.routes[0].legs[0];
    const segments = leg.steps.map(s => stepToSegment(s, adults));
    const totalMin  = Math.round(leg.duration.value / 60);
    const totalCost = segments.reduce((s, seg) => s + seg.cost, 0);

    options.push({
      id:            'transit',
      label:         'Public Transit',
      segments,
      totalMin,
      totalCost,
      comfort:       3,
      co2Kg:         Math.round(totalMin * 0.04 * adults * 10) / 10,
      isRecommended: true,
      isFastest:     false,
      isCheapest:    true,
      tags:          ['eco-friendly', 'public-transit'],
    });
  }

  // Driving/rideshare option
  if (drivingRes.status === 'fulfilled' && drivingRes.value.status === 'OK' && drivingRes.value.routes[0]) {
    const leg = drivingRes.value.routes[0].legs[0];
    const durationMin = Math.round(leg.duration.value / 60);
    const cost = Math.round((durationMin / 60) * 35 * adults);

    options.push({
      id:            'rideshare',
      label:         'Rideshare / Taxi',
      segments:      [{
        mode:        'rideshare',
        provider:    'Uber / Lyft',
        label:       `${leg.distance.text} drive`,
        durationMin,
        cost,
        departTime:  undefined,
        arriveTime:  undefined,
      }],
      totalMin:      durationMin,
      totalCost:     cost,
      comfort:       4,
      co2Kg:         Math.round(durationMin * 0.21 * adults * 10) / 10,
      isRecommended: false,
      isFastest:     true,
      isCheapest:    false,
      tags:          ['door-to-door', 'comfortable'],
    });
  }

  if (options.length === 0) return null;

  const fastest = options.reduce((a, b) => a.totalMin < b.totalMin ? a : b);
  const cheapest = options.reduce((a, b) => a.totalCost < b.totalCost ? a : b);
  options.forEach(o => {
    o.isFastest  = o.id === fastest.id;
    o.isCheapest = o.id === cheapest.id;
  });

  const transitLeg = transitRes.status === 'fulfilled' && transitRes.value.routes[0]?.legs[0];

  return {
    id:          `route-${Date.now()}`,
    from:        origin,
    fromLabel:   transitLeg ? transitLeg.start_address : origin,
    to:          destination,
    toLabel:     transitLeg ? transitLeg.end_address   : destination,
    distance:    transitLeg ? transitLeg.distance.text : '',
    options,
    aiSummary:   `${options.length} route${options.length > 1 ? 's' : ''} found from ${origin} to ${destination}. ${fastest.label} is fastest (${fastest.totalMin}min). ${cheapest.label} is cheapest ($${cheapest.totalCost}).`,
    tripContext: `${origin} → ${destination}`,
    icon:        '🚇',
  };
}

// ── POST handler ────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse<TransitSearchResponse>> {
  const body = await req.json().catch(() => ({}));
  const parsed = TransitSearchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({
      status: 'error', results: [], provider: 'none', checkedAt: Date.now(),
      setupMessage: parsed.error.flatten().fieldErrors.toString(),
    }, { status: 400 });
  }

  if (!process.env.GOOGLE_MAPS_API_KEY) {
    return NextResponse.json({
      status:       'needs_api_key',
      results:      [],
      provider:     'Google Maps',
      checkedAt:    Date.now(),
      setupUrl:     'https://console.cloud.google.com/apis/library/directions-backend.googleapis.com',
      setupMessage: 'Add GOOGLE_MAPS_API_KEY to .env.local to enable real transit routing.',
    });
  }

  const { origin, destination, adults } = parsed.data;

  try {
    const query = await fetchGoogleMapsRoutes(origin, destination, adults);
    if (!query) {
      return NextResponse.json({
        status: 'ok', results: [], provider: 'Google Maps', checkedAt: Date.now(),
        setupMessage: `No routes found between ${origin} and ${destination}.`,
      });
    }

    return NextResponse.json(
      { status: 'ok', results: [query], provider: 'Google Maps', checkedAt: Date.now() },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' } },
    );
  } catch (err) {
    return NextResponse.json({
      status: 'error', results: [], provider: 'Google Maps', checkedAt: Date.now(),
      setupMessage: err instanceof Error ? err.message : 'Transit search failed',
    }, { status: 500 });
  }
}
