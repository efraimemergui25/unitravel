import { streamText, convertToModelMessages, UIMessage, stepCountIs, tool } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { conciergeTools } from '@/services/AITools';
import { updateUserDNATool } from '@/utils/DNAExtractor';
import type { TravelDNA } from '@/utils/FinancialEngine';
import type { FlightSearchResponse } from '@/app/api/flights/route';

// ── Navigation tool — executes on server, client reacts to result ─────────────

const navigateWorkspace = tool({
  description:
    'Navigate the 2/3 workspace to a specific zone. Call this IMMEDIATELY — ' +
    'before any search — whenever the user mentions flights, hotels, dining, ' +
    'activities, or transit. Open the zone first, then search.',
  inputSchema: z.object({
    zoneId: z.enum(['flights', 'lodging', 'dining', 'attractions', 'transit'])
      .describe('Zone to open in the workspace'),
    reason: z.string().describe('One sentence explaining why this zone is being opened'),
  }),
  execute: async ({ zoneId, reason }) => ({ zoneId, reason, navigated: true }),
});

// ── commitToTimeline — direct commit without user drag ────────────────────────

const commitToTimeline = tool({
  description:
    'Directly commit an entity to the LiquidTimeline and deduct from the budget. ' +
    'Call ONLY when the user has given explicit confirmation: "book it", "add it", ' +
    '"commit", "yes do that", "add the [specific item] to day [N]". ' +
    'For ambiguous requests use mutateTimeline (requires user drag) instead.',
  inputSchema: z.object({
    entityId:    z.string().describe('ID from a previous executeOmniSearch result, or a descriptive key'),
    targetDayId: z.string().describe('Target day ID "day-N" (e.g. "day-2")'),
    category:    z.enum(['flight', 'hotel', 'restaurant', 'activity', 'transport']),
    title:       z.string().describe('Entity title'),
    subtitle:    z.string().describe('One-line description'),
    price:       z.number().min(0).describe('USD price'),
    time:        z.string().optional().describe('HH:MM 24-hour start time'),
    duration:    z.string().optional().describe('Duration e.g. "2h 30m"'),
    reason:      z.string().describe('Why this entity was chosen'),
  }),
  execute: async (params) => ({
    committed:   true,
    ...params,
    committedAt: Date.now(),
  }),
});

// ── executeAviationSearch — flight-specific parallel search ──────────────────

const executeAviationSearch = tool({
  description:
    'Search for flights across all connected aviation engines using Gestalt grouping. ' +
    'Call IMMEDIATELY — before any prose — whenever the user mentions flights, flying, ' +
    'or traveling between two cities. Opens the Aviation Hub and fans out to real adapters.',
  inputSchema: z.object({
    origin:        z.string().describe('Origin IATA code or city (e.g. "TLV", "Tel Aviv")'),
    destination:   z.string().describe('Destination IATA or city (e.g. "JFK", "New York")'),
    departureDate: z.string().describe('Departure date YYYY-MM-DD'),
    cabinClass:    z.enum(['economy', 'premium_economy', 'business', 'first'])
                    .optional()
                    .default('economy'),
    returnDate:    z.string().optional().describe('Return date YYYY-MM-DD for round-trip'),
    passengers:    z.number().int().min(1).max(9).optional().default(1),
  }),
  execute: async (params) => ({
    action:    'aviation_search_initiated' as const,
    zone:      'flights'                   as const,
    ...params,
    timestamp: Date.now(),
  }),
});

// ── commitLodgingToTimeline — hotel direct state insertion ────────────────────

const commitLodgingToTimeline = tool({
  description:
    'Directly commit a hotel/lodging to the LiquidTimeline and deduct from budget. ' +
    'Call ONLY on explicit confirmation: "book that room", "add the hotel", "yes", ' +
    '"the [hotel name] on day N". Never call proactively or on ambiguous intent.',
  inputSchema: z.object({
    hotelName: z.string().describe('Full hotel name as displayed in results'),
    price:     z.number().min(0).describe('Price per night in USD'),
    targetDay: z.string().describe('Target day ID e.g. "day-2"'),
    roomType:  z.string().optional().describe('Room type e.g. "Deluxe King", "Suite"'),
    nights:    z.number().int().min(1).optional().default(1),
    checkIn:   z.string().optional().describe('Check-in date YYYY-MM-DD'),
    checkOut:  z.string().optional().describe('Check-out date YYYY-MM-DD'),
    sourceId:  z.string().optional().describe('ID from a previous search result'),
    reason:    z.string().describe('Why this property matches the Travel DNA profile'),
  }),
  execute: async (params) => ({
    committed:   true         as const,
    category:    'hotel'      as const,
    ...params,
    totalPrice:  params.price * (params.nights ?? 1),
    committedAt: Date.now(),
  }),
});

