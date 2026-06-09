import type { FlightEngineAdapter, FlightSearchParams } from './FlightEngineAdapter';
import { needsApiKeyAdapter }        from './FlightEngineAdapter';
import { AmadeusAdapter }            from './AmadeusAdapter';
import { DuffelAdapter }             from './DuffelAdapter';
import { SerpApiAdapter }            from './SerpApiAdapter';
import { SerpApiBudgetAdapter }      from './SerpApiBudgetAdapter';

// ── Deep link helpers ─────────────────────────────────────────────────────────

const enc = (s: string) => encodeURIComponent(s);
// Skyscanner uses YYMMDD
const toYYMMDD = (iso: string) => iso.replace(/-/g, '').slice(2);
// Cabin class mapping
const skyClass = (c: string) =>
  c === 'BUSINESS' ? 'business' : c === 'FIRST' ? 'first' : c === 'PREMIUM_ECONOMY' ? 'premiumeconomy' : 'economy';
const aaClass = (c: string) =>
  c === 'BUSINESS' ? 'B' : c === 'FIRST' ? 'F' : 'Y';

function kayakLink(p: FlightSearchParams) {
  const ret = p.returnDate ? `/${p.returnDate}` : '/1';
  return `https://www.kayak.com/flights/${p.origin}-${p.destination}/${p.departureDate}${ret}/${p.adults}adults?cabin=${skyClass(p.travelClass)}`;
}
function skyscannerLink(p: FlightSearchParams) {
  const ret = p.returnDate ? `/${toYYMMDD(p.returnDate)}` : '';
  return `https://www.skyscanner.net/transport/flights/${p.origin.toLowerCase()}/${p.destination.toLowerCase()}/${toYYMMDD(p.departureDate)}${ret}/?adults=${p.adults}&cabinclass=${skyClass(p.travelClass)}`;
}
function googleFlightsLink(p: FlightSearchParams) {
  const q = `flights from ${p.origin} to ${p.destination} on ${p.departureDate}${p.returnDate ? ` returning ${p.returnDate}` : ''}`;
  return `https://www.google.com/travel/flights?q=${enc(q)}`;
}
function momondoLink(p: FlightSearchParams) {
  const ret = p.returnDate ? `/${p.returnDate}` : '/1';
  return `https://www.momondo.com/flight-search/${p.origin}-${p.destination}/${p.departureDate}${ret}/${p.adults}adults`;
}
function expediaFlightLink(p: FlightSearchParams) {
  const cabin = p.travelClass.toLowerCase().replace('_', '');
  const leg1  = `from:${p.origin},to:${p.destination},departure:${p.departureDate}TANYT`;
  const leg2  = p.returnDate ? `&leg2=from:${p.destination},to:${p.origin},departure:${p.returnDate}TANYT` : '';
  return `https://www.expedia.com/Flights-Search?trip=${p.returnDate ? 'roundtrip' : 'oneway'}&leg1=${leg1}${leg2}&passengers=adults:${p.adults}&options=cabin:${cabin}`;
}
function southwestLink(p: FlightSearchParams) {
  return `https://www.southwest.com/air/booking/select.html?originationAirportCode=${p.origin}&destinationAirportCode=${p.destination}&departureDate=${p.departureDate}${p.returnDate ? `&returnDate=${p.returnDate}` : ''}&adultPassengersCount=${p.adults}`;
}
function deltaLink(p: FlightSearchParams) {
  return `https://www.delta.com/us/en/flight-search/search-results?paxCount=${p.adults}&tripType=${p.returnDate ? 'R' : 'O'}&departureDate=${p.departureDate}${p.returnDate ? `&returnDate=${p.returnDate}` : ''}&originAirportCode=${p.origin}&destinationAirportCode=${p.destination}&cabinType=${p.travelClass === 'FIRST' ? 'FIRST' : p.travelClass === 'BUSINESS' ? 'BUSINESS_OR_FIRST' : 'COACH'}`;
}
function americanLink(p: FlightSearchParams) {
  return `https://www.aa.com/booking/search?locale=en_US&pax=${p.adults}&adult=${p.adults}&type=${p.returnDate ? 'ROUND_TRIP' : 'ONE_WAY'}&searchType=F&cabin=${aaClass(p.travelClass)}&departureCityCode=${p.origin}&arrivalCityCode=${p.destination}&outboundDateString=${p.departureDate}${p.returnDate ? `&returnDateString=${p.returnDate}` : ''}`;
}
function unitedLink(p: FlightSearchParams) {
  return `https://www.united.com/en/us/flights/${p.origin.toLowerCase()}/${p.destination.toLowerCase()}?cabin=${p.travelClass === 'FIRST' ? 'pol' : p.travelClass === 'BUSINESS' ? 'bus' : 'eco'}&date=${p.departureDate}&return=${p.returnDate ?? ''}&adults=${p.adults}`;
}
function emiratesLink(p: FlightSearchParams) {
  return `https://www.emirates.com/us/english/fly/?origin=${p.origin}&destination=${p.destination}&adult=${p.adults}&class=${p.travelClass === 'FIRST' ? 'F' : p.travelClass === 'BUSINESS' ? 'C' : 'Y'}&depDate=${p.departureDate}${p.returnDate ? `&retDate=${p.returnDate}` : ''}`;
}
function lufthansaLink(p: FlightSearchParams) {
  return `https://www.lufthansa.com/us/en/homepage#departureDate=${p.departureDate}&origin=${p.origin}&destination=${p.destination}&adult=${p.adults}&cabin=${skyClass(p.travelClass)}`;
}
function airfranceLink(p: FlightSearchParams) {
  return `https://wwws.airfrance.us/search/offers?pax=${p.adults}&origin=${p.origin}&destination=${p.destination}&outboundDate=${p.departureDate}&tripType=${p.returnDate ? 'RT' : 'OW'}${p.returnDate ? `&inboundDate=${p.returnDate}` : ''}`;
}
function britishLink(p: FlightSearchParams) {
  return `https://www.britishairways.com/travel/flightsearch/public/en_us?eId=106004&ss=${p.origin}${p.destination}&departureDate=${p.departureDate}${p.returnDate ? `&returnDate=${p.returnDate}` : ''}&adult=${p.adults}`;
}
function qatarLink(p: FlightSearchParams) {
  return `https://www.qatarairways.com/en-us/flights/${p.origin}/${p.destination}`;
}
function pricelineLink(p: FlightSearchParams) {
  return `https://www.priceline.com/fly/search/${p.origin}/${p.destination}/${p.departureDate}?adults=${p.adults}${p.returnDate ? `&returnDate=${p.returnDate}` : ''}`;
}
function cheapoairLink(p: FlightSearchParams) {
  return `https://www.cheapoair.com/flights/cheap-${p.origin.toLowerCase()}-to-${p.destination.toLowerCase()}-flights?departDate=${p.departureDate}&pax=${p.adults}`;
}
function hopperLink(p: FlightSearchParams) {
  return `https://www.hopper.com/flights?origin=${p.origin}&destination=${p.destination}&date=${p.departureDate}${p.returnDate ? `&returnDate=${p.returnDate}` : ''}&adults=${p.adults}`;
}
function amadeusAirlineLink(p: FlightSearchParams, airlineCode: string) {
  // Generic Amadeus-powered airline portal search via amadeus self-service
  return `https://www.amadeus.com/en/industries/airlines?origin=${p.origin}&destination=${p.destination}&airline=${airlineCode}&date=${p.departureDate}`;
}

