// Real-time aggregation engine simulating 30+ global travel APIs

export const FLIGHT_SOURCES = [
  'Skyscanner','Google Flights','Amadeus GDS','Sabre Travel','ITA Matrix',
  'Kayak','Momondo','Expedia Flights','Orbitz','Travelport Galileo',
  'Farelogix NDC','AeroMexico Direct','United NDC','LATAM Direct','Delta SkyMiles NDC',
  'Hopper AI','Kiwi.com','Trip.com','Wego','JetRadar',
  'Dohop','AirHint','FlightHub','CheapAir','Hipmunk Legacy',
  'Matrix ITA','FareCompare','FlyScanner','Azul Direct','VivaAerobus NDC',
] as const;

export const LODGING_SOURCES = [
  'Booking.com','Airbnb','Expedia Hotels','Hotels.com','HotelTonight',
  'Hyatt Direct','Four Seasons Direct','Marriott Bonvoy','IHG One Rewards','Hilton Honors',
  'Mr & Mrs Smith','Design Hotels','Small Luxury Hotels','Tablet Hotels','Secret Escapes',
  'Agoda','Trip.com Hotels','Priceline Express','Trivago','Kayak Hotels',
  'Virtuoso','Relais & Châteaux','Leading Hotels of the World','Preferred Hotels','GHA Discovery',
  'Prestigia','Hotelspecials','Roomkey','JetBeds','LateRooms',
] as const;

export const DINING_SOURCES = [
  'Michelin Guide','OpenTable','Yelp','TripAdvisor','Google Maps Local',
  'TheFork','Resy','Tock','Eater','World\'s 50 Best Restaurants',
  'Latin America 50 Best','OAD Top 100','Zagat','The Infatuation','Condé Nast Traveler',
  'Food & Wine','Bon Appétit','Eater Heatmap','NY Times Dining','Monocle City Guide',
  'CDMX Food Guide','Tulum Eats Blog','Cabo Insider','Riviera Maya Concierge','Google Local Guides',
  'Foursquare City Guide','Wallpaper* City Guide','Tatler Restaurants','Harper\'s Bazaar Travel','Afar Media',
] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

export type FlightClass  = 'Economy' | 'Premium Economy' | 'Business' | 'First';
export type LodgingTier  = '3★' | '4★' | '5★' | 'Ultra-Luxury';
export type SentimentScore = { positive: number; neutral: number; negative: number; compound: number };

export interface RawFlightResult {
  source:        string;
  airline:       string;
  flightNumber:  string;
  origin:        string;
  destination:   string;
  departure:     string;
  arrival:       string;
  durationMin:   number;
  stops:         number;
  class:         FlightClass;
  price:         number;
  carbonKg:      number;
  seats:         number;
  refundable:    boolean;
}

export interface AggregatedFlight {
  id:                    string;
  category:              'flight';
  sources:               string[];
  sourceCount:           number;
  aiConfidence:          number;
  airline:               string;
  flightNumber:          string;
  route:                 string;
  origin:                string;
  destination:           string;
  departure:             string;
  arrival:               string;
  durationMin:           number;
  durationLabel:         string;
  stops:                 number;
  class:                 FlightClass;
  price:                 number;
  priceRange:            [number, number];
  carbonKg:              number;
  carbonLabel:           string;
  carbonAlternative:     string;
  priceDropProbability:  number;
  layoverOptimization?:  string;
  seats:                 number;
  refundable:            boolean;
  tags:                  string[];
}

export interface AggregatedLodging {
  id:            string;
  category:      'hotel';
  sources:       string[];
  sourceCount:   number;
  aiConfidence:  number;
  name:          string;
  location:      string;
  destination:   string;
  tier:          LodgingTier;
  roomType:      string;
  pricePerNight: number;
  totalPrice:    number;
  nights:        number;
  rating:        number;
  reviewCount:   number;
  sentiment:     SentimentScore;
  amenities:     string[];
  aiHighlight:   string;
  tags:          string[];
}

