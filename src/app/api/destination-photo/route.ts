import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const QuerySchema = z.object({
  q: z.string().min(1).max(80),
});

// 5-minute in-memory cache to avoid hammering Unsplash
const cache = new Map<string, { url: string; ts: number }>();
const TTL   = 5 * 60 * 1000;

export async function GET(req: NextRequest) {
  const parsed = QuerySchema.safeParse({ q: req.nextUrl.searchParams.get('q') });
  if (!parsed.success) {
    return NextResponse.json({ status: 'error', error: 'Invalid query' }, { status: 400 });
  }
  const { q } = parsed.data;

  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) {
    return NextResponse.json({ status: 'needs_api_key', provider: 'Unsplash', setupUrl: 'https://unsplash.com/developers' });
  }

  const cacheKey = q.toLowerCase().trim();
  const cached   = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < TTL) {
    return NextResponse.json({ status: 'ok', url: cached.url });
  }

  try {
    const res = await fetch(
      `https://api.unsplash.com/photos/random?query=${encodeURIComponent(q + ' travel landscape')}&orientation=landscape&count=1`,
      {
        headers: { Authorization: `Client-ID ${key}` },
        next: { revalidate: 300 },
      },
    );

    if (!res.ok) {
      return NextResponse.json({ status: 'error', error: `Unsplash ${res.status}` }, { status: 502 });
    }

    const data  = await res.json() as Array<{ urls?: { regular?: string } }>;
    const photo = Array.isArray(data) ? data[0] : null;
    const url   = photo?.urls?.regular ?? null;

    if (url) {
      cache.set(cacheKey, { url, ts: Date.now() });
    }

    return NextResponse.json({ status: url ? 'ok' : 'no_result', url });
  } catch (err) {
    return NextResponse.json({ status: 'error', error: String(err) }, { status: 500 });
  }
}
