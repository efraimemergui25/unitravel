// Master Transaction Engine
// Verifies auth → creates Duffel orders → generates Booking.com deeplinks →
// rolls back on any failure → returns GlassError structure on 400.
// All mutations are persisted to timeline_nodes. Never returns fake booking confirmations.

import { NextRequest, NextResponse } from 'next/server';
import { z }                         from 'zod';
import { getSupabaseAdmin }          from '@/lib/supabase-admin';

const DUFFEL_BASE = 'https://api.duffel.com';

// ── GlassError — rendered by the checkout page's GlassCard error overlay ─────

export interface GlassError {
  code:      string;
  message:   string;
  field?:    string;
  recovery?: string;
  rollback?: {
    attempted:    boolean;
    succeededIds: string[];
    failedIds:    string[];
  };
}

function errRes(
  status: number,
  code:   string,
  msg:    string,
  opts?:  Omit<GlassError, 'code' | 'message'>,
): NextResponse {
  return NextResponse.json({ error: { code, message: msg, ...opts } satisfies GlassError }, { status });
}

// ── Zod schemas ───────────────────────────────────────────────────────────────

const PassengerSchema = z.object({
  id:          z.string().min(1),
  given_name:  z.string().min(1),
  family_name: z.string().min(1),
  born_on:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'born_on must be YYYY-MM-DD'),
  email:       z.string().email(),
  phone:       z.string().optional(),
  title:       z.enum(['mr', 'ms', 'mrs', 'miss', 'dr']).optional(),
});

const AviationNodeSchema = z.object({
  offerId:      z.string().min(1).describe('Duffel offer ID — off_…'),
  passengers:   z.array(PassengerSchema).min(1).max(9),
  totalPrice:   z.number().positive(),
  currency:     z.string().length(3).default('USD'),
  timelineNodeId: z.string().uuid().optional(),
});

const LodgingNodeSchema = z.object({
  provider:       z.string().min(1),
  propertyId:     z.string().min(1),
  checkIn:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  roomType:       z.string().min(1),
  totalPrice:     z.number().positive(),
  currency:       z.string().length(3).default('USD'),
  guestFirstName: z.string().min(1),
  guestLastName:  z.string().min(1),
  timelineNodeId: z.string().uuid().optional(),
});

const CheckoutRequestSchema = z.object({
  tripId:        z.string().uuid('tripId must be a valid UUID'),
  aviationNodes: z.array(AviationNodeSchema).default([]),
  lodgingNodes:  z.array(LodgingNodeSchema).default([]),
});

// ── Duffel helpers ────────────────────────────────────────────────────────────

function duffelHeaders(): Record<string, string> | null {
  const key = process.env.DUFFEL_API_KEY;
  if (!key) return null;
  return {
    Authorization:    `Bearer ${key}`,
    'Content-Type':   'application/json',
    'Duffel-Version': 'v2',
    Accept:           'application/json',
  };
}

interface DuffelOrderResult {
  ok:       boolean;
  orderId?: string;
  message?: string;
}