export interface AggregatedDining {
  id:                string;
  category:          'restaurant';
  sources:           string[];
  sourceCount:       number;
  aiConfidence:      number;
  name:              string;
  cuisine:           string;
  location:          string;
  destination:       string;
  pricePerPerson:    number;
  rating:            number;
  michelinStars?:    number;
  bestIn50?:         number;
  sentiment:         SentimentScore;
  reservationWindow: string;
  uberMinutes:       number;
  uberCost:          number;
  aiHighlight:       string;
  tags:              string[];
}

export type AggregatedResult = AggregatedFlight | AggregatedLodging | AggregatedDining;

export interface AggregationBatch {
  query:          string;
  destination:    string;
  date:           string;
  flights:        AggregatedFlight[];
  lodging:        AggregatedLodging[];
  dining:         AggregatedDining[];
  processedAt:    number;
  sourcesQueried: number;
  processingMs:   number;
}

// ── Utility helpers ──────────────────────────────────────────────────────────

const jitter = (base: number, pct = 0.15) =>
  base * (1 + (Math.random() - 0.5) * 2 * pct);

const pickN = <T>(arr: readonly T[], n: number): T[] =>
  [...arr].sort(() => Math.random() - 0.5).slice(0, n);

const mockDelay = (ms: number) => new Promise(r => setTimeout(r, ms));

const toHoursMinutes = (min: number) => `${Math.floor(min / 60)}h ${min % 60}m`;

const carbonLabel = (kg: number): string => {
  if (kg < 200)  return 'Low carbon';
  if (kg < 500)  return 'Moderate carbon';
  if (kg < 900)  return 'High carbon';
  return 'Very high carbon';
};

const carbonAlternative = (kg: number, route: string): string => {
  if (kg > 600) return `Train alternative saves ~${Math.round(kg * 0.7)}kg CO₂ (not available ${route})`;
  if (kg > 300) return `${Math.round(kg * 0.4)}kg CO₂ offset available via Atmosfair`;
  return 'Already low-impact flight';
};

const mockSentiment = (basePositive: number): SentimentScore => ({
  positive: Math.min(1, jitter(basePositive, 0.08)),
  neutral:  Math.min(1, jitter(0.12,         0.05)),
  negative: Math.max(0, 1 - basePositive - 0.12),
  compound: jitter(basePositive * 2 - 1,     0.06),
});

// ── Flight Aggregator ────────────────────────────────────────────────────────

const MEXICO_FLIGHTS: RawFlightResult[] = [
  {
    source: 'Amadeus GDS', airline: 'El Al + AeroMéxico', flightNumber: 'LY006/AM412',
    origin: 'TLV', destination: 'MEX', departure: '23:55', arrival: '+2 14:20',
    durationMin: 915, stops: 1, class: 'Business', price: 4840,
    carbonKg: 1240, seats: 4, refundable: true,
  },
  {
    source: 'Google Flights', airline: 'Iberia + AeroMéxico', flightNumber: 'IB3164/AM402',
    origin: 'TLV', destination: 'MEX', departure: '06:10', arrival: '+1 19:45',
    durationMin: 870, stops: 1, class: 'Business', price: 4320,
    carbonKg: 1180, seats: 2, refundable: true,
  },
  {
    source: 'Skyscanner', airline: 'Lufthansa + AeroMéxico', flightNumber: 'LH688/AM76',
    origin: 'TLV', destination: 'MEX', departure: '14:30', arrival: '+1 23:10',
    durationMin: 890, stops: 1, class: 'Business', price: 5100,
    carbonKg: 1310, seats: 6, refundable: false,
  },
];

