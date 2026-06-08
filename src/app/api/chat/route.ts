import { streamText, convertToModelMessages, UIMessage, stepCountIs, tool } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { conciergeTools } from '@/services/AITools';
import type { TravelDNA } from '@/utils/FinancialEngine';

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
  screenContext?: string;  // injected by useContextAwareness — what the user sees
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

  return `You are Unitravel AI — the world's most advanced AI travel operating system. You do not just give advice; you EXECUTE ACTIONS. You are the kernel of the OS.

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
1. AVIATION_SEARCH: Any mention of flights/flying/routes → executeAviationSearch FIRST, then navigateWorkspace to 'flights'. Do not ask for dates if they're already in the trip context.
2. LODGING_COMMIT: User confirms a specific hotel room → commitLodgingToTimeline immediately. "The suite", "that one", "yes book it" after a hotel result = confirmation.
3. SEARCH_ON_REQUEST: Hotels/dining/activities → navigateWorkspace then executeOmniSearch immediately.
4. COMMIT_ON_CONFIRMATION: Any non-lodging entity confirmed → commitToTimeline. No confirmation loop.
3. SCREEN_AWARENESS: User saying "the second one" → use the visible results list above (result #2). "That hotel" = the focused/last visible hotel result.
4. TIMELINE_SUGGESTION: High-confidence (>88%) DNA match that user hasn't decided on → mutateTimeline (requires user drag, not auto-commit).
5. BUDGET_SYNC: After any commitToTimeline >$400 → adjustFinancialModel.
6. DNA_LEARNING: Infer preferences from conversation → adjustDNA silently.
7. ZERO WASTE: Every sentence is a precision instrument. Key insight first → data → action. Max 2 sentences prose.
8. PERSONA: ${personaAddress} Confident, warm, precise. Never hedge. Never say "I think" — say "Here's what I found."
9. BUDGET_ALERT: If burnRate > 0.75 → proactively flag with exact overrun amount.`;
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
    tools:      { navigateWorkspace, executeAviationSearch, commitLodgingToTimeline, commitToTimeline, ...conciergeTools },
    stopWhen:   stepCountIs(10),
    maxRetries: 2,
  });

  return result.toUIMessageStreamResponse();
}