// ── triggerOmniSearch — multi-zone search dispatcher ─────────────────────────
// Covers both aviation AND lodging; use executeAviationSearch when intent is
// purely flight-focused. Use this when the user mentions hotels OR flights
// without strong zone specificity, or when you need to open both zones.

const triggerOmniSearch = tool({
  description:
    'Dispatch a real-time parallel search against the Aviation or Lodging zone. ' +
    'MUST be called — not described — whenever the user asks for flights OR hotels. ' +
    'Do NOT hallucinate dummy options. This triggers real engine adapters.',
  inputSchema: z.object({
    targetZone: z.enum(['aviation', 'lodging'])
      .describe('"aviation" for flights/routes, "lodging" for hotels/stays'),
    parameters: z.object({
      dates: z.object({
        departure: z.string().describe('Departure date YYYY-MM-DD'),
        return:    z.string().optional().describe('Return date YYYY-MM-DD for round-trips'),
      }),
      origins:      z.array(z.string()).min(1).describe('Origin IATA codes or city names'),
      destinations: z.array(z.string()).optional().describe('Destination IATA codes or cities'),
      max_price:    z.number().min(0).optional().describe('Hard max price in USD per person'),
      adults:       z.number().int().min(1).max(9).optional().default(1),
      cabin_class:  z.enum(['economy', 'premium_economy', 'business', 'first']).optional(),
    }),
  }),
  execute: async ({ targetZone, parameters }) => ({
    action:     'omni_search_initiated' as const,
    targetZone,
    parameters,
    timestamp:  Date.now(),
  }),
});

// ── commitEntityToTimeline — minimal-schema direct commit ─────────────────────
// Use when only entityId + targetDay + price are known (e.g. after an AI search
// where full metadata was already shown in chat). Use commitToTimeline for richer
// commits where category, title, and duration are available.

const commitEntityToTimeline = tool({
  description:
    'Commit a search result entity directly to the LiquidTimeline with minimal schema. ' +
    'Call ONLY on explicit user confirmation ("add it", "book it", "yes"). ' +
    'Required: entityId from a prior search, the target day, price, category, and title.',
  inputSchema: z.object({
    entityId:  z.string().describe('ID from a prior executeAviationSearch / triggerOmniSearch result'),
    targetDay: z.string().describe('Day ID e.g. "day-1", "day-3"'),
    price:     z.number().min(0).describe('Confirmed price in USD'),
    category:  z.enum(['flight', 'hotel', 'restaurant', 'activity', 'transport'])
                .describe('Entity category — must match the actual result type'),
    title:     z.string().describe('Entity display title'),
  }),
  execute: async (params) => ({
    committed:   true as const,
    ...params,
    committedAt: Date.now(),
  }),
});

// ── searchFlightsInline — real flight search that returns results in chat ─────
// Unlike executeAviationSearch (which just navigates), this tool ACTUALLY calls
// the Duffel + SerpAPI adapters and returns formatted results as structured data
// that Claude can summarise and present to the user without leaving the chat.

