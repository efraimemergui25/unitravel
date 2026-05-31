import { tool } from 'ai';
import { z } from 'zod';
import { OmniAggregator, AggregatedResult } from '@/services/OmniAggregator';

interface OmniSearchOutput {
  category:       string;
  results:        AggregatedResult[];
  count:          number;
  sourcesQueried: number;
  processingMs:   number;
}

interface MutateOutput {
  requiresConfirmation: boolean;
  entity: {
    dayId: string; category: string; title: string; subtitle: string;
    price: number; time?: string; reason: string; sourceId?: string;
  };
  status: string;
}

interface FinancialOutput {
  adjusted: boolean;
  params:   { category: string; amount: number; reason: string; urgency?: string; dayId?: string };
  impact:   string;
  status:   string;
}

// ── Tool 1: Omni Search ────────────────────────────────────────────────────────

export const executeOmniSearch = tool<
  {
    origin: string; destination: string; departDate: string;
    returnDate?: string; cabinClass?: string; passengers?: number;
    maxResults?: number; category?: string;
  },
  OmniSearchOutput
>({
  description:
    'Autonomously trigger the 30-engine Omni search to find flights, hotels, or dining. ' +
    'Call this immediately when the user asks to find, search, or compare travel options. ' +
    'Do not ask clarifying questions first.',
  inputSchema: z.object({
    origin:      z.string().describe('Origin city or IATA code (e.g. "MEX", "Mexico City")'),
    destination: z.string().describe('Destination city or IATA code (e.g. "CUN", "Cancun")'),
    departDate:  z.string().describe('Departure date in YYYY-MM-DD format'),
    returnDate:  z.string().optional().describe('Return date YYYY-MM-DD for round-trip'),
    cabinClass:  z.string().optional().describe('Cabin class: Economy, PremiumEconomy, Business, First'),
    passengers:  z.number().int().min(1).max(9).optional().describe('Passenger count'),
    maxResults:  z.number().int().min(1).max(10).optional().describe('Max results to return'),
    category:    z.string().optional().describe('Search category: flights, hotels, dining, all'),
  }),
  execute: async ({ maxResults, category }): Promise<OmniSearchOutput> => {
    const limit = maxResults ?? 5;
    const cat   = category ?? 'flights';
    const batch = await OmniAggregator.aggregate();

    if (cat === 'hotels') {
      return { category: 'hotels', results: batch.lodging.slice(0, limit),
        count: batch.lodging.length, sourcesQueried: batch.sourcesQueried, processingMs: batch.processingMs };
    }
    if (cat === 'dining') {
      return { category: 'dining', results: batch.dining.slice(0, limit),
        count: batch.dining.length, sourcesQueried: batch.sourcesQueried, processingMs: batch.processingMs };
    }
    return { category: 'flights', results: batch.flights.slice(0, limit),
      count: batch.flights.length, sourcesQueried: batch.sourcesQueried, processingMs: batch.processingMs };
  },
});

// ── Tool 2: Timeline Mutation ─────────────────────────────────────────────────

export const mutateTimeline = tool<
  { dayId: string; category: string; title: string; subtitle: string;
    price: number; time?: string; reason: string; sourceId?: string },
  MutateOutput
>({
  description:
    'Directly offer to place a highly recommended item into the user\'s travel timeline. ' +
    'Only call this when aiConfidence is very high (>0.88) and the item perfectly fits the Travel DNA. ' +
    'Requires user confirmation before placement — the UI will present a confirmation card.',
  inputSchema: z.object({
    dayId:    z.string().describe('Target day ID in format "day-N" (e.g. "day-3")'),
    category: z.string().describe('Category: flight, hotel, restaurant, activity, transport'),
    title:    z.string().describe('Display title for the item'),
    subtitle: z.string().describe('Supporting details (e.g. "Business · 2h 30m · Non-stop")'),
    price:    z.number().describe('Price in USD'),
    time:     z.string().optional().describe('Time in HH:MM 24h format'),
    reason:   z.string().describe('Concise reason why this matches the user\'s Travel DNA'),
    sourceId: z.string().optional().describe('Source entity ID for deduplication'),
  }),
  execute: async (params): Promise<MutateOutput> => ({
    requiresConfirmation: true,
    entity:               params,
    status:               'pending_approval',
  }),
});

// ── Tool 3: Financial Model Adjustment ────────────────────────────────────────

export const adjustFinancialModel = tool<
  { category: string; amount: number; reason: string; urgency?: string; dayId?: string },
  FinancialOutput
>({
  description:
    'Proactively update the predictive budget engine when identifying cost savings, ' +
    'overruns, or reallocation opportunities. Call after any significant placement ' +
    '(>$500) or when burn rate exceeds 80%.',
  inputSchema: z.object({
    category:  z.string().describe('Category: flight, hotel, restaurant, activity, transport'),
    amount:    z.number().describe('USD amount. Positive = cost increase, negative = saving found'),
    reason:    z.string().describe('Brief explanation for the financial adjustment'),
    urgency:   z.string().optional().describe('Urgency level: low, medium, high, critical'),
    dayId:     z.string().optional().describe('Specific day affected, if applicable'),
  }),
  execute: async (params): Promise<FinancialOutput> => ({
    adjusted: true,
    params,
    impact:   params.amount > 0 ? 'budget_increase' : 'savings_found',
    status:   'applied',
  }),
});

// ── Tool 4: Travel DNA Adjustment ─────────────────────────────────────────────

interface DNAOutput {
  adjusted: boolean;
  field:    string;
  value:    number;
  reason:   string;
}

export const adjustDNA = tool<
  { field: string; value: number; reason: string },
  DNAOutput
>({
  description:
    'Silently refine the user\'s Travel DNA profile when their preferences become clear ' +
    'from conversation context. Call without asking — this improves all future recommendations. ' +
    'Only update numeric DNA fields (0–1 normalized). Never call for string or array fields.',
  inputSchema: z.object({
    field:  z.string().describe('DNA field: paceIndex | culinaryAffinity | accommodationTier | experienceWeight | flexibilityScore'),
    value:  z.number().min(0).max(1).describe('Normalized value between 0 and 1'),
    reason: z.string().describe('Why this DNA reading improves future recommendations'),
  }),
  execute: async ({ field, value, reason }): Promise<DNAOutput> => ({
    adjusted: true,
    field,
    value,
    reason,
  }),
});

// ── Registry ──────────────────────────────────────────────────────────────────

export const conciergeTools = {
  executeOmniSearch,
  mutateTimeline,
  adjustFinancialModel,
  adjustDNA,
} as const;

export type ConciergeToolName = keyof typeof conciergeTools;
