'use client';

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { AggregatedResult, AggregatedFlight, AggregatedLodging, AggregatedDining, OmniAggregator, AggregatorProgress } from '@/services/OmniAggregator';
import { FinancialEngine, TravelDNA, BurnSchedule } from '@/utils/FinancialEngine';
import type { CrisisEvent, TimelineMutation } from '@/services/CrisisManager';

export type { TravelDNA, BurnSchedule } from '@/utils/FinancialEngine';
export type { CrisisEvent, TimelineMutation } from '@/services/CrisisManager';

// ── Types ─────────────────────────────────────────────────────────────────────

export type EntityCategory = 'flight' | 'hotel' | 'restaurant' | 'activity' | 'transport';

// ── Categorical Chat Memory ───────────────────────────────────────────────────

export type ChatCategory =
  | 'aviation' | 'lodging' | 'culinary' | 'budget'
  | 'destinations' | 'activities' | 'general';

export interface CategorizedMessage {
  id:         string;
  sessionId:  string;
  role:       'user' | 'assistant';
  text:       string;
  category:   ChatCategory;
  toolsUsed?: string[];
  timestamp:  number;
  entityRef?: { id: string; title: string; price: number; dayId?: string };
}

export function inferChatCategory(text: string, toolsUsed: string[]): ChatCategory {
  if (toolsUsed.some(t => /financial|budget|adjust/i.test(t))) return 'budget';
  const l = text.toLowerCase();
  if (/flight|airline|airport|layover|non.?stop|departure|arrival|cabin|economy|business/.test(l)) return 'aviation';
  if (/hotel|lodge|villa|resort|airbnb|hostel|room|suite|check.?in|check.?out|nights/.test(l))    return 'lodging';
  if (/restaurant|food|dining|michelin|cuisine|eat|lunch|dinner|chef|reservation|tasting/.test(l)) return 'culinary';
  if (/budget|price|cost|expensive|cheap|afford|spend|total|breakdown/.test(l))                   return 'budget';
  if (/activity|tour|experience|attraction|museum|hike|excursion|adventure|snorkel/.test(l))      return 'activities';
  if (/destination|city|country|region|tulum|cabo|cdmx|cancun|riviera|mexico/.test(l))            return 'destinations';
  return 'general';
}

export interface PlacedEntity {
  id:            string;
  sourceId:      string;
  category:      EntityCategory;
  title:         string;
  subtitle:      string;
  price:         number;
  time?:         string;
  duration?:     string;
  rating?:       number;
  sourceCount:   number;
  aiConfidence:  number;
  tags:          string[];
  details:       Record<string, string | number | boolean>;
  booked:        boolean;
  placedAt:      number;
  aiHighlight?:  string;
}

export interface EngineDay {
  id:          string;
  date:        string;
  dayNumber:   number;
  destination: string;
  entities:    PlacedEntity[];
  budget:      number;
  weather:     { temp: number; icon: string; condition: string };
}

export interface BudgetProjection {
  total:         number;
  spent:         number;
  committed:     number;
  projected:     number;
  dailyAllowance:number;
  burnRate:      number;
  regressionSlope: number;
  overBudgetBy?: number;
  breakdown:     Record<EntityCategory, number>;
  dayBreakdown:  Array<{ dayId: string; date: string; spent: number; budget: number; overBudget: boolean }>;
}

export interface AIPipeline {
  status:           'idle' | 'scanning' | 'ranking' | 'ready' | 'error';
  progress:         AggregatorProgress | null;
  suggestions:      AggregatedResult[];
  placedIds:        Set<string>;
  lastRunAt:        number | null;
  processingMs:     number | null;
  sourcesQueried:   number;
}

export interface TravelEngineState {
  trip: {
    id:          string;
    title:       string;
    travelers:   string[];
    startDate:   string;
    endDate:     string;
    nights:      number;
    currency:    'USD';
  };
  days:               EngineDay[];
  budget:             BudgetProjection;
  pipeline:           AIPipeline;
  activeDay:          string | null;
  dragging:           AggregatedResult | PlacedEntity | null;
  dnaProfile:         TravelDNA | null;
  burnSchedule:       BurnSchedule | null;
  onboardingComplete: boolean;
  crisisHistory:      CrisisEvent[];
  chatHistory:        CategorizedMessage[];
}

// ── Initial mock days ────────────────────────────────────────────────────────