const searchFlightsInline = tool({
  description:
    'Search for real flights and return the top options DIRECTLY in the chat — ' +
    'no zone navigation needed. Use this when the user asks "what are the cheapest ' +
    'flights to X" or "show me options" and wants to see prices without switching views. ' +
    'Always call this BEFORE making any booking commitment.',
  inputSchema: z.object({
    origin:        z.string().describe('Origin IATA code (3 letters, e.g. TLV, JFK, LHR)'),
    destination:   z.string().describe('Destination IATA code (e.g. CDG, DXB, NRT)'),
    departureDate: z.string().describe('YYYY-MM-DD departure date'),
    cabinClass:    z.enum(['ECONOMY', 'BUSINESS', 'FIRST']).optional().default('ECONOMY'),
    adults:        z.number().int().min(1).max(9).optional().default(1),
    returnDate:    z.string().optional().describe('YYYY-MM-DD for round-trips'),
    engines:       z.string().optional().describe('Comma-separated engine IDs from the USER-SELECTED ENGINES block. If not specified, uses all real adapters.'),
  }),
  execute: async ({ origin, destination, departureDate, cabinClass, adults, engines }) => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
      const params  = new URLSearchParams({
        origin, destination, departureDate,
        travelClass: cabinClass ?? 'ECONOMY',
        adults:      String(adults ?? 1),
        maxResults:  '5',
        engines:     engines ?? 'duffel,amadeus,google-flights,kiwi',
      });

      const res  = await fetch(`${baseUrl}/api/flights?${params}`, { signal: AbortSignal.timeout(18_000) });
      const data = await res.json() as FlightSearchResponse;

      if (data.status !== 'ok' || !data.results?.length) {
        return {
          status:  data.status,
          message: data.setupMessage ?? 'No results found.',
          results: [],
        };
      }

      const top5 = data.results.slice(0, 5).map(f => ({
        id:          f.id,
        airline:     f.airline,
        price:       f.totalPrice,
        pricePerPax: f.pricePerPerson,
        currency:    'USD',
        departure:   f.departure,
        arrival:     f.arrival,
        duration:    f.durationLabel,
        stops:       f.stops === 0 ? 'Non-stop' : `${f.stops} stop${f.stops > 1 ? 's' : ''}`,
        cabin:       f.cabinClass,
        co2:         f.co2Comparison,
        bookingUrl:  f.bookingUrl,
        source:      f.source,
      }));

      return {
        status:      'ok',
        origin,
        destination,
        date:        departureDate,
        resultCount: data.results.length,
        results:     top5,
        cheapest:    top5.reduce((a, b) => a.price < b.price ? a : b),
      };
    } catch (err) {
      return {
        status:  'error',
        message: err instanceof Error ? err.message : 'Search failed',
        results: [],
      };
    }
  },
});

// ── searchHotelsInline — real hotel search returning results in chat ───────────

const searchHotelsInline = tool({
  description:
    'Search for real hotels and return top options DIRECTLY in the chat. ' +
    'Call this whenever the user asks about accommodation, hotels, or where to stay. ' +
    'Returns price per night, star rating, and location for the top 5 options.',
  inputSchema: z.object({
    cityCode:  z.string().describe('City IATA code or city name (e.g. MAD, CDG, "Paris")'),
    checkIn:   z.string().describe('Check-in date YYYY-MM-DD'),
    checkOut:  z.string().describe('Check-out date YYYY-MM-DD'),
    adults:    z.number().int().min(1).max(9).optional().default(2),
    currency:  z.enum(['USD', 'EUR', 'ILS']).optional().default('USD'),
    engines:   z.array(z.string()).optional().describe('Hotel engine IDs from the USER-SELECTED ENGINES block. Defaults to all real adapters.'),
  }),
  execute: async ({ cityCode, checkIn, checkOut, adults, currency, engines }) => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
      const res  = await fetch(`${baseUrl}/api/hotels`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ cityCode, checkInDate: checkIn, checkOutDate: checkOut, adults, currency, engines: (engines ?? ['duffel-stays', 'amadeus-hotels']).join(','), maxResults: 5 }),
        signal:  AbortSignal.timeout(18_000),
      });
      const data = await res.json();

      if (data.status !== 'ok' || !data.results?.length) {
        return { status: data.status, message: data.setupMessage ?? 'No hotels found.', results: [] };
      }

      const top5 = data.results.slice(0, 5).map((h: {
        id: string; name: string; pricePerNight: number; totalPrice: number;
        stars: number; address: string; amenities: string[]; bookingUrl: string;
      }) => ({
        id:            h.id,
        name:          h.name,
        pricePerNight: h.pricePerNight,
        totalPrice:    h.totalPrice,
        stars:         h.stars,
        address:       h.address,
        topAmenities:  (h.amenities ?? []).slice(0, 3),
        bookingUrl:    h.bookingUrl,
      }));

      return {
        status:      'ok',
        city:        cityCode,
        checkIn, checkOut,
        nights:      Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000),
        resultCount: data.results.length,
        results:     top5,
        cheapest:    top5.reduce((a: typeof top5[0], b: typeof top5[0]) => a.pricePerNight < b.pricePerNight ? a : b),
      };
    } catch (err) {
      return { status: 'error', message: err instanceof Error ? err.message : 'Hotel search failed', results: [] };
    }
  },
});

// ── Request shape ─────────────────────────────────────────────────────────────

