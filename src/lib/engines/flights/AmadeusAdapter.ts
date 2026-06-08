import { getAmadeusClient, transformAmadeusOffer } from '@/lib/amadeus';
import type { FlightEngineAdapter, FlightSearchParams, FlightEngineResult } from './FlightEngineAdapter';

export const AmadeusAdapter: FlightEngineAdapter = {
  id:   'amadeus',
  name: 'Amadeus GDS',

  async search(params: FlightSearchParams): Promise<FlightEngineResult> {
    const start  = Date.now();
    const amadeus = getAmadeusClient();

    if (!amadeus) {
      return {
        engineId:     'amadeus',
        engineName:   'Amadeus GDS',
        status:       'needs_api_key',
        results:      [],
        latencyMs:    0,
        setupUrl:     'https://developers.amadeus.com/register',
        setupMessage: 'Add AMADEUS_CLIENT_ID and AMADEUS_CLIENT_SECRET to .env.local.',
      };
    }

    try {
      const apiParams: Record<string, string | number | boolean> = {
        originLocationCode:      params.origin,
        destinationLocationCode: params.destination,
        departureDate:           params.departureDate,
        adults:                  params.adults,
        travelClass:             params.travelClass,
        nonStop:                 params.nonStop,
        max:                     params.maxResults,
        currencyCode:            params.currencyCode,
      };
      if (params.returnDate) apiParams.returnDate = params.returnDate;

      const response = await amadeus.shopping.flightOffersSearch.get(apiParams);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results = (response.data as any[]).map(o => transformAmadeusOffer(o, params.adults));

      return {
        engineId:   'amadeus',
        engineName: 'Amadeus GDS',
        status:     'ok',
        results,
        latencyMs:  Date.now() - start,
      };
    } catch (err) {
      return {
        engineId:     'amadeus',
        engineName:   'Amadeus GDS',
        status:       'error',
        results:      [],
        latencyMs:    Date.now() - start,
        setupMessage: err instanceof Error ? err.message : 'Amadeus search failed',
      };
    }
  },
};
