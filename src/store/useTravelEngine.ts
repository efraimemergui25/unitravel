'use client';

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AggregatedResult, AggregatedFlight, AggregatedLodging, AggregatedDining, AggregatedActivity, AggregatorProgress } from '@/services/OmniAggregator';
import type { FlightClass, LodgingTier } from '@/services/OmniAggregator';
import type { BentoFlight } from '@/lib/amadeus';
import type { BentoHotel } from '@/app/api/hotels/route';
import type { MergedRestaurant } from '@/app/api/dining/route';
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
  if (/destination|city|country|region|where|place|location/.test(l))                             return 'destinations';
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

// ── Initial state builders ────────────────────────────────────────────────────

const buildInitialDays = (): EngineDay[] => [];

const TOTAL_BUDGET = 0;

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
  // Trip setup
  setupTrip:        (params: { title: string; travelers: string[]; startDate: string; endDate: string; nights: number; totalBudget: number }) => void;
  addDay:           (day: EngineDay) => void;
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
  // Timeline drop from any zone
  commitEventToTimeline: (payload: {
    id: string;
    type: 'flight' | 'hotel' | 'restaurant' | 'activity' | 'transport';
    title: string; subtitle: string; price: number;
    currency: string; icon: string; sourceZone: string;
  }, targetDayId: string) => void;
}

type TravelEngineStore = TravelEngineState & TravelEngineActions;

// ── API → Aggregated mappers (client-safe, no server imports) ─────────────────

function bentoFlightToAggregated(f: BentoFlight): AggregatedFlight {
  return {
    id:                   f.id,
    category:             'flight',
    sources:              [f.source],
    sourceCount:          1,
    aiConfidence:         0.98,
    airline:              f.airline,
    flightNumber:         f.flightNumbers[0] ?? '',
    route:                f.routeLabel,
    origin:               f.origin,
    destination:          f.destination,
    departure:            f.departure,
    arrival:              f.arrival,
    durationMin:          f.totalMin,
    durationLabel:        f.durationLabel,
    stops:                f.stops,
    class:                f.cabinClass as FlightClass,
    price:                f.totalPrice,
    priceRange:           [Math.round(f.totalPrice * 0.95), Math.round(f.totalPrice * 1.05)],
    carbonKg:             f.co2PerPerson,
    carbonLabel:          f.co2Comparison,
    carbonAlternative:    '',
    priceDropProbability: 0.3,
    seats:                9,
    refundable:           f.baggage.checked !== 'None',
    tags:                 [f.cabinClass.toLowerCase(), f.stops === 0 ? 'direct' : 'connecting', ...f.amenities],
  };
}

function bentoHotelToAggregated(h: BentoHotel): AggregatedLodging {
  const tier: LodgingTier =
    h.pricePerNight > 600 ? 'Ultra-Luxury' :
    h.pricePerNight > 300 ? '5★' :
    h.pricePerNight > 150 ? '4★' : '3★';
  return {
    id:            h.id,
    category:      'hotel',
    sources:       [h.source],
    sourceCount:   1,
    aiConfidence:  0.95,
    name:          h.name,
    location:      h.cityCode,
    destination:   h.cityCode,
    tier,
    roomType:      h.roomType,
    pricePerNight: h.pricePerNight,
    totalPrice:    h.totalPrice,
    nights:        h.nights,
    rating:        h.rating ?? 4.2,
    reviewCount:   0,
    sentiment:     { positive: 0.78, neutral: 0.17, negative: 0.05, compound: 0.73 },
    amenities:     h.amenities,
    aiHighlight:   `${h.roomType} · ${h.boardType}`,
    tags:          h.amenities.slice(0, 4),
  };
}

function mergedRestaurantToAggregated(r: MergedRestaurant): AggregatedDining {
  return {
    id:                r.id,
    category:          'restaurant',
    sources:           r.sources,
    sourceCount:       r.sourceCount,
    aiConfidence:      r.aiConfidence,
    name:              r.name,
    cuisine:           r.cuisine,
    location:          r.location,
    destination:       r.destination,
    pricePerPerson:    r.pricePerPerson,
    rating:            r.rating,
    michelinStars:     r.michelinStars,
    bestIn50:          r.bestIn50,
    sentiment:         r.sentiment,
    reservationWindow: r.reservationWindow,
    uberMinutes:       r.uberMinutes,
    uberCost:          r.uberCost,
    aiHighlight:       r.aiHighlight,
    tags:              r.tags,
  };
}

