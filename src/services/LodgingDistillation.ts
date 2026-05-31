import type { AggregatedLodging } from '@/services/OmniAggregator';
import type { LodgingEntity, HiddenFee, PhotoSlide, LodgingSourcePrice } from '@/types/lodging';

// ── Seeded RNG ────────────────────────────────────────────────────────────────

const seededRand = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
};

// ── Trust Score ───────────────────────────────────────────────────────────────

function computeTrustScore(raw: AggregatedLodging): number {
  let score = raw.sentiment.positive * 100;
  if (raw.sourceCount > 15) score += 4;
  if (raw.sourceCount <  5) score -= 10;
  if (raw.rating > 4.8)     score += 3;
  if (raw.rating < 4.0)     score -= 8;
  if (raw.aiConfidence > 0.9) score += 2;
  return Math.min(100, Math.max(0, Math.round(score)));
}

// ── Hidden Fees ───────────────────────────────────────────────────────────────

const RESORT_FEE_BY_TIER: Record<string, number> = {
  'Ultra-Luxury': 65, '5★': 48, '4★': 30, '3★': 18,
};

function computeHiddenFees(raw: AggregatedLodging, rand: () => number): HiddenFee[] {
  const fees: HiddenFee[] = [];
  const base = RESORT_FEE_BY_TIER[raw.tier] ?? 35;

  fees.push({
    name:     'Resort & Destination Fee',
    amount:   Math.round(base + (rand() - 0.5) * 18),
    perNight: true,
    sources:  raw.sources.slice(0, 3),
    severity: base > 50 ? 'high' : base > 30 ? 'medium' : 'low',
  });

  fees.push({
    name:     'City & Tourist Tax (3%)',
    amount:   Math.round(raw.pricePerNight * 0.03),
    perNight: true,
    sources:  raw.sources.slice(0, 5),
    severity: 'low',
  });

  if (rand() > 0.4) {
    fees.push({
      name:     'Valet Parking',
      amount:   Math.round(40 + rand() * 42),
      perNight: true,
      sources:  [raw.sources[0]],
      severity: 'low',
    });
  }

  if (rand() > 0.52) {
    fees.push({
      name:     'Energy & Service Surcharge',
      amount:   Math.round(8 + rand() * 14),
      perNight: true,
      sources:  raw.sources.slice(0, 2),
      severity: 'low',
    });
  }

  return fees;
}

// ── Photos (gradient placeholders) ───────────────────────────────────────────

const DESTINATION_PHOTOS: Record<string, PhotoSlide[]> = {
  'Mexico City': [
    { id: 1, label: 'Grand Lobby',        sublabel: 'Marble entrance · 24-hour concierge', gradient: 'linear-gradient(145deg, #1a1a2e 0%, #c0392b 100%)' },
    { id: 2, label: 'King Suite',         sublabel: 'City panorama · Floor 28',             gradient: 'linear-gradient(145deg, #16213e 0%, #0f3460 100%)' },
    { id: 3, label: 'Rooftop Pool',       sublabel: 'Heated infinity · Floor 26',           gradient: 'linear-gradient(145deg, #0a2e3a 0%, #006064 100%)' },
    { id: 4, label: 'Signature Restaurant', sublabel: 'Award-winning cuisine',              gradient: 'linear-gradient(145deg, #2d1b00 0%, #6b3a0a 100%)' },
    { id: 5, label: 'Spa Suite',          sublabel: 'Couples treatment room',               gradient: 'linear-gradient(145deg, #1a1a2e 0%, #4a148c 100%)' },
  ],
  'Tulum': [
    { id: 1, label: 'Jungle Villa',       sublabel: 'Treetop panorama · Eco architecture', gradient: 'linear-gradient(145deg, #1a3a2e 0%, #2d6a4f 100%)' },
    { id: 2, label: 'Private Cenote',     sublabel: 'Crystal-clear natural pool',           gradient: 'linear-gradient(145deg, #0a2e1f 0%, #00695c 100%)' },
    { id: 3, label: 'Private Beach',      sublabel: '200m beachfront access',               gradient: 'linear-gradient(145deg, #0a1628 0%, #1565c0 100%)' },
    { id: 4, label: 'Open-Air Spa',       sublabel: 'Holistic treatments at dusk',          gradient: 'linear-gradient(145deg, #2d1b00 0%, #bf7f3c 100%)' },
    { id: 5, label: 'Villa Interior',     sublabel: 'Handwoven Mexican textiles',           gradient: 'linear-gradient(145deg, #1a2a1a 0%, #2d4a1e 100%)' },
  ],
  'Riviera Maya': [
    { id: 1, label: 'Lagoon Suite',       sublabel: 'Private dock & waterway',              gradient: 'linear-gradient(145deg, #001f3f 0%, #0074d9 100%)' },
    { id: 2, label: 'Infinity Pool',      sublabel: 'Facing Caribbean Sea',                 gradient: 'linear-gradient(145deg, #0a2e3a 0%, #00838f 100%)' },
    { id: 3, label: 'Private Beach',      sublabel: 'White-sand shore · Palm grove',        gradient: 'linear-gradient(145deg, #002244 0%, #0055a5 100%)' },
    { id: 4, label: 'Lazy River',         sublabel: '620m winding water feature',           gradient: 'linear-gradient(145deg, #0a3a3a 0%, #004d40 100%)' },
    { id: 5, label: 'Sense Spa',          sublabel: 'Rosewood signature wellness',          gradient: 'linear-gradient(145deg, #1a0a2e 0%, #6a1b9a 100%)' },
  ],
  'Cabo San Lucas': [
    { id: 1, label: 'Ocean Suite',        sublabel: 'Arch of Cabo panorama view',           gradient: 'linear-gradient(145deg, #1a0a00 0%, #8b4513 100%)' },
    { id: 2, label: 'Palmilla Beach',     sublabel: 'Private Sea of Cortez shore',          gradient: 'linear-gradient(145deg, #001a2e 0%, #0277bd 100%)' },
    { id: 3, label: 'Nobu Restaurant',    sublabel: 'Cliff-side ocean-to-table dining',     gradient: 'linear-gradient(145deg, #0a0a1e 0%, #1a237e 100%)' },
    { id: 4, label: 'Guerlain Spa',       sublabel: '12 oceanfront treatment rooms',        gradient: 'linear-gradient(145deg, #1e0a0a 0%, #7b1fa2 100%)' },
    { id: 5, label: 'Infinity Pool',      sublabel: 'Saltwater · Sea of Cortez views',      gradient: 'linear-gradient(145deg, #002a4a 0%, #01579b 100%)' },
  ],
};

