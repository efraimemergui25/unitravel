// Two-way calendar sync + hyper-anticipation peripheral logistics engine

export type CalendarProvider = 'google' | 'apple' | 'outlook';

export interface OAuthConfig {
  provider:     CalendarProvider;
  clientId:     string;
  redirectUri:  string;
  scopes:       string[];
}

export interface CalendarEvent {
  id?:          string;
  title:        string;
  description?: string;
  location?:    string;
  startISO:     string;
  endISO:       string;
  allDay?:      boolean;
  alerts:       number[]; // minutes before event
  color?:       string;
  url?:         string;
  source:       'unitravel' | 'external';
  metadata?:    Record<string, string>;
}

export interface SyncResult {
  success:       boolean;
  synced:        number;
  failed:        number;
  conflicts:     SyncConflict[];
  events:        CalendarEvent[];
  syncedAt:      number;
  nextSyncAt:    number;
}

export interface SyncConflict {
  externalId:   string;
  localEventId: string;
  type:         'TIME_OVERLAP' | 'DUPLICATE' | 'STALE';
  resolution:   'kept_local' | 'kept_external' | 'merged';
}

export interface PeripheralTask {
  id:          string;
  type:        'pet_boarding' | 'house_sitter' | 'mail_hold' | 'car_service' | 'custom';
  title:       string;
  description: string;
  scheduledFor: string; // ISO datetime
  reminderAt:  string;  // ISO datetime
  completed:   boolean;
  provider?:   string;
  cost?:       number;
  notes?:      string;
}

// ── OAuth URL builders ──────────────────────────────────────────────────────

const GOOGLE_AUTH_BASE = 'https://accounts.google.com/o/oauth2/v2/auth';
const APPLE_AUTH_BASE  = 'https://appleid.apple.com/auth/authorize';

export function buildOAuthUrl(config: OAuthConfig): string {
  if (config.provider === 'google') {
    const params = new URLSearchParams({
      client_id:     config.clientId,
      redirect_uri:  config.redirectUri,
      response_type: 'code',
      scope:         config.scopes.join(' '),
      access_type:   'offline',
      prompt:        'consent',
      state:         `unitravel_${Date.now()}`,
    });
    return `${GOOGLE_AUTH_BASE}?${params}`;
  }
  if (config.provider === 'apple') {
    const params = new URLSearchParams({
      client_id:     config.clientId,
      redirect_uri:  config.redirectUri,
      response_type: 'code id_token',
      scope:         'name email',
      state:         `unitravel_${Date.now()}`,
    });
    return `${APPLE_AUTH_BASE}?${params}`;
  }
  throw new Error(`Unsupported provider: ${config.provider}`);
}

// ── ICS builder (Apple Calendar / export) ──────────────────────────────────

function toICSDatetime(iso: string): string {
  return iso.replace(/[-:]/g, '').replace('.000Z', 'Z').split('.')[0] + 'Z';
}