const DESTINATIONS = [
  { city: 'Mexico City',    days: 4 },
  { city: 'Tulum',          days: 5 },
  { city: 'Riviera Maya',   days: 7 },
  { city: 'Cabo San Lucas', days: 5 },
];

const WEATHER = [
  { temp: 28, icon: '☀️', condition: 'Sunny' },
  { temp: 31, icon: '⛅', condition: 'Partly Cloudy' },
  { temp: 27, icon: '🌤', condition: 'Mostly Clear' },
  { temp: 30, icon: '☀️', condition: 'Clear' },
];

const buildInitialDays = (): EngineDay[] => {
  const days: EngineDay[] = [];
  let n = 1;
  const base = new Date('2026-10-01');

  for (const dest of DESTINATIONS) {
    for (let i = 0; i < dest.days; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + n - 1);
      days.push({
        id:          `day-${n}`,
        date:        d.toISOString().split('T')[0],
        dayNumber:   n,
        destination: dest.city,
        entities:    [],
        budget:      2800,
        weather:     WEATHER[(n - 1) % WEATHER.length],
      });
      n++;
    }
  }
  return days;
};

const TOTAL_BUDGET = 42000;

const buildInitialBudget = (days: EngineDay[]): BudgetProjection => ({
  total:          TOTAL_BUDGET,
  spent:          0,
  committed:      0,
  projected:      0,
  dailyAllowance: TOTAL_BUDGET / days.length,
  burnRate:       0,
  regressionSlope: 0,
  breakdown:      { flight: 0, hotel: 0, restaurant: 0, activity: 0, transport: 0 },
  dayBreakdown:   days.map(d => ({ dayId: d.id, date: d.date, spent: 0, budget: d.budget, overBudget: false })),
});

// ── Store ─────────────────────────────────────────────────────────────────────

interface TravelEngineActions {
  // Pipeline
  runAIPipeline:    () => Promise<void>;
  // Drag & Drop
  setDragging:      (entity: AggregatedResult | PlacedEntity | null) => void;
  placeEntity:      (dayId: string, source: AggregatedResult) => void;
  removeEntity:     (dayId: string, entityId: string) => void;
  toggleBooked:     (dayId: string, entityId: string) => void;
  // Day navigation
  setActiveDay:     (id: string | null) => void;
  // DNA onboarding
  completeTravelDNA: (dna: TravelDNA) => void;
  // Budget engine
  calculatePredictiveBudget: () => void;
  // DNA live patch (called by AI adjustDNA tool result)
  patchDNA: (field: string, value: number) => void;
  // Crisis / mutation
  applyMutations: (mutations: TimelineMutation[], event: CrisisEvent) => void;
  revertCrisis:   (crisisId: string) => void;
  // Intra-day reorder with time-slot redistribution
  reorderDayEntities: (dayId: string, newOrder: PlacedEntity[]) => void;
  // Chat memory
  addChatMessage:   (msg: Omit<CategorizedMessage, 'timestamp'>) => void;
  clearChatHistory: () => void;
}

type TravelEngineStore = TravelEngineState & TravelEngineActions;

const initialDays = buildInitialDays();

