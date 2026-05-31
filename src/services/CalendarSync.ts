// Bridge layer: connects the Zustand travel store (PlacedEntity, EngineDay)
// to the SyncMatrix calendar utilities.

import {
  buildICSFile,
  buildOAuthUrl,
  syncToCalendar,
  generateTripPeripherals,
} from '@/services/SyncMatrix';
import type {
  CalendarEvent,
  CalendarProvider,
  SyncResult,
} from '@/services/SyncMatrix';
import type { PlacedEntity, EngineDay } from '@/store/useTravelEngine';

// ── Lookup maps ───────────────────────────────────────────────────────────────

const CATEGORY_EMOJI: Record<PlacedEntity['category'], string> = {
  flight:     '✈️',
  hotel:      '🏨',
  restaurant: '🍽',
  activity:   '🎭',
  transport:  '🚗',
};

const CATEGORY_COLORS: Record<PlacedEntity['category'], string> = {
  flight:     '#007AFF',
  hotel:      '#00C7BE',
  restaurant: '#FFD60A',
  activity:   '#30D158',
  transport:  '#5E5CE6',
};

const CATEGORY_ALERTS: Record<PlacedEntity['category'], number[]> = {
  flight:     [1440, 180, 60],
  hotel:      [1440, 60],
  restaurant: [60, 15],
  activity:   [60],
  transport:  [60],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Parse duration strings to total minutes.
 * "2h 30m" → 150  |  "3n" → 4320 (nights)  |  undefined → 60
 */
export function parseDurationToMinutes(duration?: string): number {
  if (!duration) return 60;

  let total = 0;

  // nights: e.g. "3n"
  const nightsMatch = duration.match(/(\d+(?:\.\d+)?)\s*n/i);
  if (nightsMatch) {
    total += parseFloat(nightsMatch[1]) * 24 * 60;
  }

  // hours: e.g. "2h"
  const hoursMatch = duration.match(/(\d+(?:\.\d+)?)\s*h/i);
  if (hoursMatch) {
    total += parseFloat(hoursMatch[1]) * 60;
  }

  // minutes: e.g. "30m"
  const minutesMatch = duration.match(/(\d+(?:\.\d+)?)\s*m(?!i)/i);
  if (minutesMatch) {
    total += parseFloat(minutesMatch[1]);
  }

  return total > 0 ? total : 60;
}

/**
 * Convert a PlacedEntity + its parent EngineDay into a CalendarEvent.
 */
export function entityToCalendarEvent(
  entity: PlacedEntity,
  day: EngineDay,
): CalendarEvent {
  const time = entity.time ?? '09:00';
  const [hourStr, minStr] = time.split(':');
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minStr, 10);

  const startDate = new Date(`${day.date}T00:00:00.000Z`);
  startDate.setUTCHours(hour, minute, 0, 0);
  const startISO = startDate.toISOString();

  const durationMins = parseDurationToMinutes(entity.duration);
  const endDate = new Date(startDate.getTime() + durationMins * 60_000);
  const endISO = endDate.toISOString();

  const descParts: string[] = [];
  if (entity.subtitle)    descParts.push(entity.subtitle);
  if (entity.aiHighlight) descParts.push(entity.aiHighlight);
  descParts.push(`💰 $${entity.price}`);
  if (entity.rating != null) descParts.push(`⭐ ${entity.rating}`);
  descParts.push(entity.booked ? '✅ Booked' : '⏳ Not booked');

  return {
    id:          entity.id,
    title:       `${CATEGORY_EMOJI[entity.category]} ${entity.title}`,
    description: descParts.join('\n'),
    location:    day.destination,
    startISO,
    endISO,
    alerts:      CATEGORY_ALERTS[entity.category] ?? [60],
    color:       CATEGORY_COLORS[entity.category],
    source:      'unitravel',
    metadata:    {
      entityId:   entity.id,
      category:   entity.category,
      dayId:      day.id,
      confidence: entity.aiConfidence.toString(),
    },
  };
}

/**
 * Flat-map all days and their entities into a CalendarEvent array.
 * Entities without a `time` field use '09:00' as default.
 */
export function daysToCalendarEvents(days: EngineDay[]): CalendarEvent[] {
  return days.flatMap(day =>
    day.entities.map(entity => entityToCalendarEvent(entity, day)),
  );
}

/**
 * Generate a complete .ics string for the trip, optionally merging
 * peripheral logistics (pet boarding, mail hold, packing reminders).
 */
export function generateTripICS(
  days: EngineDay[],
  tripTitle: string,
  peripherals?: Parameters<typeof generateTripPeripherals>[0],
): string {
  const tripEvents = daysToCalendarEvents(days);

  const peripheralEvents: CalendarEvent[] = peripherals
    ? generateTripPeripherals(peripherals).allEvents
    : [];

  return buildICSFile([...tripEvents, ...peripheralEvents], tripTitle);
}

/**
 * Trigger a browser-side download of an .ics file.
 */
export function downloadICS(filename: string, icsContent: string): void {
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), {
    href:     url,
    download: filename,
  });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── CalendarSync singleton ────────────────────────────────────────────────────

export const CalendarSync = {
  /** Convert entities from the store to CalendarEvent[]. */
  fromDays(days: EngineDay[]): CalendarEvent[] {
    return daysToCalendarEvents(days);
  },

  /**
   * Generate and download an .ics file for Apple Calendar / Outlook import.
   * Peripheral logistics are included when `peripherals` is provided.
   */
  exportICS(
    days: EngineDay[],
    tripTitle: string,
    peripherals?: Parameters<typeof generateTripPeripherals>[0],
  ): void {
    const icsContent = generateTripICS(days, tripTitle, peripherals);
    const filename   = `${tripTitle.replace(/[^a-z0-9]/gi, '_')}.ics`;
    downloadICS(filename, icsContent);
  },

  /**
   * Open Google OAuth popup so the user can authorise calendar access.
   */
  connectGoogle(clientId: string, redirectUri: string): void {
    const url = buildOAuthUrl({
      provider:    'google',
      clientId,
      redirectUri,
      scopes:      [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
      ],
    });
    window.open(url, 'google-calendar-oauth', 'width=500,height=600');
  },

  /** Push events to a calendar provider (mock sync engine). */
  async push(
    events:   CalendarEvent[],
    provider: CalendarProvider,
    token:    string,
  ): Promise<SyncResult> {
    return syncToCalendar(events, provider, token);
  },

  /** Count total placed entities across all days. */
  entityCount(days: EngineDay[]): number {
    return days.reduce((sum, day) => sum + day.entities.length, 0);
  },

  /** Return true if any day has at least one placed entity. */
  hasEntities(days: EngineDay[]): boolean {
    return days.some(day => day.entities.length > 0);
  },
};
