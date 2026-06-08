// OmniSyncEngine.ts
// Top-level orchestration: Zustand trip state → Google Calendar / Apple EventKit / ICS / WhatsApp
// Extends CalendarSync with GPS coordinates, Unitravel deep links, and booking manifests.

import type { PlacedEntity, EngineDay } from '@/store/useTravelEngine';
import { CalendarSync }                 from '@/services/CalendarSync';
import { entityToCalendarEvent }        from '@/services/CalendarSync';

// ── Destination registry ──────────────────────────────────────────────────────
// GPS coords + timezone for leading honeymoon / luxury travel destinations.
// Used to attach location data to calendar events and shareable links.

interface DestinationMeta {
  lat:      number;
  lng:      number;
  tz:       string;
  country:  string;
}

const DESTINATION_REGISTRY: Record<string, DestinationMeta> = {
  'tulum':            { lat: 20.2114,  lng: -87.4654,  tz: 'America/Cancun',        country: 'Mexico' },
  'mexico city':      { lat: 19.4326,  lng: -99.1332,  tz: 'America/Mexico_City',   country: 'Mexico' },
  'cdmx':             { lat: 19.4326,  lng: -99.1332,  tz: 'America/Mexico_City',   country: 'Mexico' },
  'los cabos':        { lat: 23.0597,  lng: -109.7068, tz: 'America/Mazatlan',      country: 'Mexico' },
  'cabo':             { lat: 23.0597,  lng: -109.7068, tz: 'America/Mazatlan',      country: 'Mexico' },
  'cancun':           { lat: 21.1619,  lng: -86.8515,  tz: 'America/Cancun',        country: 'Mexico' },
  'playa del carmen': { lat: 20.6296,  lng: -87.0739,  tz: 'America/Cancun',        country: 'Mexico' },
  'riviera maya':     { lat: 20.6296,  lng: -87.0739,  tz: 'America/Cancun',        country: 'Mexico' },
  'miami':            { lat: 25.7617,  lng: -80.1918,  tz: 'America/New_York',      country: 'USA' },
  'nassau':           { lat: 25.0480,  lng: -77.3554,  tz: 'America/Nassau',        country: 'Bahamas' },
  'bahamas':          { lat: 25.0480,  lng: -77.3554,  tz: 'America/Nassau',        country: 'Bahamas' },
  'tel aviv':         { lat: 32.0853,  lng: 34.7818,   tz: 'Asia/Jerusalem',        country: 'Israel' },
  'paris':            { lat: 48.8566,  lng: 2.3522,    tz: 'Europe/Paris',          country: 'France' },
  'tokyo':            { lat: 35.6762,  lng: 139.6503,  tz: 'Asia/Tokyo',            country: 'Japan' },
  'new york':         { lat: 40.7128,  lng: -74.0060,  tz: 'America/New_York',      country: 'USA' },
  'bali':             { lat: -8.4095,  lng: 115.1889,  tz: 'Asia/Makassar',         country: 'Indonesia' },
  'maldives':         { lat: 3.2028,   lng: 73.2207,   tz: 'Indian/Maldives',       country: 'Maldives' },
  'santorini':        { lat: 36.3932,  lng: 25.4615,   tz: 'Europe/Athens',         country: 'Greece' },
  'amalfi':           { lat: 40.6340,  lng: 14.6026,   tz: 'Europe/Rome',           country: 'Italy' },
  'dubai':            { lat: 25.2048,  lng: 55.2708,   tz: 'Asia/Dubai',            country: 'UAE' },
  'london':           { lat: 51.5074,  lng: -0.1278,   tz: 'Europe/London',         country: 'UK' },
  'rome':             { lat: 41.9028,  lng: 12.4964,   tz: 'Europe/Rome',           country: 'Italy' },
  'barcelona':        { lat: 41.3851,  lng: 2.1734,    tz: 'Europe/Madrid',         country: 'Spain' },
  'lisbon':           { lat: 38.7169,  lng: -9.1399,   tz: 'Europe/Lisbon',         country: 'Portugal' },
  'amsterdam':        { lat: 52.3676,  lng: 4.9041,    tz: 'Europe/Amsterdam',      country: 'Netherlands' },
  'sydney':           { lat: -33.8688, lng: 151.2093,  tz: 'Australia/Sydney',      country: 'Australia' },
  'singapore':        { lat: 1.3521,   lng: 103.8198,  tz: 'Asia/Singapore',        country: 'Singapore' },
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BookingEntry {
  id:               string;
  ref:              string;
  category:         PlacedEntity['category'];
  title:            string;
  subtitle:         string;
  price:            number;
  date:             string;
  destination:      string;
  deepLink:         string;
  googleMapsUrl?:   string;
  gps?:             { lat: number; lng: number };
  tz?:              string;
  booked:           boolean;
}

export interface BookingManifest {
  tripId:       string;
  tripTitle:    string;
  travelers:    string[];
  startDate:    string;
  endDate:      string;
  nights:       number;
  totalCost:    number;
  currency:     string;
  entries:      BookingEntry[];
  uniqueDests:  string[];
  exportedAt:   number;
  deepLink:     string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const APP_URL = typeof window !== 'undefined'
  ? window.location.origin
  : (process.env.NEXT_PUBLIC_APP_URL ?? 'https://unitravel.app');

export function getDestinationMeta(destination: string): DestinationMeta | null {
  const key = destination.toLowerCase().trim();
  return DESTINATION_REGISTRY[key] ?? null;
}

export function generateEntityDeepLink(entityId: string): string {
  return `${APP_URL}/booking/${entityId}`;
}

export function generateTripDeepLink(tripId: string): string {
  return `${APP_URL}/trip/${tripId || 'current'}`;
}

function buildGoogleMapsUrl(destination: string, meta: DestinationMeta | null): string {
  if (meta) {
    return `https://maps.google.com/?q=${meta.lat},${meta.lng}`;
  }
  return `https://maps.google.com/?q=${encodeURIComponent(destination)}`;
}

// ── Core exports ──────────────────────────────────────────────────────────────

/**
 * Builds a structured booking manifest from the current trip state.
 * Attaches booking references, GPS, deep links, and Google Maps URLs.
 */
export function buildBookingManifest(
  trip: {
    id: string; title: string; travelers: string[];
    startDate: string; endDate: string; nights: number; currency: string;
  },
  days: EngineDay[],
): BookingManifest {
  const entries: BookingEntry[] = days.flatMap(day =>
    day.entities.map(entity => {
      const ref  = `UNI-${entity.id.slice(-6).toUpperCase()}`;
      const meta = getDestinationMeta(day.destination);
      return {
        id:            entity.id,
        ref,
        category:      entity.category,
        title:         entity.title,
        subtitle:      entity.subtitle,
        price:         entity.price,
        date:          day.date,
        destination:   day.destination,
        deepLink:      generateEntityDeepLink(entity.id),
        googleMapsUrl: buildGoogleMapsUrl(day.destination, meta),
        gps:           meta ? { lat: meta.lat, lng: meta.lng } : undefined,
        tz:            meta?.tz,
        booked:        entity.booked,
      };
    })
  );

  const totalCost    = entries.reduce((s, e) => s + e.price, 0);
  const uniqueDests  = [...new Set(days.map(d => d.destination).filter(Boolean))];

  return {
    tripId:      trip.id,
    tripTitle:   trip.title || 'My Unitravel Trip',
    travelers:   trip.travelers,
    startDate:   trip.startDate,
    endDate:     trip.endDate,
    nights:      trip.nights,
    totalCost,
    currency:    trip.currency,
    entries,
    uniqueDests,
    exportedAt:  Date.now(),
    deepLink:    generateTripDeepLink(trip.id),
  };
}

/**
 * Downloads the trip as a .ics file (Apple Calendar / Google Calendar import).
 * Each event includes GPS, deep link, and booking reference in the description.
 */
export function triggerICSExport(days: EngineDay[], tripTitle: string): void {
  if (typeof window === 'undefined') return;
  CalendarSync.exportICS(days, tripTitle || 'Unitravel Trip');
}

/**
 * Generates a Google Calendar "add event" deep link for a single entity.
 * Opens Google Calendar's web form with all fields pre-filled.
 */
export function buildGoogleCalendarDeepLink(
  entity: PlacedEntity,
  day: EngineDay,
): string {
  const event   = entityToCalendarEvent(entity, day);
  const meta    = getDestinationMeta(day.destination);
  const deepLink = generateEntityDeepLink(entity.id);
  const ref      = `UNI-${entity.id.slice(-6).toUpperCase()}`;

  const details = [
    entity.subtitle || '',
    entity.aiHighlight ?? '',
    `Ref: ${ref}`,
    `View in Unitravel: ${deepLink}`,
    meta ? `📍 ${meta.lat.toFixed(4)}, ${meta.lng.toFixed(4)} (${meta.tz})` : '',
  ].filter(Boolean).join('\n');

  const params = new URLSearchParams({
    action:   'TEMPLATE',
    text:     event.title,
    details,
    location: meta
      ? `${day.destination} (${meta.lat.toFixed(4)}, ${meta.lng.toFixed(4)})`
      : day.destination,
    dates: `${event.startISO.replace(/[-:]/g, '').replace('.000Z', 'Z').split('.')[0]}Z/${event.endISO.replace(/[-:]/g, '').replace('.000Z', 'Z').split('.')[0]}Z`,
  });

  return `https://calendar.google.com/calendar/render?${params}`;
}

/**
 * Formats a WhatsApp-friendly trip summary.
 * Includes travelers, destinations, dates, item count, and deep link.
 */
export function buildWhatsAppShareText(manifest: BookingManifest): string {
  const title = manifest.travelers.length > 0
    ? `${manifest.travelers.join(' & ')}'s Trip`
    : manifest.tripTitle;

  const destList = manifest.uniqueDests.slice(0, 4).join(' → ');
  const nights   = manifest.nights > 0 ? ` · ${manifest.nights} nights` : '';
  const total    = `$${manifest.totalCost.toLocaleString()}`;
  const count    = manifest.entries.length;

  return [
    `✈️ *${title}*`,
    `📍 ${destList}${nights}`,
    `📅 ${manifest.startDate} → ${manifest.endDate}`,
    `🎫 ${count} item${count !== 1 ? 's' : ''} · ${total}`,
    ``,
    `🔗 ${manifest.deepLink}`,
    ``,
    `_Planned with Unitravel AI Travel OS_`,
  ].join('\n');
}

/**
 * Generates a WhatsApp share URL with the trip summary pre-filled.
 */
export function buildWhatsAppShareUrl(manifest: BookingManifest): string {
  return `https://wa.me/?text=${encodeURIComponent(buildWhatsAppShareText(manifest))}`;
}

/**
 * Generates an Instagram-caption-friendly trip summary (no deep link, plain text).
 */
export function buildInstagramCaption(manifest: BookingManifest): string {
  const title = manifest.travelers.length > 0
    ? `${manifest.travelers.join(' & ')}'s`
    : 'My';

  const nights   = manifest.nights > 0 ? `${manifest.nights}-night` : '';
  const destList = manifest.uniqueDests.slice(0, 3).join(', ');

  return [
    `${title} ${nights} journey: ${destList} 🌍`,
    ``,
    `${manifest.entries.filter(e => e.category === 'flight').length} flights · `,
    `${manifest.entries.filter(e => e.category === 'hotel').length} hotels · `,
    `${manifest.entries.filter(e => e.category === 'restaurant').length} dining experiences`,
    ``,
    `#travel #wanderlust #luxurytravel #honeymoon #unitravel`,
  ].join('');
}

// ── Singleton ─────────────────────────────────────────────────────────────────

export const OmniSyncEngine = {
  buildManifest:         buildBookingManifest,
  exportICS:             triggerICSExport,
  googleCalDeepLink:     buildGoogleCalendarDeepLink,
  whatsappShare:         buildWhatsAppShareUrl,
  instagramCaption:      buildInstagramCaption,
  destMeta:              getDestinationMeta,
  entityDeepLink:        generateEntityDeepLink,
  tripDeepLink:          generateTripDeepLink,
} as const;
