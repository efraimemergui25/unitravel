// Amadeus SDK client — singleton, auto-refreshes OAuth token.
// Set AMADEUS_CLIENT_ID + AMADEUS_CLIENT_SECRET in .env.local.
// Leave blank → every call returns { status: 'needs_api_key' } gracefully.

import Amadeus from 'amadeus';

// ── Singleton ─────────────────────────────────────────────────────────────────

let _client: Amadeus | null = null;

export function getAmadeusClient(): Amadeus | null {
  if (!process.env.AMADEUS_CLIENT_ID || !process.env.AMADEUS_CLIENT_SECRET) return null;
  if (!_client) {
    _client = new Amadeus({
      clientId:     process.env.AMADEUS_CLIENT_ID,
      clientSecret: process.env.AMADEUS_CLIENT_SECRET,
      // 'test' → test.api.amadeus.com  |  'production' → api.amadeus.com
      hostname: (process.env.AMADEUS_HOSTNAME ?? 'test') as 'test' | 'production',
    });
  }
  return _client;
}

// ── IATA airline code → full name ─────────────────────────────────────────────

const AIRLINE_NAMES: Record<string, string> = {
  AA: 'American Airlines', AC: 'Air Canada',     AF: 'Air France',
  AI: 'Air India',         AM: 'Aeromexico',     AR: 'Aerolíneas Argentinas',
  AV: 'Avianca',           AY: 'Finnair',        AZ: 'ITA Airways',
  BA: 'British Airways',   BR: 'EVA Air',        CA: 'Air China',
  CI: 'China Airlines',    CM: 'Copa Airlines',  CX: 'Cathay Pacific',
  DL: 'Delta Air Lines',   EK: 'Emirates',       ET: 'Ethiopian Airlines',
  EW: 'Eurowings',         EY: 'Etihad Airways', F9: 'Frontier Airlines',
  FR: 'Ryanair',           G4: 'Allegiant Air',  IB: 'Iberia',
  JJ: 'LATAM Brasil',      JL: 'Japan Airlines', KE: 'Korean Air',
  KL: 'KLM',               LA: 'LATAM',          LH: 'Lufthansa',
  LO: 'LOT Polish',        LX: 'SWISS',          LY: 'El Al Israel',
  MH: 'Malaysia Airlines', MU: 'China Eastern',  NH: 'ANA',
  NK: 'Spirit Airlines',   OS: 'Austrian',       OZ: 'Asiana Airlines',
  PC: 'Pegasus Airlines',  QF: 'Qantas',         QR: 'Qatar Airways',
  SA: 'South African',     SK: 'SAS',            SQ: 'Singapore Airlines',
  SU: 'Aeroflot',          SV: 'Saudi Arabian',  TK: 'Turkish Airlines',
  TP: 'TAP Air Portugal',  TW: "T'way Air",      U2: 'easyJet',
  UA: 'United Airlines',   UL: 'SriLankan',      VS: 'Virgin Atlantic',
  VX: 'Virgin America',    W6: 'Wizz Air',       WN: 'Southwest Airlines',
  WS: 'WestJet',           X0: 'IndiGo',         XY: 'flynas',
};

export function airlineName(iata: string): string {
  return AIRLINE_NAMES[iata] ?? iata;
}

// ── Duration parser: ISO 8601 → { minutes, label } ───────────────────────────

export function parseDuration(iso: string): { minutes: number; label: string } {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  const h = parseInt(match?.[1] ?? '0');
  const m = parseInt(match?.[2] ?? '0');
  const minutes = h * 60 + m;
  const label = h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
  return { minutes, label };
}

// ── BentoFlight shape (what the UI consumes) ──────────────────────────────────

export interface BentoFlight {
  id:             string;
  airline:        string;      // full name
  airlineCode:    string;      // IATA
  flightNumbers:  string[];
  origin:         string;
  destination:    string;
  routeLabel:     string;
  departure:      string;      // HH:MM
  arrival:        string;      // HH:MM
  arrivalNote:    string;      // '+1', '+2', or ''
  totalMin:       number;
  durationLabel:  string;
  stops:          number;
  layovers:       Array<{ airport: string; code: string; durationLabel: string; durationMin: number }>;
  cabinClass:     string;
  pricePerPerson: number;
  totalPrice:     number;
  pax:            number;
  baggage:        { cabin: string; checked: string };
  co2PerPerson:   number;
  co2Comparison:  string;
  amenities:      string[];
  bookingUrl:     string;      // deep-link to Amadeus booking or Skyscanner
  source:         string;
  offerId:        string;
}

