// PayloadSanitizer.ts — Security & minification layer before public sharing
// Strips all sensitive/financial data. Only shares the experience, never the receipt.

import type { PlacedEntity, EngineDay } from '@/store/useTravelEngine';

// ── Public types ──────────────────────────────────────────────────────────────

export interface PublicEntity {
  id:       string;
  category: string;
  title:    string;
  subtitle: string;
  time?:    string;
  duration?: string;
  rating?:  number;
  tags:     string[];
  aiHighlight?: string;
}

export interface PublicDay {
  id:          string;
  date:        string;
  dayNumber:   number;
  destination: string;
  weather:     { temp: number; icon: string; condition: string };
  entities:    PublicEntity[];
}

export interface PublicTripPayload {
  v:           1;
  title:       string;
  destination: string;
  startDate:   string;
  endDate:     string;
  travelers:   number;
  days:        PublicDay[];
  generatedAt: number;
}

// ── Sensitive field list ──────────────────────────────────────────────────────

// These keys in PlacedEntity.details are NEVER shared
const BANNED_DETAIL_KEYS = new Set([
  'confirmationCode', 'confirmation', 'pnr', 'bookingRef',
  'email', 'emailAddress', 'phone', 'passport', 'passportNumber',
  'cardLast4', 'cardNumber', 'cvv', 'loyaltyNumber', 'frequentFlyerNumber',
  'price', 'totalPrice', 'pricePerNight', 'perNight', 'uberCost',
  'totalCost', 'cost', 'amount', 'fare', 'tax', 'fees',
  'refundable', 'carbon',
]);

// ── Entity sanitizer ──────────────────────────────────────────────────────────

function sanitizeEntity(e: PlacedEntity): PublicEntity {
  return {
    id:         e.id,
    category:   e.category,
    title:      e.title,
    subtitle:   e.subtitle,
    time:       e.time,
    duration:   e.duration,
    rating:     e.rating,
    tags:       e.tags,
    aiHighlight: e.aiHighlight,
    // price, booked, sourceId, placedAt, details — all omitted
  };
}

// ── Day sanitizer ─────────────────────────────────────────────────────────────

function sanitizeDay(day: EngineDay): PublicDay {
  return {
    id:          day.id,
    date:        day.date,
    dayNumber:   day.dayNumber,
    destination: day.destination,
    weather:     day.weather,
    entities:    day.entities.map(sanitizeEntity),
    // budget omitted
  };
}

// ── Trip sanitizer ────────────────────────────────────────────────────────────

export function sanitizeTripForSharing(params: {
  title:       string;
  startDate:   string;
  endDate:     string;
  travelers:   string[];
  days:        EngineDay[];
}): PublicTripPayload {
  const destination =
    params.days.find(d => d.destination)?.destination ??
    params.title ??
    'Trip';

  return {
    v:           1,
    title:       params.title || destination,
    destination,
    startDate:   params.startDate,
    endDate:     params.endDate,
    travelers:   params.travelers.length || 1,
    days:        params.days
      .filter(d => d.entities.length > 0)
      .map(sanitizeDay),
    generatedAt: Date.now(),
  };
}

// ── URL-safe base64 encoding ──────────────────────────────────────────────────

export function encodePayload(payload: PublicTripPayload): string {
  const json  = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let binary  = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g,  '');
}

export function decodePayload(shareId: string): PublicTripPayload | null {
  try {
    const base64 = shareId
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const binary  = atob(base64);
    const bytes   = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json) as PublicTripPayload;
    if (parsed.v !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}
