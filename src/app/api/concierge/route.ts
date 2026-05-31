import { streamText, convertToModelMessages, UIMessage, stepCountIs } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { conciergeTools } from '@/services/AITools';
import type { TravelDNA } from '@/utils/FinancialEngine';

// ── Request shape ─────────────────────────────────────────────────────────────

interface TripContext {
  tripTitle:    string;
  travelers:    string[];
  destination:  string;
  startDate:    string;
  endDate:      string;
  budget: {
    total:       number;
    spent:       number;
    burnRate:    number;
    projected:   number;
    overBudgetBy?: number;
  };
  dnaProfile:   TravelDNA | null;
  activeDay:    string | null;
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

  return `You are ARIA — the Autonomous Routing Intelligence for Adventure — the world's most sophisticated AI travel concierge. You serve ultra-discerning clients with surgical precision.

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
7. FLAG budget stress (burnRate > 0.75) proactively.`;
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
    tools:    conciergeTools,
    stopWhen: stepCountIs(6),
    maxRetries: 2,
  });

  return result.toUIMessageStreamResponse();
}