async function aggregateFlights(): Promise<AggregatedFlight[]> {
  await mockDelay(jitter(280, 0.3));

  return MEXICO_FLIGHTS.map((r, i) => {
    const srcList = pickN(FLIGHT_SOURCES, Math.floor(jitter(18, 0.2)));
    return {
      id:           `flight-agg-${i}`,
      category:     'flight',
      sources:      srcList,
      sourceCount:  srcList.length,
      aiConfidence: parseFloat((jitter(0.88 - i * 0.04, 0.04)).toFixed(2)),
      airline:      r.airline,
      flightNumber: r.flightNumber,
      route:        `${r.origin} → ${r.destination}`,
      origin:       r.origin,
      destination:  r.destination,
      departure:    r.departure,
      arrival:      r.arrival,
      durationMin:  r.durationMin,
      durationLabel:toHoursMinutes(r.durationMin),
      stops:        r.stops,
      class:        r.class,
      price:        Math.round(jitter(r.price, 0.03)),
      priceRange:   [Math.round(r.price * 0.92), Math.round(r.price * 1.14)] as [number, number],
      carbonKg:     Math.round(jitter(r.carbonKg, 0.05)),
      carbonLabel:  carbonLabel(r.carbonKg),
      carbonAlternative: carbonAlternative(r.carbonKg, `${r.origin}–${r.destination}`),
      priceDropProbability: parseFloat((jitter(0.28, 0.4)).toFixed(2)),
      layoverOptimization: r.stops > 0 ? `Optimized ${r.stops}-stop via Madrid: +${Math.round(jitter(90, 0.3))}min, -$${Math.round(jitter(320, 0.2))}` : undefined,
      seats:        r.seats,
      refundable:   r.refundable,
      tags:         [r.class, r.refundable ? 'Refundable' : 'Non-refund', `${r.stops === 0 ? 'Non-stop' : r.stops + ' stop'}`],
    };
  });
}

// ── Lodging Aggregator ───────────────────────────────────────────────────────

const MEXICO_HOTELS = [
  { name: 'Four Seasons Mexico City', location: 'Paseo de la Reforma 500', destination: 'Mexico City', tier: 'Ultra-Luxury' as LodgingTier, roomType: 'City View Suite', pricePerNight: 680, nights: 4, rating: 4.92, reviewCount: 3841, basePositive: 0.91, amenities: ['Spa Millesime','3 Restaurants','Rooftop Pool','Butler Service','Airport Transfer'] },
  { name: 'Azulik Resort & Spa',       location: 'Sian Ka\'an Biosphere',      destination: 'Tulum',        tier: 'Ultra-Luxury' as LodgingTier, roomType: 'Overwater Villa',  pricePerNight: 940, nights: 5, rating: 4.88, reviewCount: 1204, basePositive: 0.87, amenities: ['Private Cenote','Treetop Restaurant','Spa Kin Toh','Treehouse Pool','No WiFi Retreat'] },
  { name: 'Rosewood Mayakoba',         location: 'Playa del Carmen',            destination: 'Riviera Maya',  tier: 'Ultra-Luxury' as LodgingTier, roomType: 'Lagoon Suite',    pricePerNight: 1100, nights: 7, rating: 4.95, reviewCount: 2156, basePositive: 0.94, amenities: ['Private Dock','3 Pools','Sense Spa','Golf Course','Lazy River'] },
  { name: 'One&Only Palmilla',         location: 'Palmilla Beach',              destination: 'Cabo San Lucas',tier: 'Ultra-Luxury' as LodgingTier, roomType: 'Ocean Suite',     pricePerNight: 1380, nights: 6, rating: 4.97, reviewCount: 1873, basePositive: 0.96, amenities: ['2 Pools','Nobu Restaurant','Guerlain Spa','Private Beach','Watersports Center'] },
];

async function aggregateLodging(): Promise<AggregatedLodging[]> {
  await mockDelay(jitter(320, 0.25));

  return MEXICO_HOTELS.map((h, i) => {
    const srcList = pickN(LODGING_SOURCES, Math.floor(jitter(22, 0.15)));
    const totalPrice = Math.round(jitter(h.pricePerNight * h.nights, 0.02));
    const highlights = [
      `Ranked #${i + 1} in ${h.destination} by ${srcList[0]} and ${srcList[1]}`,
      `AI analysis of ${Math.round(jitter(h.reviewCount, 0.05)).toLocaleString()} reviews: ${Math.round(h.basePositive * 100)}% positive`,
      `Honeymoon upgrade probability: ${Math.round(jitter(0.78, 0.15) * 100)}% based on booking timing`,
    ];
    return {
      id:            `hotel-agg-${i}`,
      category:      'hotel',
      sources:       srcList,
      sourceCount:   srcList.length,
      aiConfidence:  parseFloat((jitter(0.92 - i * 0.02, 0.03)).toFixed(2)),
      name:          h.name,
      location:      h.location,
      destination:   h.destination,
      tier:          h.tier,
      roomType:      h.roomType,
      pricePerNight: Math.round(jitter(h.pricePerNight, 0.04)),
      totalPrice,
      nights:        h.nights,
      rating:        parseFloat((jitter(h.rating, 0.01)).toFixed(2)),
      reviewCount:   Math.round(jitter(h.reviewCount, 0.05)),
      sentiment:     mockSentiment(h.basePositive),
      amenities:     h.amenities,
      aiHighlight:   highlights[0],
      tags:          [h.tier, h.roomType, `${h.nights} nights`],
    };
  });
}

