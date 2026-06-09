// ── Deeplink factory — one place for all external booking/search URLs ─────────
//
// Every result shown to the user must either complete booking inside Unitravel
// OR send the user to the EXACT page on the source site (not a generic homepage).
// This file owns all deeplink construction logic.

// ── Flights ───────────────────────────────────────────────────────────────────

export interface FlightDeeplinkParams {
  origin:       string;   // IATA, e.g. "TLV"
  destination:  string;   // IATA, e.g. "LHR"
  departureDate:string;   // ISO, e.g. "2026-08-01"
  returnDate?:  string;
  adults:       number;
  cabinClass:   'economy' | 'premium_economy' | 'business' | 'first';
  flightNumbers?: string[]; // e.g. ["LY315"]
  airline?:     string;
  bookingToken?: string;   // SerpAPI booking_token for Google Flights
}

const CABIN_GF: Record<string, '1' | '2' | '3' | '4'> = {
  economy: '1', premium_economy: '2', business: '3', first: '4',
};

/** Google Flights pre-filled search — works for any airline. */
export function googleFlightsUrl(p: FlightDeeplinkParams): string {
  const base   = 'https://www.google.com/travel/flights';
  const params = new URLSearchParams({
    hl:    'en',
    q:     `Flights from ${p.origin} to ${p.destination}`,
    ...(p.departureDate ? { dest_date: p.departureDate } : {}),
  });
  // Use fragment-based deep link for better prefilling
  // Format: #flt={origin}.{dest}.{date};c:USD;tt:o (or tt:r for roundtrip);sc:{cabin}
  const tripType = p.returnDate ? 'r' : 'o';
  const cabin    = CABIN_GF[p.cabinClass] ?? '1';
  const dateStr  = p.departureDate;
  const retStr   = p.returnDate ? `*${p.returnDate}` : '';
  const fragment = `flt=${p.origin}.${p.destination}.${dateStr}${retStr};c:USD;tt:${tripType};sc:${cabin}`;
  return `${base}?${params}#${fragment}`;
}

/** Kayak pre-filled flight search — good alternative. */
export function kayakFlightUrl(p: FlightDeeplinkParams): string {
  const d = p.departureDate.replace(/-/g, '-'); // keep ISO
  const cabin = p.cabinClass === 'economy' ? '' : `/${p.cabinClass.replace('_', '-')}`;
  const pax   = p.adults > 1 ? `/${p.adults}adults` : '';
  return `https://www.kayak.com/flights/${p.origin}-${p.destination}/${d}${pax}${cabin}`;
}

/** Best flight deeplink — Google Flights fragment format with all params. */
export function bestFlightUrl(p: FlightDeeplinkParams): string {
  return googleFlightsUrl(p);
}

// ── Hotels ────────────────────────────────────────────────────────────────────

export interface HotelDeeplinkParams {
  name:         string;
  city:         string;
  cityCode?:    string;
  checkIn:      string;   // ISO date
  checkOut:     string;   // ISO date
  adults:       number;
  rooms?:       number;
  currency?:    string;
}

/** Booking.com search — pre-fills property name + dates + guests. */
export function bookingComUrl(p: HotelDeeplinkParams): string {
  const [ciY, ciM, ciD] = p.checkIn.split('-');
  const [coY, coM, coD] = p.checkOut.split('-');
  const query = `${p.name} ${p.city}`.trim();

  const params = new URLSearchParams({
    ss:               query,
    checkin_year:     ciY  ?? '',
    checkin_month:    ciM  ?? '',
    checkin_monthday: ciD  ?? '',
    checkout_year:    coY  ?? '',
    checkout_month:   coM  ?? '',
    checkout_monthday:coD  ?? '',
    group_adults:     String(p.adults || 2),
    no_rooms:         String(p.rooms || 1),
    lang:             'en-us',
  });

  return `https://www.booking.com/searchresults.html?${params}`;
}

/** Google Hotels pre-filled search with dates and guests. */
export function googleHotelsUrl(p: HotelDeeplinkParams): string {
  const q = `${p.name} ${p.city}`.trim();
  const params = new URLSearchParams({
    hl:    'en',
    q:     q,
    dates: `${p.checkIn}/${p.checkOut}`,
    adults:String(p.adults || 2),
  });
  return `https://www.google.com/travel/hotels?${params}`;
}

