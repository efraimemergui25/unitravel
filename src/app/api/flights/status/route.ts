import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// ── Schema ─────────────────────────────────────────────────────────────────────

const QuerySchema = z.object({
  flight:    z.string().min(2).max(8).toUpperCase(),
  scheduled: z.string().optional(),
});

export interface FlightStatusResponse {
  flightNumber:  string;
  status:        'on-time' | 'delayed' | 'cancelled' | 'boarding' | 'landed';
  delayMinutes:  number;
  gateDepart?:   string;
  gateArrive?:   string;
  actualDepart?: string;  // ISO 8601
  actualArrive?: string;  // ISO 8601
  source:        string;
  provider:      string;
  checkedAt:     number;
  // present only when status === 'needs_api_key'
  setupUrl?:     string;
  setupMessage?: string;
}

// ── AviationStack adapter ──────────────────────────────────────────────────────

async function fetchAviationStack(
  flightIata: string,
): Promise<FlightStatusResponse | null> {
  const key = process.env.AVIATIONSTACK_API_KEY;
  if (!key) return null;

  const url = new URL('http://api.aviationstack.com/v1/flights');
  url.searchParams.set('access_key', key);
  url.searchParams.set('flight_iata', flightIata);

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8_000) });
  if (!res.ok) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await res.json() as { data?: any[] };
  const flight = data?.data?.[0];
  if (!flight) return null;

  const rawStatus: string = flight.flight_status ?? 'unknown';
  const status: FlightStatusResponse['status'] =
    rawStatus === 'cancelled'  ? 'cancelled'  :
    rawStatus === 'active'     ? 'boarding'   :
    rawStatus === 'landed'     ? 'landed'     :
    rawStatus === 'delayed'    ? 'delayed'    :
    rawStatus === 'scheduled'  ? 'on-time'    : 'on-time';

  const scheduledDepart: string  = flight.departure?.scheduled ?? '';
  const estimatedDepart: string  = flight.departure?.estimated ?? scheduledDepart;
  const scheduledArrive: string  = flight.arrival?.scheduled ?? '';
  const estimatedArrive: string  = flight.arrival?.estimated ?? scheduledArrive;

  let delayMinutes = 0;
  if (scheduledDepart && estimatedDepart) {
    delayMinutes = Math.max(0, Math.round(
      (new Date(estimatedDepart).getTime() - new Date(scheduledDepart).getTime()) / 60_000
    ));
  }

  return {
    flightNumber:  flightIata,
    status:        delayMinutes > 15 ? 'delayed' : status,
    delayMinutes,
    gateDepart:    flight.departure?.gate ?? undefined,
    gateArrive:    flight.arrival?.gate   ?? undefined,
    actualDepart:  flight.departure?.actual ?? undefined,
    actualArrive:  flight.arrival?.actual   ?? undefined,
    source:        'AviationStack',
    provider:      'AviationStack',
    checkedAt:     Date.now(),
  };
}

// ── GET handler ────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse<FlightStatusResponse>> {
  const p = req.nextUrl.searchParams;

  const parsed = QuerySchema.safeParse({
    flight:    p.get('flight')    ?? '',
    scheduled: p.get('scheduled') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({
      flightNumber:  p.get('flight') ?? '',
      status:        'on-time',
      delayMinutes:  0,
      source:        'error',
      provider:      'none',
      checkedAt:     Date.now(),
      setupMessage:  parsed.error.flatten().fieldErrors.toString(),
    }, { status: 400 });
  }

  const { flight } = parsed.data;

  // No API key — return honest empty state
  if (!process.env.AVIATIONSTACK_API_KEY) {
    return NextResponse.json({
      flightNumber:  flight,
      status:        'on-time',
      delayMinutes:  0,
      source:        'needs_api_key',
      provider:      'AviationStack',
      checkedAt:     Date.now(),
      setupUrl:      'https://aviationstack.com/signup/free',
      setupMessage:  'Add AVIATIONSTACK_API_KEY to .env.local for real-time flight status.',
    });
  }

  const result = await fetchAviationStack(flight);

  if (!result) {
    return NextResponse.json({
      flightNumber:  flight,
      status:        'on-time',
      delayMinutes:  0,
      source:        'no_data',
      provider:      'AviationStack',
      checkedAt:     Date.now(),
      setupMessage:  `No flight data found for ${flight}`,
    });
  }

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' },
  });
}
