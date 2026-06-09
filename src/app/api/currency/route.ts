import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

// Frankfurter API — completely free, no API key, ECB data updated daily
// https://www.frankfurter.app/

export async function GET(req: NextRequest) {
  const base = req.nextUrl.searchParams.get('base') ?? 'USD';

  try {
    const res  = await fetch(
      `https://api.frankfurter.app/latest?from=${base}`,
      { next: { revalidate: 3600 } },
    );
    if (!res.ok) throw new Error(`Frankfurter ${res.status}`);
    const data = await res.json();

    return NextResponse.json({
      base:  data.base,
      date:  data.date,
      rates: data.rates,
    });
  } catch (e) {
    // Fallback static rates so UI never breaks
    const FALLBACK: Record<string, number> = {
      EUR: 0.92, GBP: 0.79, JPY: 149.2, ILS: 3.70,
      AED: 3.67, THB: 35.8, SGD: 1.34, AUD: 1.53,
      CAD: 1.36, CHF: 0.89, MXN: 17.2, BRL: 5.06,
    };
    return NextResponse.json({
      base: 'USD', date: 'fallback', rates: FALLBACK, error: String(e),
    });
  }
}