/** Best hotel deeplink — Booking.com with full params. */
export function bestHotelUrl(p: HotelDeeplinkParams): string {
  return bookingComUrl(p);
}

// ── Dining ────────────────────────────────────────────────────────────────────

export interface DiningDeeplinkParams {
  name:         string;
  location:     string;
  city?:        string;
  lat?:         number;
  lon?:         number;
  date?:        string;
  time?:        string;
  party?:       number;
  source?:      string;  // 'google-places' | 'foursquare' | 'osm' | etc.
  placeId?:     string;  // Google place_id
}

/** Google Maps search for a specific restaurant — always works. */
export function googleMapsRestaurantUrl(p: DiningDeeplinkParams): string {
  if (p.lat && p.lon) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name)}&center=${p.lat},${p.lon}`;
  }
  if (p.placeId) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name)}&query_place_id=${p.placeId}`;
  }
  const q = `${p.name} ${p.location || p.city || ''}`.trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

/** OpenTable search — pre-fills restaurant name + date + party. */
export function openTableUrl(p: DiningDeeplinkParams): string {
  const params = new URLSearchParams({
    term:       p.name,
    ...(p.date  ? { dateTime: `${p.date}T${p.time ?? '19:00'}` } : {}),
    ...(p.party ? { covers: String(p.party) } : {}),
  });
  return `https://www.opentable.com/s/?${params}`;
}

/** Resy search — pre-fills party and date. */
export function resyUrl(p: DiningDeeplinkParams): string {
  const params = new URLSearchParams({
    query:    p.name,
    ...(p.party ? { seats: String(p.party) } : {}),
    ...(p.date  ? { day:   p.date } : {}),
  });
  return `https://resy.com/find?${params}`;
}

/** Best dining deeplink by source. */
export function bestDiningUrl(p: DiningDeeplinkParams): string {
  // Always use Google Maps as fallback — it's universal and always works
  return googleMapsRestaurantUrl(p);
}

// ── Attractions ───────────────────────────────────────────────────────────────

export interface AttractionDeeplinkParams {
  title:        string;
  destination:  string;
  lat?:         number;
  lon?:         number;
  type?:        string;
}

/** Google Maps POI search — always works for any attraction. */
export function googleMapsAttractionUrl(p: AttractionDeeplinkParams): string {
  if (p.lat && p.lon) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.title)}&center=${p.lat},${p.lon}`;
  }
  const q = `${p.title} ${p.destination}`.trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

/** Viator search for tours/experiences. */
export function viatorUrl(p: AttractionDeeplinkParams): string {
  const q = `${p.title} ${p.destination}`.replace(/\s+/g, '-').toLowerCase();
  return `https://www.viator.com/search/${encodeURIComponent(p.destination)}?text=${encodeURIComponent(p.title)}`;
}

/** GetYourGuide search. */
export function getYourGuideUrl(p: AttractionDeeplinkParams): string {
  return `https://www.getyourguide.com/s/?q=${encodeURIComponent(`${p.title} ${p.destination}`)}`;
}

/** Best attraction deeplink. */
export function bestAttractionUrl(p: AttractionDeeplinkParams): string {
  return googleMapsAttractionUrl(p);
}

// ── Transit ───────────────────────────────────────────────────────────────────

export interface TransitDeeplinkParams {
  origin:       string;
  destination:  string;
  mode?:        'transit' | 'driving' | 'walking' | 'bicycling';
}

/** Google Maps Directions — pre-fills origin, destination, travel mode. */
export function googleMapsDirectionsUrl(p: TransitDeeplinkParams): string {
  const params = new URLSearchParams({
    api:         '1',
    origin:      p.origin,
    destination: p.destination,
    travelmode:  p.mode ?? 'transit',
  });
  return `https://www.google.com/maps/dir/?${params}`;
}

/** Uber deeplink — pre-fills pickup/dropoff names. */
export function uberUrl(from: string, to: string): string {
  const params = new URLSearchParams({
    'pickup[formatted_address]':  from,
    'dropoff[formatted_address]': to,
    client_id: 'unitravel',
  });
  return `https://m.uber.com/ul/?${params}`;
}
