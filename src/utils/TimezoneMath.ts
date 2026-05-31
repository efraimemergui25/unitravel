'use client';

import { useMemo }          from 'react';
import { useTravelEngine }  from '@/store/useTravelEngine';

// ── IANA timezone registry ────────────────────────────────────────────────────

const TIMEZONE_MAP: Record<string, string> = {
  // Mexico
  'Mexico City':    'America/Mexico_City',
  'Tulum':          'America/Cancun',
  'Riviera Maya':   'America/Cancun',
  'Cancun':         'America/Cancun',
  'Cabo San Lucas': 'America/Mazatlan',
  'Los Cabos':      'America/Mazatlan',
  'Guadalajara':    'America/Mexico_City',
  'Puerto Vallarta':'America/Mexico_City',
  'Oaxaca':         'America/Mexico_City',
  // USA
  'New York':       'America/New_York',
  'Los Angeles':    'America/Los_Angeles',
  'Chicago':        'America/Chicago',
  'Miami':          'America/New_York',
  'San Francisco':  'America/Los_Angeles',
  'Las Vegas':      'America/Los_Angeles',
  'Seattle':        'America/Los_Angeles',
  'Boston':         'America/New_York',
  'Washington':     'America/New_York',
  'Austin':         'America/Chicago',
  'Denver':         'America/Denver',
  'Phoenix':        'America/Phoenix',
  'Honolulu':       'Pacific/Honolulu',
  // Israel
  'Tel Aviv':       'Asia/Jerusalem',
  'Jerusalem':      'Asia/Jerusalem',
  'Eilat':          'Asia/Jerusalem',
  'Haifa':          'Asia/Jerusalem',
  // Europe
  'London':         'Europe/London',
  'Paris':          'Europe/Paris',
  'Rome':           'Europe/Rome',
  'Barcelona':      'Europe/Madrid',
  'Madrid':         'Europe/Madrid',
  'Amsterdam':      'Europe/Amsterdam',
  'Berlin':         'Europe/Berlin',
  'Lisbon':         'Europe/Lisbon',
  'Athens':         'Europe/Athens',
  'Prague':         'Europe/Prague',
  'Vienna':         'Europe/Vienna',
  'Zurich':         'Europe/Zurich',
  'Copenhagen':     'Europe/Copenhagen',
  'Stockholm':      'Europe/Stockholm',
  // Asia
  'Tokyo':          'Asia/Tokyo',
  'Bangkok':        'Asia/Bangkok',
  'Singapore':      'Asia/Singapore',
  'Dubai':          'Asia/Dubai',
  'Bali':           'Asia/Makassar',
  'Hong Kong':      'Asia/Hong_Kong',
  'Seoul':          'Asia/Seoul',
  'Mumbai':         'Asia/Kolkata',
  'Delhi':          'Asia/Kolkata',
  'Bangalore':      'Asia/Kolkata',
  'Beijing':        'Asia/Shanghai',
  'Shanghai':       'Asia/Shanghai',
  'Taipei':         'Asia/Taipei',
  // South America
  'Buenos Aires':   'America/Argentina/Buenos_Aires',
  'São Paulo':      'America/Sao_Paulo',
  'Rio de Janeiro': 'America/Sao_Paulo',
  'Bogota':         'America/Bogota',
  'Lima':           'America/Lima',
  'Santiago':       'America/Santiago',
  // Africa
  'Cairo':          'Africa/Cairo',
  'Nairobi':        'Africa/Nairobi',
  'Lagos':          'Africa/Lagos',
  'Cape Town':      'Africa/Johannesburg',
  'Johannesburg':   'Africa/Johannesburg',
};

const DEFAULT_TIMEZONE = 'UTC';

// ── Resolver ──────────────────────────────────────────────────────────────────

export function resolveTimezone(destination: string): string {
  if (!destination) return DEFAULT_TIMEZONE;
  if (TIMEZONE_MAP[destination]) return TIMEZONE_MAP[destination];
  // Fuzzy: "Mexico City, Mexico" → check each key
  const lower = destination.toLowerCase();
  for (const [key, tz] of Object.entries(TIMEZONE_MAP)) {
    if (lower.includes(key.toLowerCase())) return tz;
  }
  return DEFAULT_TIMEZONE;
}

// ── UTC offset display ────────────────────────────────────────────────────────

export function formatUTCOffset(timezone: string): string {
  try {
    const fmt   = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'longOffset' });
    const parts = fmt.formatToParts(new Date());
    return parts.find(p => p.type === 'timeZoneName')?.value ?? 'UTC';
  } catch {
    return 'UTC';
  }
}

// ── LocalTime shape ───────────────────────────────────────────────────────────

export interface LocalTime {
  timezone:    string;
  displayHHMM: string;  // "14:30"
  display12h:  string;  // "2:30 PM"
  utcOffset:   string;  // "GMT-6"
  date:        string;  // "Mon, Oct 3"
}

// ── UTC → local ───────────────────────────────────────────────────────────────

