import { getAmadeusClient }           from '@/lib/amadeus';
import { transformAmadeusHotelOffer } from './AmadeusHotelsAdapter';
import type { BentoHotel }            from '@/app/api/hotels/route';
import { DuffelStaysAdapter }         from './DuffelStaysAdapter';

// ── Hotel Engine Adapter interface ────────────────────────────────────────────

export interface HotelSearchParams {
  cityCode:     string;
  checkInDate:  string;
  checkOutDate: string;
  adults:       number;
  roomQuantity: number;
  currency:     string;
  maxResults:   number;
}

export interface HotelEngineResult {
  engineId:      string;
  engineName:    string;
  status:        'ok' | 'needs_api_key' | 'error';
  results:       BentoHotel[];
  latencyMs:     number;
  setupUrl?:     string;
  setupMessage?: string;
}

export interface HotelEngineAdapter {
  id:   string;
  name: string;
  search(params: HotelSearchParams): Promise<HotelEngineResult>;
}

function needsKey(id: string, name: string, setupUrl: string, envVar: string): HotelEngineAdapter {
  return {
    id, name,
    async search() {
      return { engineId: id, engineName: name, status: 'needs_api_key',
        results: [], latencyMs: 0, setupUrl,
        setupMessage: `Add ${envVar} to .env.local to enable ${name}.` };
    },
  };
}

// ── Amadeus Hotels adapter (real) ─────────────────────────────────────────────

const AmadeusHotelsAdapter: HotelEngineAdapter = {
  id: 'amadeus-hotels', name: 'Amadeus Hotels',
  async search(params) {
    const start   = Date.now();
    const amadeus = getAmadeusClient();
    if (!amadeus) {
      return { engineId: 'amadeus-hotels', engineName: 'Amadeus Hotels',
        status: 'needs_api_key', results: [], latencyMs: 0,
        setupUrl: 'https://developers.amadeus.com/register',
        setupMessage: 'Add AMADEUS_CLIENT_ID + AMADEUS_CLIENT_SECRET to .env.local.' };
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const a = amadeus as any;
      const listRes = await a.referenceData.locations.hotels.byCity.get(
        { cityCode: params.cityCode },
      );
      const hotelIds: string[] = ((listRes?.data ?? []) as { hotelId?: string }[])
        .slice(0, Math.min(params.maxResults, 10))
        .map(h => h.hotelId)
        .filter((id): id is string => !!id);

      if (hotelIds.length === 0) {
        return { engineId: 'amadeus-hotels', engineName: 'Amadeus Hotels',
          status: 'ok', results: [], latencyMs: Date.now() - start };
      }

      const offersRes = await a.shopping.hotelOffersSearch.get({
        hotelIds:     hotelIds.join(','),
        checkInDate:  params.checkInDate,
        checkOutDate: params.checkOutDate,
        adults:       params.adults,
        currency:     params.currency,
      });

      const results: BentoHotel[] = ((offersRes?.data ?? []) as unknown[])
        .flatMap(h => transformAmadeusHotelOffer(h));

      return { engineId: 'amadeus-hotels', engineName: 'Amadeus Hotels',
        status: 'ok', results, latencyMs: Date.now() - start };
    } catch (err) {
      return { engineId: 'amadeus-hotels', engineName: 'Amadeus Hotels',
        status: 'error', results: [], latencyMs: Date.now() - start,
        setupMessage: err instanceof Error ? err.message : 'Amadeus Hotels failed' };
    }
  },
};

// ── All hotel adapters ────────────────────────────────────────────────────────

const BOOKING  = 'https://join.booking.com/affiliation/portal/en/signup';
const EXPEDIA  = 'https://developer.expediapartnersolutions.com';
const AIRBNB   = 'https://www.airbnb.com/affiliate-program';
const MARRIOTT = 'https://developer.marriott.com';
const IHG_URL  = 'https://developer.ihg.com';
const AGODA    = 'https://www.agoda.com/affiliates/';

