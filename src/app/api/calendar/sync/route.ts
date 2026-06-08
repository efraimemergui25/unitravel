import { NextRequest, NextResponse }             from 'next/server';
import { z }                                        from 'zod';
import { syncToCalendar, buildICSFile }             from '@/services/SyncMatrix';
import type { CalendarEvent }                       from '@/services/SyncMatrix';
import type { PlacedEntity, EngineDay }             from '@/store/useTravelEngine';

// ── Validation ────────────────────────────────────────────────────────────────

const PlacedEntitySchema = z.object({
  id:           z.string(),
  sourceId:     z.string(),
  category:     z.enum(['flight', 'hotel', 'restaurant', 'activity', 'transit']),
  title:        z.string(),
  subtitle:     z.string(),
  price:        z.number(),
  time:         z.string().optional(),
  duration:     z.string().optional(),
  rating:       z.number().optional(),
  sourceCount:  z.number(),
  aiConfidence: z.number(),
  tags:         z.array(z.string()),
  details:      z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  booked:       z.boolean(),
  placedAt:     z.number(),
  aiHighlight:  z.string().optional(),
});

const EngineDaySchema = z.object({
  id:          z.string(),
  date:        z.string(),
  dayNumber:   z.number(),
  destination: z.string(),
  entities:    z.array(PlacedEntitySchema),
  budget:      z.number(),
  weather:     z.object({ temp: z.number(), icon: z.string(), condition: z.string() }),
});

const SyncRequestSchema = z.object({
  days:        z.array(EngineDaySchema),
  tripName:    z.string().optional().default('My Unitravel Trip'),
  accessToken: z.string().optional(),
  timezone:    z.string().optional().default('UTC'),
  format:      z.enum(['ics', 'google']).optional().default('ics'),
});

// ── Entity → CalendarEvent converter ──────────────────────────────────────────

function entityToCalendarEvent(
  entity:      PlacedEntity,
  day:         EngineDay,
  timezone:    string,
): CalendarEvent {
  const dateStr    = day.date; // YYYY-MM-DD
  const timeStr    = entity.time ?? '09:00';
  const startISO   = `${dateStr}T${timeStr}:00`;

  // Parse duration like "2h", "1h 30m", "90m" → minutes
  let durationMins = 60;
  if (entity.duration) {
    const hoursMatch = entity.duration.match(/(\d+)h/);
    const minsMatch  = entity.duration.match(/(\d+)m/);
    const hours = hoursMatch ? parseInt(hoursMatch[1]!, 10) : 0;
    const mins  = minsMatch  ? parseInt(minsMatch[1!],  10) : 0;
    durationMins = (hours * 60) + mins || 60;
  }

  const startDate = new Date(`${startISO}`);
  const endDate   = new Date(startDate.getTime() + durationMins * 60_000);
  const endISO    = endDate.toISOString().replace(/\.\d{3}Z$/, '');

  const categoryEmoji: Record<string, string> = {
    flight:     '✈️',
    hotel:      '🏨',
    restaurant: '🍽️',
    activity:   '🎯',
    transit:    '🚌',
  };

  const emoji = categoryEmoji[entity.category] ?? '📍';

  return {
    id:          entity.id,
    title:       `${emoji} ${entity.title}`,
    description: [
      entity.subtitle,
      entity.aiHighlight ? `✦ ${entity.aiHighlight}` : '',
      entity.rating ? `★ ${entity.rating.toFixed(1)}` : '',
      entity.price > 0 ? `$${entity.price.toFixed(0)}/person` : '',
      entity.tags.join(' · '),
    ].filter(Boolean).join('\n'),
    location:    day.destination,
    startISO,
    endISO,
    allDay:      false,
    alerts:      [60, 1440], // 1 hour before + 1 day before
    color:       entity.category === 'flight' ? '#007AFF'
               : entity.category === 'hotel'  ? '#30D158'
               : entity.category === 'restaurant' ? '#FF9F0A'
               : entity.category === 'activity'   ? '#BF5AF2'
               : '#00C7BE',
    source:      'unitravel',
    metadata: {
      category:    entity.category,
      sourceCount: String(entity.sourceCount),
      confidence:  String(entity.aiConfidence),
      booked:      String(entity.booked),
    },
  };
}

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = SyncRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { days, tripName, accessToken, timezone, format } = parsed.data;

  // Convert all placed entities to CalendarEvent[]
  const events: CalendarEvent[] = (days as EngineDay[]).flatMap(day =>
    day.entities.map(entity => entityToCalendarEvent(entity, day, timezone)),
  );

  if (events.length === 0) {
    return NextResponse.json({ error: 'No entities to sync' }, { status: 400 });
  }

  // ── ICS download ────────────────────────────────────────────────────────────
  if (format === 'ics' || !accessToken) {
    const ics = buildICSFile(events, tripName);
    return new NextResponse(ics, {
      status: 200,
      headers: {
        'Content-Type':        'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="unitravel-trip.ics"`,
        'Cache-Control':       'no-store',
      },
    });
  }

  // ── Google Calendar push ─────────────────────────────────────────────────────
  const result = await syncToCalendar(events, 'google', accessToken);

  if (!result.success && result.synced === 0) {
    return NextResponse.json(
      { status: 'not_connected', message: 'Google Calendar not connected or token invalid.' },
      { status: 401 },
    );
  }

  return NextResponse.json({
    status:  'ok',
    synced:  result.synced,
    failed:  result.failed,
    total:   events.length,
    conflicts: result.conflicts.length,
    syncedAt:  result.syncedAt,
  });
}
