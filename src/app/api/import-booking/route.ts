/**
 * POST /api/import-booking
 * Accepts raw confirmation email text and uses Claude to extract structured
 * booking data. Returns a normalised BookingImport object that the client
 * can preview and commit to the timeline.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z }                         from 'zod';
import { generateText }              from 'ai';
import { anthropic }                 from '@ai-sdk/anthropic';

// ── Schema ─────────────────────────────────────────────────────────────────────

const RequestSchema = z.object({
  text: z.string().min(10).max(20_000),
});

export interface ImportedSegment {
  type:        'flight' | 'hotel' | 'car' | 'activity' | 'rail';
  title:       string;
  provider:    string;
  date:        string;         // YYYY-MM-DD
  time?:       string;         // HH:MM
  endDate?:    string;         // YYYY-MM-DD (for hotels)
  endTime?:    string;         // HH:MM (arrival)
  origin?:     string;         // airport/city
  destination?: string;
  flightNum?:  string;         // e.g. "AA 123"
  pnr?:        string;         // booking reference
  price?:      number;
  currency?:   string;
  seats?:      string;         // e.g. "14A, 14B"
  class?:      string;         // e.g. "Economy", "Business"
  notes?:      string;
}

export interface BookingImportResponse {
  status:    'ok' | 'error' | 'empty';
  segments:  ImportedSegment[];
  message?:  string;
  rawCount:  number;
}

// ── Claude extraction ─────────────────────────────────────────────────────────

const EXTRACTION_PROMPT = `You are a travel booking parser. Extract ALL travel segments from the email text below.

Return ONLY a JSON array of segment objects. No prose, no markdown, just the raw JSON array.

Each segment must include:
- type: "flight" | "hotel" | "car" | "activity" | "rail"
- title: descriptive name (e.g. "New York → London", "Hilton Paris Opera", "Economy Rental Car")
- provider: airline/hotel/car company name
- date: YYYY-MM-DD (departure or check-in)
- time: HH:MM 24h (departure or check-in time, if available)
- endDate: YYYY-MM-DD (arrival date or check-out, if available)
- endTime: HH:MM (arrival time, if available)
- origin: city or airport for flights/rail
- destination: city or airport for flights/rail
- flightNum: flight number (e.g. "BA 117")
- pnr: booking/confirmation reference code
- price: numeric total price (no currency symbol)
- currency: 3-letter ISO code (USD, EUR, GBP, ILS, etc.)
- seats: seat assignment(s) if present
- class: cabin/service class
- notes: any other relevant info (baggage allowance, check-in deadline, etc.)

Rules:
- Include EVERY segment found — don't skip layovers or connections
- For return flights, create separate segments
- If a field is not found, omit it (don't use null)
- Date format MUST be YYYY-MM-DD
- Time format MUST be HH:MM (24-hour)
- If only year+month is found without day, use the 1st of that month

EMAIL TEXT:
`;

export async function POST(req: NextRequest): Promise<NextResponse<BookingImportResponse>> {
  const body   = await req.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ status: 'error', segments: [], message: 'Invalid request body', rawCount: 0 }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ status: 'error', segments: [], message: 'ANTHROPIC_API_KEY not configured', rawCount: 0 }, { status: 503 });
  }

  try {
    const { text: raw } = await generateText({
      model:           anthropic('claude-haiku-4-5-20251001'),
      messages:        [{ role: 'user', content: EXTRACTION_PROMPT + parsed.data.text }],
      maxOutputTokens: 2048,
    });

    // Extract JSON array from the response
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) {
      return NextResponse.json({ status: 'empty', segments: [], message: 'No travel segments found in this text', rawCount: 0 });
    }

    const segments = JSON.parse(match[0]) as ImportedSegment[];
    if (!Array.isArray(segments) || segments.length === 0) {
      return NextResponse.json({ status: 'empty', segments: [], message: 'No travel segments found in this text', rawCount: 0 });
    }

    // Light normalisation
    const clean = segments.filter(s => s.type && s.title && s.date).map(s => ({
      ...s,
      date: s.date?.slice(0, 10) ?? '',
      endDate: s.endDate?.slice(0, 10),
    }));

    return NextResponse.json({ status: 'ok', segments: clean, rawCount: clean.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Extraction failed';
    return NextResponse.json({ status: 'error', segments: [], message: msg, rawCount: 0 }, { status: 500 });
  }
}