const initialDays = buildInitialDays();

export const useTravelEngine = create<TravelEngineStore>()(
  persist(
    immer((set, get) => ({
    trip: {
      id:        '',
      title:     '',
      travelers: [],
      startDate: '',
      endDate:   '',
      nights:    0,
      currency:  'USD',
    },
    days:      [],
    budget:    buildInitialBudget([]),
    pipeline:  {
      status:         'idle',
      progress:       null,
      suggestions:    [],
      placedIds:      new Set(),
      lastRunAt:      null,
      processingMs:   null,
      sourcesQueried: 0,
    },
    activeDay:          null,
    dragging:           null,
    dnaProfile:         null,
    burnSchedule:       null,
    onboardingComplete: false,
    crisisHistory:      [],
    chatHistory:        [],

    // ── Trip setup ───────────────────────────────────────────────────────────
    setupTrip: ({ title, travelers, startDate, endDate, nights, totalBudget }) =>
      set(s => {
        s.trip.title     = title;
        s.trip.travelers = travelers;
        s.trip.startDate = startDate;
        s.trip.endDate   = endDate;
        s.trip.nights    = nights;
        s.budget.total   = totalBudget;
        s.budget.dailyAllowance = nights > 0 ? Math.round(totalBudget / nights) : 0;
      }),

    addDay: (day) => set(s => {
      s.days.push(day);
      s.budget.dayBreakdown.push({ dayId: day.id, date: day.date, spent: 0, budget: day.budget, overBudget: false });
      if (!s.activeDay) s.activeDay = day.id;
    }),

    // ── AI Pipeline ──────────────────────────────────────────────────────────
    runAIPipeline: async () => {
      const { trip, days, dnaProfile } = get();

      const destination =
        days.find(d => d.destination)?.destination ||
        trip.title ||
        '';

      if (!destination) {
        set(s => { s.pipeline.status = 'idle'; });
        return;
      }

      set(s => { s.pipeline.status = 'scanning'; s.pipeline.progress = null; });

      const TICKS: AggregatorProgress[] = [
        { phase: 'flight',  sourcesScanned: 1,  totalSources: 30, currentSource: 'Amadeus GDS',   percentComplete: 15 },
        { phase: 'flight',  sourcesScanned: 3,  totalSources: 30, currentSource: 'Skyscanner',     percentComplete: 30 },
        { phase: 'lodging', sourcesScanned: 6,  totalSources: 30, currentSource: 'Amadeus Hotels', percentComplete: 45 },
        { phase: 'dining',  sourcesScanned: 8,  totalSources: 30, currentSource: 'Google Places',  percentComplete: 60 },
        { phase: 'dining',  sourcesScanned: 10, totalSources: 30, currentSource: 'Yelp Fusion',    percentComplete: 75 },
        { phase: 'ranking', sourcesScanned: 30, totalSources: 30, currentSource: 'AI Ranking',     percentComplete: 90 },
      ];
      let tickIdx = 0;
      const tickInterval = setInterval(() => {
        if (tickIdx < TICKS.length) {
          const tick = TICKS[tickIdx++];
          set(s => {
            s.pipeline.progress = tick;
            if (tick.phase === 'ranking') s.pipeline.status = 'ranking';
          });
        } else {
          clearInterval(tickInterval);
        }
      }, 400);

      const t0 = Date.now();
      try {
        const adults   = trip.travelers.length || 2;
        const date     = trip.startDate || new Date().toISOString().split('T')[0];
        const checkIn  = trip.startDate || date;
        const checkOut = trip.endDate ||
          new Date(new Date(checkIn).getTime() + (trip.nights || 3) * 86_400_000)
            .toISOString().split('T')[0];

        const flightParams = new URLSearchParams({
          origin:        'TLV',
          destination,
          departureDate: date,
          adults:        String(adults),
          maxResults:    '6',
          travelClass:   (dnaProfile?.accommodationTier ?? 0) > 0.7 ? 'BUSINESS' : 'ECONOMY',
        });

        const [flightRes, hotelRes, diningRes] = await Promise.allSettled([
          fetch(`/api/flights?${flightParams}`).then(r => r.json()),
          fetch('/api/hotels', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ city: destination, checkIn, checkOut, adults, roomType: 'STANDARD' }),
          }).then(r => r.json()),
          fetch('/api/dining', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ destination, guests: String(adults), date }),
          }).then(r => r.json()),
        ]);

        const flights: AggregatedFlight[] =
          flightRes.status === 'fulfilled' && flightRes.value?.status === 'ok'
            ? (flightRes.value.results as BentoFlight[]).map(bentoFlightToAggregated)
            : [];

        const lodging: AggregatedLodging[] =
          hotelRes.status === 'fulfilled' && hotelRes.value?.status === 'ok'
            ? (hotelRes.value.results as BentoHotel[]).map(bentoHotelToAggregated)
            : [];

        const dining: AggregatedDining[] =
          diningRes.status === 'fulfilled' && diningRes.value?.status === 'ok'
            ? (diningRes.value.results as MergedRestaurant[]).map(mergedRestaurantToAggregated)
            : [];

        clearInterval(tickInterval);
        set(s => {
          s.pipeline.status         = 'ready';
          s.pipeline.suggestions    = [...flights, ...lodging, ...dining];
          s.pipeline.lastRunAt      = Date.now();
          s.pipeline.processingMs   = Date.now() - t0;
          s.pipeline.sourcesQueried = 3;
        });
      } catch {
        clearInterval(tickInterval);
        set(s => { s.pipeline.status = 'idle'; });
      }
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
      } else if (source.category === 'activity') {
        const a = source as AggregatedActivity;
        entity = { ...base, title: a.title, subtitle: `${a.durationHours}h · ${a.difficulty}`, price: a.pricePerPerson, time: a.bestTimeOfDay === 'morning' ? '09:00' : a.bestTimeOfDay === 'afternoon' ? '14:00' : '19:00', duration: `${a.durationHours}h`, rating: a.rating, details: { type: a.type, difficulty: a.difficulty, bestTime: a.bestTimeOfDay }, aiHighlight: a.aiHighlight };
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

    commitEventToTimeline: (payload, targetDayId) => {
      const entity: PlacedEntity = {
        id:           `timeline-${payload.id}-${Date.now()}`,
        sourceId:     payload.id,
        category:     payload.type as EntityCategory,
        title:        payload.title,
        subtitle:     payload.subtitle,
        price:        payload.price,
        sourceCount:  1,
        aiConfidence: 0.92,
        tags:         [payload.sourceZone],
        booked:       false,
        placedAt:     Date.now(),
        details:      { currency: payload.currency, icon: payload.icon },
      };
      set(s => {
        const day = s.days.find(d => d.id === targetDayId);
        if (day) {
          day.entities.push(entity);
          s.activeDay = targetDayId;
        }
      });
      get().calculatePredictiveBudget();
    },

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

      const totalBudget    = s.budget.total;
      const burnRate       = totalBudget > 0 ? spent / totalBudget : 0;
      const dailyAllowance = totalBudget > 0 ? (totalBudget - spent) / Math.max(remainingDays, 1) : 0;

      // DNA-powered BurnSchedule recalibration
      const dna = s.dnaProfile;
      if (dna) {
        const schedule = FinancialEngine.recalibrateAfterPlacement({
          dna,
          days: s.days.map(d => ({
            id: d.id,
            entities: d.entities.map(e => ({ price: e.price, booked: e.booked })),
          })),
          totalBudget,
          fixedCosts: committed,
        });
        s.burnSchedule = schedule;
      }

      s.budget = {
        ...s.budget,
        total: totalBudget,
        spent,
        committed,
        projected: Math.round(projected),
        dailyAllowance: Math.round(dailyAllowance),
        burnRate: parseFloat(burnRate.toFixed(4)),
        regressionSlope: parseFloat(regressionSlope.toFixed(2)),
        overBudgetBy: projected > totalBudget ? Math.round(projected - totalBudget) : undefined,
        breakdown,
        dayBreakdown,
      };
    }),
    })),
    {
      name:    'unitravel-engine',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        trip:               state.trip,
        days:               state.days,
        budget:             state.budget,
        activeDay:          state.activeDay,
        dnaProfile:         state.dnaProfile,
        burnSchedule:       state.burnSchedule,
        onboardingComplete: state.onboardingComplete,
        crisisHistory:      state.crisisHistory,
        chatHistory:        state.chatHistory,
        pipeline: {
          ...state.pipeline,
          placedIds: Array.from(state.pipeline.placedIds) as unknown as Set<string>,
          status:    'idle' as const,
          progress:  null,
        },
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.pipeline?.placedIds) {
          state.pipeline.placedIds = new Set(
            state.pipeline.placedIds as unknown as string[]
          );
        }
        if (state?.pipeline) state.pipeline.status = 'idle';
      },
    }
  )
);
