// AIToolRegistry.ts — Client-side execution bridge for AI tool call results.
// When the server fires a tool and returns output, this registry applies
// the real-world side-effects: Zustand mutations, routing, budget recalc.

import type { DynamicToolUIPart } from 'ai';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import type { AggregatedResult } from '@/services/OmniAggregator';

// ── Output types (mirroring server-side execute return shapes) ────────────────

interface NavigateOutput  { zoneId: string; reason: string; navigated: boolean }
interface CommitOutput    {
  committed: true; entityId: string; targetDayId: string;
  category: string; title: string; subtitle: string;
  price: number; time?: string; duration?: string; reason: string;
  committedAt: number;
}
interface MutateOutput    {
  requiresConfirmation: boolean;
  entity: { dayId: string; category: string; title: string; subtitle: string; price: number; time?: string };
  status: string;
}
interface FinancialOutput { adjusted: boolean; params: { category: string; amount: number }; status: string }
interface DNAOutput       { adjusted: boolean; field: string; value: number; reason: string }

// ── Registry ──────────────────────────────────────────────────────────────────

export interface ToolRegistryContext {
  router:                   AppRouterInstance;
  placeEntity:              (dayId: string, source: AggregatedResult) => void;
  calculatePredictiveBudget: () => void;
  patchDNA:                 (field: string, value: number) => void;
  navigatedIds:             Set<string>;
  appliedIds:               Set<string>;
}

export type ToolRegistryResult =
  | { type: 'navigated';  zoneId: string }
  | { type: 'committed';  entity: CommitOutput }
  | { type: 'suggested';  entity: MutateOutput['entity'] }
  | { type: 'budget';     impact: string }
  | { type: 'dna';        field: string; value: number }
  | { type: 'noop' };

// Apply a single dynamic-tool part to the real world (idempotent via appliedIds).
export function applyToolResult(
  dp:  DynamicToolUIPart,
  ctx: ToolRegistryContext,
): ToolRegistryResult {
  if (dp.state !== 'output-available') return { type: 'noop' };
  const key = dp.toolCallId;
  if (ctx.appliedIds.has(key)) return { type: 'noop' };
  ctx.appliedIds.add(key);

  switch (dp.toolName) {
    case 'navigateWorkspace': {
      const out = dp.output as NavigateOutput;
      if (!ctx.navigatedIds.has(key)) {
        ctx.navigatedIds.add(key);
        setTimeout(() => ctx.router.push(`/zone/${out.zoneId}`), 400);
      }
      return { type: 'navigated', zoneId: out.zoneId };
    }

    case 'commitToTimeline': {
      const out = dp.output as CommitOutput;
      // Build a minimal AggregatedResult-compatible object for placeEntity
      const category = out.category as 'flight' | 'hotel' | 'restaurant' | 'activity' | 'transport';
      const synthetic = buildSyntheticEntity(out);
      // placeEntity expects AggregatedResult — use a cast since we're AI-originated
      ctx.placeEntity(out.targetDayId, synthetic as Parameters<typeof ctx.placeEntity>[1]);
      // Budget recalc after commit
      ctx.calculatePredictiveBudget();
      return { type: 'committed', entity: out };
    }

    case 'mutateTimeline': {
      const out = dp.output as MutateOutput;
      // mutateTimeline requires user drag — just surface the card, don't auto-place
      return { type: 'suggested', entity: out.entity };
    }

    case 'adjustFinancialModel': {
      ctx.calculatePredictiveBudget();
      const out = dp.output as FinancialOutput;
      return { type: 'budget', impact: out.params.amount > 0 ? 'increase' : 'savings' };
    }

    case 'adjustDNA': {
      const out = dp.output as DNAOutput;
      if (out.field && typeof out.value === 'number') {
        ctx.patchDNA(out.field, out.value);
      }
      return { type: 'dna', field: out.field, value: out.value };
    }

    default:
      return { type: 'noop' };
  }
}

// ── Synthetic entity builder ──────────────────────────────────────────────────

function buildSyntheticEntity(out: CommitOutput) {
  const category = out.category as 'flight' | 'hotel' | 'restaurant' | 'activity' | 'transport';

  // All AggregatedResult variants share these base fields;
  // non-flight fields are set to neutral defaults so placeEntity doesn't crash.
  return {
    id:                   out.entityId || `committed-${out.committedAt}`,
    category,
    sources:              ['AI Concierge'],
    sourceCount:          1,
    aiConfidence:         0.95,
    tags:                 [category, 'ai-committed'],
    price:                out.price,
    // Flight-specific (neutralized for non-flights):
    airline:              out.title,
    flightNumber:         '',
    route:                out.subtitle,
    origin:               '',
    destination:          '',
    departure:            out.time ?? '10:00',
    arrival:              '12:00',
    durationMin:          60,
    durationLabel:        out.duration ?? '1h',
    stops:                0,
    class:                'Economy' as const,
    carbonKg:             0,
    carbonLabel:          '',
    carbonAlternative:    '',
    priceRange:           [out.price, out.price] as [number, number],
    priceDropProbability: 0,
    seats:                1,
    refundable:           true,
    // Hotel-specific (neutralized):
    name:                 out.title,
    description:          out.subtitle,
    location:             '',
    roomType:             '',
    amenities:            [],
    rating:               0,
    reviewCount:          0,
    tier:                 'Premium' as const,
    nights:               1,
    pricePerNight:        out.price,
    totalPrice:           out.price,
    images:               [],
    checkIn:              '',
    checkOut:             '',
    freeCancellation:     true,
    breakfastIncluded:    false,
    coordinates:          { lat: 0, lng: 0 },
    aiHighlight:          out.reason,
  };
}
