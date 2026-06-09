import type { AttractionEntity } from '@/types/attractions';
import { GeoapifyAdapter }        from './GeoapifyAdapter';

// ── Attraction Engine Adapter interface ───────────────────────────────────────

export interface AttractionSearchParams {
  destination: string;
  startDate:   string;
  endDate:     string;
  adults:      number;
  currency:    string;
  maxResults:  number;
}

export interface AttractionEngineResult {
  engineId:      string;
  engineName:    string;
  status:        'ok' | 'needs_api_key' | 'error';
  results:       AttractionEntity[];
  latencyMs:     number;
  deepLinkUrl?:  string;
  setupUrl?:     string;
  setupMessage?: string;
}

export interface AttractionEngineAdapter {
  id:   string;
  name: string;
  search(params: AttractionSearchParams): Promise<AttractionEngineResult>;
}

const _enc = (s: string) => encodeURIComponent(s);

function needsKey(
  id: string, name: string, setupUrl: string, envVar: string,
  deepLinkFn?: (p: AttractionSearchParams) => string,
): AttractionEngineAdapter {
  return {
    id, name,
    async search(params) {
      return {
        engineId: id, engineName: name, status: 'needs_api_key',
        results: [], latencyMs: 0,
        deepLinkUrl: deepLinkFn ? deepLinkFn(params) : undefined,
        setupUrl, setupMessage: `Add ${envVar} to .env.local to enable ${name}.`,
      };
    },
  };
}

// ── All attraction adapters ───────────────────────────────────────────────────

const GYG      = 'https://api.getyourguide.com/1';
const VIATOR   = 'https://api.viator.com/partner';
const KLOOK    = 'https://openapi.klook.com';
const GPLACES  = 'https://developers.google.com/maps/documentation/places/web-service/overview';
const TA       = 'https://tripadvisor.com/developers';
const EXPEDIA  = 'https://developer.expediapartnersolutions.com';
const BOOKING  = 'https://join.booking.com/affiliation/portal/en/signup';

