import { streamText, convertToModelMessages, UIMessage, stepCountIs, tool } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { conciergeTools } from '@/services/AITools';
import type { TravelDNA } from '@/utils/FinancialEngine';
import type { FlightSearchResponse } from '@/app/api/flights/route';

// ── searchFlightsInline — real flight results directly in chat ────────────────

const searchFlightsInline = tool({
  description:
    'Search for real flights and return the top options DIRECTLY in the chat. ' +
    'Call this whenever the user asks for flights, prices, or routes.',
  inputSchema: z.object({
    origin:        z.string().describe('Origin IATA code (e.g. TLV, JFK, LHR)'),
    destination:   z.string().describe('Destination IATA code (e.g. CDG, DXB, NRT)'),
    departureDate: z.string().describe('YYYY-MM-DD departure date'),
    cabinClass:    z.enum(['ECONOMY', 'BUSINESS', 'FIRST']).optional().default('ECONOMY'),
    adults:        z.number().int().min(1).max(9).optional().default(1),
    returnDate:    z.string().optional().describe('YYYY-MM-DD for round-trips'),
  }),
  execute: async ({ origin, destination, departureDate, cabinClass, adults }) => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
      const params  = new URLSearchParams({
        origin, destination, departureDate,
        travelClass: cabinClass ?? 'ECONOMY',
        adults:      String(adults ?? 1),
        maxResults:  '5',
        engines:     'duffel,google-flights',
      });
      const res  = await fetch(`${baseUrl}/api/flights?${params}`, { signal: AbortSignal.timeout(18_000) });
      const data = await res.json() as FlightSearchResponse;
      if (data.status !== 'ok' || !data.results?.length) {
        return { status: data.status, message: data.setupMessage ?? 'No results found.', results: [] };
      }
      const top5 = data.results.slice(0, 5).map(f => ({
        id: f.id, airline: f.airline, price: f.totalPrice, pricePerPax: f.pricePerPerson,
        currency: 'USD', departure: f.departure, arrival: f.arrival,
        duration: f.durationLabel, stops: f.stops === 0 ? 'Non-stop' : `${f.stops} stop${f.stops > 1 ? 's' : ''}`,
        cabin: f.cabinClass, co2: f.co2Comparison, bookingUrl: f.bookingUrl, source: f.source,
      }));
      return { status: 'ok', origin, destination, date: departureDate, resultCount: data.results.length, results: top5, cheapest: top5.reduce((a, b) => a.price < b.price ? a : b) };
    } catch (err) {
      return { status: 'error', message: err instanceof Error ? err.message : 'Search failed', results: [] };
    }
  },
});

// ── searchHotelsInline — real hotel results directly in chat ─────────────────

const searchHotelsInline = tool({
  description:
    'Search for real hotels and return top options DIRECTLY in the chat. ' +
    'Call this whenever the user asks about accommodation, hotels, or where to stay.',
  inputSchema: z.object({
    cityCode:  z.string().describe('City IATA code or city name (e.g. MAD, CDG, "Paris")'),
    checkIn:   z.string().describe('Check-in date YYYY-MM-DD'),
    checkOut:  z.string().describe('Check-out date YYYY-MM-DD'),
    adults:    z.number().int().min(1).max(9).optional().default(2),
    currency:  z.enum(['USD', 'EUR', 'ILS']).optional().default('USD'),
  }),
  execute: async ({ cityCode, checkIn, checkOut, adults, currency }) => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
      const res  = await fetch(`${baseUrl}/api/hotels`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ cityCode, checkInDate: checkIn, checkOutDate: checkOut, adults, currency, engines: 'duffel-stays', maxResults: 5 }),
        signal:  AbortSignal.timeout(18_000),
      });
      const data = await res.json();
      if (data.status !== 'ok' || !data.results?.length) {
        return { status: data.status, message: data.setupMessage ?? 'No hotels found.', results: [] };
      }
      const top5 = data.results.slice(0, 5).map((h: { id: string; name: string; pricePerNight: number; totalPrice: number; stars: number; address: string; amenities: string[]; bookingUrl: string }) => ({
        id: h.id, name: h.name, pricePerNight: h.pricePerNight, totalPrice: h.totalPrice,
        stars: h.stars, address: h.address, topAmenities: (h.amenities ?? []).slice(0, 3), bookingUrl: h.bookingUrl,
      }));
      return { status: 'ok', city: cityCode, checkIn, checkOut, nights: Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000), resultCount: data.results.length, results: top5, cheapest: top5.reduce((a: typeof top5[0], b: typeof top5[0]) => a.pricePerNight < b.pricePerNight ? a : b) };
    } catch (err) {
      return { status: 'error', message: err instanceof Error ? err.message : 'Hotel search failed', results: [] };
    }
  },
});

// ── Request shape ─────────────────────────────────────────────────────────────

interface TripContext {
  tripTitle:       string;
  travelers:       string[];
  destination:     string;
  startDate:       string;
  endDate:         string;
  budget: {
    total:         number;
    spent:         number;
    burnRate:      number;
    projected:     number;
    overBudgetBy?: number;
  };
  dnaProfile:      TravelDNA | null;
  activeDay:       string | null;
  // Engine selections per zone — ARIA searches exactly these when queried
  selectedEngines?: {
    flights?:     string[];
    hotels?:      string[];
    dining?:      string[];
    attractions?: string[];
    transit?:     string[];
  };
}

// ── System prompt generator ───────────────────────────────────────────────────