interface TripContext {
  tripTitle:     string;
  travelers:     string[];
  destination:   string;
  startDate:     string;
  endDate:       string;
  budget: {
    total:        number;
    spent:        number;
    burnRate:     number;
    projected:    number;
    overBudgetBy?: number;
  };
  dnaProfile:    TravelDNA | null;
  activeDay:     string | null;
  screenContext?: string;
  locale?:       'en-US' | 'he-IL';
  // User-selected engines per zone — inline search tools respect these
  selectedEngines?: {
    flights?:     string[];
    hotels?:      string[];
    dining?:      string[];
    attractions?: string[];
    transit?:     string[];
  };
}

const DEFAULT_CONTEXT: TripContext = {
  tripTitle:   'New Trip',
  travelers:   [],
  destination: '',
  startDate:   '',
  endDate:     '',
  budget:      { total: 0, spent: 0, burnRate: 0, projected: 0 },
  dnaProfile:  null,
  activeDay:   null,
};

// ── Cultural persona injection ────────────────────────────────────────────────

function buildLocalePersona(locale: 'en-US' | 'he-IL' | undefined): string {
  if (locale === 'he-IL') {
    return `
═══ CULTURAL KERNEL: ISRAELI MARKET ═══
אתה יוניטראבל, קונסיירז׳ תיירות פרימיום לישראלים. דבר בעברית קולחת, טבעית ומקצועית — לא שפה מתורגמת. תן עדיפות לטיסות היוצאות מנתב״ג (TLV) ולהעדפות של הקהל הישראלי: מלונות בוטיק, אוכל כשר כשרלוונטי, יעדים פופולריים (תאילנד, קרואטיה, אמסטרדם, דובאי, ניו יורק). תמחר תמיד ב-₪ (ILS). תאריכים בפורמט DD/MM/YYYY.`;
  }

  return `
═══ CULTURAL KERNEL: US MARKET ═══
You are a high-end US travel concierge. Use American English, imperial units if asked, and prioritize US-centric flight hubs (JFK, LAX, ORD, MIA, SFO, BOS). Price in USD ($). Dates in MM/DD/YYYY format.`;
}

// ── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(ctx: TripContext): string {
  const budgetStatus = ctx.budget.overBudgetBy
    ? `⚠️ OVER BUDGET by $${ctx.budget.overBudgetBy.toLocaleString()}`
    : '✓ within budget';

  const dnaBlock = ctx.dnaProfile
    ? `
Travel DNA Profile (calibrate every recommendation to this):
• Pace Index: ${ctx.dnaProfile.paceIndex.toFixed(2)} — ${
        ctx.dnaProfile.paceIndex > 0.65 ? 'High-velocity explorer — dense itinerary preferred'
        : ctx.dnaProfile.paceIndex < 0.35 ? 'Slow travel devotee — depth over breadth'
        : 'Balanced rhythm — mix of activity and recovery'
      }
• Culinary Affinity: ${ctx.dnaProfile.culinaryAffinity.toFixed(2)} — ${
        ctx.dnaProfile.culinaryAffinity > 0.75 ? 'Serious gastronome — Michelin + chef tables mandatory'
        : ctx.dnaProfile.culinaryAffinity > 0.5 ? 'Food-forward traveler'
        : 'Dining is secondary to other experiences'
      }
• Accommodation Tier: ${ctx.dnaProfile.accommodationTier.toFixed(2)} — ${
        ctx.dnaProfile.accommodationTier > 0.7 ? '5-star luxury only — no exceptions'
        : ctx.dnaProfile.accommodationTier > 0.45 ? 'Premium comfort — boutique + design hotels'
        : 'Value-focused — quality/price ratio matters'
      }`
    : 'Travel DNA: Not yet profiled — use luxury traveler defaults';

  const travelersLabel  = ctx.travelers.length > 0 ? ctx.travelers.join(' & ') : 'the traveler';
  const destinationLine = ctx.destination ? `Destination: ${ctx.destination}` : 'Destination: Not yet set';
  const datesLine       = ctx.startDate   ? `Dates: ${ctx.startDate} → ${ctx.endDate}` : 'Dates: Not yet set';
  const budgetLine      = ctx.budget.total > 0
    ? `Budget: $${ctx.budget.total.toLocaleString()} total | $${ctx.budget.spent.toLocaleString()} spent | ${(ctx.budget.burnRate * 100).toFixed(1)}% burned | Projected: $${ctx.budget.projected.toLocaleString()} ${budgetStatus}`
    : 'Budget: Not yet set';
  const personaAddress  = ctx.travelers.length > 0
    ? `Address ${travelersLabel} by name.`
    : 'The user has not set up their trip yet. Help them get started.';

  const screenBlock = ctx.screenContext
    ? `\n═══ USER'S LIVE SCREEN (resolve "that one", "the second", "book it" against this) ═══\n${ctx.screenContext}`
    : '';

  const enginesBlock = ctx.selectedEngines ? `\n═══ USER-SELECTED SEARCH ENGINES ═══
${ctx.selectedEngines.flights     ? `• Flights:      ${ctx.selectedEngines.flights.join(', ')}` : ''}
${ctx.selectedEngines.hotels      ? `• Hotels:       ${ctx.selectedEngines.hotels.join(', ')}` : ''}
${ctx.selectedEngines.dining      ? `• Dining:       ${ctx.selectedEngines.dining.join(', ')}` : ''}
${ctx.selectedEngines.attractions ? `• Attractions:  ${ctx.selectedEngines.attractions.join(', ')}` : ''}
${ctx.selectedEngines.transit     ? `• Transit:      ${ctx.selectedEngines.transit.join(', ')}` : ''}
searchFlightsInline and searchHotelsInline already use these engine IDs automatically.` : '';

  const todayISO = new Date().toISOString().split('T')[0];

  return `You are Unitravel AI — the world's most advanced AI travel operating system. You do not just give advice; you EXECUTE ACTIONS. You are the kernel of the OS.
TODAY'S DATE: ${todayISO} — use this when the user asks about "this summer", "next month", upcoming dates, or seasonal advice.

CRITICAL — GESTALT EXECUTION PROTOCOL: You are the Unitravel Autonomous Concierge. You guide the user using Gestalt psychology — perceive the whole intent, not just the words. You have direct programmatic control over the workspace. If the user wants flights, you MUST invoke executeAviationSearch. If they choose a room, invoke commitLodgingToTimeline. For any other entity confirmation, invoke commitToTimeline. Never fake text responses if a structural tool call is required. Every action you take is real — no theater, no placeholders.

═══ LIVE TRIP CONTEXT ═══
Trip: ${ctx.tripTitle}
Travelers: ${travelersLabel}
${destinationLine}
${datesLine}
${budgetLine}
${ctx.activeDay ? `Active Day: ${ctx.activeDay}` : ''}
${dnaBlock}${screenBlock}

═══ AUTONOMOUS EXECUTION PROTOCOL ═══
1. INLINE_SEARCH FIRST: When user asks for flights → call searchFlightsInline immediately (real results in chat, no navigation). When user asks for hotels → call searchHotelsInline. These return REAL prices and options. Present the top 3 with prices and ask which to book.
2. NAVIGATE IF REQUESTED: If user says "show me the flights page" or "open stays" → navigateWorkspace. Don't navigate proactively when inline search covers the need.
3. COMMIT_ON_CONFIRMATION: After user picks a result ("book the first one", "add that to day 3") → commitToTimeline or commitLodgingToTimeline with the entityId from the search result.
4. SCREEN_AWARENESS: User saying "the second one" → use result #2 from the last searchFlightsInline/searchHotelsInline call above.
5. TIMELINE_SUGGESTION: High-confidence (>88%) DNA match that user hasn't decided on → mutateTimeline (requires user drag, not auto-commit).
6. BUDGET_SYNC: After any commitToTimeline >$400 → adjustFinancialModel.
7. DNA_LEARNING: Infer preferences from conversation → adjustDNA silently.
8. ZERO WASTE: Price first → details → action. Never say "I'll search" — just search. Max 2 sentences prose before showing results.
9. PERSONA: ${personaAddress} Confident, warm, precise. Never hedge. Never say "I think" — say "Here's what I found."
10. BUDGET_ALERT: If burnRate > 0.75 → proactively flag with exact overrun amount.${buildLocalePersona(ctx.locale)}${enginesBlock}`;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const body = await req.json() as {
    messages: Array<Omit<UIMessage, 'id'>>;
    context?: TripContext;
  };

  const ctx = body.context ?? DEFAULT_CONTEXT;

  const result = streamText({
    model:      anthropic('claude-sonnet-4-6'),
    messages:   await convertToModelMessages(body.messages),
    system:     buildSystemPrompt(ctx),
    tools:      { navigateWorkspace, triggerOmniSearch, executeAviationSearch, searchFlightsInline, searchHotelsInline, commitLodgingToTimeline, commitToTimeline, commitEntityToTimeline, updateUserDNA: updateUserDNATool, ...conciergeTools },
    stopWhen:   stepCountIs(10),
    maxRetries: 2,
  });

  return result.toUIMessageStreamResponse();
}