export function utcToLocal(isoUTC: string, timezone: string): LocalTime {
  const date = new Date(isoUTC);

  const fmt24 = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const fmt12 = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, hour: 'numeric', minute: '2-digit', hour12: true,
  });
  const fmtDate = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, weekday: 'short', month: 'short', day: 'numeric',
  });
  const fmtOffset = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, timeZoneName: 'short',
  });

  const utcOffset = fmtOffset.formatToParts(date).find(p => p.type === 'timeZoneName')?.value ?? 'UTC';

  return {
    timezone,
    displayHHMM: fmt24.format(date),
    display12h:  fmt12.format(date),
    utcOffset,
    date:        fmtDate.format(date),
  };
}

// ── Local HH:MM → UTC ISO ─────────────────────────────────────────────────────
// Iterative correction: build a naive UTC guess, measure the local offset at
// that instant via Intl, then subtract the offset. One Newton step is exact
// for all non-DST-transition times; DST transitions are < 1min error.

export function localHHMMtoUTC(hhMM: string, dateStr: string, timezone: string): string {
  const [h, m] = hhMM.split(':').map(Number);
  const naiveUTC = new Date(`${dateStr}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00Z`);

  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year:     'numeric', month:  '2-digit', day:    '2-digit',
    hour:     '2-digit', minute: '2-digit', second: '2-digit',
    hour12:   false,
  });

  const getPart = (parts: Intl.DateTimeFormatPart[], type: string) =>
    parts.find(p => p.type === type)?.value ?? '00';

  const parts    = fmt.formatToParts(naiveUTC);
  const localAt  = new Date(
    `${getPart(parts,'year')}-${getPart(parts,'month')}-${getPart(parts,'day')}T` +
    `${getPart(parts,'hour')}:${getPart(parts,'minute')}:${getPart(parts,'second')}Z`
  );
  const offsetMs = localAt.getTime() - naiveUTC.getTime();
  return new Date(naiveUTC.getTime() - offsetMs).toISOString();
}

// ── Duration helpers ──────────────────────────────────────────────────────────

export function formatDuration(minutes: number, locale: 'en' | 'he' = 'en'): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (locale === 'he') {
    if (h > 0 && m > 0) return `${h} שע' ${m} דק'`;
    if (h > 0)           return `${h} שעות`;
    return `${m} דק'`;
  }
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0)           return `${h}h`;
  return `${m}m`;
}

// ── Gap detection ─────────────────────────────────────────────────────────────

export interface TimeGap {
  afterEntityId:  string;
  beforeEntityId: string | null;
  startISO:       string;
  endISO:         string | null;
  gapMinutes:     number;
  midpointISO:    string;
}

function parseDurationToMinutes(s?: string): number {
  if (!s) return 60;
  const h = parseInt(s.match(/(\d+)h/)?.[1] ?? '0');
  const m = parseInt(s.match(/(\d+)m/)?.[1] ?? '0');
  return h * 60 + m;
}

export function detectDayGaps(
  entities:      Array<{ id: string; time?: string; duration?: string }>,
  dayDate:       string,
  timezone:      string,
  minGapMinutes: number = 180,
): TimeGap[] {
  const timed = entities
    .filter(e => e.time)
    .sort((a, b) => a.time!.localeCompare(b.time!));

  if (timed.length < 2) return [];

  const gaps: TimeGap[] = [];

  for (let i = 0; i < timed.length - 1; i++) {
    const cur  = timed[i];
    const next = timed[i + 1];

    const curStartISO  = localHHMMtoUTC(cur.time!, dayDate, timezone);
    const curEndISO    = new Date(new Date(curStartISO).getTime() + parseDurationToMinutes(cur.duration) * 60_000).toISOString();
    const nextStartISO = localHHMMtoUTC(next.time!, dayDate, timezone);
    const gapMins      = (new Date(nextStartISO).getTime() - new Date(curEndISO).getTime()) / 60_000;

    if (gapMins >= minGapMinutes) {
      const midMs = (new Date(curEndISO).getTime() + new Date(nextStartISO).getTime()) / 2;
      gaps.push({
        afterEntityId:  cur.id,
        beforeEntityId: next.id,
        startISO:       curEndISO,
        endISO:         nextStartISO,
        gapMinutes:     Math.round(gapMins),
        midpointISO:    new Date(midMs).toISOString(),
      });
    }
  }

  return gaps;
}

// ── useDayTimezone hook ───────────────────────────────────────────────────────

export function useDayTimezone(dayId: string): {
  timezone:   string;
  utcOffset:  string;
  formatTime: (hhmm: string, date: string) => LocalTime;
} {
  const days = useTravelEngine(s => s.days);

  return useMemo(() => {
    const day      = days.find(d => d.id === dayId);
    const timezone = day ? resolveTimezone(day.destination) : DEFAULT_TIMEZONE;
    const utcOffset = formatUTCOffset(timezone);

    return {
      timezone,
      utcOffset,
      formatTime: (hhmm: string, date: string) =>
        utcToLocal(localHHMMtoUTC(hhmm, date, timezone), timezone),
    };
  }, [days, dayId]);
}