export const ATTRACTION_ADAPTERS: Record<string, AttractionEngineAdapter> = {
  'geoapify':       GeoapifyAdapter,

  'getyourguide':   needsKey('getyourguide',   'GetYourGuide',   GYG,    'GETYOURGUIDE_API_KEY',   (p) => `https://www.getyourguide.com/s/?q=${_enc(p.destination)}&type=1&date_from=${p.startDate}&date_to=${p.endDate}&travelers=${p.adults}`),
  'viator':         needsKey('viator',         'Viator',         VIATOR, 'VIATOR_API_KEY',         (p) => `https://www.viator.com/search/${_enc(p.destination)}?startDate=${p.startDate}&endDate=${p.endDate}`),
  'klook':          needsKey('klook',          'Klook',          KLOOK,  'KLOOK_API_KEY',          (p) => `https://www.klook.com/en-US/search/?keyword=${_enc(p.destination)}`),
  'google-places':  needsKey('google-places',  'Google Places',  GPLACES,'GOOGLE_PLACES_API_KEY',  (p) => `https://www.google.com/maps/search/things+to+do+in+${_enc(p.destination)}`),
  'tripadvisor-a':  needsKey('tripadvisor-a',  'TripAdvisor',    TA,     'TRIPADVISOR_API_KEY',    (p) => `https://www.tripadvisor.com/Search?q=${_enc(p.destination)}+attractions`),
  'airbnb-exp':     needsKey('airbnb-exp',     'Airbnb Exp.',    'https://www.airbnb.com/experiences', 'AIRBNB_API_KEY', (p) => `https://www.airbnb.com/s/${_enc(p.destination)}/experiences`),
  'musement':       needsKey('musement',       'Musement',       'https://api.musement.com', 'MUSEMENT_API_KEY', (p) => `https://www.musement.com/us/search/${_enc(p.destination).replace(/%20/g,'-').toLowerCase()}/`),
  'tiqets':         needsKey('tiqets',         'Tiqets',         'https://www.tiqets.com/api/', 'TIQETS_API_KEY', (p) => `https://www.tiqets.com/en/search/?q=${_enc(p.destination)}&date_from=${p.startDate}`),
  'headout':        needsKey('headout',        'Headout',        'https://api.headout.com', 'HEADOUT_API_KEY', (p) => `https://www.headout.com/search/?q=${_enc(p.destination)}`),
  'civitatis':      needsKey('civitatis',      'Civitatis',      'https://www.civitatis.com/api/', 'CIVITATIS_API_KEY', (p) => `https://www.civitatis.com/en/${_enc(p.destination).toLowerCase()}/`),
  'lonely-planet-a':needsKey('lonely-planet-a','Lonely Planet',  'https://developers.lonelyplanet.com', 'LONELY_PLANET_API_KEY', (p) => `https://www.lonelyplanet.com/search?q=${_enc(p.destination)}`),
  'culture-trip':   needsKey('culture-trip',  'Culture Trip',   'https://theculturetrip.com', 'CULTURE_TRIP_API_KEY', (p) => `https://theculturetrip.com/search?q=${_enc(p.destination)}`),
  'atlas-obscura':  needsKey('atlas-obscura',  'Atlas Obscura',  'https://www.atlasobscura.com', 'ATLAS_OBSCURA_API_KEY', (p) => `https://www.atlasobscura.com/search?q=${_enc(p.destination)}`),
  'timeout-a':      needsKey('timeout-a',      'Timeout',        'https://www.timeout.com/api', 'TIMEOUT_API_KEY', (p) => `https://www.timeout.com/search?q=${_enc(p.destination)}+things+to+do`),
  'unesco':         needsKey('unesco',         'UNESCO Sites',   'https://whc.unesco.org/en/api/', 'UNESCO_API_KEY', (p) => `https://whc.unesco.org/en/list/?search=${_enc(p.destination)}`),
  'natgeo':         needsKey('natgeo',         'Nat Geographic', 'https://www.nationalgeographic.com', 'NATGEO_API_KEY', (p) => `https://www.nationalgeographic.com/search#q=${_enc(p.destination)}`),
  'fodors':         needsKey('fodors',         "Fodor's",        'https://www.fodors.com', 'FODORS_API_KEY', (p) => `https://www.fodors.com/world/${_enc(p.destination.toLowerCase().replace(/ /g,'-'))}`),
  'frommers':       needsKey('frommers',       "Frommer's",      'https://www.frommers.com', 'FROMMERS_API_KEY', (p) => `https://www.frommers.com/search/${_enc(p.destination)}`),
  'context':        needsKey('context',        'Context Travel', 'https://www.contexttravel.com', 'CONTEXT_API_KEY', (p) => `https://www.contexttravel.com/search?q=${_enc(p.destination)}`),
  'walks':          needsKey('walks',          'Walks',          'https://www.walks.com', 'WALKS_API_KEY', (p) => `https://www.walks.com/search?query=${_enc(p.destination)}`),
  'topdeck':        needsKey('topdeck',        'Topdeck',        'https://www.topdeck.travel', 'TOPDECK_API_KEY', (p) => `https://www.topdeck.travel/search?q=${_enc(p.destination)}`),
  'withlocals':     needsKey('withlocals',     'Withlocals',     'https://www.withlocals.com', 'WITHLOCALS_API_KEY', (p) => `https://www.withlocals.com/search/${_enc(p.destination.toLowerCase().replace(/ /g,'-'))}/`),
  'toursbylocals':  needsKey('toursbylocals',  'Tours by Locals','https://www.toursbylocals.com', 'TOURSBYLOCALS_API_KEY', (p) => `https://www.toursbylocals.com/Private-Tours/${_enc(p.destination)}`),
  'peek':           needsKey('peek',           'Peek.com',       'https://www.peek.com/partners', 'PEEK_API_KEY', (p) => `https://www.peek.com/s/${_enc(p.destination)}`),
  'urban-adv':      needsKey('urban-adv',      'Urban Adventures','https://www.urbanadventures.com', 'URBAN_ADV_API_KEY', (p) => `https://www.urbanadventures.com/search?q=${_enc(p.destination)}`),
  'g-adventures':   needsKey('g-adventures',   'G Adventures',   'https://www.gadventures.com/api/', 'G_ADVENTURES_API_KEY', (p) => `https://www.gadventures.com/trips/search/?destination=${_enc(p.destination)}`),
  'intrepid':       needsKey('intrepid',       'Intrepid Travel','https://www.intrepidtravel.com', 'INTREPID_API_KEY', (p) => `https://www.intrepidtravel.com/en/search?q=${_enc(p.destination)}`),
  'expedia-act':    needsKey('expedia-act',    'Expedia Activ.', EXPEDIA,'EXPEDIA_API_KEY',        (p) => `https://www.expedia.com/things-to-do/search?location=${_enc(p.destination)}&startDate=${p.startDate}`),
  'booking-att':    needsKey('booking-att',    'Booking Attract.',BOOKING,'BOOKING_API_KEY',       (p) => `https://www.booking.com/attractions/searchresults.html?ss=${_enc(p.destination)}`),
  'local-experts':  needsKey('local-experts',  'Local Experts',  'https://www.localexperts.travel', 'LOCAL_EXPERTS_API_KEY', (p) => `https://www.localexperts.travel/search?destination=${_enc(p.destination)}`),
};