export function buildICSFile(events: CalendarEvent[], calName = 'Unitravel Trip'): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Unitravel//AI Travel OS//EN',
    `X-WR-CALNAME:${calName}`,
    'X-WR-TIMEZONE:UTC',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const evt of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${evt.id || `unitravel-${Date.now()}-${Math.random().toString(36).slice(2)}`}`);
    lines.push(`DTSTAMP:${toICSDatetime(new Date().toISOString())}`);
    lines.push(`DTSTART:${toICSDatetime(evt.startISO)}`);
    lines.push(`DTEND:${toICSDatetime(evt.endISO)}`);
    lines.push(`SUMMARY:${evt.title.replace(/,/g, '\\,')}`);
    if (evt.description) lines.push(`DESCRIPTION:${evt.description.replace(/\n/g, '\\n').replace(/,/g, '\\,')}`);
    if (evt.location)    lines.push(`LOCATION:${evt.location.replace(/,/g, '\\,')}`);
    if (evt.url)         lines.push(`URL:${evt.url}`);
    if (evt.color)       lines.push(`COLOR:${evt.color}`);
    for (const mins of evt.alerts) {
      lines.push('BEGIN:VALARM');
      lines.push('ACTION:DISPLAY');
      lines.push(`DESCRIPTION:Reminder: ${evt.title}`);
      lines.push(`TRIGGER:-PT${mins}M`);
      lines.push('END:VALARM');
    }
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

// ── Google Calendar API helpers (scaffolded for real implementation) ─────────

export interface GoogleCalendarEvent {
  summary:     string;
  description: string;
  location?:   string;
  start:       { dateTime: string; timeZone: string };
  end:         { dateTime: string; timeZone: string };
  reminders?:  { useDefault: false; overrides: Array<{ method: string; minutes: number }> };
  colorId?:    string;
  source?:     { title: string; url: string };
}

export function toGoogleCalendarEvent(evt: CalendarEvent, timeZone = 'America/Mexico_City'): GoogleCalendarEvent {
  return {
    summary:     evt.title,
    description: evt.description || '',
    location:    evt.location,
    start:       { dateTime: evt.startISO, timeZone },
    end:         { dateTime: evt.endISO,   timeZone },
    reminders:   evt.alerts.length > 0 ? {
      useDefault: false,
      overrides:  evt.alerts.map(m => ({ method: 'popup', minutes: m })),
    } : undefined,
    colorId:     evt.color,
    source:      { title: 'Unitravel', url: 'https://unitravel.app' },
  };
}

// ── Mock sync engine (production: swap with real Google Calendar API) ────────

export async function syncToCalendar(
  events:   CalendarEvent[],
  provider: CalendarProvider,
  _token:   string // OAuth access token
): Promise<SyncResult> {
  // Simulate network latency
  await new Promise(r => setTimeout(r, 200 + Math.random() * 300));

  const conflicts: SyncConflict[] = [];
  const synced   = Math.floor(events.length * 0.95);
  const failed   = events.length - synced;

  return {
    success:    true,
    synced,
    failed,
    conflicts,
    events:     events.slice(0, synced),
    syncedAt:   Date.now(),
    nextSyncAt: Date.now() + 15 * 60_000, // 15 min
  };
}

// ── Hyper-Anticipation: Pet boarding auto-scheduling ─────────────────────────

export interface PetBoardingInput {
  petName:              string;
  outboundFlightISO:    string; // departure datetime
  returnFlightISO:      string; // landing datetime
  boardingFacilityName: string;
  boardingFacilityPhone?: string;
}

export function generatePetBoardingTasks(input: PetBoardingInput): {
  tasks:  PeripheralTask[];
  events: CalendarEvent[];
} {
  const outbound = new Date(input.outboundFlightISO);
  const returnLand = new Date(input.returnFlightISO);

  // Drop-off: 24h before outbound flight departure
  const dropOffISO = new Date(outbound.getTime() - 24 * 60 * 60_000).toISOString();
  // Pick-up: morning after return landing (08:00 local next day)
  const pickUpDate = new Date(returnLand);
  pickUpDate.setDate(pickUpDate.getDate() + 1);
  pickUpDate.setHours(8, 0, 0, 0);
  const pickUpISO = pickUpDate.toISOString();

  const tasks: PeripheralTask[] = [
    {
      id:           `pet-dropoff-${Date.now()}`,
      type:         'pet_boarding',
      title:        `Drop ${input.petName} at ${input.boardingFacilityName}`,
      description:  `${input.petName} boarding drop-off — 24 hours before TLV departure. Pack food, medication, and comfort toy.`,
      scheduledFor: dropOffISO,
      reminderAt:   new Date(new Date(dropOffISO).getTime() - 2 * 60 * 60_000).toISOString(),
      completed:    false,
      provider:     input.boardingFacilityName,
      notes:        input.boardingFacilityPhone ? `📞 ${input.boardingFacilityPhone}` : undefined,
    },
    {
      id:           `pet-pickup-${Date.now()}`,
      type:         'pet_boarding',
      title:        `Pick up ${input.petName} from ${input.boardingFacilityName}`,
      description:  `${input.petName} boarding pick-up — morning after return. Bring ID, payment, and a treat 🐾`,
      scheduledFor: pickUpISO,
      reminderAt:   new Date(pickUpDate.getTime() - 60 * 60_000).toISOString(),
      completed:    false,
      provider:     input.boardingFacilityName,
    },
  ];

  const events: CalendarEvent[] = [
    {
      id:          `pet-dropoff-cal-${Date.now()}`,
      title:       `🐾 Drop off ${input.petName} — ${input.boardingFacilityName}`,
      description: `Pre-honeymoon pet boarding drop-off.\nFacility: ${input.boardingFacilityName}${input.boardingFacilityPhone ? `\nPhone: ${input.boardingFacilityPhone}` : ''}`,
      location:    input.boardingFacilityName,
      startISO:    dropOffISO,
      endISO:      new Date(new Date(dropOffISO).getTime() + 60 * 60_000).toISOString(),
      alerts:      [120, 30],
      source:      'unitravel',
      metadata:    { tripId: 'honeymoon-mx-2026', petName: input.petName },
    },
    {
      id:          `pet-pickup-cal-${Date.now()}`,
      title:       `🐾 Pick up ${input.petName} — ${input.boardingFacilityName}`,
      description: `Post-honeymoon ${input.petName} pick-up 🎉\nFacility: ${input.boardingFacilityName}`,
      location:    input.boardingFacilityName,
      startISO:    pickUpISO,
      endISO:      new Date(pickUpDate.getTime() + 60 * 60_000).toISOString(),
      alerts:      [60],
      source:      'unitravel',
      metadata:    { tripId: 'honeymoon-mx-2026', petName: input.petName },
    },
  ];

  return { tasks, events };
}

// ── Full peripheral logistics generator ───────────────────────────────────────

export interface TripPeripherals {
  petBoarding?:  ReturnType<typeof generatePetBoardingTasks>;
  allTasks:      PeripheralTask[];
  allEvents:     CalendarEvent[];
  icsPayload:    string;
}

export function generateTripPeripherals(params: {
  outboundFlightISO: string;
  returnFlightISO:   string;
  pet?: { name: string; facility: string; phone?: string };
}): TripPeripherals {
  const allTasks:  PeripheralTask[] = [];
  const allEvents: CalendarEvent[]  = [];
  let petBoarding: ReturnType<typeof generatePetBoardingTasks> | undefined;

  // Pet boarding
  if (params.pet) {
    petBoarding = generatePetBoardingTasks({
      petName:              params.pet.name,
      outboundFlightISO:    params.outboundFlightISO,
      returnFlightISO:      params.returnFlightISO,
      boardingFacilityName: params.pet.facility,
      boardingFacilityPhone:params.pet.phone,
    });
    allTasks.push(...petBoarding.tasks);
    allEvents.push(...petBoarding.events);
  }

  // Auto-generate: mail hold 1 day before departure
  const mailHoldISO = new Date(new Date(params.outboundFlightISO).getTime() - 24 * 60 * 60_000).toISOString();
  allTasks.push({
    id:           `mail-hold-${Date.now()}`,
    type:         'mail_hold',
    title:        'Activate Israel Post mail hold',
    description:  'Hold mail during 3-week Mexico trip. Activate at israelpost.co.il',
    scheduledFor: mailHoldISO,
    reminderAt:   new Date(new Date(mailHoldISO).getTime() - 2 * 60 * 60_000).toISOString(),
    completed:    false,
  });

  // Pre-trip packing reminder: 48h before
  const packingISO = new Date(new Date(params.outboundFlightISO).getTime() - 48 * 60 * 60_000).toISOString();
  allEvents.push({
    id:          `packing-${Date.now()}`,
    title:       '🧳 Pack for Mexico Honeymoon',
    description: 'Check packing list: passports, travel insurance docs, currency, medication. Tommy drop-off tomorrow.',
    startISO:    packingISO,
    endISO:      new Date(new Date(packingISO).getTime() + 2 * 60 * 60_000).toISOString(),
    alerts:      [30],
    source:      'unitravel',
  });

  return {
    petBoarding,
    allTasks,
    allEvents,
    icsPayload: buildICSFile(allEvents, 'Unitravel — Mexico Honeymoon Peripherals'),
  };
}
