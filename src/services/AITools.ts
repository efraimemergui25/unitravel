import { tool } from 'ai';
import { z } from 'zod';
import { runOrchestratorSearch } from '@/services/OrchestratorService';
import type { TravelEntity } from '@/services/OrchestratorService';

// ── Output shapes ─────────────────────────────────────────────────────────────

interface OmniSearchOutput {
  category:          string;
  results:           TravelEntity[];
  distilledTop3:     TravelEntity[];
  count:             number;
  sourcesQueried:    number;
  successfulSources: number;
  processingMs:      number;
  warnings:          string[];
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

interface DNAOutput {
  adjusted: boolean;
  field:    string;
  value:    number;
  reason:   string;
}

// ── Tool 1: Omni Search ────────────────────────────────────────────────────────
// Calls OrchestratorService which fans out to 30 real API endpoints in parallel,
// applies DNA-aware scoring, and returns distilled top 3. Zero hallucination.

export const executeOmniSearch = tool<
  {
    origin:      string;
    destination: string;
    departDate:  string;
    returnDate?: string;
    cabinClass?: string;
    passengers?: number;
    maxResults?: number;
    category?:   string;
    tier?:       string;
  },
  OmniSearchOutput
>({
  description:
    'Autonomously trigger the 30-engine OmniOrchestrator to find flights, hotels, or dining. ' +
    'Call IMMEDIATELY when the user asks to search, find, or compare options. ' +
    'Results are DNA-ranked — no hallucination, every result comes from a real source fetch.',
  inputSchema: z.object({
    origin:      z.string().describe('Origin city or IATA (e.g. "TLV", "Tel Aviv")'),
    destination: z.string().describe('Destination city or IATA (e.g. "CUN", "Tulum")'),
    departDate:  z.string().describe('Departure date YYYY-MM-DD'),
    returnDate:  z.string().optional().describe('Return date YYYY-MM-DD for round-trip'),
    cabinClass:  z.string().optional().describe('Economy | PremiumEconomy | Business | First'),
    passengers:  z.number().int().min(1).max(9).optional(),
    maxResults:  z.number().int().min(1).max(10).optional(),
    category:    z.string().optional().describe('flights | hotels | restaurants | activities | all'),
    tier:        z.string().optional().describe('economy | premium | luxury | ultra-luxury'),
  }),

  execute: async ({ destination, category, tier, cabinClass, passengers }): Promise<OmniSearchOutput> => {
    const intent =
      category === 'hotels'      ? 'hotels'      as const :
      category === 'restaurants' ? 'restaurants' as const :
      category === 'activities'  ? 'activities'  as const :
      category === 'all'         ? 'all'          as const :
      'flights'                                   as const;

    const resolvedTier =
      tier === 'ultra-luxury'                                    ? 'ultra-luxury' as const :
      tier === 'luxury'                                          ? 'luxury'       as const :
      tier === 'premium'                                         ? 'premium'      as const :
      cabinClass === 'Business' || cabinClass === 'First'        ? 'luxury'       as const :
                                                                   'premium'      as const;

    const response = await runOrchestratorSearch({
      intent,
      destination,
      adults:   passengers ?? 2,
      tier:     resolvedTier,
      freeText: [cabinClass, tier].filter(Boolean).join(' ') || undefined,
    });

    return {
      category:          intent,
      results:           response.results,
      distilledTop3:     response.distilledTop3,
      count:             response.results.length,
      sourcesQueried:    response.totalSources,
      successfulSources: response.successfulSources,
      processingMs:      response.processingMs,
      warnings:          response.warnings,
    };
  },
});

// ── Tool 2: Timeline Mutation ─────────────────────────────────────────────────

export const mutateTimeline = tool<
  {
    dayId: string; category: string; title: string; subtitle: string;
    price: number; time?: string; reason: string; sourceId?: string;
  },
  MutateOutput
>({
  description:
    'Offer to place a high-confidence item into the travel timeline. ' +
    'Only call when confidence > 0.88 and the item matches Travel DNA perfectly. ' +
    'The UI presents a draggable confirmation card — user drags it to commit.',
  inputSchema: z.object({
    dayId:    z.string().describe('Target day "day-N" (e.g. "day-3")'),
    category: z.string().describe('flight | hotel | restaurant | activity | transport'),
    title:    z.string(),
    subtitle: z.string(),
    price:    z.number().describe('USD price'),
    time:     z.string().optional().describe('HH:MM 24h'),
    reason:   z.string().describe('Why this matches Travel DNA'),
    sourceId: z.string().optional(),
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
    'Update the predictive budget engine. Call after significant placements (>$500) ' +
    'or when burn rate exceeds 80%. Surface savings and overruns proactively.',
  inputSchema: z.object({
    category: z.string(),
    amount:   z.number().describe('USD. Positive = cost increase, negative = saving found'),
    reason:   z.string(),
    urgency:  z.string().optional().describe('low | medium | high | critical'),
    dayId:    z.string().optional(),
  }),
  execute: async (params): Promise<FinancialOutput> => ({
    adjusted: true,
    params,
    impact:   params.amount > 0 ? 'budget_increase' : 'savings_found',
    status:   'applied',
  }),
});

// ── Tool 4: Travel DNA Adjustment ─────────────────────────────────────────────

export const adjustDNA = tool<
  { field: string; value: number; reason: string },
  DNAOutput
>({
  description:
    'Silently refine Travel DNA when preferences emerge from conversation. ' +
    'Call without asking — only numeric fields, normalized 0–1.',
  inputSchema: z.object({
    field:  z.string().describe('paceIndex | culinaryAffinity | accommodationTier | experienceWeight | flexibilityScore'),
    value:  z.number().min(0).max(1),
    reason: z.string(),
  }),
  execute: async ({ field, value, reason }): Promise<DNAOutput> => ({
    adjusted: true, field, value, reason,
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
