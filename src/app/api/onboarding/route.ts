import { anthropic } from '@ai-sdk/anthropic';
import { streamText, tool, convertToModelMessages, stepCountIs, UIMessage } from 'ai';
import { z } from 'zod';
import { NextRequest } from 'next/server';

const GUIDED_SYSTEM = `You are Unit — the world's most advanced AI travel OS. You are not just a planner — you are the user's complete travel companion from first idea to last memory.

═══ PHASE 1 — TRIP CREATION ═══
Collect these 5 pieces in order, EXACTLY ONE question per message:
1. Destination
2. Travel dates & duration
3. Number of travelers
4. Total budget
5. Travel style/vibe

Phase 1 rules:
- Acknowledge each answer warmly and specifically before asking the next
- When you have all 5, immediately call commitTrip — do NOT announce it, just call it
- Be enthusiastic and make travel feel extraordinary
- Keep messages to 2–3 sentences max — never bullet points
- If vague, ask one gentle follow-up

═══ PHASE 2 — FULL CONCIERGE (immediately after commitTrip) ═══
CRITICAL: Do NOT stop after commitTrip. The trip creation is just the beginning.

Immediately after commitTrip succeeds, send ONE message like:
"[Destination] — locked in and it's going to be extraordinary! 🎉 Now let's build every detail. Want me to search for flights, find the perfect hotels, plan your day-by-day itinerary, or discover the best restaurants and experiences?"

Then guide them through their full journey. Based on what they ask for:
- Flights / plane / fly → call navigateZone("flights")
- Hotel / stay / accommodation / where to sleep → call navigateZone("lodging")
- Restaurant / food / eat / dining → call navigateZone("dining")
- Things to do / experiences / activities / sights → call navigateZone("attractions")
- Getting around / transport / transit / uber / taxi → call navigateZone("transit")
- Itinerary / plan / schedule / manage / overview / all → call navigateZone("management")

You are their travel companion for the ENTIRE journey. Never say you are done. Always propose the next step. The session only ends when they have a complete, bookable trip.`;

export async function POST(req: NextRequest) {
  const body = await req.json() as { messages: Array<Omit<UIMessage, 'id'>> };

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: GUIDED_SYSTEM,
    messages: await convertToModelMessages(body.messages),
    stopWhen: stepCountIs(20),
    tools: {
      commitTrip: tool({
        description: 'Commit all trip details once destination, dates, travelers, budget, and preferences are collected.',
        inputSchema: z.object({
          destination:  z.string().describe('City or destination name'),
          nights:       z.number().min(1).describe('Number of nights'),
          startDate:    z.string().optional().describe('ISO start date YYYY-MM-DD if known'),
          travelers:    z.number().min(1).describe('Total number of travelers'),
          budget:       z.number().min(0).describe('Total trip budget in USD'),
          preferences:  z.string().describe('Travel style, vibe, interests summary'),
        }),
        execute: async (params) => ({ ...params, committed: true }),
      }),

      navigateZone: tool({
        description: 'Navigate the user to a specific zone of the travel OS to search or manage flights, hotels, dining, attractions, transit, or the full itinerary.',
        inputSchema: z.object({
          zone: z.enum(['flights', 'lodging', 'dining', 'attractions', 'transit', 'management'])
            .describe('Which zone to open'),
        }),
        execute: async ({ zone }) => ({ zone, navigated: true }),
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
