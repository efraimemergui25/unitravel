import type { BentoFlight } from '@/lib/amadeus';

export interface FlightSearchParams {
  origin:        string;
  destination:   string;
  departureDate: string;
  returnDate?:   string;
  adults:        number;
  travelClass:   'ECONOMY' | 'PREMIUM_ECONOMY' | 'BUSINESS' | 'FIRST';
  nonStop:       boolean;
  maxResults:    number;
  currencyCode:  string;
}

export interface FlightEngineResult {
  engineId:     string;
  engineName:   string;
  status:       'ok' | 'needs_api_key' | 'error' | 'timeout';
  results:      BentoFlight[];
  latencyMs:    number;
  setupUrl?:    string;
  setupMessage?: string;
}

export interface FlightEngineAdapter {
  id:   string;
  name: string;
  search(params: FlightSearchParams): Promise<FlightEngineResult>;
}

export function needsApiKeyAdapter(
  id:       string,
  name:     string,
  setupUrl: string,
  envVar:   string,
): FlightEngineAdapter {
  return {
    id,
    name,
    async search() {
      return {
        engineId:     id,
        engineName:   name,
        status:       'needs_api_key',
        results:      [],
        latencyMs:    0,
        setupUrl,
        setupMessage: `Add ${envVar} to .env.local to enable ${name}.`,
      };
    },
  };
}