function resolvePhotos(destination: string): PhotoSlide[] {
  for (const [city, slides] of Object.entries(DESTINATION_PHOTOS)) {
    if (destination.toLowerCase().includes(city.toLowerCase())) return slides;
  }
  return DESTINATION_PHOTOS['Mexico City'];
}

// ── Source Price Comparison ───────────────────────────────────────────────────

const SOURCE_ENGINE_ID: Record<string, string> = {
  'Booking.com': 'booking', 'Airbnb': 'airbnb', 'Expedia Hotels': 'expedia-h',
  'Hotels.com': 'hotels-com', 'HotelTonight': 'hotel-tonight',
  'Hyatt Direct': 'hyatt', 'Four Seasons Direct': 'four-seasons',
  'Marriott Bonvoy': 'marriott', 'IHG One Rewards': 'ihg', 'Hilton Honors': 'hilton',
  'Mr & Mrs Smith': 'mr-mrs-smith', 'Design Hotels': 'design-hotels',
  'Small Luxury Hotels': 'slh', 'Tablet Hotels': 'tablet-hotels',
  'Secret Escapes': 'secret-escapes', 'Agoda': 'agoda',
  'Trip.com Hotels': 'trip-com', 'Relais & Châteaux': 'relais',
  'Leading Hotels of the World': 'leading', 'Preferred Hotels': 'preferred',
};

function buildSourcePrices(raw: AggregatedLodging, rand: () => number): LodgingSourcePrice[] {
  return raw.sources.slice(0, 10).map(name => {
    const delta = (rand() - 0.47) * raw.pricePerNight * 0.2;
    const ppn   = Math.max(Math.round(raw.pricePerNight * 0.84), Math.round(raw.pricePerNight + delta));
    return {
      engineId:     SOURCE_ENGINE_ID[name] ?? name.toLowerCase().replace(/[\s&]/g, '-'),
      engineName:   name,
      pricePerNight: ppn,
      totalPrice:   ppn * raw.nights,
      available:    rand() > 0.07,
    };
  });
}

// ── Recommendation ────────────────────────────────────────────────────────────

function resolve(trustScore: number, feeRatio: number): LodgingEntity['recommendation'] {
  if (trustScore >= 88 && feeRatio < 0.12) return 'book-now';
  if (trustScore >= 72 && feeRatio < 0.22) return 'compare';
  if (trustScore >= 55)                    return 'watch';
  return 'skip';
}

// ── Main export ───────────────────────────────────────────────────────────────

export function distillLodging(rawLodging: AggregatedLodging[]): LodgingEntity[] {
  return rawLodging.map((raw, idx) => {
    const rand       = seededRand(Math.round(raw.pricePerNight) + idx * 7919);
    const trustScore = computeTrustScore(raw);
    const hiddenFees = computeHiddenFees(raw, rand);

    const feeTotal = hiddenFees.reduce((sum, f) =>
      sum + (f.perNight ? f.amount * raw.nights : f.amount), 0,
    );

    return {
      ...raw,
      trustScore,
      hiddenFees,
      photos:        resolvePhotos(raw.destination),
      sourcePrices:  buildSourcePrices(raw, rand),
      feeTotal:      Math.round(feeTotal),
      totalWithFees: Math.round(raw.totalPrice + feeTotal),
      recommendation: resolve(trustScore, feeTotal / raw.totalPrice),
    };
  });
}
