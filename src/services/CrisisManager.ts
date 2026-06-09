export type CrisisType =
  | 'FLIGHT_DELAY'
  | 'HOTEL_CHECKIN_CONFLICT'
  | 'RESTAURANT_RESERVATION_CONFLICT'
  | 'TRANSFER_TOO_TIGHT'
  | 'WEATHER_ALERT'
  | 'BUDGET_THRESHOLD_BREACH';

export type ResolutionStrategy = 'PUSH_DOWNSTREAM' | 'RESCHEDULE_SINGLE' | 'BUDGET_THROTTLE' | 'ALERT_ONLY';
export type CrisisSeverity     = 'low' | 'medium' | 'high' | 'critical';

export interface TimelineMutation {
  id:       string;
  dayId:    string;
  entityId: string;
  field:    'time' | 'duration';
  oldValue: string;
  newValue: string;
}

export interface CrisisEvent {
  id:          string;
  type:        CrisisType;
  severity:    CrisisSeverity;
  triggeredAt: number;
  title:       string;
  resolution:  string;
  strategy:    ResolutionStrategy;
  mutations:   TimelineMutation[];
  canUndo:     boolean;
  undone:      boolean;
}

function addMinutesToTime(timeStr: string, minutes: number): string {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function parseDurationToMinutes(duration: string): number {
  const h = parseInt(duration.match(/(\d+)h/)?.[1] ?? '0');
  const m = parseInt(duration.match(/(\d+)m/)?.[1] ?? '0');
  return h * 60 + m;
}

export class CrisisManager {
  private intervalId:   ReturnType<typeof setInterval> | null = null;
  private firedFlights: Set<string> = new Set();

  constructor(
    private getDays:  () => Array<{ id: string; entities: Array<{ id: string; category: string; title: string; time?: string; duration?: string }> }>,
    private onCrisis: (event: CrisisEvent, mutations: TimelineMutation[]) => void,
  ) {}

  start(intervalMs = 90_000): void {
    // Delay first check by 12s to let the app fully mount
    setTimeout(() => this.runCheck(), 12_000);
    this.intervalId = setInterval(() => this.runCheck(), intervalMs);
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private runCheck(): void {
    const days = this.getDays();
    const allFlights = days.flatMap(d =>
      d.entities
        .filter(e => e.category === 'flight')
        .map(e => ({ entity: e, day: d }))
    );

    // ── Only check real flights in the user's actual timeline ──────────────
    // No synthetic alerts, no random delays.
    // A real conflict only fires when there is a genuine scheduling collision:
    // a downstream entity has less than 30 minutes of buffer after a flight lands.
    for (const { entity: flight, day } of allFlights) {
      if (this.firedFlights.has(flight.id)) continue;

      const crisis = this.detectTightTransfer(flight, day);
      if (crisis) {
        this.firedFlights.add(flight.id);
        this.onCrisis(crisis, crisis.mutations);
      }
    }
  }

  /** Fires only when a downstream entity has < 30 min buffer after a flight. */
  private detectTightTransfer(
    flight: { id: string; title: string; time?: string; duration?: string },
    day: { id: string; entities: Array<{ id: string; title: string; time?: string; duration?: string; category: string }> },
  ): CrisisEvent | null {
    const flightTime = flight.time;
    if (!flightTime) return null;
    const [fH, fM] = flightTime.split(':').map(Number);
    const flightDurationMins = parseDurationToMinutes(flight.duration ?? '2h 30m');
    const arrivalMins = fH * 60 + fM + flightDurationMins;
    const BUFFER = 30; // minutes

    const tight = day.entities.filter(e => {
      if (!e.time || e.id === flight.id) return false;
      const [eH, eM] = e.time.split(':').map(Number);
      const gap = eH * 60 + eM - arrivalMins;
      return gap >= 0 && gap < BUFFER;
    });

    if (tight.length === 0) return null;

    const mutations: TimelineMutation[] = tight.map(entity => ({
      id:       `mut-${entity.id}-${Date.now()}`,
      dayId:    day.id,
      entityId: entity.id,
      field:    'time' as const,
      oldValue: entity.time!,
      newValue: addMinutesToTime(entity.time!, BUFFER),
    }));

    const names = tight.slice(0, 2).map(e => e.title).join(', ');
    const extra = tight.length > 2 ? ` +${tight.length - 2} more` : '';

    return {
      id:          `crisis-transfer-${Date.now()}`,
      type:        'TRANSFER_TOO_TIGHT',
      severity:    'medium',
      triggeredAt: Date.now(),
      title:       `Tight transfer: ${flight.title}`,
      resolution:  `${names}${extra} buffer added — less than 30 min after landing.`,
      strategy:    'PUSH_DOWNSTREAM',
      mutations,
      canUndo:     true,
      undone:      false,
    };
  }

  private buildFlightDelayCrisis(
    flight: { id: string; title: string; time?: string; duration?: string },
    day: { id: string; entities: Array<{ id: string; title: string; time?: string; duration?: string; category: string }> },
    delayMinutes: number,
  ): CrisisEvent | null {
    const flightTime = flight.time ?? '07:00';
    const [fH, fM] = flightTime.split(':').map(Number);
    const flightDurationMins = parseDurationToMinutes(flight.duration ?? '2h 30m');
    const flightArrivalMins = fH * 60 + fM + flightDurationMins;

    const affected = day.entities.filter(e => {
      if (!e.time || e.id === flight.id) return false;
      const [eH, eM] = e.time.split(':').map(Number);
      return eH * 60 + eM >= flightArrivalMins;
    });

    if (affected.length === 0) return null;

    const mutations: TimelineMutation[] = affected.map(entity => ({
      id:       `mut-${entity.id}-${Date.now()}`,
      dayId:    day.id,
      entityId: entity.id,
      field:    'time' as const,
      oldValue: entity.time!,
      newValue: addMinutesToTime(entity.time!, delayMinutes),
    }));

    const names = affected.slice(0, 2).map(e => e.title).join(', ');
    const extra = affected.length > 2 ? ` +${affected.length - 2} more` : '';

    return {
      id:          `crisis-${Date.now()}`,
      type:        'FLIGHT_DELAY',
      severity:    delayMinutes >= 50 ? 'high' : 'medium',
      triggeredAt: Date.now(),
      title:       `${flight.title} delayed ${delayMinutes}m`,
      resolution:  `${names}${extra} pushed forward ${delayMinutes} minutes autonomously.`,
      strategy:    'PUSH_DOWNSTREAM',
      mutations,
      canUndo:     true,
      undone:      false,
    };
  }
}
