// Temporal Observer — real-time flight delay webhook handler.
// Listens for Duffel airline_initiated_change and AviationStack alert payloads.
// On a delay ≥ 3h: updates timeline_nodes.end_time + broadcasts TEMPORAL_SHIFT
// to the multiplayer Supabase Realtime channel so the UI updates live.

import { NextRequest, NextResponse } from 'next/server';
import { z }                         from 'zod';
import { createHmac }                from 'crypto';
import { getSupabaseAdmin }          from '@/lib/supabase-admin';

const DELAY_THRESHOLD_MINUTES = 180; // 3 hours

// ── Duffel webhook signature verification ─────────────────────────────────────
// Header: X-Duffel-Signature → "t=<ts>,v1=<hmac_sha256_hex>"
// HMAC-SHA256( "<ts>.<raw_body>", DUFFEL_WEBHOOK_SECRET )

function verifyDuffelSignature(
  rawBody:   string,
  sigHeader: string | null,
): boolean {
  const secret = process.env.DUFFEL_WEBHOOK_SECRET;
  if (!secret || !sigHeader) return false;

  const parts: Record<string, string> = {};
  for (const part of sigHeader.split(',')) {
    const [k, v] = part.split('=', 2);
    if (k && v) parts[k] = v;
  }

  const { t, v1 } = parts;
  if (!t || !v1) return false;

  // Replay attack guard: reject if timestamp is >5 minutes old
  const timestampDelta = Math.abs(Date.now() / 1000 - parseInt(t, 10));
  if (timestampDelta > 300) return false;

  const expected = createHmac('sha256', secret)
    .update(`${t}.${rawBody}`)
    .digest('hex');

  // Constant-time comparison to prevent timing attacks
  if (expected.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ v1.charCodeAt(i);
  }
  return diff === 0;
}

// ── Payload schemas ───────────────────────────────────────────────────────────
// Duffel: order.airline_initiated_change event

const DuffelAICSchema = z.object({
  data: z.object({
    type: z.string(),
    object: z.object({
      id:      z.string(),           // order ID — "ord_..."
      changes: z.array(z.object({
        slices: z.array(z.object({
          segments: z.array(z.object({
            departing_at:  z.string().optional(),
            arriving_at:   z.string().optional(),
            origin:        z.object({ iata_code: z.string() }).optional(),
            destination:   z.object({ iata_code: z.string() }).optional(),
          })).optional().default([]),
        })).optional().default([]),
      })).optional().default([]),
    }),
  }),
});

// AviationStack: real-time flight alert
const AviationStackAlertSchema = z.object({
  event:  z.string(),              // "delay", "gate_change", "cancelled"
  flight: z.object({
    iata:         z.string(),
    icao:         z.string().optional(),
    departure: z.object({
      actual:       z.string().nullable().optional(),
      scheduled:    z.string().nullable().optional(),
      delay:        z.number().nullable().optional(),   // delay minutes
    }).optional(),
    arrival: z.object({
      actual:       z.string().nullable().optional(),
      scheduled:    z.string().nullable().optional(),
      delay:        z.number().nullable().optional(),
    }).optional(),
  }),
});

// ── DB + Realtime helpers ─────────────────────────────────────────────────────

interface ShiftResult {
  nodeId:       string;
  tripId:       string;
  delayMinutes: number;
  newEndTime:   string;
}

async function applyTemporalShift(
  duffelOrderId: string | null,
  flightIata:    string | null,
  delayMinutes:  number,
): Promise<ShiftResult | null> {
  const admin = getSupabaseAdmin();
  if (!admin || delayMinutes < DELAY_THRESHOLD_MINUTES) return null;

  // Find matching timeline_node by duffel_order_id or flight IATA
  let query = admin
    .from('timeline_nodes')
    .select('id, trip_id, end_time, raw_api_payload')
    .eq('node_type', 'flight');

  if (duffelOrderId) {
    query = query.eq('raw_api_payload->>duffel_order_id', duffelOrderId);
  } else if (flightIata) {
    query = query.eq('raw_api_payload->>flight_iata', flightIata);
  } else {
    return null;
  }

  const { data: nodes } = await query.limit(1);
  const node = nodes?.[0];
  if (!node?.end_time) return null;

  const newEndTime = new Date(
    new Date(node.end_time as string).getTime() + delayMinutes * 60_000,
  ).toISOString();

  const { error } = await admin
    .from('timeline_nodes')
    .update({ end_time: newEndTime, updated_at: new Date().toISOString() })
    .eq('id', node.id as string);

  if (error) return null;

  return {
    nodeId:       node.id as string,
    tripId:       node.trip_id as string,
    delayMinutes,
    newEndTime,
  };
}