export const HOTEL_ADAPTERS: Record<string, HotelEngineAdapter> = {
  'duffel-stays':   DuffelStaysAdapter,
  'amadeus-hotels': AmadeusHotelsAdapter,
  airbnb:           needsKey('airbnb',         'Airbnb',          AIRBNB,   'AIRBNB_API_KEY'),
  booking:          needsKey('booking',        'Booking.com',     BOOKING,  'BOOKING_API_KEY'),
  'hotels-com':     needsKey('hotels-com',     'Hotels.com',      EXPEDIA,  'EXPEDIA_API_KEY'),
  'expedia-h':      needsKey('expedia-h',      'Expedia Hotels',  EXPEDIA,  'EXPEDIA_API_KEY'),
  marriott:         needsKey('marriott',       'Marriott',        MARRIOTT, 'MARRIOTT_API_KEY'),
  hilton:           needsKey('hilton',         'Hilton',          'https://developer.hilton.com', 'HILTON_API_KEY'),
  hyatt:            needsKey('hyatt',          'Hyatt',           'https://developer.hyatt.com',  'HYATT_API_KEY'),
  ihg:              needsKey('ihg',            'IHG',             IHG_URL,  'IHG_API_KEY'),
  'four-seasons':   needsKey('four-seasons',   'Four Seasons',    'https://www.fourseasons.com/affiliates', 'FOUR_SEASONS_API_KEY'),
  'ritz-carlton':   needsKey('ritz-carlton',   'Ritz-Carlton',    MARRIOTT, 'MARRIOTT_API_KEY'),
  rosewood:         needsKey('rosewood',       'Rosewood',        'https://www.rosewoodhotels.com', 'ROSEWOOD_API_KEY'),
  'one-only':       needsKey('one-only',       'One&Only',        'https://www.oneandonlyresorts.com', 'ONE_ONLY_API_KEY'),
  vrbo:             needsKey('vrbo',           'VRBO',            EXPEDIA,  'EXPEDIA_API_KEY'),
  hostelworld:      needsKey('hostelworld',    'Hostelworld',     'https://partners.hostelworld.com', 'HOSTELWORLD_API_KEY'),
  agoda:            needsKey('agoda',          'Agoda',           AGODA,    'AGODA_API_KEY'),
  'trip-com':       needsKey('trip-com',       'Trip.com',        'https://affiliates.trip.com', 'TRIP_COM_API_KEY'),
  'mr-mrs-smith':   needsKey('mr-mrs-smith',   'Mr & Mrs Smith',  'https://www.mrandmrssmith.com', 'MR_MRS_SMITH_API_KEY'),
  'design-hotels':  needsKey('design-hotels',  'Design Hotels',   'https://www.designhotels.com', 'DESIGN_HOTELS_API_KEY'),
  slh:              needsKey('slh',            'Small Luxury H.', 'https://www.slh.com', 'SLH_API_KEY'),
  'secret-escapes': needsKey('secret-escapes', 'Secret Escapes',  'https://affiliates.secretescapes.com', 'SECRET_ESCAPES_API_KEY'),
  'tablet-hotels':  needsKey('tablet-hotels',  'Tablet Hotels',   'https://www.tablethotels.com', 'TABLET_API_KEY'),
  preferred:        needsKey('preferred',      'Preferred Hotels','https://www.preferredhotels.com', 'PREFERRED_API_KEY'),
  relais:           needsKey('relais',         'Relais & Ch.',    'https://www.relaischateaux.com', 'RELAIS_API_KEY'),
  leading:          needsKey('leading',        'Leading Hotels',  'https://www.lhw.com', 'LEADING_API_KEY'),
  wyndham:          needsKey('wyndham',        'Wyndham',         'https://developer.wyndhamhotels.com', 'WYNDHAM_API_KEY'),
  kimpton:          needsKey('kimpton',        'Kimpton',         IHG_URL,  'IHG_API_KEY'),
  autograph:        needsKey('autograph',      'Autograph Coll.', MARRIOTT, 'MARRIOTT_API_KEY'),
  'omni-hotels':    needsKey('omni-hotels',    'Omni Hotels',     'https://www.omnihotels.com', 'OMNI_API_KEY'),
  'i-escape':       needsKey('i-escape',       'i-escape',        'https://www.i-escape.com', 'I_ESCAPE_API_KEY'),
  belmond:          needsKey('belmond',        'Belmond',         'https://www.belmond.com', 'BELMOND_API_KEY'),
};
