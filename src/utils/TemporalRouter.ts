// Core time-management utility — transit injection, disruption cascades, conflict detection

export type TimeBlock = {
  id:          string;
  type:        'flight' | 'hotel' | 'restaurant' | 'activity' | 'transport' | 'transit' | 'buffer';
  title:       string;
  startISO:    string; // ISO-8601 datetime
  endISO:      string;
  durationMin: number;
  dayId:       string;
  entityId?:   string;
  injected?:   boolean; // auto-inserted by engine
  conflict?:   ConflictType;
};

export type ConflictType =
  | 'MISSED_RESERVATION'
  | 'OVERLAPPING_EVENTS'
  | 'INSUFFICIENT_TRANSIT'
  | 'HOTEL_CHECKOUT_CLASH'
  | 'FLIGHT_GATE_RISK';

export type TemporalDisruption = {
  disruptionId:   string;
  entityId:       string;
  delayMinutes:   number;
  cascadeCount:   number;
  conflicts:      ResolvedConflict[];
  shiftedBlocks:  TimeBlock[];
  appliedAt:      number;
};

export type ResolvedConflict = {
  blockId:     string;
  type:        ConflictType;
  severity:    'warning' | 'critical';
  description: string;
  resolution:  'shifted' | 'flagged' | 'cancelled';
};

export type TransitBlock = TimeBlock & {
  type:        'transit';
  provider:    'Uber' | 'Taxi' | 'Walk' | 'Shuttle' | 'Hotel Transfer';
  distanceKm:  number;
  costUSD:     number;
  injected:    true;
};

// ── Coordinate data for Mexico destinations ────────────────────────────────

const COORDS: Record<string, { lat: number; lng: number }> = {
  // Mexico City
  'Four Seasons Mexico City':    { lat: 19.4284, lng: -99.1678 },
  'Pujol':                       { lat: 19.4329, lng: -99.1939 },
  'Quintonil':                   { lat: 19.4332, lng: -99.1941 },
  'Benito Juárez Int Airport':   { lat: 19.4363, lng: -99.0721 },
  // Tulum
  'Azulik Resort':               { lat: 20.1416, lng: -87.4655 },
  'Hartwood':                    { lat: 20.1608, lng: -87.4573 },
  'Tulum Int Airport':           { lat: 20.0272, lng: -87.5044 },
  // Riviera Maya
  'Rosewood Mayakoba':           { lat: 20.6945, lng: -87.0659 },
  'Cancun Airport':              { lat: 21.0365, lng: -86.8771 },
  // Cabo San Lucas
  'One&Only Palmilla':           { lat: 23.0444, lng: -109.7155 },
  'El Farallon':                 { lat: 22.8875, lng: -109.8969 },
  'Los Cabos Airport':           { lat: 23.1538, lng: -109.7213 },
};