export const useTravelEngine = create<TravelEngineStore>()(
  immer((set, get) => ({
    trip: {
      id:        'honeymoon-mx-2026',
      title:     'Effi & Nofar · Honeymoon · Mexico',
      travelers: ['Effi', 'Nofar'],
      startDate: '2026-10-01',
      endDate:   '2026-10-21',
      nights:    21,
      currency:  'USD',
    },
    days:      initialDays,
    budget:    buildInitialBudget(initialDays),
    pipeline:  {
      status:         'idle',
      progress:       null,
      suggestions:    [],
      placedIds:      new Set(),
      lastRunAt:      null,
      processingMs:   null,
      sourcesQueried: 0,
    },
    activeDay:          'day-1',
    dragging:           null,
    dnaProfile:         null,
    burnSchedule:       null,
    onboardingComplete: false,
    crisisHistory:      [],
    chatHistory:        [],

    // ── AI Pipeline ──────────────────────────────────────────────────────────
    runAIPipeline: async () => {
      set(s => { s.pipeline.status = 'scanning'; s.pipeline.progress = null; });

      // Stream progress ticks
      const progressGen = OmniAggregator.streamProgress();
      const streamLoop = (async () => {
        for await (const tick of progressGen) {
          set(s => {
            s.pipeline.progress = tick;
            if (tick.phase === 'ranking') s.pipeline.status = 'ranking';
          });
        }
      })();

      // Parallel fetch
      const batch = await OmniAggregator.aggregate();
      await streamLoop;

      set(s => {
        s.pipeline.status         = 'ready';
        s.pipeline.suggestions    = [
          ...batch.flights,
          ...batch.lodging,
          ...batch.dining,
        ];
        s.pipeline.lastRunAt      = Date.now();
        s.pipeline.processingMs   = batch.processingMs;
        s.pipeline.sourcesQueried = batch.sourcesQueried;
      });
    },

    // ── Drag & Drop ──────────────────────────────────────────────────────────
    setDragging: (entity) => set(s => { s.dragging = entity; }),

    placeEntity: (dayId, source) => {
      const entityId = `placed-${source.id}-${Date.now()}`;
      const base = {
        id:           entityId,
        sourceId:     source.id,
        category:     source.category as EntityCategory,
        sourceCount:  source.sourceCount,
        aiConfidence: source.aiConfidence,
        tags:         source.tags,
        booked:       false,
        placedAt:     Date.now(),
      };

      let entity: PlacedEntity;
      if (source.category === 'flight') {
        const f = source as AggregatedFlight;
        entity = { ...base, title: `${f.airline} · ${f.route}`, subtitle: `${f.class} · ${f.durationLabel} · ${f.stops === 0 ? 'Non-stop' : f.stops + ' stop'}`, price: f.price, time: f.departure, duration: f.durationLabel, rating: undefined, details: { class: f.class, carbon: f.carbonLabel, seats: f.seats, refundable: f.refundable }, aiHighlight: f.carbonAlternative };
      } else if (source.category === 'hotel') {
        const h = source as AggregatedLodging;
        entity = { ...base, title: h.name, subtitle: `${h.roomType} · ${h.nights} nights`, price: h.totalPrice, time: '15:00', duration: `${h.nights}n`, rating: h.rating, details: { roomType: h.roomType, nights: h.nights, perNight: h.pricePerNight, amenities: h.amenities.slice(0, 2).join(', ') }, aiHighlight: h.aiHighlight };
      } else {
        const d = source as AggregatedDining;
        entity = { ...base, title: d.name, subtitle: `${d.cuisine}${d.michelinStars ? ` · ${d.michelinStars}★ Michelin` : ''}`, price: d.pricePerPerson * 2, time: '20:00', duration: '2h 30m', rating: d.rating, details: { cuisine: d.cuisine, uberTime: `${d.uberMinutes}min`, uberCost: `$${d.uberCost}`, reservation: d.reservationWindow }, aiHighlight: d.aiHighlight };
      }

      set(s => {
        const day = s.days.find(d => d.id === dayId);
        if (day) {
          day.entities.push(entity);
          s.pipeline.placedIds.add(source.id);
          s.activeDay = dayId;
        }
      });

      get().calculatePredictiveBudget();
    },

    removeEntity: (dayId, entityId) => {
      set(s => {
        const day = s.days.find(d => d.id === dayId);
        if (day) day.entities = day.entities.filter(e => e.id !== entityId);
      });
      get().calculatePredictiveBudget();
    },

    toggleBooked: (dayId, entityId) => set(s => {
      const entity = s.days.find(d => d.id === dayId)?.entities.find(e => e.id === entityId);
      if (entity) entity.booked = !entity.booked;
    }),

    setActiveDay: (id) => set(s => { s.activeDay = id; }),

    completeTravelDNA: (dna) => {
      set(s => {
        s.dnaProfile = dna;
        s.onboardingComplete = true;
      });
      get().calculatePredictiveBudget();
    },

    patchDNA: (field, value) => set(s => {
      if (!s.dnaProfile) return;
      const numericFields = [
        'paceIndex', 'culinaryAffinity', 'accommodationTier',
        'experienceWeight', 'flexibilityScore',
      ] as const;
      if ((numericFields as readonly string[]).includes(field)) {
        (s.dnaProfile as Record<string, unknown>)[field] = Math.max(0, Math.min(1, value));
      }
    }),

    applyMutations: (mutations, event) => set(s => {
      for (const mutation of mutations) {
        const day    = s.days.find(d => d.id === mutation.dayId);
        if (!day) continue;
        const entity = day.entities.find(e => e.id === mutation.entityId);
        if (!entity) continue;
        if (mutation.field === 'time')     entity.time     = mutation.newValue;
        if (mutation.field === 'duration') entity.duration = mutation.newValue;
      }
      s.crisisHistory.push(event);
    }),

    reorderDayEntities: (dayId, newOrder) => set(s => {
      const day = s.days.find(d => d.id === dayId);
      if (!day) return;
      // Collect original time slots sorted chronologically
      const sortedSlots = [...day.entities]
        .filter(e => e.time)
        .sort((a, b) => a.time!.localeCompare(b.time!))
        .map(e => e.time!);
      // Redistribute time slots to entities in their new visual order
      let slotIdx = 0;
      day.entities = newOrder.map(entity => {
        if (entity.time !== undefined && slotIdx < sortedSlots.length) {
          return { ...entity, time: sortedSlots[slotIdx++] };
        }
        return entity;
      });
    }),

    // ── Chat memory ──────────────────────────────────────────────────────────
    addChatMessage: (msg) => set(s => {
      s.chatHistory.push({ ...msg, timestamp: Date.now() });
    }),

    clearChatHistory: () => set(s => { s.chatHistory = []; }),

    revertCrisis: (crisisId) => set(s => {
      const crisis = s.crisisHistory.find(c => c.id === crisisId);
      if (!crisis || crisis.undone) return;
      for (const mutation of crisis.mutations) {
        const day    = s.days.find(d => d.id === mutation.dayId);
        if (!day) continue;
        const entity = day.entities.find(e => e.id === mutation.entityId);
        if (!entity) continue;
        if (mutation.field === 'time')     entity.time     = mutation.oldValue;
        if (mutation.field === 'duration') entity.duration = mutation.oldValue;
      }
      crisis.undone = true;
    }),

    // ── Predictive Budget Engine ─────────────────────────────────────────────
    calculatePredictiveBudget: () => set(s => {
      const breakdown: Record<EntityCategory, number> = { flight: 0, hotel: 0, restaurant: 0, activity: 0, transport: 0 };
      let spent = 0;
      let committed = 0;

      const dayBreakdown = s.days.map(day => {
        let daySpent = 0;
        day.entities.forEach(e => {
          daySpent += e.price;
          spent    += e.price;
          if (e.booked) committed += e.price;
          breakdown[e.category] += e.price;
        });
        return { dayId: day.id, date: day.date, spent: daySpent, budget: day.budget, overBudget: daySpent > day.budget };
      });

      // Linear regression on daily spend to project end-of-trip total
      const spentDays = dayBreakdown.filter(d => d.spent > 0);
      let regressionSlope = 0;
      if (spentDays.length >= 2) {
        const n = spentDays.length;
        const xMean = (n - 1) / 2;
        const yMean = spentDays.reduce((a, d) => a + d.spent, 0) / n;
        const num = spentDays.reduce((a, d, i) => a + (i - xMean) * (d.spent - yMean), 0);
        const den = spentDays.reduce((a, _, i) => a + (i - xMean) ** 2, 0);
        regressionSlope = den !== 0 ? num / den : 0;
      }

      const remainingDays = s.days.length - spentDays.length;
      const avgDailySpend = spentDays.length > 0 ? spent / spentDays.length : 0;
      const projected = spent + (avgDailySpend + regressionSlope * remainingDays / 2) * remainingDays;

      const burnRate       = TOTAL_BUDGET > 0 ? spent / TOTAL_BUDGET : 0;
      const dailyAllowance = TOTAL_BUDGET > 0 ? (TOTAL_BUDGET - spent) / Math.max(remainingDays, 1) : 0;

      // DNA-powered BurnSchedule recalibration
      const dna = s.dnaProfile;
      if (dna) {
        const schedule = FinancialEngine.recalibrateAfterPlacement({
          dna,
          days: s.days.map(d => ({
            id: d.id,
            entities: d.entities.map(e => ({ price: e.price, booked: e.booked })),
          })),
          totalBudget: TOTAL_BUDGET,
          fixedCosts: committed,
        });
        s.burnSchedule = schedule;
      }

      s.budget = {
        total: TOTAL_BUDGET,
        spent,
        committed,
        projected: Math.round(projected),
        dailyAllowance: Math.round(dailyAllowance),
        burnRate: parseFloat(burnRate.toFixed(4)),
        regressionSlope: parseFloat(regressionSlope.toFixed(2)),
        overBudgetBy: projected > TOTAL_BUDGET ? Math.round(projected - TOTAL_BUDGET) : undefined,
        breakdown,
        dayBreakdown,
      };
    }),
  }))
);
