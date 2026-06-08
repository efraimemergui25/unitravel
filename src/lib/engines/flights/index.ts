import type { FlightEngineAdapter } from './FlightEngineAdapter';
import { needsApiKeyAdapter }        from './FlightEngineAdapter';
import { AmadeusAdapter }            from './AmadeusAdapter';
import { KiwiAdapter }               from './KiwiAdapter';
import { DuffelAdapter }             from './DuffelAdapter';

// ── All 30 flight engine adapters ─────────────────────────────────────────────
// Real: amadeus (Amadeus GDS)
// Shells: all others — return needs_api_key with correct setup URL

const SERPAPI   = 'https://serpapi.com/users/sign_up';
const SKYSCANNER = 'https://partners.skyscanner.net/affiliates/register';
const KAYAK      = 'https://www.kayak.com/api';
const KIWI       = 'https://tequila.kiwi.com';
const EXPEDIA    = 'https://developer.expediapartnersolutions.com';
const AIRLINE    = 'https://developers.amadeus.com/register'; // direct airline → via Amadeus GDS

export const FLIGHT_ADAPTERS: Record<string, FlightEngineAdapter> = {
  // ── Tier 1: Global Leaders ────────────────────────────────────────────────
  duffel:         DuffelAdapter,
  amadeus:        AmadeusAdapter,
  kiwi:           KiwiAdapter,
  'google-flights': needsApiKeyAdapter('google-flights', 'Google Flights', SERPAPI,    'SERPAPI_KEY'),
  kayak:          needsApiKeyAdapter('kayak',          'Kayak',           KAYAK,      'KAYAK_API_KEY'),
  skyscanner:     needsApiKeyAdapter('skyscanner',     'Skyscanner',      SKYSCANNER, 'SKYSCANNER_API_KEY'),
  'expedia-f':    needsApiKeyAdapter('expedia-f',      'Expedia',         EXPEDIA,    'EXPEDIA_API_KEY'),
  momondo:        needsApiKeyAdapter('momondo',        'Momondo',         KAYAK,      'KAYAK_API_KEY'),

  // ── Tier 2: Core Aggregators ──────────────────────────────────────────────
  hopper:         needsApiKeyAdapter('hopper',         'Hopper',          'https://developer.hopper.com', 'HOPPER_API_KEY'),
  orbitz:         needsApiKeyAdapter('orbitz',         'Orbitz',          EXPEDIA,    'EXPEDIA_API_KEY'),
  priceline:      needsApiKeyAdapter('priceline',      'Priceline',       'https://www.priceline.com/affiliates/', 'PRICELINE_API_KEY'),
  cheapoair:      needsApiKeyAdapter('cheapoair',      'CheapOAir',       'https://www.cheapoair.com/api/', 'CHEAPOAIR_API_KEY'),
  aeromexico:     needsApiKeyAdapter('aeromexico',     'Aeroméxico',      AIRLINE,    'AMADEUS_CLIENT_ID'),
  united:         needsApiKeyAdapter('united',         'United',          AIRLINE,    'AMADEUS_CLIENT_ID'),
  delta:          needsApiKeyAdapter('delta',          'Delta',           AIRLINE,    'AMADEUS_CLIENT_ID'),
  american:       needsApiKeyAdapter('american',       'American',        AIRLINE,    'AMADEUS_CLIENT_ID'),

  // ── Tier 3: Extended Network ──────────────────────────────────────────────
  southwest:      needsApiKeyAdapter('southwest',      'Southwest',       'https://developer.southwest.com', 'SOUTHWEST_API_KEY'),
  volaris:        needsApiKeyAdapter('volaris',        'Volaris',         AIRLINE,    'AMADEUS_CLIENT_ID'),
  vivaaerobus:    needsApiKeyAdapter('vivaaerobus',    'VivaAerobus',     AIRLINE,    'AMADEUS_CLIENT_ID'),
  copa:           needsApiKeyAdapter('copa',           'Copa Airlines',   AIRLINE,    'AMADEUS_CLIENT_ID'),
  latam:          needsApiKeyAdapter('latam',          'LATAM',           AIRLINE,    'AMADEUS_CLIENT_ID'),
  jetblue:        needsApiKeyAdapter('jetblue',        'JetBlue',         AIRLINE,    'AMADEUS_CLIENT_ID'),
  spirit:         needsApiKeyAdapter('spirit',         'Spirit',          AIRLINE,    'AMADEUS_CLIENT_ID'),
  frontier:       needsApiKeyAdapter('frontier',       'Frontier',        AIRLINE,    'AMADEUS_CLIENT_ID'),
  airfrance:      needsApiKeyAdapter('airfrance',      'Air France',      AIRLINE,    'AMADEUS_CLIENT_ID'),
  klm:            needsApiKeyAdapter('klm',            'KLM',             AIRLINE,    'AMADEUS_CLIENT_ID'),
  british:        needsApiKeyAdapter('british',        'British Airways', AIRLINE,    'AMADEUS_CLIENT_ID'),
  iberia:         needsApiKeyAdapter('iberia',         'Iberia',          AIRLINE,    'AMADEUS_CLIENT_ID'),
  lufthansa:      needsApiKeyAdapter('lufthansa',      'Lufthansa',       AIRLINE,    'AMADEUS_CLIENT_ID'),
  qatar:          needsApiKeyAdapter('qatar',          'Qatar Airways',   AIRLINE,    'AMADEUS_CLIENT_ID'),
  emirates:       needsApiKeyAdapter('emirates',       'Emirates',        AIRLINE,    'AMADEUS_CLIENT_ID'),
  aircanada:      needsApiKeyAdapter('aircanada',      'Air Canada',      AIRLINE,    'AMADEUS_CLIENT_ID'),
};

export type { FlightEngineAdapter, FlightSearchParams, FlightEngineResult } from './FlightEngineAdapter';