// ── Haversine distance ─────────────────────────────────────────────────────

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R    = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
    Math.cos((b.lat * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// ── Transit time estimation ────────────────────────────────────────────────

export type TransitEstimate = {
  minutes:    number;
  distanceKm: number;
  costUSD:    number;
  provider:   TransitBlock['provider'];
  confidence: number; // 0–1
};

export function estimateTransit(
  origin:      string,
  destination: string,
  timeOfDay:   string // "HH:MM"
): TransitEstimate {
  const o = COORDS[origin];
  const d = COORDS[destination];

  if (!o || !d) {
    // Fallback: estimate from name similarity / destination cluster
    return {
      minutes:    20,
      distanceKm: 5,
      costUSD:    12,
      provider:   'Uber',
      confidence: 0.4,
    };
  }

  const km      = haversineKm(o, d);
  const [h]     = timeOfDay.split(':').map(Number);
  const rushHourMultiplier = (h >= 7 && h <= 9) || (h >= 17 && h <= 19) ? 1.45 : 1.0;
  const speedKmh = 28 * rushHourMultiplier; // urban avg
  const minutes  = Math.ceil((km / speedKmh) * 60) + 5; // +5 min pickup buffer
  const costUSD  = Math.round(km * 1.8 + 4); // ~$1.8/km + base

  const provider: TransitBlock['provider'] =
    km < 0.5 ? 'Walk' :
    km < 3   ? 'Uber' :
    km > 40  ? 'Hotel Transfer' : 'Uber';

  return { minutes, distanceKm: km, costUSD, provider, confidence: 0.82 };
}

// ── Parse ISO to minutes-since-midnight ────────────────────────────────────

function isoToMinutes(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

function addMinutesToISO(iso: string, mins: number): string {
  const d = new Date(new Date(iso).getTime() + mins * 60_000);
  return d.toISOString();
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ── Inject transit block before an event ──────────────────────────────────

export function injectTransitBlock(
  targetBlock: TimeBlock,
  origin:      string,
  estimate:    TransitEstimate
): TransitBlock {
  const departureISO = addMinutesToISO(targetBlock.startISO, -estimate.minutes - 5);
  return {
    id:          `transit-${targetBlock.id}-${Date.now()}`,
    type:        'transit',
    title:       `${estimate.provider} → ${targetBlock.title.split('·')[0].trim()}`,
    startISO:    departureISO,
    endISO:      targetBlock.startISO,
    durationMin: estimate.minutes + 5,
    dayId:       targetBlock.dayId,
    entityId:    targetBlock.entityId,
    injected:    true,
    provider:    estimate.provider,
    distanceKm:  estimate.distanceKm,
    costUSD:     estimate.costUSD,
    confidence:  estimate.confidence,
  } as TransitBlock;
}

// ── Overlap detection ──────────────────────────────────────────────────────

export function detectOverlap(a: TimeBlock, b: TimeBlock): boolean {
  const aStart = new Date(a.startISO).getTime();
  const aEnd   = new Date(a.endISO).getTime();
  const bStart = new Date(b.startISO).getTime();
  const bEnd   = new Date(b.endISO).getTime();
  return aStart < bEnd && bStart < aEnd;
}

// ── Core: handleTemporalDisruption ────────────────────────────────────────

/**
 * When a flight/event is delayed by delayMinutes, recursively cascade-shift
 * all subsequent blocks on the same day and flag hard conflicts.
 */
export function handleTemporalDisruption(
  allBlocks:    TimeBlock[],
  disruptedId:  string,
  delayMinutes: number
): TemporalDisruption {
  const disrupted = allBlocks.find(b => b.id === disruptedId);
  if (!disrupted) {
    return {
      disruptionId:   `disruption-${Date.now()}`,
      entityId:       disruptedId,
      delayMinutes,
      cascadeCount:   0,
      conflicts:      [],
      shiftedBlocks:  [],
      appliedAt:      Date.now(),
    };
  }

  // Sort all blocks on same day chronologically
  const dayBlocks = allBlocks
    .filter(b => b.dayId === disrupted.dayId)
    .sort((a, b) => new Date(a.startISO).getTime() - new Date(b.startISO).getTime());

  const disruptedIndex = dayBlocks.findIndex(b => b.id === disruptedId);
  const shiftedBlocks:   TimeBlock[]         = [];
  const resolvedConflicts: ResolvedConflict[] = [];

  // Shift the disrupted block
  const shiftedDisrupted: TimeBlock = {
    ...disrupted,
    startISO: addMinutesToISO(disrupted.startISO, delayMinutes),
    endISO:   addMinutesToISO(disrupted.endISO,   delayMinutes),
  };
  shiftedBlocks.push(shiftedDisrupted);

  // Cascade to all subsequent blocks
  let accumulatedDelay = delayMinutes;

  for (let i = disruptedIndex + 1; i < dayBlocks.length; i++) {
    const block   = dayBlocks[i];
    const shifted = {
      ...block,
      startISO: addMinutesToISO(block.startISO, accumulatedDelay),
      endISO:   addMinutesToISO(block.endISO,   accumulatedDelay),
    };
    shiftedBlocks.push(shifted);

    // Conflict checks
    const newStart = isoToMinutes(shifted.startISO);

    if (block.type === 'restaurant') {
      // Restaurants have hard reservation windows — flag if > 30 min late
      if (accumulatedDelay > 30) {
        resolvedConflicts.push({
          blockId:     block.id,
          type:        'MISSED_RESERVATION',
          severity:    accumulatedDelay > 60 ? 'critical' : 'warning',
          description: `Reservation at "${block.title}" pushed ${accumulatedDelay}min late. Contact OpenTable immediately.`,
          resolution:  accumulatedDelay > 90 ? 'cancelled' : 'shifted',
        });
      }
    }

    if (block.type === 'flight') {
      // Flight gate risk: < 90 min before departure
      const gateBuffer = newStart - (isoToMinutes(shifted.startISO) - accumulatedDelay);
      if (accumulatedDelay > 45) {
        resolvedConflicts.push({
          blockId:     block.id,
          type:        'FLIGHT_GATE_RISK',
          severity:    'critical',
          description: `Connecting flight "${block.title}" has only ${90 - accumulatedDelay}min buffer. Recommend rebooking.`,
          resolution:  'flagged',
        });
      }
      // Flights don't cascade further — their delay is their own
      accumulatedDelay = 0;
    }

    if (block.type === 'hotel' && block.title.toLowerCase().includes('check')) {
      resolvedConflicts.push({
        blockId:     block.id,
        type:        'HOTEL_CHECKOUT_CLASH',
        severity:    'warning',
        description: `Hotel "${block.title}" check-in shifted to ${formatTime(shifted.startISO)}. Concierge auto-notified.`,
        resolution:  'shifted',
      });
    }
  }

  return {
    disruptionId:  `disruption-${disruptedId}-${Date.now()}`,
    entityId:      disruptedId,
    delayMinutes,
    cascadeCount:  shiftedBlocks.length,
    conflicts:     resolvedConflicts,
    shiftedBlocks,
    appliedAt:     Date.now(),
  };
}

// ── Build full day timeline with transit injection ─────────────────────────

export function buildDayTimeline(
  blocks:      TimeBlock[],
  hotelName:   string
): TimeBlock[] {
  const sorted = [...blocks].sort(
    (a, b) => new Date(a.startISO).getTime() - new Date(b.startISO).getTime()
  );
  const result: TimeBlock[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const block = sorted[i];

    if (i > 0 && !block.injected) {
      // Inject transit block from hotel (or previous location)
      const origin   = i === 0 ? hotelName : hotelName;
      const estimate = estimateTransit(origin, block.title.split('·')[0].trim(), formatTime(block.startISO));
      if (estimate.minutes > 5) {
        result.push(injectTransitBlock(block, origin, estimate));
      }
    }

    result.push(block);
  }

  return result;
}

// ── Validate day for conflicts ─────────────────────────────────────────────

export type DayValidation = {
  valid:     boolean;
  conflicts: Array<{ blockA: string; blockB: string; type: ConflictType; message: string }>;
  warnings:  string[];
};

export function validateDayTimeline(blocks: TimeBlock[]): DayValidation {
  const sorted = [...blocks].sort(
    (a, b) => new Date(a.startISO).getTime() - new Date(b.startISO).getTime()
  );
  const conflicts: DayValidation['conflicts'] = [];
  const warnings:  string[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      if (detectOverlap(sorted[i], sorted[j])) {
        conflicts.push({
          blockA:  sorted[i].id,
          blockB:  sorted[j].id,
          type:    'OVERLAPPING_EVENTS',
          message: `"${sorted[i].title}" overlaps "${sorted[j].title}" by ${
            Math.round(
              (new Date(sorted[i].endISO).getTime() - new Date(sorted[j].startISO).getTime()) / 60_000
            )
          }min`,
        });
      }
    }

    // Check transit gap
    const gap = (new Date(sorted[i + 1].startISO).getTime() - new Date(sorted[i].endISO).getTime()) / 60_000;
    if (gap < 0) continue;
    if (gap < 15 && !sorted[i + 1].injected) {
      warnings.push(`Only ${Math.round(gap)}min gap between "${sorted[i].title}" and "${sorted[i + 1].title}"`);
    }
  }

  return { valid: conflicts.length === 0, conflicts, warnings };
}
