import { getAmadeusClient }           from '@/lib/amadeus';
import { transformAmadeusHotelOffer } from './AmadeusHotelsAdapter';
import type { BentoHotel }            from '@/app/api/hotels/route';
import { DuffelStaysAdapter }         from './DuffelStaysAdapter';
import { GoogleHotelsAdapter }        from './GoogleHotelsAdapter';

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
  deepLinkUrl?:  string;
  setupUrl?:     string;
  setupMessage?: string;
}

export interface HotelEngineAdapter {
  id:   string;
  name: string;
  search(params: HotelSearchParams): Promise<HotelEngineResult>;
}

function needsKey(
  id: string, name: string, setupUrl: string, envVar: string,
  deepLinkFn?: (p: HotelSearchParams) => string,
): HotelEngineAdapter {
  return {
    id, name,
    async search(params) {
      return { engineId: id, engineName: name, status: 'needs_api_key',
        results: [], latencyMs: 0,
        deepLinkUrl: deepLinkFn ? deepLinkFn(params) : undefined,
        setupUrl, setupMessage: `Add ${envVar} to .env.local to enable ${name}.` };
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

// ── Deep link helpers ─────────────────────────────────────────────────────────

const enc = (s: string) => encodeURIComponent(s);

function bookingLink(p: HotelSearchParams) {
  return `https://www.booking.com/searchresults.html?ss=${enc(p.cityCode)}&checkin=${p.checkInDate}&checkout=${p.checkOutDate}&group_adults=${p.adults}&no_rooms=${p.roomQuantity}`;
}
function airbnbLink(p: HotelSearchParams) {
  return `https://www.airbnb.com/s/${enc(p.cityCode)}/homes?checkin=${p.checkInDate}&checkout=${p.checkOutDate}&adults=${p.adults}`;
}
function hotelsComLink(p: HotelSearchParams) {
  return `https://www.hotels.com/search/hotels?q-destination=${enc(p.cityCode)}&q-check-in=${p.checkInDate}&q-check-out=${p.checkOutDate}&q-rooms=${p.roomQuantity}&q-room-0-adults=${p.adults}`;
}
function expediaHotelLink(p: HotelSearchParams) {
  return `https://www.expedia.com/Hotel-Search?destination=${enc(p.cityCode)}&startDate=${p.checkInDate}&endDate=${p.checkOutDate}&adults=${p.adults}`;
}
function marriottLink(p: HotelSearchParams) {
  return `https://www.marriott.com/search/default.mi?destinationAddress.destination=${enc(p.cityCode)}&fromDate=${p.checkInDate}&toDate=${p.checkOutDate}&numAdultsPerGuestRoom=${p.adults}`;
}
function hiltonLink(p: HotelSearchParams) {
  return `https://www.hilton.com/en/search/find-hotels/list/?destination=${enc(p.cityCode)}&arrival=${p.checkInDate}&departure=${p.checkOutDate}&numAdults=${p.adults}`;
}
function hyattLink(p: HotelSearchParams) {
  return `https://www.hyatt.com/search-results?destination=${enc(p.cityCode)}&checkinDate=${p.checkInDate}&checkoutDate=${p.checkOutDate}&adults=${p.adults}`;
}
function ihgLink(p: HotelSearchParams) {
  return `https://www.ihg.com/hotels/us/en/find-hotels/hotel/list?qDest=${enc(p.cityCode)}&qCheckInDay=${p.checkInDate.split('-')[2]}&qCheckInMonthYear=${p.checkInDate.slice(0,7)}&qCheckOutDay=${p.checkOutDate.split('-')[2]}&qCheckOutMonthYear=${p.checkOutDate.slice(0,7)}&qAdultPerRoom=${p.adults}`;
}
function agodaLink(p: HotelSearchParams) {
  return `https://www.agoda.com/search?city=${enc(p.cityCode)}&checkIn=${p.checkInDate}&checkOut=${p.checkOutDate}&numberOfAdult=${p.adults}&numberOfRoom=${p.roomQuantity}`;
}
function vrboLink(p: HotelSearchParams) {
  return `https://www.vrbo.com/search/keywords:${enc(p.cityCode)}/arrival:${p.checkInDate}/departure:${p.checkOutDate}/adults:${p.adults}`;
}
function hostelworldLink(p: HotelSearchParams) {
  return `https://www.hostelworld.com/search?search_keywords=${enc(p.cityCode)}&b_date=${p.checkInDate}&e_date=${p.checkOutDate}&number_of_guests=${p.adults}`;
}
function tripComLink(p: HotelSearchParams) {
  return `https://www.trip.com/hotels/list?city=${enc(p.cityCode)}&checkin=${p.checkInDate}&checkout=${p.checkOutDate}&adult=${p.adults}`;
}

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
  'google-hotels':  GoogleHotelsAdapter,

  // ── OTAs (deep links) ─────────────────────────────────────────────────────
  airbnb:        needsKey('airbnb',        'Airbnb',         AIRBNB,   'AIRBNB_API_KEY',   airbnbLink),
  booking:       needsKey('booking',       'Booking.com',    BOOKING,  'BOOKING_API_KEY',  bookingLink),
  'hotels-com':  needsKey('hotels-com',    'Hotels.com',     EXPEDIA,  'EXPEDIA_API_KEY',  hotelsComLink),
  'expedia-h':   needsKey('expedia-h',     'Expedia Hotels', EXPEDIA,  'EXPEDIA_API_KEY',  expediaHotelLink),
  agoda:         needsKey('agoda',         'Agoda',          AGODA,    'AGODA_API_KEY',    agodaLink),
  vrbo:          needsKey('vrbo',          'VRBO',           EXPEDIA,  'EXPEDIA_API_KEY',  vrboLink),
  hostelworld:   needsKey('hostelworld',   'Hostelworld',    'https://partners.hostelworld.com', 'HOSTELWORLD_API_KEY', hostelworldLink),
  'trip-com':    needsKey('trip-com',      'Trip.com',       'https://affiliates.trip.com', 'TRIP_COM_API_KEY', tripComLink),

  // ── Major chains (deep links) ─────────────────────────────────────────────
  marriott:      needsKey('marriott',      'Marriott',       MARRIOTT, 'MARRIOTT_API_KEY', marriottLink),
  hilton:        needsKey('hilton',        'Hilton',         'https://developer.hilton.com', 'HILTON_API_KEY', hiltonLink),
  hyatt:         needsKey('hyatt',         'Hyatt',          'https://developer.hyatt.com',  'HYATT_API_KEY',  hyattLink),
  ihg:           needsKey('ihg',           'IHG',            IHG_URL,  'IHG_API_KEY',      ihgLink),
  wyndham:       needsKey('wyndham',       'Wyndham',        'https://developer.wyndhamhotels.com', 'WYNDHAM_API_KEY', (p) => `https://www.wyndhamhotels.com/search?checkInDate=${p.checkInDate}&checkOutDate=${p.checkOutDate}&destination=${enc(p.cityCode)}&adults=${p.adults}`),

  // ── Luxury / Boutique (deep links to brand sites) ─────────────────────────
  'four-seasons': needsKey('four-seasons', 'Four Seasons',   'https://www.fourseasons.com/affiliates', 'FOUR_SEASONS_API_KEY', (p) => `https://www.fourseasons.com/find-a-hotel/?destination=${enc(p.cityCode)}&check_in=${p.checkInDate}&check_out=${p.checkOutDate}&adults=${p.adults}`),
  'ritz-carlton': needsKey('ritz-carlton', 'Ritz-Carlton',   MARRIOTT, 'MARRIOTT_API_KEY', (p) => `https://www.ritzcarlton.com/en/hotels/?city=${enc(p.cityCode)}`),
  rosewood:       needsKey('rosewood',     'Rosewood',       'https://www.rosewoodhotels.com', 'ROSEWOOD_API_KEY', (p) => `https://www.rosewoodhotels.com/en/destinations?destination=${enc(p.cityCode)}`),
  'one-only':     needsKey('one-only',     'One&Only',       'https://www.oneandonlyresorts.com', 'ONE_ONLY_API_KEY', (p) => `https://www.oneandonlyresorts.com/search?destination=${enc(p.cityCode)}`),
  'mr-mrs-smith': needsKey('mr-mrs-smith', 'Mr & Mrs Smith', 'https://www.mrandmrssmith.com', 'MR_MRS_SMITH_API_KEY', (p) => `https://www.mrandmrssmith.com/hotel-search?q=${enc(p.cityCode)}&checkin=${p.checkInDate}&checkout=${p.checkOutDate}&adults=${p.adults}`),
  'design-hotels':needsKey('design-hotels','Design Hotels',  'https://www.designhotels.com', 'DESIGN_HOTELS_API_KEY', (p) => `https://www.designhotels.com/hotels?destination=${enc(p.cityCode)}&arrival=${p.checkInDate}&departure=${p.checkOutDate}&adults=${p.adults}`),
  slh:            needsKey('slh',          'Small Luxury H.','https://www.slh.com', 'SLH_API_KEY', (p) => `https://www.slh.com/search?destination=${enc(p.cityCode)}&checkin=${p.checkInDate}&checkout=${p.checkOutDate}&adults=${p.adults}`),
  'secret-escapes':needsKey('secret-escapes','Secret Escapes','https://affiliates.secretescapes.com', 'SECRET_ESCAPES_API_KEY', (p) => `https://www.secretescapes.com/search?destination=${enc(p.cityCode)}`),
  'tablet-hotels':needsKey('tablet-hotels','Tablet Hotels',  'https://www.tablethotels.com', 'TABLET_API_KEY', (p) => `https://www.tablethotels.com/en/${p.cityCode.toLowerCase()}-hotels`),
  preferred:      needsKey('preferred',    'Preferred Hotels','https://www.preferredhotels.com', 'PREFERRED_API_KEY', (p) => `https://www.preferredhotels.com/search?destination=${enc(p.cityCode)}&check-in=${p.checkInDate}&check-out=${p.checkOutDate}&adults=${p.adults}`),
  relais:         needsKey('relais',       'Relais & Ch.',   'https://www.relaischateaux.com', 'RELAIS_API_KEY', (p) => `https://www.relaischateaux.com/us/hotel-restaurant/?destination=${enc(p.cityCode)}`),
  leading:        needsKey('leading',      'Leading Hotels', 'https://www.lhw.com', 'LEADING_API_KEY', (p) => `https://www.lhw.com/search?q=${enc(p.cityCode)}&checkIn=${p.checkInDate}&checkOut=${p.checkOutDate}&adults=${p.adults}`),
  kimpton:        needsKey('kimpton',      'Kimpton',        IHG_URL,  'IHG_API_KEY', ihgLink),
  autograph:      needsKey('autograph',    'Autograph Coll.',MARRIOTT, 'MARRIOTT_API_KEY', (p) => `https://www.marriott.com/search/default.mi?destinationAddress.destination=${enc(p.cityCode)}&brands=AK&fromDate=${p.checkInDate}&toDate=${p.checkOutDate}`),
  'omni-hotels':  needsKey('omni-hotels',  'Omni Hotels',    'https://www.omnihotels.com', 'OMNI_API_KEY', (p) => `https://www.omnihotels.com/find-a-hotel?check-in=${p.checkInDate}&check-out=${p.checkOutDate}&destination=${enc(p.cityCode)}`),
  'i-escape':     needsKey('i-escape',     'i-escape',       'https://www.i-escape.com', 'I_ESCAPE_API_KEY', (p) => `https://www.i-escape.com/search?q=${enc(p.cityCode)}`),
  belmond:        needsKey('belmond',      'Belmond',        'https://www.belmond.com', 'BELMOND_API_KEY', (p) => `https://www.belmond.com/hotels/?destination=${enc(p.cityCode)}`),
};