function buildSystemPrompt(ctx: TripContext): string {
  const budgetStatus = ctx.budget.overBudgetBy
    ? `⚠️ OVER BUDGET by $${ctx.budget.overBudgetBy.toLocaleString()}`
    : '✓ within budget';

  const dnaBlock = ctx.dnaProfile
    ? `
Travel DNA Profile (calibrate every recommendation to this):
• Pace Index: ${ctx.dnaProfile.paceIndex.toFixed(2)} — ${
        ctx.dnaProfile.paceIndex > 0.65
          ? 'High-velocity explorer — dense itinerary preferred'
          : ctx.dnaProfile.paceIndex < 0.35
          ? 'Slow travel devotee — depth over breadth'
          : 'Balanced rhythm — mix of activity and recovery'
      }
• Culinary Affinity: ${ctx.dnaProfile.culinaryAffinity.toFixed(2)} — ${
        ctx.dnaProfile.culinaryAffinity > 0.75
          ? 'Serious gastronome — Michelin + chef tables mandatory'
          : ctx.dnaProfile.culinaryAffinity > 0.5
          ? 'Food-forward traveler'
          : 'Dining is secondary to other experiences'
      }
• Accommodation Tier: ${ctx.dnaProfile.accommodationTier.toFixed(2)} — ${
        ctx.dnaProfile.accommodationTier > 0.7
          ? '5-star luxury only — no exceptions'
          : ctx.dnaProfile.accommodationTier > 0.45
          ? 'Premium comfort — boutique + design hotels'
          : 'Value-focused — quality/price ratio matters'
      }
• Experience Weight: ${ctx.dnaProfile.experienceWeight.toFixed(2)} — ${
        ctx.dnaProfile.experienceWeight > 0.6
          ? 'Experience > amenity — immersive activities prioritized'
          : 'Amenity-focused comfort seeker'
      }
• Flexibility: ${ctx.dnaProfile.flexibilityScore.toFixed(2)} — ${
        ctx.dnaProfile.flexibilityScore > 0.6 ? 'Spontaneous' : 'Structured itinerary preferred'
      }
• Spending Curve: ${ctx.dnaProfile.spendingCurve}`
    : 'Travel DNA: Not yet profiled — use general luxury traveler defaults';

  const enginesBlock = ctx.selectedEngines ? `
═══ ACTIVE SEARCH ENGINES (user-selected — search ONLY these) ═══
${ctx.selectedEngines.flights     ? `• Flights:      ${ctx.selectedEngines.flights.join(', ')}` : ''}
${ctx.selectedEngines.hotels      ? `• Hotels:       ${ctx.selectedEngines.hotels.join(', ')}` : ''}
${ctx.selectedEngines.dining      ? `• Dining:       ${ctx.selectedEngines.dining.join(', ')}` : ''}
${ctx.selectedEngines.attractions ? `• Attractions:  ${ctx.selectedEngines.attractions.join(', ')}` : ''}
${ctx.selectedEngines.transit     ? `• Transit:      ${ctx.selectedEngines.transit.join(', ')}` : ''}
When the user asks to search or find options, pass the relevant engine IDs above to executeOmniSearch. Never use engines outside this list unless the user asks.` : '';

  const todayISO = new Date().toISOString().split('T')[0];

  return `You are ARIA — the Autonomous Routing Intelligence for Adventure — the world's most sophisticated AI travel concierge. You serve ultra-discerning clients with surgical precision.
TODAY'S DATE: ${todayISO} — use this for seasonal advice, date calculations, and "this summer" / "next month" references.

═══ LIVE TRIP CONTEXT ═══
Trip: ${ctx.tripTitle}
Travelers: ${ctx.travelers.join(' & ')}
Active Destination: ${ctx.destination}
Dates: ${ctx.startDate} → ${ctx.endDate}
Budget: $${ctx.budget.total.toLocaleString()} total | $${ctx.budget.spent.toLocaleString()} spent | ${(ctx.budget.burnRate * 100).toFixed(1)}% burned | Projected: $${ctx.budget.projected.toLocaleString()} ${budgetStatus}
${ctx.activeDay ? `Active Day: ${ctx.activeDay}` : ''}

${dnaBlock}

═══ BEHAVIORAL DIRECTIVES ═══
1. ZERO WASTE. Every sentence is a precision instrument. No filler, no hedging.
2. SEARCH FIRST. When user asks to find/search/compare anything → call executeOmniSearch immediately. No clarifying questions.
3. PROACTIVE PLACEMENT. If search results have a 90%+ DNA alignment, offer timeline placement via mutateTimeline.
4. BUDGET INTELLIGENCE. After any significant placement (>$400), call adjustFinancialModel.
5. PERSONA: Address ${ctx.travelers[0]}${ctx.travelers[1] ? ` & ${ctx.travelers[1]}` : ''} by name. Speak as their personal elite concierge — confident, warm, precise.
6. RESPOND with: key insight first → supporting data → recommended action. Max 2 sentences prose before structured content.
7. FLAG budget stress (burnRate > 0.75) proactively.
${enginesBlock}`;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const { messages, context } = (await req.json()) as {
    messages: Array<Omit<UIMessage, 'id'>>;
    context:  TripContext;
  };

  const result = streamText({
    model:    anthropic('claude-sonnet-4-6'),
    messages: await convertToModelMessages(messages),
    system:   buildSystemPrompt(context),
    tools:    { ...conciergeTools, searchFlightsInline, searchHotelsInline },
    stopWhen: stepCountIs(10),
    maxRetries: 2,
  });

  return result.toUIMessageStreamResponse();
}
