// ICS (iCalendar) export — client-side, no deps.

import type { EngineDay, PlacedEntity } from '@/store/useTravelEngine';

function fmt(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export function buildICS(days: EngineDay[], tripTitle: string): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Unitravel//AI Travel OS//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(tripTitle || 'My Trip')}`,
  ];

  for (const day of days) {
    const base = day.date ? new Date(`${day.date}T08:00:00`) : new Date();
    const end  = new Date(base);
    end.setHours(23, 0, 0, 0);

    const desc = day.entities
      .map((e: PlacedEntity) => `${e.category}: ${e.title}${e.price ? ` ($${e.price})` : ''}`)
      .join('\\n');

    lines.push(
      'BEGIN:VEVENT',
      `UID:unitravel-day-${day.id}@unitravel.app`,
      `DTSTAMP:${fmt(new Date())}`,
      `DTSTART:${fmt(base)}`,
      `DTEND:${fmt(end)}`,
      `SUMMARY:${esc(`Day ${day.dayNumber}${day.destination ? ` — ${day.destination}` : ''}`)}`,
      ...(desc ? [`DESCRIPTION:${desc}`] : []),
      ...(day.destination ? [`LOCATION:${esc(day.destination)}`] : []),
      'END:VEVENT',
    );

    // Per-entity events for flights and hotels
    for (const entity of day.entities) {
      if (entity.category !== 'flight' && entity.category !== 'hotel') continue;
      const startH = entity.time ? parseInt(entity.time.split(':')[0]) : (entity.category === 'hotel' ? 14 : 10);
      const startTime = new Date(`${day.date}T${String(startH).padStart(2,'0')}:00:00`);
      const durH = entity.duration ? parseInt(entity.duration) : 2;
      const endTime = new Date(startTime.getTime() + durH * 3_600_000);

      const emoji = entity.category === 'flight' ? '✈' : '🏨';
      lines.push(
        'BEGIN:VEVENT',
        `UID:unitravel-entity-${entity.id}@unitravel.app`,
        `DTSTAMP:${fmt(new Date())}`,
        `DTSTART:${fmt(startTime)}`,
        `DTEND:${fmt(endTime)}`,
        `SUMMARY:${esc(`${emoji} ${entity.title}`)}`,
        `DESCRIPTION:${esc(`${entity.subtitle} · $${entity.price}${entity.aiHighlight ? ` · ${entity.aiHighlight}` : ''}`)}`,
        ...(day.destination ? [`LOCATION:${esc(day.destination)}`] : []),
        'END:VEVENT',
      );
    }
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadICS(days: EngineDay[], tripTitle: string): void {
  const content = buildICS(days, tripTitle);
  const blob    = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement('a');
  a.href        = url;
  a.download    = `${(tripTitle || 'unitravel-trip').replace(/\s+/g, '-').toLowerCase()}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}
