// Bridges `unitravel:zone-drag-commit` CustomEvents to the 5-step DropCascade.
// Handles restaurant transit pre-injection and payload → AggregatedResult conversion.

import { handleMasterEntityDrop }     from '@/utils/DropCascade';
import { useTravelEngine }             from '@/store/useTravelEngine';
import type {
  AggregatedFlight,
  AggregatedLodging,
  AggregatedDining,
  AggregatedResult,
} from '@/services/OmniAggregator';
import type { DropCascadeResult } from '@/utils/DropCascade';

// ── TimelineDropPayload ───────────────────────────────────────────────────────
// Shape of the `detail` object in CustomEvent `unitravel:zone-drag-commit`.
// Emitted by AviationBento's DragHandle and "Add to Timeline" buttons.

export interface TimelineDropPayload {
  id:         string;
  type:       'flight' | 'hotel' | 'restaurant' | 'activity' | 'transport';
  title:      string;
  subtitle:   string;
  price:      number;
  currency:   string;
  icon:       string;
  sourceZone: string;
}

// ── DropAction ────────────────────────────────────────────────────────────────
// WebSocket-ready action envelope for multiplayer sync.
// When a WebSocket layer is wired up, serialize this over the wire.
// `actionId` is the idempotency key for CRDT conflict resolution.

export interface DropAction {
  actionId:    string;
  userId:      string;
  sessionId:   string;
  timestamp:   number;
  payload:     TimelineDropPayload;
  targetDayId: string;
  targetTime?: string;
}

// ── Transit block builder ─────────────────────────────────────────────────────
// Creates a synthetic Uber transit block 30 min before a restaurant reservation.
// Uses AggregatedFlight as the closest proxy for point-to-point ground transport.

export function buildTransitBlock(
  targetTime: string,
  forTitle:   string,
): AggregatedFlight {
  const [hStr = '20', mStr = '00'] = targetTime.split(':');
  const totalMins = parseInt(hStr, 10) * 60 + parseInt(mStr, 10) - 30;
  const safeMins  = Math.max(0, totalMins);
  const fmt = (mins: number) =>
    `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

  return {
    id:                   `transit-pre-${Date.now()}`,
    category:             'flight',
    sources:              [],
    sourceCount:          1,
    aiConfidence:         0.95,
    tags:                 ['auto', 'transit', 'uber'],
    airline:              '',
    flightNumber:         '',
    route:                `Uber → ${forTitle}`,
    origin:               '',
    destination:          '',
    departure:            fmt(safeMins),
    arrival:              targetTime,
    durationMin:          30,
    durationLabel:        '30m',
    stops:                0,
    class:                'Economy',
    price:                0,
    priceRange:           [0, 0],
    carbonKg:             0,
    carbonLabel:          'Ground transport',
    carbonAlternative:    '',
    priceDropProbability: 0,
    seats:                0,
    refundable:           false,
  };
}

// ── AggregatedResult builder ──────────────────────────────────────────────────
// Converts a minimal TimelineDropPayload into a full AggregatedResult so the
// existing DropCascade / placeEntity pipeline can consume it without changes.

function buildAggregatedResult(
  payload:     TimelineDropPayload,
  targetTime?: string,
): AggregatedResult {
  const base = {
    id:           payload.id,
    sources:      [payload.sourceZone],
    sourceCount:  1,
    aiConfidence: 0.9,
    tags:         [payload.type, payload.sourceZone],
  };

  switch (payload.type) {
    case 'flight': {
      const parts = payload.subtitle?.split('→') ?? [];
      return {
        ...base,
        category:             'flight',
        airline:              payload.title,
        flightNumber:         payload.subtitle?.match(/[A-Z]{2}\d+/)?.[0] ?? '',
        route:                payload.subtitle || payload.title,
        origin:               parts[0]?.trim() ?? 'TLV',
        destination:          parts[1]?.trim() ?? 'MEX',
        departure:            targetTime ?? '07:00',
        arrival:              '',
        durationMin:          240,
        durationLabel:        '4h 0m',
        stops:                0,
        class:                'Business',
        price:                payload.price,
        priceRange:           [Math.round(payload.price * 0.9), Math.round(payload.price * 1.1)],
        carbonKg:             400,
        carbonLabel:          'Moderate carbon',
        carbonAlternative:    '',
        priceDropProbability: 0.2,
        seats:                2,
        refundable:           true,
      } satisfies AggregatedFlight;
    }

    case 'hotel': {
      const nights = 7;
      return {
        ...base,
        category:      'hotel',
        name:          payload.title,
        location:      payload.subtitle || 'Mexico',
        destination:   'Mexico City',
        tier:          '5★',
        roomType:      payload.subtitle || 'Suite',
        pricePerNight: Math.round(payload.price / nights),
        totalPrice:    payload.price,
        nights,
        rating:        4.8,
        reviewCount:   1200,
        sentiment:     { positive: 0.92, neutral: 0.05, negative: 0.03, compound: 0.89 },
        amenities:     ['Spa', 'Pool'],
        aiHighlight:   payload.subtitle || payload.title,
      } satisfies AggregatedLodging;
    }

    default: {
      return {
        ...base,
        category:          'restaurant',
        name:              payload.title,
        cuisine:           payload.subtitle?.split('·')[0]?.trim() ?? 'Mexican',
        location:          'Mexico City, Mexico',
        destination:       'Mexico City',
        pricePerPerson:    Math.round(payload.price / 2),
        rating:            4.7,
        sentiment:         { positive: 0.88, neutral: 0.08, negative: 0.04, compound: 0.84 },
        reservationWindow: '2 weeks',
        uberMinutes:       15,
        uberCost:          8,
        aiHighlight:       payload.subtitle || payload.title,
      } satisfies AggregatedDining;
    }
  }
}

// ── Main drop handler ─────────────────────────────────────────────────────────
// Called by LiquidTimeline's `unitravel:zone-drag-commit` listener.
// Sanitizes the incoming payload before any store mutation.
// For restaurants with a known time: auto-injects a 30-min Uber transit block.

export async function handleEntityDrop(
  rawEntity:   unknown,
  targetDayId: string,
  targetTime?: string,
): Promise<DropCascadeResult> {
  const { sanitizeIncomingDropPayload } = await import('./PayloadSanitizer');
  const result = sanitizeIncomingDropPayload(rawEntity);

  if (!result.ok) {
    console.warn('[TimelineSync] Rejected invalid drop payload:', result.reason, rawEntity);
    return { success: false, error: result.reason } as unknown as DropCascadeResult;
  }

  const entity = result.payload;

  if (entity.type === 'restaurant' && targetTime) {
    const transit = buildTransitBlock(targetTime, entity.title);
    useTravelEngine.getState().placeEntity(targetDayId, transit);
  }

  const source = buildAggregatedResult(entity, targetTime);
  return handleMasterEntityDrop(source, targetDayId);
}