// ── Setup URLs ────────────────────────────────────────────────────────────────

const SKYSCANNER_SU = 'https://partners.skyscanner.net/affiliates/register';
const KAYAK_SU      = 'https://www.kayak.com/api';
const EXPEDIA_SU    = 'https://developer.expediapartnersolutions.com';
const AIRLINE_SU    = 'https://developers.amadeus.com/register';

export const FLIGHT_ADAPTERS: Record<string, FlightEngineAdapter> = {
  // ── Tier 1: Global Leaders (real search) ─────────────────────────────────
  duffel:           DuffelAdapter,
  amadeus:          AmadeusAdapter,
  'google-flights': SerpApiAdapter,
  kiwi:             SerpApiBudgetAdapter,

  // ── Tier 1: Global Aggregators (deep links) ───────────────────────────────
  kayak:      needsApiKeyAdapter('kayak',      'Kayak',       KAYAK_SU,      'KAYAK_API_KEY',      kayakLink),
  skyscanner: needsApiKeyAdapter('skyscanner', 'Skyscanner',  SKYSCANNER_SU, 'SKYSCANNER_API_KEY', skyscannerLink),
  'expedia-f':needsApiKeyAdapter('expedia-f',  'Expedia',     EXPEDIA_SU,    'EXPEDIA_API_KEY',    expediaFlightLink),
  momondo:    needsApiKeyAdapter('momondo',    'Momondo',     KAYAK_SU,      'KAYAK_API_KEY',      momondoLink),
  hopper:     needsApiKeyAdapter('hopper',     'Hopper',      'https://developer.hopper.com', 'HOPPER_API_KEY', hopperLink),
  orbitz:     needsApiKeyAdapter('orbitz',     'Orbitz',      EXPEDIA_SU,    'EXPEDIA_API_KEY',    expediaFlightLink),
  priceline:  needsApiKeyAdapter('priceline',  'Priceline',   'https://www.priceline.com/affiliates/', 'PRICELINE_API_KEY', pricelineLink),
  cheapoair:  needsApiKeyAdapter('cheapoair',  'CheapOAir',   'https://www.cheapoair.com/api/', 'CHEAPOAIR_API_KEY', cheapoairLink),

  // ── Tier 2: Major Airlines (deep links) ──────────────────────────────────
  united:     needsApiKeyAdapter('united',     'United',          AIRLINE_SU, 'AMADEUS_CLIENT_ID', unitedLink),
  delta:      needsApiKeyAdapter('delta',      'Delta',           AIRLINE_SU, 'AMADEUS_CLIENT_ID', deltaLink),
  american:   needsApiKeyAdapter('american',   'American',        AIRLINE_SU, 'AMADEUS_CLIENT_ID', americanLink),
  southwest:  needsApiKeyAdapter('southwest',  'Southwest',       'https://developer.southwest.com', 'SOUTHWEST_API_KEY', southwestLink),
  emirates:   needsApiKeyAdapter('emirates',   'Emirates',        AIRLINE_SU, 'AMADEUS_CLIENT_ID', emiratesLink),
  lufthansa:  needsApiKeyAdapter('lufthansa',  'Lufthansa',       AIRLINE_SU, 'AMADEUS_CLIENT_ID', lufthansaLink),
  airfrance:  needsApiKeyAdapter('airfrance',  'Air France',      AIRLINE_SU, 'AMADEUS_CLIENT_ID', airfranceLink),
  klm:        needsApiKeyAdapter('klm',        'KLM',             AIRLINE_SU, 'AMADEUS_CLIENT_ID', (p) => `https://www.klm.com/search/v2/#/passengers=${p.adults},cabin=${skyClass(p.travelClass)};from=${p.origin};to=${p.destination};outbound=${p.departureDate}`),
  british:    needsApiKeyAdapter('british',    'British Airways', AIRLINE_SU, 'AMADEUS_CLIENT_ID', britishLink),
  iberia:     needsApiKeyAdapter('iberia',     'Iberia',          AIRLINE_SU, 'AMADEUS_CLIENT_ID', (p) => `https://www.iberia.com/web/portal/iberiaDotCom?clickOrigin=searchForm&origin=${p.origin}&destination=${p.destination}&departureDate=${p.departureDate}&adults=${p.adults}`),
  qatar:      needsApiKeyAdapter('qatar',      'Qatar Airways',   AIRLINE_SU, 'AMADEUS_CLIENT_ID', qatarLink),

  // ── Tier 2: Key global airlines — newly added ──────────────────────────────
  elal:       needsApiKeyAdapter('elal',       'El Al',           AIRLINE_SU, 'AMADEUS_CLIENT_ID', (p) => `https://www.elal.com/en/Flights-and-Destinations/Pages/find-flights.aspx?origin=${p.origin}&destination=${p.destination}&departDate=${p.departureDate}&adults=${p.adults}`),
  turkish:    needsApiKeyAdapter('turkish',    'Turkish Airlines',AIRLINE_SU, 'AMADEUS_CLIENT_ID', (p) => `https://www.turkishairlines.com/en-us/flights/${p.origin.toLowerCase()}-to-${p.destination.toLowerCase()}/?outboundDateTime=${p.departureDate}&adult=${p.adults}`),
  etihad:     needsApiKeyAdapter('etihad',     'Etihad',          AIRLINE_SU, 'AMADEUS_CLIENT_ID', (p) => `https://www.etihad.com/en/fly/book/flights?origin=${p.origin}&destination=${p.destination}&departureDate=${p.departureDate}&adults=${p.adults}`),
  singapore:  needsApiKeyAdapter('singapore',  'Singapore Air',   AIRLINE_SU, 'AMADEUS_CLIENT_ID', (p) => `https://www.singaporeair.com/en_UK/us/plan-travel/book-a-flight/?origin=${p.origin}&destination=${p.destination}&departDate=${p.departureDate}&adultCount=${p.adults}`),
  cathay:     needsApiKeyAdapter('cathay',     'Cathay Pacific',  AIRLINE_SU, 'AMADEUS_CLIENT_ID', (p) => `https://www.cathaypacific.com/cx/en_US/search-offer/flights/${p.origin}/${p.destination}/${p.departureDate}/${p.returnDate ?? ''}/${p.adults}/0/0/Y.html`),
  ryanair:    needsApiKeyAdapter('ryanair',    'Ryanair',         'https://www.ryanair.com/api', 'RYANAIR_API_KEY', (p) => `https://www.ryanair.com/en/cheap-flights/${p.origin.toLowerCase()}-${p.destination.toLowerCase()}.html`),
  easyjet:    needsApiKeyAdapter('easyjet',    'EasyJet',         'https://www.easyjet.com/en/flights', 'EASYJET_API_KEY', (p) => `https://www.easyjet.com/en/cheap-flights/${p.origin.toLowerCase()}-${p.destination.toLowerCase()}`),
  wizzair:    needsApiKeyAdapter('wizzair',    'Wizz Air',        'https://wizzair.com/#/', 'WIZZAIR_API_KEY', (p) => `https://wizzair.com/en-gb/booking/select-flight/${p.origin}/${p.destination}/${p.departureDate}/${p.returnDate ?? 'none'}/1/0/0/null`),

  // ── Tier 3: Regional (kept for Americas coverage) ─────────────────────────
  aeromexico: needsApiKeyAdapter('aeromexico', 'Aeroméxico',      AIRLINE_SU, 'AMADEUS_CLIENT_ID', (p) => `https://aeromexico.com/search?origin=${p.origin}&destination=${p.destination}&departureDate=${p.departureDate}&adults=${p.adults}`),
  volaris:    needsApiKeyAdapter('volaris',    'Volaris',         AIRLINE_SU, 'AMADEUS_CLIENT_ID', (p) => `https://www.volaris.com/vuelos/${p.origin}/${p.destination}/${p.departureDate}?adults=${p.adults}`),
  vivaaerobus:needsApiKeyAdapter('vivaaerobus','VivaAerobus',     AIRLINE_SU, 'AMADEUS_CLIENT_ID', (p) => `https://www.vivaaerobus.com/es-mx/vuelos/${p.origin}-${p.destination}?date=${p.departureDate}&adults=${p.adults}`),
  copa:       needsApiKeyAdapter('copa',       'Copa Airlines',   AIRLINE_SU, 'AMADEUS_CLIENT_ID', (p) => `https://www.copaair.com/en-gs/vuelo/${p.origin}/${p.destination}?date=${p.departureDate}&adults=${p.adults}`),
  latam:      needsApiKeyAdapter('latam',      'LATAM',           AIRLINE_SU, 'AMADEUS_CLIENT_ID', (p) => `https://www.latamairlines.com/us/en/offers/flights?origin=${p.origin}&destination=${p.destination}&outbound=${p.departureDate}&adults=${p.adults}`),
  jetblue:    needsApiKeyAdapter('jetblue',    'JetBlue',         AIRLINE_SU, 'AMADEUS_CLIENT_ID', (p) => `https://www.jetblue.com/en-us/sales/flights?from=${p.origin}&to=${p.destination}&depart=${p.departureDate}&pax=${p.adults}`),
  spirit:     needsApiKeyAdapter('spirit',     'Spirit',          AIRLINE_SU, 'AMADEUS_CLIENT_ID', (p) => `https://www.spirit.com/book/flight?origin=${p.origin}&destination=${p.destination}&departureDate=${p.departureDate}&adults=${p.adults}`),
  frontier:   needsApiKeyAdapter('frontier',   'Frontier',        AIRLINE_SU, 'AMADEUS_CLIENT_ID', (p) => `https://www.flyfrontier.com/book/book-flight/?origin=${p.origin}&destination=${p.destination}&departureDate=${p.departureDate}&adults=${p.adults}`),
  aircanada:  needsApiKeyAdapter('aircanada',  'Air Canada',      AIRLINE_SU, 'AMADEUS_CLIENT_ID', (p) => `https://www.aircanada.com/aeroplan/redeem/flight-reward/search?origin=${p.origin}&destination=${p.destination}&date=${p.departureDate}&adults=${p.adults}`),
};

export type { FlightEngineAdapter, FlightSearchParams, FlightEngineResult } from './FlightEngineAdapter';
