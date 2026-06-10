import type { AttractionEntity }                                                from '@/types/attractions';
import type { AttractionEngineAdapter, AttractionSearchParams, AttractionEngineResult } from './index';

const TEXT_SEARCH = 'https://maps.googleapis.com/maps/api/place/textsearch/json';

const TYPE_MAP: Record<string, 'cultural' | 'outdoor' | 'culinary' | 'adventure' | 'wellness'> = {
  museum:              'cultural',
  art_gallery:         'cultural',
  church:              'cultural',
  hindu_temple:        'cultural',
  mosque:              'cultural',
  synagogue:           'cultural',
  place_of_worship:    'cultural',
  park:                'outdoor',
  natural_feature:     'outdoor',
  campground:          'outdoor',
  zoo:                 'outdoor',
  aquarium:            'outdoor',
  amusement_park:      'adventure',
  tourist_attraction:  'cultural',
  point_of_interest:   'cultural',
  stadium:             'adventure',
  food:                'culinary',
  restaurant:          'culinary',
  spa:                 'wellness',
};

const GRADIENTS: Record<string, string> = {
  cultural:  'linear-gradient(135deg, #5E5CE6 0%, #007AFF 100%)',
  outdoor:   'linear-gradient(135deg, #1B5E20 0%, #43A047 100%)',
  culinary:  'linear-gradient(135deg, #FF9F0A 0%, #FF453A 100%)',
  adventure: 'linear-gradient(135deg, #FF453A 0%, #BF5AF2 100%)',
  wellness:  'linear-gradient(135deg, #00C7BE 0%, #30D158 100%)',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformPlace(place: any, destination: string): AttractionEntity {
  const types: string[]  = place.types ?? [];
  const type = types.reduce<'cultural' | 'outdoor' | 'culinary' | 'adventure' | 'wellness'>((acc, t) => {
    return TYPE_MAP[t] ?? acc;
  }, 'cultural');

  const mapsUrl = place.place_id
    ? `https://www.google.com/maps/place/?q=place_id:${place.place_id}`
    : `https://www.google.com/maps/search/${encodeURIComponent(place.name ?? destination)}`;

  return {
    id:                place.place_id ?? `gplaces-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title:             place.name ?? 'Attraction',
    description:       place.formatted_address ?? destination,
    type,
    destination,
    city:              destination,
    lat:               place.geometry?.location?.lat ?? undefined,
    lon:               place.geometry?.location?.lng ?? undefined,
    durationHours:     2,
    groupSizeMax:      50,
    pricePerPerson:    0,
    difficulty:        'easy',
    weatherDependency: 'none',
    bestTimeOfDay:     'anytime',
    instantBook:       false,
    rating:            typeof place.rating === 'number' ? parseFloat(place.rating.toFixed(1)) : 0,
    reviewCount:       place.user_ratings_total ?? 0,
    aiHighlight:       `Rated ${place.rating ?? 'N/A'} by ${(place.user_ratings_total ?? 0).toLocaleString()} visitors on Google.`,
    weatherMatch:      null,
    gradient:          GRADIENTS[type],
    tags:              types.filter(t => t !== 'point_of_interest' && t !== 'establishment').slice(0, 5),
    aiConfidence:      0.85,
    providers:         ['Google Places'],
    sourceCount:       1,
    bookingUrl:        mapsUrl,
  };
}

export const GooglePlacesAttractionsAdapter: AttractionEngineAdapter = {
  id:   'google-places',
  name: 'Google Places',

  async search(params: AttractionSearchParams): Promise<AttractionEngineResult> {
    const start = Date.now();
    const key   = process.env.GOOGLE_PLACES_API_KEY;

    if (!key) {
      return {
        engineId:     'google-places',
        engineName:   'Google Places',
        status:       'needs_api_key',
        results:      [],
        latencyMs:    0,
        deepLinkUrl:  `https://www.google.com/maps/search/things+to+do+in+${encodeURIComponent(params.destination)}`,
        setupUrl:     'https://developers.google.com/maps/documentation/places/web-service/overview',
        setupMessage: 'Add GOOGLE_PLACES_API_KEY to .env.local to enable Google Places.',
      };
    }

    try {
      const urlParams = new URLSearchParams({
        query: `tourist attractions in ${params.destination}`,
        type:  'tourist_attraction',
        key,
      });

      const res = await fetch(`${TEXT_SEARCH}?${urlParams}`, {
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        return {
          engineId:     'google-places',
          engineName:   'Google Places',
          status:       'error',
          results:      [],
          latencyMs:    Date.now() - start,
          setupMessage: `Google Places HTTP ${res.status}`,
        };
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await res.json();

      if (data.status === 'REQUEST_DENIED') {
        return {
          engineId:     'google-places',
          engineName:   'Google Places',
          status:       'needs_api_key',
          results:      [],
          latencyMs:    Date.now() - start,
          deepLinkUrl:  `https://www.google.com/maps/search/things+to+do+in+${encodeURIComponent(params.destination)}`,
          setupUrl:     'https://developers.google.com/maps/documentation/places/web-service/overview',
          setupMessage: `Google Places: ${data.error_message ?? 'Key restricted or invalid.'}`,
        };
      }

      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        return {
          engineId:     'google-places',
          engineName:   'Google Places',
          status:       'error',
          results:      [],
          latencyMs:    Date.now() - start,
          setupMessage: `Google Places status: ${data.status}`,
        };
      }

      const results: AttractionEntity[] = (data.results ?? [])
        .slice(0, params.maxResults)
        .map((p: unknown) => transformPlace(p, params.destination));

      return {
        engineId:   'google-places',
        engineName: 'Google Places',
        status:     'ok',
        results,
        latencyMs:  Date.now() - start,
      };
    } catch (err) {
      return {
        engineId:     'google-places',
        engineName:   'Google Places',
        status:       'error',
        results:      [],
        latencyMs:    Date.now() - start,
        setupMessage: err instanceof Error ? err.message : 'Google Places search failed',
      };
    }
  },
};
