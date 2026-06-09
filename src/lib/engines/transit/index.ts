import { needsTransitKey }   from './TransitEngineAdapter';
import { GoogleMapsAdapter } from './GoogleMapsAdapter';

export type { TransitEngineAdapter, TransitEngineResult, TransitSearchParams } from './TransitEngineAdapter';

// ── Setup URLs ─────────────────────────────────────────────────────────────────

const GMAPS    = 'https://console.cloud.google.com/apis/library/directions-backend.googleapis.com';
const ROME2RIO = 'https://www.rome2rio.com/documentation/';
const UBER     = 'https://developer.uber.com/docs/riders/ride-requests/tutorials/api/introduction';
const LYFT     = 'https://developer.lyft.com/docs/get-started';
const TRANSIT  = 'https://transitapp.com/api';
const MOOVIT   = 'https://developer.moovitapp.com';
const CITYMAPPER= 'https://developer.citymapper.com';
const FLIXBUS  = 'https://global.flixbus.com/bus-routes/bus-api';
const MEGABUS  = 'https://us.megabus.com/api';
const GREYHOUND= 'https://www.greyhound.com/api';
const AMTRAK   = 'https://developer.amtrak.com';
const EUROSTAR = 'https://www.eurostar.com/api';
const RENTALCARS = 'https://www.rentalcars.com/api/';
const ENTERPRISE = 'https://developer.enterprise.com';
const HERTZ    = 'https://developer.hertz.com';
const AVIS     = 'https://developer.avis.com';
const BLABLACAR= 'https://dev.blablacar.com';
const GETAROUND= 'https://developer.getaround.com';
const TURO     = 'https://turo.com/api';
const ZIPCAR   = 'https://developer.zipcar.com';
const LIME     = 'https://developer.li.me/api';
const BIRD     = 'https://birdapp.com/api';
const BIKESHARE= 'https://www.lyft.com/bikes/api';
const TRAINLINE= 'https://developer.thetrainline.com';
const BUSBUD   = 'https://developer.busbud.com';
const WANDERU  = 'https://developer.wanderu.com';
const OMIO     = 'https://www.omio.com/api';
const SNCF     = 'https://www.digital.sncf.com/startup/api';
const DB       = 'https://developer.deutschebahn.com';

// ── All 30 transit engine adapters ────────────────────────────────────────────
// Real: google-maps (GOOGLE_MAPS_API_KEY)
// Shells: all others — return needs_api_key with setup URL

const _e = (s: string) => encodeURIComponent(s);

