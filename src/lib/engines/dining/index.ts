import { needsDiningKey }       from './DiningEngineAdapter';
import { GooglePlacesAdapter }  from './GooglePlacesAdapter';
import { YelpAdapter }          from './YelpAdapter';
import { FoursquareAdapter }    from './FoursquareAdapter';
import { OSMAdapter }           from './OSMAdapter';

export type { DiningEngineAdapter, DiningEngineResult, DiningSearchParams, RawDiningSource, RawTimeSlot } from './DiningEngineAdapter';
export { cuisineGradient } from './DiningEngineAdapter';

// ── Setup URLs ─────────────────────────────────────────────────────────────────

const OPENTABLE  = 'https://platform.opentable.com/documentation/#getting-started';
const RESY       = 'https://resy.com/developer';
const TOCK       = 'https://www.exploretock.com/partners';
const THEFORK    = 'https://developer.thefork.com';
const ZAGAT      = 'https://www.zagat.com';
const MICHELIN   = 'https://guide.michelin.com/api';
const INFATUATED = 'https://www.theinfatuation.com/api';
const EATER      = 'https://www.eater.com/api';
const W50BEST    = 'https://www.theworlds50best.com/api';
const TA         = 'https://tripadvisor.com/developers';
const EATWITH    = 'https://www.eatwith.com/affiliates';
const AIRBNB_EX  = 'https://www.airbnb.com/experiences';
const DISHCRAWL  = 'https://www.dishcrawl.com/api';
const BOOKATABLE = 'https://www.bookatable.com/api';
const QUANDOO    = 'https://docs.quandoo.com';
const DIMMI      = 'https://www.dimmi.com.au/api';
const TABLEIN    = 'https://www.tablein.com/api';
const COVERMANAGER = 'https://www.covermanager.com/api';
const REZKU      = 'https://www.rezku.com/api';
const SEVENROOMS = 'https://sevenrooms.com/api';
const WISELY     = 'https://www.wiselyapp.com/api';
const NOWAIT     = 'https://yelp.com/nowait';
const TABLELIST  = 'https://www.tablelist.com/api';
const DORSIA     = 'https://dorsia.com/api';

// ── Deep link helpers ─────────────────────────────────────────────────────────

const enc = (s: string) => encodeURIComponent(s);

// All 30 dining engine adapters ─────────────────────────────────────────────
// Real: google-places, foursquare, yelp (OSM — no key needed)
// Deep links: all others — pre-filled search URL on the platform

