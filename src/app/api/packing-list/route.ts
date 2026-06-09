/**
 * POST /api/packing-list
 * Generates a personalized packing list using Claude.
 * Considers: destination, trip duration, activities, cabin class, weather forecast.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z }                          from 'zod';
import { generateText }               from 'ai';
import { anthropic }                  from '@ai-sdk/anthropic';

const RequestSchema = z.object({
  destination:  z.string().min(1),
  nights:       z.coerce.number().int().min(1).max(60).default(7),
  activities:   z.array(z.string()).default([]),
  cabinClass:   z.enum(['Economy', 'Business', 'First']).default('Economy'),
  weather:      z.object({ tempC: z.number().optional(), condition: z.string().optional() }).optional(),
  travelers:    z.coerce.number().int().min(1).max(20).default(2),
  tripStyle:    z.string().optional(),
});

export interface PackingCategory {
  id:    string;
  label: string;
  icon:  string;
  items: PackingItem[];
}

export interface PackingItem {
  id:       string;
  text:     string;
  essential: boolean;
  qty?:     string;
}

export interface PackingListResponse {
  status:       'ok' | 'error';
  destination:  string;
  categories:   PackingCategory[];
  totalItems:   number;
  message?:     string;
  generatedAt:  number;
}

const SYSTEM = `You are a world-class travel packing expert. Generate a personalized, practical packing list.

Return ONLY valid JSON — no prose, no markdown fences. Structure:
{
  "categories": [
    {
      "id": "clothing",
      "label": "Clothing",
      "icon": "👕",
      "items": [
        { "id": "c1", "text": "T-shirts (3)", "essential": true, "qty": "3" },
        { "id": "c2", "text": "Smart casual shirt", "essential": false }
      ]
    }
  ]
}

Categories to include (use exactly these IDs): clothing, footwear, toiletries, electronics, documents, health, activities, misc.

Rules:
- Make items SPECIFIC and actionable (not "clothes" but "lightweight trousers (2)")
- Mark essential=true for non-negotiable items
- Include qty when meaningful (e.g., "3", "1 pair")
- Adapt to weather: cold = pack layers; hot/humid = lightweight; beach = sunscreen, rash guard
- Adapt to activities: hiking = poles, trekking socks; beach = snorkel, rash guard
- Adapt to cabin class: Business/First = noise-cancelling headphones, eye mask, compression socks
- Include destination-specific: Israel → converter adapter; Japan → IC card reminder; Europe → EU plug adapter
- Keep it realistic (60–90 items total max)
- Never repeat items across categories`;

export async function POST(req: NextRequest): Promise<NextResponse<PackingListResponse>> {
  const body   = await req.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ status: 'error', destination: '', categories: [], totalItems: 0, message: 'Invalid request', generatedAt: Date.now() }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ status: 'error', destination: '', categories: [], totalItems: 0, message: 'ANTHROPIC_API_KEY not configured', generatedAt: Date.now() }, { status: 503 });
  }

  const q = parsed.data;
  const weatherDesc = q.weather?.tempC !== undefined
    ? `${Math.round(q.weather.tempC)}°C, ${q.weather.condition ?? 'mixed'}`
    : 'weather unknown';

  const prompt = `Generate a packing list for:
- Destination: ${q.destination}
- Duration: ${q.nights} nights
- Travelers: ${q.travelers}
- Cabin class: ${q.cabinClass}
- Activities: ${q.activities.length > 0 ? q.activities.join(', ') : 'general sightseeing'}
- Weather: ${weatherDesc}
${q.tripStyle ? `- Trip style: ${q.tripStyle}` : ''}

Return JSON only.`;

  try {
    const { text } = await generateText({
      model:           anthropic('claude-haiku-4-5-20251001'),
      system:          SYSTEM,
      messages:        [{ role: 'user', content: prompt }],
      maxOutputTokens: 3000,
    });

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON in response');

    const data = JSON.parse(match[0]) as { categories: PackingCategory[] };
    const totalItems = data.categories.reduce((s, c) => s + c.items.length, 0);

    return NextResponse.json({
      status:      'ok',
      destination: q.destination,
      categories:  data.categories,
      totalItems,
      generatedAt: Date.now(),
    });
  } catch (err) {
    return NextResponse.json({
      status:      'error',
      destination: q.destination,
      categories:  [],
      totalItems:  0,
      message:     err instanceof Error ? err.message : 'Generation failed',
      generatedAt: Date.now(),
    }, { status: 500 });
  }
}