export const TRANSIT_ADAPTERS: Record<string, import('./TransitEngineAdapter').TransitEngineAdapter> = {
  // ── Tier 1: Global Routing ─────────────────────────────────────────────────
  'google-maps': GoogleMapsAdapter,
  'rome2rio':    needsTransitKey('rome2rio',   'Rome2Rio',    ROME2RIO,   'ROME2RIO_API_KEY',   (p) => `https://www.rome2rio.com/map/${_e(p.origin)}/${_e(p.destination)}`),

  // ── Tier 2: Rideshare (deep links) ────────────────────────────────────────
  'uber':        needsTransitKey('uber',       'Uber',        UBER,       'UBER_SERVER_TOKEN',  (p) => `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[formatted_address]=${_e(p.destination)}`),
  'lyft':        needsTransitKey('lyft',       'Lyft',        LYFT,       'LYFT_CLIENT_ID',     (p) => `https://www.lyft.com/rider/`),

  // ── Tier 3: Public Transit Apps (deep links) ──────────────────────────────
  'transit-app': needsTransitKey('transit-app','Transit App', TRANSIT,    'TRANSIT_APP_KEY',    (p) => `https://transitapp.com/?from=${_e(p.origin)}&to=${_e(p.destination)}`),
  'moovit':      needsTransitKey('moovit',     'Moovit',      MOOVIT,     'MOOVIT_API_KEY',     (p) => `https://moovitapp.com/index/en/public_transit-${_e(p.destination)}`),
  'citymapper':  needsTransitKey('citymapper', 'Citymapper',  CITYMAPPER, 'CITYMAPPER_API_KEY', (p) => `https://citymapper.com/directions?startcoord=${_e(p.origin)}&endcoord=${_e(p.destination)}`),

  // ── Tier 4: Bus Intercity (deep links) ────────────────────────────────────
  'flixbus':     needsTransitKey('flixbus',    'FlixBus',     FLIXBUS,    'FLIXBUS_API_KEY',    (p) => `https://global.flixbus.com/bus-routes/${_e(p.origin.toLowerCase())}-${_e(p.destination.toLowerCase())}`),
  'megabus':     needsTransitKey('megabus',    'Megabus',     MEGABUS,    'MEGABUS_API_KEY',    (p) => `https://us.megabus.com/journey-planner/journeys?originId=&destinationId=&outboundDepartureDate=${p.date ?? ''}&totalPassengers=${p.adults}&concessionCount=0&nusCount=0`),
  'greyhound':   needsTransitKey('greyhound',  'Greyhound',   GREYHOUND,  'GREYHOUND_API_KEY',  (p) => `https://www.greyhound.com/bus-tickets/${_e(p.origin.toLowerCase())}-to-${_e(p.destination.toLowerCase())}`),
  'busbud':      needsTransitKey('busbud',     'Busbud',      BUSBUD,     'BUSBUD_API_KEY',     (p) => `https://www.busbud.com/en/bus-schedules/${_e(p.origin)}/${_e(p.destination)}${p.date ? `?outward_date=${p.date}` : ''}`),
  'wanderu':     needsTransitKey('wanderu',    'Wanderu',     WANDERU,    'WANDERU_API_KEY',    (p) => `https://www.wanderu.com/en-us/bus-train-travel/${_e(p.origin.toLowerCase())}/${_e(p.destination.toLowerCase())}/${p.date ?? ''}/`),

  // ── Tier 5: Rail (deep links) ─────────────────────────────────────────────
  'amtrak':      needsTransitKey('amtrak',     'Amtrak',      AMTRAK,     'AMTRAK_API_KEY',     (p) => `https://www.amtrak.com/buy/oneway.html?departureDate=${p.date ?? ''}&from=${_e(p.origin)}&to=${_e(p.destination)}&adult=${p.adults}`),
  'eurostar':    needsTransitKey('eurostar',   'Eurostar',    EUROSTAR,   'EUROSTAR_API_KEY',    (p) => `https://www.eurostar.com/uk-en/train/search/${_e(p.origin.toLowerCase())}/${_e(p.destination.toLowerCase())}`),
  'trainline':   needsTransitKey('trainline',  'Trainline',   TRAINLINE,  'TRAINLINE_API_KEY',  (p) => `https://www.thetrainline.com/book/trains/${_e(p.origin.toLowerCase())}/${_e(p.destination.toLowerCase())}${p.date ? `/${p.date}` : ''}`),
  'omio':        needsTransitKey('omio',       'Omio',        OMIO,       'OMIO_API_KEY',        (p) => `https://www.omio.com/trains/${_e(p.origin)}/${_e(p.destination)}${p.date ? `/${p.date}` : ''}`),
  'sncf':        needsTransitKey('sncf',       'SNCF (France)',SNCF,      'SNCF_API_KEY',        (p) => `https://www.sncf-connect.com/en-en/train-search/${_e(p.origin)}/${_e(p.destination)}${p.date ? `?outwardDate=${p.date}` : ''}`),
  'db':          needsTransitKey('db',         'Deutsche Bahn',DB,        'DB_API_KEY',          (p) => `https://www.bahn.de/buchung/start?origin=${_e(p.origin)}&destination=${_e(p.destination)}${p.date ? `&travelDate=${p.date}` : ''}`),

  // ── Tier 6: Car Rental (deep links) ──────────────────────────────────────
  'rentalcars':  needsTransitKey('rentalcars', 'RentalCars.com',RENTALCARS,'RENTALCARS_API_KEY', (p) => `https://www.rentalcars.com/SearchResults.do?pickUpCity=${_e(p.destination)}&pickUpDate=${p.date ?? ''}`),
  'enterprise':  needsTransitKey('enterprise', 'Enterprise',   ENTERPRISE, 'ENTERPRISE_API_KEY', (p) => `https://www.enterprise.com/en/home.html`),
  'hertz':       needsTransitKey('hertz',      'Hertz',        HERTZ,      'HERTZ_API_KEY',      (p) => `https://www.hertz.com/rentacar/reservation/`),
  'avis':        needsTransitKey('avis',       'Avis',         AVIS,       'AVIS_API_KEY',        (p) => `https://www.avis.com/en/home`),

  // ── Tier 7: Peer-to-Peer / Shared (deep links) ───────────────────────────
  'blablacar':   needsTransitKey('blablacar',  'BlaBlaCar',    BLABLACAR,  'BLABLACAR_API_KEY',  (p) => `https://www.blablacar.com/search?fn=${_e(p.origin)}&tn=${_e(p.destination)}${p.date ? `&db=${p.date.replace(/-/g,'')}` : ''}&seats=${p.adults}`),
  'getaround':   needsTransitKey('getaround',  'Getaround',    GETAROUND,  'GETAROUND_API_KEY',  (p) => `https://www.getaround.com/search?location=${_e(p.destination)}`),
  'turo':        needsTransitKey('turo',       'Turo',         TURO,       'TURO_API_KEY',       (p) => `https://turo.com/us/en/search#${_e(p.destination)}`),
  'zipcar':      needsTransitKey('zipcar',     'Zipcar',       ZIPCAR,     'ZIPCAR_API_KEY',     (p) => `https://www.zipcar.com/search?location=${_e(p.destination)}`),

  // ── Tier 8: Micro-Mobility (deep links) ──────────────────────────────────
  'lime':        needsTransitKey('lime',       'Lime',         LIME,       'LIME_API_KEY',       (p) => `https://www.li.me/en-us/locations`),
  'bird':        needsTransitKey('bird',       'Bird',         BIRD,       'BIRD_API_KEY',       (p) => `https://www.bird.co/`),
  'bikeshare':   needsTransitKey('bikeshare',  'Bike Share',   BIKESHARE,  'BIKESHARE_API_KEY',  (p) => `https://www.lyft.com/bikes/${_e(p.destination.toLowerCase().replace(/ /g,'-'))}`),

  // ── Missing adapters referenced in zoneEngines.ts UI ─────────────────────
  // Global rideshare leaders not yet wired
  'bolt':        needsTransitKey('bolt',        'Bolt',           'https://bolt.eu/api', 'BOLT_API_KEY',
    (p) => `https://bolt.eu/`),
  'grab':        needsTransitKey('grab',        'Grab',           'https://developer.grab.com', 'GRAB_API_KEY',
    (p) => `https://www.grab.com/sg/transport/`),
  'didi':        needsTransitKey('didi',        'DiDi',           'https://developer.didiglobal.com', 'DIDI_API_KEY',
    (p) => `https://web.didiglobal.com/`),
  'cabify':      needsTransitKey('cabify',      'Cabify',         'https://developer.cabify.com', 'CABIFY_API_KEY',
    (p) => `https://cabify.com/`),
  'ola':         needsTransitKey('ola',         'Ola',            'https://developer.olacabs.com', 'OLA_API_KEY',
    (p) => `https://www.olacabs.com/`),
  'gett':        needsTransitKey('gett',        'Gett',           'https://developer.gett.com', 'GETT_API_KEY',
    (p) => `https://gett.com/`),
  'waze':        needsTransitKey('waze',        'Waze',           'https://developers.google.com/waze', 'WAZE_API_KEY',
    (p) => `https://ul.waze.com/ul?q=${_e(p.destination)}`),

  // Car rental platforms missing from UI
  'europcar':    needsTransitKey('europcar',    'Europcar',       'https://developer.europcar.com', 'EUROPCAR_API_KEY',
    (p) => `https://www.europcar.com/en-gb/car-rental/${_e(p.destination.toLowerCase().replace(/ /g,'-'))}`),
  'budget-car':  needsTransitKey('budget-car',  'Budget',         'https://developer.budgetgroup.com', 'BUDGET_API_KEY',
    (p) => `https://www.budget.com/en/locations/${_e(p.destination.toLowerCase().replace(/ /g,'-'))}`),
  'sixt':        needsTransitKey('sixt',        'Sixt',           'https://developer.sixt.com', 'SIXT_API_KEY',
    (p) => `https://www.sixt.com/car-rental/${_e(p.destination.toLowerCase().replace(/ /g,'-'))}`),
  'national-car':needsTransitKey('national-car','National Car',   'https://www.nationalcar.com', 'NATIONAL_API_KEY',
    (p) => `https://www.nationalcar.com/en_US/car-rental/location/${_e(p.destination)}.html`),
  'alamo':       needsTransitKey('alamo',       'Alamo',          'https://www.alamo.com', 'ALAMO_API_KEY',
    (p) => `https://www.alamo.com/en_US/car-rental/location/${_e(p.destination)}.html`),

  // Rail network
  'rail-europe': needsTransitKey('rail-europe', 'Rail Europe',    'https://www.raileurope.com/api', 'RAILEUROPE_API_KEY',
    (p) => `https://www.raileurope.com/en/search#${_e(p.origin)}-${_e(p.destination)}${p.date ? `/${p.date}` : ''}`),
};