async function broadcastTemporalShift(shift: ShiftResult): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin) return;

  // Broadcast on the trip's multiplayer channel — MultiplayerCanvas.tsx subscribes here
  const channel = admin.channel(`trip:${shift.tripId}`);
  await channel.send({
    type:    'broadcast',
    event:   'TEMPORAL_SHIFT',
    payload: {
      nodeId:       shift.nodeId,
      delayMinutes: shift.delayMinutes,
      newEndTime:   shift.newEndTime,
      severity:     shift.delayMinutes >= 360 ? 'critical'
                  : shift.delayMinutes >= 240 ? 'high'
                  : 'moderate',
      detectedAt:   Date.now(),
    },
  });
}

// ── POST /api/webhooks/flight-updates ─────────────────────────────────────────

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  // ── Duffel webhook path ──────────────────────────────────────────────────────
  const sigHeader   = req.headers.get('x-duffel-signature');
  const sourceDuffel = sigHeader !== null;

  if (sourceDuffel) {
    if (!verifyDuffelSignature(rawBody, sigHeader)) {
      return NextResponse.json({ error: 'SIGNATURE_INVALID' }, { status: 401 });
    }

    let body: unknown;
    try { body = JSON.parse(rawBody); }
    catch { return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 }); }

    const parsed = DuffelAICSchema.safeParse(body);
    if (!parsed.success) {
      // Unknown Duffel event type — acknowledge to prevent retries, log shape
      return NextResponse.json({ received: true, processed: false });
    }

    const { data: { type: eventType, object } } = parsed.data;

    // Only process delay-related changes
    if (!eventType.includes('airline_initiated_change') && !eventType.includes('delay')) {
      return NextResponse.json({ received: true, processed: false, reason: 'Non-delay event' });
    }

    // Extract new arrival time from the first changed slice's last segment
    const firstChange = parsed.data.data.object.changes?.[0];
    const lastSegment = firstChange?.slices?.[0]?.segments?.slice(-1)[0];
    const newArrival  = lastSegment?.arriving_at;

    if (!newArrival) {
      return NextResponse.json({ received: true, processed: false, reason: 'No arrival time in payload' });
    }

    const shift = await applyTemporalShift(object.id, null, DELAY_THRESHOLD_MINUTES);
    if (shift) await broadcastTemporalShift(shift);

    return NextResponse.json({
      received:     true,
      processed:    !!shift,
      orderId:      object.id,
      shiftApplied: shift ?? null,
    });
  }

  // ── AviationStack webhook path ───────────────────────────────────────────────
  // AviationStack does not support HMAC — verify shared secret via header instead
  const asSecret = req.headers.get('x-aviationstack-secret');
  const asEnvKey = process.env.AVIATIONSTACK_WEBHOOK_SECRET;
  if (asEnvKey && asSecret !== asEnvKey) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  let body: unknown;
  try { body = JSON.parse(rawBody); }
  catch { return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 }); }

  const asParsed = AviationStackAlertSchema.safeParse(body);
  if (!asParsed.success) {
    return NextResponse.json({ received: true, processed: false, reason: 'Unrecognized AviationStack payload' });
  }

  const { event, flight } = asParsed.data;
  if (event !== 'delay') {
    return NextResponse.json({ received: true, processed: false, reason: `Event '${event}' is not a delay` });
  }

  const delayMinutes =
    flight.arrival?.delay ??
    flight.departure?.delay ??
    0;

  const shift = await applyTemporalShift(null, flight.iata, delayMinutes);
  if (shift) await broadcastTemporalShift(shift);

  return NextResponse.json({
    received:     true,
    processed:    !!shift,
    flightIata:   flight.iata,
    delayMinutes,
    shiftApplied: shift ?? null,
  });
}