// ── Dining Aggregator ────────────────────────────────────────────────────────

const MEXICO_RESTAURANTS = [
  { name: 'Pujol',               cuisine: 'Contemporary Mexican',   destination: 'Mexico City',    pricePerPerson: 280, rating: 4.92, michelinStars: 2, bestIn50: 13, basePositive: 0.96, location: 'Tennyson 133, Polanco',     uberMinutes: 12 },
  { name: 'Quintonil',           cuisine: 'Modern Mexican',         destination: 'Mexico City',    pricePerPerson: 220, rating: 4.88, michelinStars: 1, bestIn50: 22, basePositive: 0.93, location: 'Isaac Newton 55, Polanco',   uberMinutes: 9 },
  { name: 'Hartwood',            cuisine: 'Wood-Fire Contemporary', destination: 'Tulum',          pricePerPerson: 180, rating: 4.85, basePositive: 0.91,              location: 'Carretera Tulum-Boca Paila',uberMinutes: 18 },
  { name: 'Rosewood Casa Marina',cuisine: 'Mexican Coastal',        destination: 'Riviera Maya',   pricePerPerson: 240, rating: 4.94, basePositive: 0.95,              location: 'Rosewood Mayakoba Resort',   uberMinutes: 5 },
  { name: 'El Farallon',         cuisine: 'Seafood Cliff-side',     destination: 'Cabo San Lucas', pricePerPerson: 320, rating: 4.96, basePositive: 0.97,              location: 'Palmilla Beach Cliff',       uberMinutes: 8 },
  { name: 'Manta by Enrique Olvera', cuisine: 'Ocean-to-Table',    destination: 'Cabo San Lucas', pricePerPerson: 260, rating: 4.90, bestIn50: 48, basePositive: 0.92, location: 'One&Only Palmilla',          uberMinutes: 3 },
];

async function aggregateDining(): Promise<AggregatedDining[]> {
  await mockDelay(jitter(240, 0.3));

  return MEXICO_RESTAURANTS.map((r, i) => {
    const srcList = pickN(DINING_SOURCES, Math.floor(jitter(16, 0.2)));
    const uberCost = Math.round(r.uberMinutes * 0.9 + jitter(4, 0.3));
    return {
      id:               `dining-agg-${i}`,
      category:         'restaurant',
      sources:          srcList,
      sourceCount:      srcList.length,
      aiConfidence:     parseFloat((jitter(0.91 - i * 0.015, 0.03)).toFixed(2)),
      name:             r.name,
      cuisine:          r.cuisine,
      location:         r.location,
      destination:      r.destination,
      pricePerPerson:   Math.round(jitter(r.pricePerPerson, 0.08)),
      rating:           parseFloat((jitter(r.rating, 0.01)).toFixed(2)),
      michelinStars:    r.michelinStars,
      bestIn50:         r.bestIn50,
      sentiment:        mockSentiment(r.basePositive),
      reservationWindow:`${Math.round(jitter(21, 0.3))} days in advance`,
      uberMinutes:      Math.round(jitter(r.uberMinutes, 0.15)),
      uberCost,
      aiHighlight:      r.michelinStars
        ? `${r.michelinStars}★ Michelin · AI distilled from ${srcList.length} sources · ${Math.round(r.basePositive * 100)}% positive reviews`
        : `Top pick from ${srcList.length} sources · ${r.cuisine} · ${Math.round(r.basePositive * 100)}% guest satisfaction`,
      tags:             [
        r.cuisine,
        r.michelinStars ? `${r.michelinStars}★ Michelin` : '',
        r.bestIn50       ? `#${r.bestIn50} World's 50 Best` : '',
        `$${r.pricePerPerson}pp`,
      ].filter(Boolean),
    };
  });
}

