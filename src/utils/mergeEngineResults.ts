import type {
  NormalizedResult,
  NormalizedFlight,
  NormalizedHotel,
  NormalizedRestaurant,
  NormalizedAttraction,
  NormalizedTransit,
} from '@/types/TravelEntities';

// ── Fingerprint generators ────────────────────────────────────────────────────
// Each type computes a canonical string to identify the "same" entity across
// engines — deduplicating e.g. AA 443 MEX→CUN when it appears in Skyscanner,
// Amadeus, and Kiwi simultaneously.

function fingerprintOf(r: NormalizedResult): string {
  switch (r.type) {
    case 'flight':
      return `flight|${r.airline.toLowerCase()}|${r.flightNumber.toUpperCase()}|${r.origin}|${r.destination}|${r.departureISO.slice(0, 16)}`;

    case 'hotel':
      return `hotel|${r.name.toLowerCase().replace(/\s+/g, '-')}|${r.city.toLowerCase()}`;

    case 'restaurant':
      return `restaurant|${r.name.toLowerCase().replace(/\s+/g, '-')}|${r.city.toLowerCase()}`;

    case 'attraction':
      return `attraction|${r.title.toLowerCase().replace(/\s+/g, '-')}|${r.city.toLowerCase()}`;

    case 'transit':
      return `transit|${r.provider.toLowerCase().replace(/\s+/g, '-')}|${r.fromLabel.toLowerCase()}|${r.toLabel.toLowerCase()}|${r.mode}`;
  }
}

// ── Type-specific merge logic ─────────────────────────────────────────────────
// For each entity type, when duplicates are found we keep the cheapest price,
// merge the `availableAt` array, and average the confidence score.

function mergeTwo<T extends NormalizedResult>(a: T, b: T): T {
  const mergedAvailableAt = Array.from(new Set([...a.availableAt, ...b.availableAt]));
  const avgConfidence     = (a.confidence + b.confidence) / 2;

  const base = {
    ...a,
    availableAt: mergedAvailableAt,
    confidence:  avgConfidence,
    fetchedAt:   a.fetchedAt < b.fetchedAt ? b.fetchedAt : a.fetchedAt, // keep latest
  };

  // Always pick the cheaper price
  if (a.type === 'flight' && b.type === 'flight') {
    const af = a as NormalizedFlight;
    const bf = b as NormalizedFlight;
    return { ...base, priceUSD: Math.min(af.priceUSD, bf.priceUSD) } as T;
  }

  if (a.type === 'hotel' && b.type === 'hotel') {
    const ah = a as NormalizedHotel;
    const bh = b as NormalizedHotel;
    const cheaper = ah.priceUSD <= bh.priceUSD ? ah : bh;
    return { ...base, priceUSD: cheaper.priceUSD, pricePerNight: cheaper.pricePerNight } as T;
  }

  if (a.type === 'restaurant' && b.type === 'restaurant') {
    const ar = a as NormalizedRestaurant;
    const br = b as NormalizedRestaurant;
    // Merge available time slots
    const mergedSlots = Array.from(new Set([...ar.availableSlots, ...br.availableSlots])).sort();
    const cheaperPrice = Math.min(ar.pricePerPerson, br.pricePerPerson);
    // Average ratings when both have them
    const avgRating = (ar.guestRating !== undefined && br.guestRating !== undefined)
      ? (ar.guestRating + br.guestRating) / 2 : ar.guestRating ?? br.guestRating;
    return {
      ...base,
      priceUSD:       cheaperPrice,
      pricePerPerson: cheaperPrice,
      availableSlots: mergedSlots,
      guestRating:    avgRating,
    } as T;
  }

  if (a.type === 'attraction' && b.type === 'attraction') {
    const aa = a as NormalizedAttraction;
    const ba = b as NormalizedAttraction;
    return { ...base, priceUSD: Math.min(aa.priceUSD, ba.priceUSD), pricePerPerson: Math.min(aa.pricePerPerson, ba.pricePerPerson) } as T;
  }

  if (a.type === 'transit' && b.type === 'transit') {
    const at = a as NormalizedTransit;
    const bt = b as NormalizedTransit;
    return { ...base, priceUSD: Math.min(at.priceUSD, bt.priceUSD) } as T;
  }

  return base as T;
}

// ── MergeStats ────────────────────────────────────────────────────────────────

export interface MergeStats {
  inputCount:      number;
  outputCount:     number;
  deduplicatedCount: number;
  byType:          Record<string, { in: number; out: number }>;
}

// ── mergeEngineResults ────────────────────────────────────────────────────────

export function mergeEngineResults(results: NormalizedResult[]): {
  merged: NormalizedResult[];
  stats:  MergeStats;
} {
  const map = new Map<string, NormalizedResult>();
  const typeStats: Record<string, { in: number; out: number }> = {};

  for (const result of results) {
    // Track input counts per type
    if (!typeStats[result.type]) typeStats[result.type] = { in: 0, out: 0 };
    typeStats[result.type].in++;

    const fp = fingerprintOf(result);

    if (map.has(fp)) {
      const existing = map.get(fp)!;
      map.set(fp, mergeTwo(existing, result));
    } else {
      map.set(fp, result);
    }
  }

  const merged = Array.from(map.values());

  // Count outputs per type
  for (const r of merged) {
    typeStats[r.type].out = (typeStats[r.type].out ?? 0) + 1;
  }

  return {
    merged,
    stats: {
      inputCount:        results.length,
      outputCount:       merged.length,
      deduplicatedCount: results.length - merged.length,
      byType:            typeStats,
    },
  };
}

// ── Convenience: sort merged results by confidence descending ─────────────────

export function rankByConfidence(results: NormalizedResult[]): NormalizedResult[] {
  return [...results].sort((a, b) => b.confidence - a.confidence);
}

// ── Convenience: filter to a specific type (preserves type narrowing) ─────────

export function filterByType<T extends NormalizedResult['type']>(
  results: NormalizedResult[],
  type:    T,
): Extract<NormalizedResult, { type: T }>[] {
  return results.filter((r): r is Extract<NormalizedResult, { type: T }> => r.type === type);
}