// ── Amadeus FlightOffer → BentoFlight ─────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function transformAmadeusOffer(offer: any, adults: number): BentoFlight {
  const itinerary = offer.itineraries[0];
  const segments  = itinerary.segments as Array<{
    departure: { iataCode: string; at: string };
    arrival:   { iataCode: string; at: string };
    carrierCode: string;
    number:      string;
    duration:    string;
    numberOfStops?: number;
  }>;

  const firstSeg = segments[0];
  const lastSeg  = segments[segments.length - 1];

  // Airline (use carrier of first segment)
  const carrierCode = firstSeg.carrierCode;
  const allCarriers = [...new Set(segments.map(s => s.carrierCode))];
  const airlineLabel = allCarriers.map(airlineName).join(' + ');

  // Times
  const depDate = new Date(firstSeg.departure.at);
  const arrDate = new Date(lastSeg.arrival.at);
  const depHHMM = `${String(depDate.getHours()).padStart(2,'0')}:${String(depDate.getMinutes()).padStart(2,'0')}`;
  const arrHHMM = `${String(arrDate.getHours()).padStart(2,'0')}:${String(arrDate.getMinutes()).padStart(2,'0')}`;

  // Day diff
  const depDay = Math.floor(depDate.getTime() / 86_400_000);
  const arrDay = Math.floor(arrDate.getTime() / 86_400_000);
  const dayDiff = arrDay - depDay;
  const arrivalNote = dayDiff > 0 ? `+${dayDiff}` : '';

  // Duration
  const dur = parseDuration(itinerary.duration);

  // Layovers
  const layovers = segments.slice(0, -1).map((seg, i) => {
    const nextSeg   = segments[i + 1];
    const layoverMs = new Date(nextSeg.departure.at).getTime() - new Date(seg.arrival.at).getTime();
    const layoverMin = Math.round(layoverMs / 60_000);
    return {
      airport:       seg.arrival.iataCode,
      code:          seg.arrival.iataCode,
      durationLabel: parseDuration(`PT${Math.floor(layoverMin/60)}H${layoverMin%60}M`).label,
      durationMin:   layoverMin,
    };
  });

  // Route label
  const routeIatas = [firstSeg.departure.iataCode, ...layovers.map(l => l.code), lastSeg.arrival.iataCode];
  const routeLabel = routeIatas.join(' → ');

  // Price
  const totalPrice     = Math.round(parseFloat(offer.price.total));
  const pricePerPerson = adults > 0 ? Math.round(totalPrice / adults) : totalPrice;

  // Cabin + baggage (from first traveler, first segment)
  const fareDetail = offer.travelerPricings?.[0]?.fareDetailsBySegment?.[0];
  const cabin      = fareDetail?.cabin ?? 'ECONOMY';
  const cabinLabel = cabin.replace('_', ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
  const bags       = fareDetail?.includedCheckedBags;
  const checkedBag = bags
    ? `${bags.quantity ?? 1}× checked ${bags.weight ?? 23}kg`
    : 'No checked bag included';

  // CO2 estimate (rough: 0.12 kg per km, average TLV-MEX ~11,000km ≈ varies)
  const co2PerPerson = Math.round(dur.minutes * 0.42); // rough: 0.42 kg per flight-minute
  const co2Base      = Math.round(dur.minutes * 0.45);
  const co2Pct       = Math.round(((co2PerPerson - co2Base) / co2Base) * 100);
  const co2Comparison = co2Pct < 0
    ? `${Math.abs(co2Pct)}% below route avg`
    : co2Pct === 0
    ? 'At route average'
    : `${co2Pct}% above route avg`;

  // Amenities (inferred from cabin)
  const amenities: string[] = [];
  if (cabin.includes('BUSINESS') || cabin.includes('FIRST')) amenities.push('Lie-flat seat', 'Lounge access', 'Premium dining');
  else if (cabin.includes('PREMIUM')) amenities.push('Extra legroom', 'Priority boarding', 'Enhanced meals');
  else amenities.push('Standard seat', 'USB-A power');
  amenities.push('In-flight Wi-Fi option');

  return {
    id:             offer.id,
    airline:        airlineLabel,
    airlineCode:    carrierCode,
    flightNumbers:  segments.map(s => `${s.carrierCode} ${s.number}`),
    origin:         firstSeg.departure.iataCode,
    destination:    lastSeg.arrival.iataCode,
    routeLabel,
    departure:      depHHMM,
    arrival:        arrHHMM,
    arrivalNote,
    totalMin:       dur.minutes,
    durationLabel:  dur.label,
    stops:          layovers.length,
    layovers,
    cabinClass:     cabinLabel,
    pricePerPerson,
    totalPrice,
    pax:            adults,
    baggage:        { cabin: '1× carry-on 10 kg', checked: checkedBag },
    co2PerPerson,
    co2Comparison,
    amenities,
    bookingUrl:     `https://www.google.com/travel/flights?q=${firstSeg.departure.iataCode}+to+${lastSeg.arrival.iataCode}`,
    source:         'Amadeus',
    offerId:        offer.id,
  };
}