// ── OmniAggregator ───────────────────────────────────────────────────────────

export interface AggregatorProgress {
  phase:           'flight' | 'lodging' | 'dining' | 'ranking' | 'done';
  sourcesScanned:  number;
  totalSources:    number;
  currentSource:   string;
  percentComplete: number;
}

export class OmniAggregator {
  static readonly TOTAL_SOURCES =
    FLIGHT_SOURCES.length + LODGING_SOURCES.length + DINING_SOURCES.length;

  static async aggregate(): Promise<AggregationBatch> {
    const t0 = Date.now();
    const [flights, lodging, dining] = await Promise.all([
      aggregateFlights(),
      aggregateLodging(),
      aggregateDining(),
    ]);
    return {
      query:          'Ultra-luxury honeymoon Mexico Oct 2026',
      destination:    'Mexico',
      date:           '2026-10-01',
      flights:        flights.sort((a, b) => b.aiConfidence - a.aiConfidence).slice(0, 3),
      lodging:        lodging.sort((a, b) => b.aiConfidence - a.aiConfidence),
      dining:         dining.sort((a, b) => b.aiConfidence - a.aiConfidence).slice(0, 3),
      processedAt:    Date.now(),
      sourcesQueried: OmniAggregator.TOTAL_SOURCES,
      processingMs:   Date.now() - t0,
    };
  }

  static async *streamProgress(): AsyncGenerator<AggregatorProgress> {
    const phases: Array<{ phase: AggregatorProgress['phase']; sources: number; label: string }> = [
      { phase: 'flight',  sources: FLIGHT_SOURCES.length,  label: 'Scanning flight APIs' },
      { phase: 'lodging', sources: LODGING_SOURCES.length, label: 'Scanning lodging APIs' },
      { phase: 'dining',  sources: DINING_SOURCES.length,  label: 'Scanning dining APIs' },
      { phase: 'ranking', sources: OmniAggregator.TOTAL_SOURCES, label: 'AI ranking & distillation' },
    ];
    let scanned = 0;
    for (const p of phases) {
      const sourceList =
        p.phase === 'flight'  ? FLIGHT_SOURCES  :
        p.phase === 'lodging' ? LODGING_SOURCES :
        p.phase === 'dining'  ? DINING_SOURCES  :
        [...FLIGHT_SOURCES, ...LODGING_SOURCES, ...DINING_SOURCES];

      for (let i = 0; i < Math.min(4, sourceList.length); i++) {
        await mockDelay(jitter(60, 0.5));
        scanned = Math.min(scanned + Math.floor(p.sources / 4), OmniAggregator.TOTAL_SOURCES);
        yield {
          phase:           p.phase,
          sourcesScanned:  scanned,
          totalSources:    OmniAggregator.TOTAL_SOURCES,
          currentSource:   sourceList[i],
          percentComplete: scanned / OmniAggregator.TOTAL_SOURCES,
        };
      }
    }
    yield { phase: 'done', sourcesScanned: OmniAggregator.TOTAL_SOURCES, totalSources: OmniAggregator.TOTAL_SOURCES, currentSource: '', percentComplete: 1 };
  }

  static calculateUberETA(originHotel: string, restaurantMinutes: number): { minutes: number; cost: number; provider: string } {
    return {
      minutes:  Math.round(jitter(restaurantMinutes, 0.2)),
      cost:     Math.round(restaurantMinutes * 0.9 + jitter(5, 0.4)),
      provider: 'Uber Black',
    };
  }

  static predictPriceDrop(currentPrice: number, daysUntilTrip: number): { probability: number; expectedDrop: number; recommendAction: string } {
    const prob = Math.max(0.05, Math.min(0.65, 0.5 - (daysUntilTrip / 365) * 0.8 + Math.random() * 0.1));
    const expectedDrop = Math.round(currentPrice * prob * 0.18);
    return {
      probability: parseFloat(prob.toFixed(2)),
      expectedDrop,
      recommendAction: prob > 0.4
        ? `Wait ${Math.round(jitter(14, 0.5))} days — likely to drop $${expectedDrop}`
        : 'Book now — price likely to rise',
    };
  }
}