async function createDuffelOrder(
  node: z.infer<typeof AviationNodeSchema>,
): Promise<DuffelOrderResult> {
  const hdrs = duffelHeaders();
  if (!hdrs) return { ok: false, message: 'DUFFEL_API_KEY is not configured — add it to .env.local' };

  try {
    const res = await fetch(`${DUFFEL_BASE}/air/orders`, {
      method:  'POST',
      headers: hdrs,
      body:    JSON.stringify({
        data: {
          type:            'instant',
          selected_offers: [node.offerId],
          passengers:      node.passengers,
          payments:        [{
            type:     'balance',
            amount:   node.totalPrice.toFixed(2),
            currency: node.currency,
          }],
        },
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as {
        errors?: Array<{ message: string; type?: string; title?: string }>;
      };
      const firstError = err.errors?.[0];
      return { ok: false, message: firstError?.message ?? firstError?.title ?? `Duffel HTTP ${res.status}` };
    }

    const json = await res.json() as { data: { id: string } };
    return { ok: true, orderId: json.data.id };
  } catch (e) {
    const isTimeout = e instanceof Error && e.name === 'TimeoutError';
    return { ok: false, message: isTimeout ? 'Duffel request timed out (20s)' : (e instanceof Error ? e.message : 'Network error') };
  }
}

// Best-effort Duffel rollback — confirms cancellation in two steps.
// Failure is swallowed: rollback is advisory, not transactional.
async function cancelDuffelOrder(orderId: string): Promise<void> {
  const hdrs = duffelHeaders();
  if (!hdrs) return;
  try {
    const res = await fetch(`${DUFFEL_BASE}/air/order_cancellations`, {
      method:  'POST',
      headers: hdrs,
      body:    JSON.stringify({ data: { order_id: orderId } }),
      signal:  AbortSignal.timeout(10_000),
    });
    if (!res.ok) return;
    const json = await res.json() as { data: { id: string } };
    await fetch(`${DUFFEL_BASE}/air/order_cancellations/${json.data.id}/actions/confirm`, {
      method:  'POST',
      headers: hdrs,
      signal:  AbortSignal.timeout(10_000),
    });
  } catch { /* best-effort — failure logged by Duffel's audit trail, not surfaced here */ }
}

// ── Booking.com — deeplink model ───────────────────────────────────────────────
// Booking.com does not offer a partner API for direct bookings.
// The correct integration is: generate a tracked affiliate deeplink
// and redirect the user to complete payment on Booking.com directly.

interface LodgingResult {
  ok:       boolean;
  deepLink?: string;
  message?: string;
}

function buildBookingDeepLink(node: z.infer<typeof LodgingNodeSchema>): LodgingResult {
  const aid = process.env.BOOKING_AFFILIATE_ID;

  // With affiliate ID: tracked hotel page deeplink
  if (aid) {
    const params = new URLSearchParams({
      aid,
      hotel_id:     node.propertyId,
      checkin:      node.checkIn,
      checkout:     node.checkOut,
      group_adults: '1',
      no_rooms:     '1',
      currency:     node.currency,
      lang:         'en-us',
    });
    return {
      ok:       true,
      deepLink: `https://www.booking.com/hotel/${encodeURIComponent(node.propertyId)}.html?${params}`,
    };
  }

  // Without affiliate ID: use public search URL — no key needed, works immediately.
  // User lands on Booking.com with pre-filled dates and property name.
  const [ciYear, ciMonth, ciDay] = node.checkIn.split('-');
  const [coYear, coMonth, coDay] = node.checkOut.split('-');
  const params = new URLSearchParams({
    ss:                node.propertyId,
    checkin_year:      ciYear,
    checkin_month:     ciMonth,
    checkin_monthday:  ciDay,
    checkout_year:     coYear,
    checkout_month:    coMonth,
    checkout_monthday: coDay,
    group_adults:      '1',
    no_rooms:          '1',
    currency:          node.currency || 'USD',
    lang:              'en-us',
  });
  return {
    ok:       true,
    deepLink: `https://www.booking.com/searchresults.html?${params}`,
  };
}

// ── POST /api/checkout/execute ────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── Step 1: Verify Supabase auth token ──────────────────────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return errRes(401, 'MISSING_AUTH', 'Authorization: Bearer <token> header required');
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return errRes(503, 'SUPABASE_UNAVAILABLE', 'Supabase is not configured', {
      recovery: 'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local',
    });
  }

  const token = authHeader.slice(7);
  const { data: { user }, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !user) {
    return errRes(401, 'INVALID_TOKEN', 'Session expired or token invalid — please sign in again');
  }

  // ── Step 2: Parse + validate body ───────────────────────────────────────────
  let raw: unknown;
  try { raw = await req.json(); }
  catch { return errRes(400, 'INVALID_JSON', 'Request body must be valid JSON'); }

  const parsed = CheckoutRequestSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    return errRes(400, 'VALIDATION_ERROR', issue.message, { field: issue.path.join('.') });
  }
  const { tripId, aviationNodes, lodgingNodes } = parsed.data;

  // ── Step 3: Verify trip ownership ───────────────────────────────────────────
  const { data: trip } = await admin
    .from('trips')
    .select('id, owner_id')
    .eq('id', tripId)
    .single();

  if (!trip) return errRes(404, 'TRIP_NOT_FOUND', `Trip ${tripId} not found`);
  if (trip.owner_id !== user.id) {
    return errRes(403, 'FORBIDDEN', 'You are not the owner of this trip');
  }

  // ── Step 4: Execute aviation bookings (sequential — rollback on first failure)
  const confirmedOrderIds: string[] = [];

  for (let i = 0; i < aviationNodes.length; i++) {
    const node   = aviationNodes[i]!;
    const result = await createDuffelOrder(node);

    if (!result.ok) {
      // Roll back every confirmed order before returning the error
      await Promise.all(confirmedOrderIds.map(id => cancelDuffelOrder(id)));

      return errRes(400, 'AVIATION_BOOKING_FAILED', result.message ?? 'Flight booking failed', {
        field: `aviationNodes[${i}].offerId`,
        recovery: result.message?.toLowerCase().includes('price')
          ? 'The fare price changed since selection. Re-search and pick a new offer.'
          : result.message?.toLowerCase().includes('sold out') || result.message?.toLowerCase().includes('unavailable')
          ? 'This fare is no longer available. Please select another flight.'
          : 'Please try again in a few moments.',
        rollback: {
          attempted:    confirmedOrderIds.length > 0,
          succeededIds: confirmedOrderIds,
          failedIds:    [node.offerId],
        },
      });
    }

    confirmedOrderIds.push(result.orderId!);
  }

  // ── Step 5: Resolve lodging deeplinks ────────────────────────────────────────
  const lodgingDeepLinks: Array<{ propertyId: string; deepLink: string }> = [];

  for (let i = 0; i < lodgingNodes.length; i++) {
    const node   = lodgingNodes[i]!;
    const result = buildBookingDeepLink(node);

    if (!result.ok) {
      return errRes(400, 'LODGING_CONFIG_ERROR', result.message ?? 'Lodging config error', {
        field:    `lodgingNodes[${i}].provider`,
        recovery: 'Set BOOKING_AFFILIATE_ID in .env.local',
        rollback: { attempted: false, succeededIds: [], failedIds: [] },
      });
    }

    lodgingDeepLinks.push({ propertyId: node.propertyId, deepLink: result.deepLink! });
  }

  // ── Step 6: Persist confirmed Duffel orders to timeline_nodes ────────────────
  if (confirmedOrderIds.length > 0) {
    const rows = confirmedOrderIds.map((orderId, i) => ({
      trip_id:         tripId,
      node_type:       'flight',
      title:           `Flight · ${orderId}`,
      affiliate_rate:  0.02,
      raw_api_payload: { duffel_order_id: orderId, offer_id: aviationNodes[i]?.offerId },
    }));
    await admin.from('timeline_nodes').insert(rows);
  }

  return NextResponse.json({
    status:           'ok',
    userId:           user.id,
    tripId,
    aviationBookings: confirmedOrderIds.map((orderId, i) => ({
      orderId,
      offerId:    aviationNodes[i]?.offerId,
      passengers: aviationNodes[i]?.passengers.length ?? 0,
    })),
    lodgingDeepLinks,
  });
}
