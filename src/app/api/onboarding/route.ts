import { anthropic } from '@ai-sdk/anthropic';
import { streamText, tool, convertToModelMessages, stepCountIs, UIMessage } from 'ai';
import { z } from 'zod';
import { NextRequest } from 'next/server';

const GUIDED_SYSTEM = `You are Unit — an elite AI travel concierge at the world's most sophisticated travel OS.

Your mission: Collect everything needed to build the user's perfect trip through natural, energetic conversation.

RULES (follow strictly):
1. Ask EXACTLY ONE question per message — never multiple
2. Acknowledge the user's answer warmly and specifically before asking the next question
3. Collect in this exact order: destination → travel dates & duration → number of travelers → total budget → travel style/vibe
4. When you have all 5 pieces, immediately call commitTrip — do NOT say you will call it, just call it
5. Be enthusiastic, warm, and make travel feel extraordinary — not form-like
6. Do NOT use bullet points or numbered lists in your messages
7. Keep messages short — 2–3 sentences max
8. If the user is vague (e.g. "sometime this summer"), ask a gentle follow-up

Start: Brief warm greeting as Unit (1 sentence), then immediately ask for their destination.`;

export async function POST(req: NextRequest) {
  const body = await req.json() as { messages: Array<Omit<UIMessage, 'id'>> };

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: GUIDED_SYSTEM,
    messages: await convertToModelMessages(body.messages),
    stopWhen: stepCountIs(3),
    tools: {
      commitTrip: tool({
        description: 'Finalize and commit all trip details once you have collected destination, dates, travelers, budget, and preferences.',
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
    },
  });

  return result.toUIMessageStreamResponse();
}
