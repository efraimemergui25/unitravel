/* Minimal type shim for the 'amadeus' npm package (no official @types). */
declare module 'amadeus' {
  interface AmadeusConfig {
    clientId:     string;
    clientSecret: string;
    hostname?:    'test' | 'production';
  }

  interface FlightOffersSearch {
    get(params: Record<string, string | number | boolean>): Promise<{ data: unknown[] }>;
  }

  interface Shopping {
    flightOffersSearch: FlightOffersSearch;
  }

  class Amadeus {
    constructor(config: AmadeusConfig);
    shopping: Shopping;
  }

  export = Amadeus;
}