export const DINING_ADAPTERS: Record<string, import('./DiningEngineAdapter').DiningEngineAdapter> = {
  // ── Tier 1: Discovery (real data) ────────────────────────────────────────
  'google-places': GooglePlacesAdapter,
  'yelp':          YelpAdapter,      // Yelp Fusion — YELP_API_KEY required
  'foursquare':    FoursquareAdapter, // Foursquare v3 autocomplete — FOURSQUARE_API_KEY required
  'osm':           OSMAdapter,       // OpenStreetMap — no key needed, global coverage

  // ── Tier 2: Reservation platforms (deep links) ────────────────────────────
  'opentable':    needsDiningKey('opentable',   'OpenTable',       OPENTABLE,  'OPENTABLE_API_KEY',
    (p) => `https://www.opentable.com/s/?term=${enc(p.destination)}&covers=${p.adults}&dateTime=${p.date}`),
  'resy':         needsDiningKey('resy',        'Resy',            RESY,       'RESY_API_KEY',
    (p) => `https://resy.com/cities?date=${p.date}&seats=${p.adults}&query=${enc(p.destination)}`),
  'tock':         needsDiningKey('tock',        'Tock',            TOCK,       'TOCK_API_KEY',
    (p) => `https://www.exploretock.com/search?query=${enc(p.destination)}&date=${p.date}&size=${p.adults}`),
  'thefork':      needsDiningKey('thefork',     'TheFork',         THEFORK,    'THEFORK_API_KEY',
    (p) => `https://www.thefork.com/search#?q=${enc(p.destination)}&date=${p.date}&guestNumber=${p.adults}`),
  'sevenrooms':   needsDiningKey('sevenrooms',  'SevenRooms',      SEVENROOMS, 'SEVENROOMS_API_KEY',
    (p) => `https://sevenrooms.com/search?query=${enc(p.destination)}`),
  'tablein':      needsDiningKey('tablein',     'Table.in',        TABLEIN,    'TABLEIN_API_KEY',
    (p) => `https://www.tablein.com/restaurants/?city=${enc(p.destination)}`),
  'covermanager': needsDiningKey('covermanager','Cover Manager',   COVERMANAGER,'COVERMANAGER_API_KEY',
    (p) => `https://www.covermanager.com/en/search?city=${enc(p.destination)}`),
  'rezku':        needsDiningKey('rezku',       'Rezku',           REZKU,      'REZKU_API_KEY',
    (p) => `https://www.rezku.com/search?location=${enc(p.destination)}`),
  'wisely':       needsDiningKey('wisely',      'Wisely',          WISELY,     'WISELY_API_KEY',
    (p) => `https://www.wiselyapp.com/search?q=${enc(p.destination)}`),
  'nowait':       needsDiningKey('nowait',      'Yelp Waitlist',   NOWAIT,     'NOWAIT_API_KEY',
    (p) => `https://www.yelp.com/search?find_desc=Restaurants&find_loc=${enc(p.destination)}`),
  'bookatable':   needsDiningKey('bookatable',  'Bookatable',      BOOKATABLE, 'BOOKATABLE_API_KEY',
    (p) => `https://www.bookatable.co.uk/search?q=${enc(p.destination)}&date=${p.date}&covers=${p.adults}`),
  'quandoo':      needsDiningKey('quandoo',     'Quandoo',         QUANDOO,    'QUANDOO_API_KEY',
    (p) => `https://www.quandoo.com/en/search?term=${enc(p.destination)}&date=${p.date}&partySize=${p.adults}`),
  'dimmi':        needsDiningKey('dimmi',       'Dimmi',           DIMMI,      'DIMMI_API_KEY',
    (p) => `https://www.dimmi.com.au/find/?search=${enc(p.destination)}&date=${p.date}&covers=${p.adults}`),

  // ── Tier 3: Editorial / Curation (deep links) ────────────────────────────
  'michelin':     needsDiningKey('michelin',    'Michelin Guide',  MICHELIN,   'MICHELIN_API_KEY',
    (p) => `https://guide.michelin.com/en/restaurants?location=${enc(p.destination)}`),
  'zagat':        needsDiningKey('zagat',       'Zagat',           ZAGAT,      'ZAGAT_API_KEY',
    (p) => `https://www.google.com/maps/search/restaurants+in+${enc(p.destination)}`),
  'infatuation':  needsDiningKey('infatuation', 'The Infatuation', INFATUATED, 'INFATUATION_API_KEY',
    (p) => `https://www.theinfatuation.com/search?q=${enc(p.destination)}+restaurants`),
  'eater':        needsDiningKey('eater',       'Eater',           EATER,      'EATER_API_KEY',
    (p) => `https://www.eater.com/search?q=${enc(p.destination)}+restaurants`),
  'worlds50best': needsDiningKey('worlds50best',"World's 50 Best", W50BEST,    'W50BEST_API_KEY',
    (p) => `https://www.theworlds50best.com/the-list/1-50/search?q=${enc(p.destination)}`),
  'tripadvisor':  needsDiningKey('tripadvisor', 'TripAdvisor',     TA,         'TRIPADVISOR_API_KEY',
    (p) => `https://www.tripadvisor.com/Search?q=${enc(p.destination)}+restaurants`),

  // ── Tier 4: Experiences (deep links) ────────────────────────────────────
  'eatwith':      needsDiningKey('eatwith',     'EatWith',         EATWITH,    'EATWITH_API_KEY',
    (p) => `https://www.eatwith.com/search?q=${enc(p.destination)}&date=${p.date}&guests=${p.adults}`),
  'airbnb-exp':   needsDiningKey('airbnb-exp',  'Airbnb Experiences',AIRBNB_EX,'AIRBNB_API_KEY',
    (p) => `https://www.airbnb.com/s/${enc(p.destination)}/experiences`),
  'dishcrawl':    needsDiningKey('dishcrawl',   'Dishcrawl',       DISHCRAWL,  'DISHCRAWL_API_KEY',
    (p) => `https://www.dishcrawl.com/search?location=${enc(p.destination)}&date=${p.date}`),

  // ── Tier 5: VIP / Nightlife (deep links) ─────────────────────────────────
  'tablelist':    needsDiningKey('tablelist',   'Tablelist',       TABLELIST,  'TABLELIST_API_KEY',
    (p) => `https://www.tablelist.com/search?q=${enc(p.destination)}`),
  'dorsia':       needsDiningKey('dorsia',      'Dorsia',          DORSIA,     'DORSIA_API_KEY',
    (p) => `https://dorsia.com/search?city=${enc(p.destination)}&date=${p.date}&guests=${p.adults}`),

  // ── Aliases: zoneEngines.ts uses these IDs — route to correct adapters ────
  'google-maps-d':   GooglePlacesAdapter,
  'tripadvisor-d':   needsDiningKey('tripadvisor-d', 'TripAdvisor',    TA,         'TRIPADVISOR_API_KEY',
    (p) => `https://www.tripadvisor.com/Search?q=${enc(p.destination)}+restaurants`),

  // ── Missing adapters referenced in zoneEngines.ts UI ─────────────────────
  'zomato':          needsDiningKey('zomato',        'Zomato',          'https://www.zomato.com/api', 'ZOMATO_API_KEY',
    (p) => `https://www.zomato.com/search?q=restaurants+in+${enc(p.destination)}`),
  'jamesbeard':      needsDiningKey('jamesbeard',    'James Beard',     'https://www.jamesbeard.org', 'JAMESBEARD_API_KEY',
    (p) => `https://www.jamesbeard.org/restaurants?q=${enc(p.destination)}`),
  'oad':             needsDiningKey('oad',            'OAD Awards',      'https://www.opinionatedaboutdining.com', 'OAD_API_KEY',
    (p) => `https://www.opinionatedaboutdining.com/restaurant/search?location=${enc(p.destination)}`),
  'lafourchette':    needsDiningKey('lafourchette',  'LaFourchette',    THEFORK,    'THEFORK_API_KEY',
    (p) => `https://www.lafourchette.com/search?q=${enc(p.destination)}&date=${p.date}&guestNumber=${p.adults}`),
  'timeout-d':       needsDiningKey('timeout-d',     'Timeout Dining',  'https://www.timeout.com', 'TIMEOUT_API_KEY',
    (p) => `https://www.timeout.com/search?q=${enc(p.destination)}+restaurants`),
  'bonappetit':      needsDiningKey('bonappetit',    'Bon Appétit',     'https://www.bonappetit.com', 'BONAPPETIT_API_KEY',
    (p) => `https://www.bonappetit.com/search?q=${enc(p.destination)}+restaurants`),
  'foodwine':        needsDiningKey('foodwine',      'Food & Wine',     'https://www.foodandwine.com', 'FOODWINE_API_KEY',
    (p) => `https://www.foodandwine.com/search?q=${enc(p.destination)}+restaurants`),
  'lonelyplanet-d':  needsDiningKey('lonelyplanet-d','Lonely Planet',   'https://www.lonelyplanet.com', 'LONELYPLANET_API_KEY',
    (p) => `https://www.lonelyplanet.com/search?q=${enc(p.destination)}+restaurants`),
  'instagram-d':     needsDiningKey('instagram-d',   'Instagram',       'https://www.instagram.com', 'INSTAGRAM_API_KEY',
    (p) => `https://www.instagram.com/explore/tags/${enc(p.destination.toLowerCase().replace(/ /g,''))}food/`),
  'ubereats-r':      needsDiningKey('ubereats-r',    'Uber Eats',       'https://developer.uber.com', 'UBEREATS_API_KEY',
    (p) => `https://www.ubereats.com/search?q=restaurants&pl=${enc(p.destination)}`),
  'doordash-r':      needsDiningKey('doordash-r',    'DoorDash',        'https://developer.doordash.com', 'DOORDASH_API_KEY',
    (p) => `https://www.doordash.com/search/store/${enc(p.destination)}/1/`),
  'deliveroo-r':     needsDiningKey('deliveroo-r',   'Deliveroo',       'https://deliveroo.co.uk/api', 'DELIVEROO_API_KEY',
    (p) => `https://deliveroo.co.uk/restaurants/${enc(p.destination.toLowerCase().replace(/ /g,'-'))}`),
  'noma':            needsDiningKey('noma',           'Noma Projects',   'https://noma.dk', 'NOMA_API_KEY',
    (p) => `https://www.theworlds50best.com/the-list/1-50/search?q=${enc(p.destination)}`),
  'cdmx':            needsDiningKey('cdmx',           'CDMX Gourmet',    'https://www.cdmxgourmet.com', 'CDMX_API_KEY',
    (p) => `https://www.theinfatuation.com/mexico-city/search?q=${enc(p.destination)}`),
  'local-guide':     needsDiningKey('local-guide',    'Google Local',    'https://maps.google.com', 'GOOGLE_MAPS_API_KEY',
    (p) => `https://www.google.com/maps/search/restaurants+in+${enc(p.destination)}`),
  'guia-roji':       needsDiningKey('guia-roji',      'Guía Roji',       'https://www.guiaroji.com.mx', 'GUIAROJI_API_KEY',
    (p) => `https://www.zomato.com/mexico/search?q=restaurants+${enc(p.destination)}`),
};
