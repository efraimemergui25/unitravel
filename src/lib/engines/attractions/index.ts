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
  setupUrl?:     string;
  setupMessage?: string;
}

export interface AttractionEngineAdapter {
  id:   string;
  name: string;
  search(params: AttractionSearchParams): Promise<AttractionEngineResult>;
}

function needsKey(id: string, name: string, setupUrl: string, envVar: string): AttractionEngineAdapter {
  return {
    id, name,
    async search() {
      return {
        engineId: id, engineName: name, status: 'needs_api_key',
        results: [], latencyMs: 0, setupUrl,
        setupMessage: `Add ${envVar} to .env.local to enable ${name}.`,
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
  'geoapify':        GeoapifyAdapter,
  'getyourguide':    needsKey('getyourguide',    'GetYourGuide',    GYG,     'GETYOURGUIDE_API_KEY'),
  'viator':          needsKey('viator',          'Viator',          VIATOR,  'VIATOR_API_KEY'),
  'klook':           needsKey('klook',           'Klook',           KLOOK,   'KLOOK_API_KEY'),
  'google-places':   needsKey('google-places',   'Google Places',   GPLACES, 'GOOGLE_PLACES_API_KEY'),
  'tripadvisor-a':   needsKey('tripadvisor-a',   'TripAdvisor',     TA,      'TRIPADVISOR_API_KEY'),
  'airbnb-exp':      needsKey('airbnb-exp',      'Airbnb Exp.',     'https://www.airbnb.com/experiences', 'AIRBNB_API_KEY'),
  'musement':        needsKey('musement',        'Musement',        'https://api.musement.com', 'MUSEMENT_API_KEY'),
  'tiqets':          needsKey('tiqets',          'Tiqets',          'https://www.tiqets.com/api/', 'TIQETS_API_KEY'),
  'headout':         needsKey('headout',         'Headout',         'https://api.headout.com', 'HEADOUT_API_KEY'),
  'civitatis':       needsKey('civitatis',       'Civitatis',       'https://www.civitatis.com/api/', 'CIVITATIS_API_KEY'),
  'lonely-planet-a': needsKey('lonely-planet-a', 'Lonely Planet',   'https://developers.lonelyplanet.com', 'LONELY_PLANET_API_KEY'),
  'culture-trip':    needsKey('culture-trip',    'Culture Trip',    'https://theculturetrip.com', 'CULTURE_TRIP_API_KEY'),
  'atlas-obscura':   needsKey('atlas-obscura',   'Atlas Obscura',   'https://www.atlasobscura.com', 'ATLAS_OBSCURA_API_KEY'),
  'timeout-a':       needsKey('timeout-a',       'Timeout',         'https://www.timeout.com/api', 'TIMEOUT_API_KEY'),
  'unesco':          needsKey('unesco',          'UNESCO Sites',    'https://whc.unesco.org/en/api/', 'UNESCO_API_KEY'),
  'natgeo':          needsKey('natgeo',          'Nat Geographic',  'https://www.nationalgeographic.com', 'NATGEO_API_KEY'),
  'fodors':          needsKey('fodors',          "Fodor's",         'https://www.fodors.com', 'FODORS_API_KEY'),
  'frommers':        needsKey('frommers',        "Frommer's",       'https://www.frommers.com', 'FROMMERS_API_KEY'),
  'context':         needsKey('context',         'Context Travel',  'https://www.contexttravel.com', 'CONTEXT_API_KEY'),
  'walks':           needsKey('walks',           'Walks',           'https://www.walks.com', 'WALKS_API_KEY'),
  'topdeck':         needsKey('topdeck',         'Topdeck',         'https://www.topdeck.travel', 'TOPDECK_API_KEY'),
  'withlocals':      needsKey('withlocals',      'Withlocals',      'https://www.withlocals.com', 'WITHLOCALS_API_KEY'),
  'toursbylocals':   needsKey('toursbylocals',   'Tours by Locals', 'https://www.toursbylocals.com', 'TOURSBYLOCALS_API_KEY'),
  'peek':            needsKey('peek',            'Peek.com',        'https://www.peek.com/partners', 'PEEK_API_KEY'),
  'urban-adv':       needsKey('urban-adv',       'Urban Adventures','https://www.urbanadventures.com', 'URBAN_ADV_API_KEY'),
  'g-adventures':    needsKey('g-adventures',    'G Adventures',    'https://www.gadventures.com/api/', 'G_ADVENTURES_API_KEY'),
  'intrepid':        needsKey('intrepid',        'Intrepid Travel', 'https://www.intrepidtravel.com', 'INTREPID_API_KEY'),
  'expedia-act':     needsKey('expedia-act',     'Expedia Activ.',  EXPEDIA, 'EXPEDIA_API_KEY'),
  'booking-att':     needsKey('booking-att',     'Booking Attract.',BOOKING, 'BOOKING_API_KEY'),
  'local-experts':   needsKey('local-experts',   'Local Experts',   'https://www.localexperts.travel', 'LOCAL_EXPERTS_API_KEY'),
};
