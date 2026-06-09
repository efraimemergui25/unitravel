// PayloadSanitizer.ts — Two-directional security layer:
//
//  OUTBOUND (sharing):  sanitizeTripForSharing / encodePayload / decodePayload
//    → strips all financial/PII data before creating a public share URL.
//
//  INBOUND (drag-drop): sanitizeIncomingDropPayload
//    → validates + clamps every field of a zone→timeline drag payload before it
//      enters the store. Prevents price injection, XSS in titles, and type confusion.

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

// ════════════════════════════════════════════════════════════════════════════
// INBOUND DROP PAYLOAD SANITIZER
// Called in TimelineSync.handleEntityDrop BEFORE any data enters the store.
// ════════════════════════════════════════════════════════════════════════════

import type { TimelineDropPayload } from './TimelineSync';

// Allowed entity types — anything else is rejected
const ALLOWED_TYPES = new Set(['flight', 'hotel', 'restaurant', 'activity', 'transport']);

// Title/subtitle max length — prevents DOM injection via long strings
const MAX_TITLE_LEN    = 120;
const MAX_SUBTITLE_LEN = 200;

// Price bounds — prevents store inflation attacks
const MIN_PRICE = 0;
const MAX_PRICE = 250_000;  // $250K per entity is the ceiling

// Source zone allowlist — only known zones can commit to the timeline
const ALLOWED_SOURCE_ZONES = new Set([
  'flights', 'lodging', 'dining', 'attractions', 'transit', 'concierge', 'ai',
]);

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function truncate(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return '';
  // Strip any HTML tags to prevent XSS via React dangerouslySetInnerHTML elsewhere
  const stripped = value.replace(/<[^>]*>/g, '').trim();
  return stripped.slice(0, maxLen);
}

export interface SanitizeResult {
  ok:      true;
  payload: TimelineDropPayload;
}

export interface SanitizeError {
  ok:     false;
  reason: string;
}

/**
 * Validates and clamps an incoming drag payload from any zone before it is
 * committed to the store via commitEventToTimeline / placeEntity.
 *
 * Returns { ok: true, payload } on success or { ok: false, reason } on rejection.
 * The caller is responsible for logging / showing a toast on rejection.
 */
export function sanitizeIncomingDropPayload(
  raw: unknown,
): SanitizeResult | SanitizeError {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, reason: 'Payload must be an object.' };
  }

  const r = raw as Record<string, unknown>;

  // ── id ────────────────────────────────────────────────────────────────────
  if (typeof r.id !== 'string' || r.id.trim().length === 0) {
    return { ok: false, reason: 'Missing or empty id.' };
  }
  const id = r.id.trim().slice(0, 64); // cap id length

  // ── type ──────────────────────────────────────────────────────────────────
  if (typeof r.type !== 'string' || !ALLOWED_TYPES.has(r.type)) {
    return { ok: false, reason: `Invalid type "${r.type}". Allowed: ${[...ALLOWED_TYPES].join(', ')}.` };
  }
  const type = r.type as TimelineDropPayload['type'];

  // ── title ─────────────────────────────────────────────────────────────────
  const title = truncate(r.title, MAX_TITLE_LEN);
  if (title.length === 0) {
    return { ok: false, reason: 'Title must not be empty after sanitization.' };
  }

  // ── subtitle ──────────────────────────────────────────────────────────────
  const subtitle = truncate(r.subtitle, MAX_SUBTITLE_LEN);

  // ── price ─────────────────────────────────────────────────────────────────
  const rawPrice = typeof r.price === 'number' ? r.price : parseFloat(String(r.price ?? '0'));
  if (!isFinite(rawPrice)) {
    return { ok: false, reason: 'Price must be a finite number.' };
  }
  const price = clamp(Math.round(rawPrice), MIN_PRICE, MAX_PRICE);

  // ── currency ──────────────────────────────────────────────────────────────
  // Normalize to uppercase 3-letter code; default to USD
  const rawCurrency = typeof r.currency === 'string' ? r.currency.toUpperCase().trim() : 'USD';
  const currency    = /^[A-Z]{3}$/.test(rawCurrency) ? rawCurrency : 'USD';

  // ── icon ──────────────────────────────────────────────────────────────────
  const icon = typeof r.icon === 'string' ? r.icon.trim().slice(0, 4) : '';

  // ── sourceZone ────────────────────────────────────────────────────────────
  const rawZone   = typeof r.sourceZone === 'string' ? r.sourceZone.toLowerCase().trim() : '';
  const sourceZone = ALLOWED_SOURCE_ZONES.has(rawZone) ? rawZone : 'general';

  return {
    ok: true,
    payload: { id, type, title, subtitle, price, currency, icon, sourceZone },
  };
}
