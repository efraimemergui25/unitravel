import type { TransitEngineAdapter, TransitSearchParams, TransitEngineResult } from './TransitEngineAdapter';
import type { TransitQuery, RouteOption, TransitSegment, TransitMode } from '@/types/transit';
import { googleMapsDirectionsUrl } from '@/utils/deeplinks';

const GMAPS_BASE = 'https://maps.googleapis.com/maps/api/directions/json';

type GmapsStep = {
  travel_mode:       string;
  duration:          { value: number };
  html_instructions: string;
  transit_details?: {
    line?: { vehicle?: { type?: string }; name?: string; short_name?: string };
    num_stops?:       number;
    departure_time?:  { text?: string };
    arrival_time?:    { text?: string };
  };
};

type GmapsLeg = {
  duration:      { value: number; text: string };
  distance:      { text: string };
  start_address: string;
  end_address:   string;
  steps:         GmapsStep[];
};

type GmapsRoute = { legs: GmapsLeg[]; summary: string };
type GmapsResponse = { status: string; routes: GmapsRoute[] };

function stepToSegment(step: GmapsStep, adults: number): TransitSegment {
  const durationMin = Math.round(step.duration.value / 60);

  if (step.travel_mode === 'WALKING') {
    return {
      mode:       'walk',
      provider:   'On foot',
      label:      'Walk',
      durationMin,
      cost:       0,
      walkEffort: durationMin > 10 ? 'moderate' : 'flat',
    };
  }

  if (step.travel_mode === 'TRANSIT') {
    const td          = step.transit_details;
    const vehicleType = td?.line?.vehicle?.type?.toLowerCase() ?? '';
    const mode: TransitMode =
      vehicleType.includes('subway') || vehicleType.includes('metro') ? 'train' :
      vehicleType.includes('bus')    ? 'bus'   :
      vehicleType.includes('train')  ? 'train' : 'bus';

    const provider = td?.line?.name ?? td?.line?.short_name ?? 'Transit';
    return {
      mode,
      provider,
      label:       `${provider} (${td?.num_stops ?? 1} stop${(td?.num_stops ?? 1) > 1 ? 's' : ''})`,
      durationMin,
      cost:        mode === 'train' ? 3 * adults : 2 * adults,
      departTime:  td?.departure_time?.text,
      arriveTime:  td?.arrival_time?.text,
    };
  }

  return {
    mode:       'rideshare',
    provider:   'Uber / Taxi',
    label:      'Drive',
    durationMin,
    cost:       Math.round((durationMin / 60) * 35 * adults),
  };
}

export const GoogleMapsAdapter: TransitEngineAdapter = {
  id: 'google-maps', name: 'Google Maps',

  async search(params: TransitSearchParams): Promise<TransitEngineResult> {
    const start = Date.now();
    const key   = process.env.GOOGLE_MAPS_API_KEY;

    if (!key) {
      return {
        engineId: 'google-maps', engineName: 'Google Maps', status: 'needs_api_key',
        results: [], latencyMs: 0,
        setupUrl: 'https://console.cloud.google.com/apis/library/directions-backend.googleapis.com',
        setupMessage: 'Add GOOGLE_MAPS_API_KEY to .env.local to enable real transit routing.',
      };
    }

    try {
      const encode = encodeURIComponent;
      const [transitRes, drivingRes] = await Promise.allSettled([
        fetch(
          `${GMAPS_BASE}?origin=${encode(params.origin)}&destination=${encode(params.destination)}&mode=transit&key=${key}`,
          { signal: AbortSignal.timeout(8_000) },
        ).then(r => r.json() as Promise<GmapsResponse>),
        fetch(
          `${GMAPS_BASE}?origin=${encode(params.origin)}&destination=${encode(params.destination)}&mode=driving&key=${key}`,
          { signal: AbortSignal.timeout(8_000) },
        ).then(r => r.json() as Promise<GmapsResponse>),
      ]);

      const options: RouteOption[] = [];

      if (transitRes.status === 'fulfilled' && transitRes.value.status === 'OK' && transitRes.value.routes[0]) {
        const leg      = transitRes.value.routes[0].legs[0]!;
        const segments = leg.steps.map(s => stepToSegment(s, params.adults));
        const totalMin  = Math.round(leg.duration.value / 60);
        const totalCost = segments.reduce((s, seg) => s + seg.cost, 0);
        options.push({
          id:            'transit',
          label:         'Public Transit',
          segments,
          totalMin,
          totalCost,
          comfort:       3,
          co2Kg:         Math.round(totalMin * 0.04 * params.adults * 10) / 10,
          isRecommended: true,
          isFastest:     false,
          isCheapest:    true,
          tags:          ['eco-friendly', 'public-transit'],
          directionsUrl: googleMapsDirectionsUrl({ origin: params.origin, destination: params.destination, mode: 'transit' }),
        });
      }

      if (drivingRes.status === 'fulfilled' && drivingRes.value.status === 'OK' && drivingRes.value.routes[0]) {
        const leg         = drivingRes.value.routes[0].legs[0]!;
        const durationMin = Math.round(leg.duration.value / 60);
        const cost        = Math.round((durationMin / 60) * 35 * params.adults);
        options.push({
          id:    'rideshare',
          label: 'Rideshare / Taxi',
          segments: [{
            mode:       'rideshare',
            provider:   'Uber / Lyft',
            label:      `${leg.distance.text} drive`,
            durationMin,
            cost,
          }],
          totalMin:      durationMin,
          totalCost:     cost,
          comfort:       4,
          co2Kg:         Math.round(durationMin * 0.21 * params.adults * 10) / 10,
          isRecommended: false,
          isFastest:     true,
          isCheapest:    false,
          tags:          ['door-to-door', 'comfortable'],
          directionsUrl: googleMapsDirectionsUrl({ origin: params.origin, destination: params.destination, mode: 'driving' }),
        });
      }

      if (options.length === 0) {
        return { engineId: 'google-maps', engineName: 'Google Maps', status: 'ok', results: [], latencyMs: Date.now() - start };
      }

      const fastest  = options.reduce((a, b) => a.totalMin  < b.totalMin  ? a : b);
      const cheapest = options.reduce((a, b) => a.totalCost < b.totalCost ? a : b);
      options.forEach(o => { o.isFastest = o.id === fastest.id; o.isCheapest = o.id === cheapest.id; });

      const transitLeg = transitRes.status === 'fulfilled' && transitRes.value.routes[0]?.legs[0];

      const query: TransitQuery = {
        id:          `route-gmaps-${Date.now()}`,
        from:        params.origin,
        fromLabel:   transitLeg ? transitLeg.start_address : params.origin,
        to:          params.destination,
        toLabel:     transitLeg ? transitLeg.end_address   : params.destination,
        distance:    transitLeg ? transitLeg.distance.text : '',
        options,
        aiSummary:   `${options.length} route${options.length > 1 ? 's' : ''} found. ${fastest.label} is fastest (${fastest.totalMin}min). ${cheapest.label} is cheapest ($${cheapest.totalCost}).`,
        tripContext: `${params.origin} → ${params.destination}`,
        icon:        '🚇',
      };

      return { engineId: 'google-maps', engineName: 'Google Maps', status: 'ok', results: [query], latencyMs: Date.now() - start };
    } catch (err) {
      return {
        engineId: 'google-maps', engineName: 'Google Maps', status: 'error',
        results: [], latencyMs: Date.now() - start,
        setupMessage: err instanceof Error ? err.message : 'Google Maps failed',
      };
    }
  },
};
