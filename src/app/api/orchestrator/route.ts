// Unitravel OmniOrchestrator — HTTP surface for the 30-engine search service.
// Core parallel-fetch logic lives in OrchestratorService.ts (shared with AI tools).
// Supports both full JSON response and SSE streaming (Accept: text/event-stream).

import { NextRequest, NextResponse } from 'next/server';
import {
  runOrchestratorSearch,
  streamOrchestratorSearch,
  ALL_ENDPOINTS,
} from '@/services/OrchestratorService';
import type { OrchestratorQuery } from '@/services/OrchestratorService';

// ── Re-export types for consumers ─────────────────────────────────────────────
export type { TravelEntity, OrchestratorQuery, OrchestratorResponse } from '@/services/OrchestratorService';

// ── POST /api/orchestrator ────────────────────────────────────────────────────
// Full JSON:      POST body, Accept: application/json  (default)
// Streaming SSE:  POST body, Accept: text/event-stream

export async function POST(req: NextRequest): Promise<NextResponse | Response> {
  let query: OrchestratorQuery;
  try {
    query = await req.json() as OrchestratorQuery;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!query.destination || typeof query.destination !== 'string') {
    return NextResponse.json({ error: 'destination is required' }, { status: 422 });
  }

  // ── SSE streaming ─────────────────────────────────────────────────────────
  if (req.headers.get('accept') === 'text/event-stream') {
    const encoder = new TextEncoder();
    const gen     = streamOrchestratorSearch(query);

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of gen) {
            controller.enqueue(encoder.encode(event));
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type':                'text/event-stream',
        'Cache-Control':               'no-cache',
        'Connection':                  'keep-alive',
        'X-Accel-Buffering':           'no',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  // ── Full JSON ─────────────────────────────────────────────────────────────
  const result = await runOrchestratorSearch(query);

  return NextResponse.json(result, {
    headers: {
      'Cache-Control':        'public, s-maxage=60, stale-while-revalidate=120',
      'X-Sources-Queried':    String(result.totalSources),
      'X-Successful-Sources': String(result.successfulSources),
      'X-Processing-Ms':      String(result.processingMs),
    },
  });
}

// ── GET /api/orchestrator ─────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    service:       'Unitravel OmniOrchestrator',
    version:       '2.0.0',
    totalSources:  ALL_ENDPOINTS.length,
    categories:    ['flights', 'hotels', 'restaurants', 'activities', 'all'],
    tiers:         ['economy', 'premium', 'luxury', 'ultra-luxury'],
    streaming:     'POST with Accept: text/event-stream for per-source live events',
    documentation: 'POST /api/orchestrator with OrchestratorQuery body',
  });
}
