import type { TransitQuery, RouteOption, TransitSegment, TransitMode, ComfortLevel } from '@/types/transit';

// ── Transit engine IDs that provide routing data ──────────────────────────────

const ROUTING_ENGINE_IDS = new Set([
  'rome2rio', 'google-maps-transit', 'citymapper', 'trainline', 'eurail',
  'uber', 'lyft', 'turo', 'rentalcars', 'kayak-cars', 'flixbus', 'redbus',
  'busbud', 'blablacar', 'ferryhopper',
]);

// ── Mode colors (used externally by TransitVisualizer) ────────────────────────

export const MODE_COLOR: Record<TransitMode, string> = {
  flight:      '#007AFF',
  train:       '#5E5CE6',
  bus:         '#FF9F0A',
  rideshare:   '#1C1C1E',
  'car-rental':'#30D158',
  ferry:       '#00C7BE',
  walk:        '#8E8E93',
  shuttle:     '#FF6B35',
};

export const MODE_ICON: Record<TransitMode, string> = {
  flight:      '✈',
  train:       '🚄',
  bus:         '🚌',
  rideshare:   '🚗',
  'car-rental':'🚙',
  ferry:       '⛴',
  walk:        '🚶',
  shuttle:     '🚐',
};

// ── Seeded PRNG ───────────────────────────────────────────────────────────────

function seededRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

// ── Route library for 5 Mexico trip legs ─────────────────────────────────────

const ROUTE_TEMPLATES: Omit<TransitQuery, 'options'>[] = [
  {
    id:          'aicm-roma',
    from:        'AICM T1',
    fromLabel:   'Mexico City Airport (T1)',
    to:          'Roma Norte',
    toLabel:     'Roma Norte, CDMX',
    distance:    '14 km',
    aiSummary:   'Uber is fastest. Metro Line 5 is dirt cheap at MX$5 but adds 35 min with luggage. Airport taxis are fixed-rate and reliable for groups.',
    tripContext: 'Day 1 arrival transfer — arriving 14:30, hotel check-in from 15:00',
    icon:        '🛬',
  },
  {
    id:          'cdmx-tulum',
    from:        'CDMX',
    fromLabel:   'Mexico City (NAICM or T1)',
    to:          'Tulum',
    toLabel:     'Tulum Town Centre',
    distance:    '1,280 km',
    aiSummary:   'Fly Aeromexico or Volaris to CUN (90 min), then rideshare or rental car to Tulum (90 min). Direct overnight bus exists for budget travellers — 14 h.',
    tripContext: 'Day 3 morning — departing 08:00, check-in Tulum eco-lodge at 14:00',
    icon:        '✈',
  },
  {
    id:          'tulum-riviera',
    from:        'Tulum',
    fromLabel:   'Tulum Pueblo',
    to:          'Playa del Carmen',
    toLabel:     'Playa del Carmen, Riviera Maya',
    distance:    '62 km',
    aiSummary:   'Rental car is the most flexible — park at your hotel. ADO bus is comfortable and runs hourly. Colectivo taxis are the cheapest local option.',
    tripContext: 'Day 6 — moving from Tulum to Riviera Maya for scuba diving days',
    icon:        '🌴',
  },
  {
    id:          'riviera-cabo',
    from:        'Cancún (CUN)',
    fromLabel:   'Cancún Int\'l Airport',
    to:          'Los Cabos (SJD)',
    toLabel:     'San José del Cabo Airport',
    distance:    '2,340 km',
    aiSummary:   'Direct flight is the only practical option — 2 h 35 min. Aeromexico and Volaris both serve this route. Book early for honeymoon rates.',
    tripContext: 'Day 8 — hop to Cabo for whale watching & arch sunset',
    icon:        '🛫',
  },
  {
    id:          'cabo-aicm',
    from:        'Los Cabos (SJD)',
    fromLabel:   'San José del Cabo Airport',
    to:          'AICM T2',
    toLabel:     'Mexico City Airport (T2)',
    distance:    '1,490 km',
    aiSummary:   'Multiple daily flights via Aeromexico, Volaris, and VivaAerobus. Late-afternoon departure lets you catch one last Cabo sunrise.',
    tripContext: 'Day 10 — departure home via CDMX',
    icon:        '🏁',
  },
];

// ── Hard-coded route options for each leg ─────────────────────────────────────

type RouteTemplate = Omit<RouteOption, 'id'>;

const ROUTE_OPTIONS: Record<string, RouteTemplate[]> = {
  'aicm-roma': [
    {
      label:         'Uber / DiDi',
      segments:      [{ mode: 'rideshare', provider: 'Uber', label: 'Uber Pool', durationMin: 22, cost: 180, departTime: '14:35', arriveTime: '14:57' }],
      totalMin:      22, totalCost: 180, comfort: 4, co2Kg: 1.8,
      isRecommended: true, isFastest: true, isCheapest: false,
      tags:          ['Door-to-door', 'No cash needed', 'Surge possible'],
    },
    {
      label:         'Airport Taxi (Fixed)',
      segments:      [{ mode: 'rideshare', provider: 'AICM Taxi', label: 'Authorized Taxi', durationMin: 30, cost: 350, departTime: '14:35', arriveTime: '15:05' }],
      totalMin:      30, totalCost: 350, comfort: 4, co2Kg: 2.1,
      isRecommended: false, isFastest: false, isCheapest: false,
      tags:          ['Fixed rate', 'Safe', 'Accepts luggage'],
    },
    {
      label:         'Metro Line 5',
      segments:      [
        { mode: 'walk',  provider: 'Walk', label: 'T1 → Metro Terminal Aérea', durationMin: 10, cost: 0 },
        { mode: 'train', provider: 'Metro CDMX', label: 'Line 5 → Cuauhtémoc', durationMin: 35, cost: 5 },
        { mode: 'walk',  provider: 'Walk', label: 'Cuauhtémoc → Hotel', durationMin: 12, cost: 0 },
      ],
      totalMin:      57, totalCost: 5, comfort: 1, co2Kg: 0.3,
      isRecommended: false, isFastest: false, isCheapest: true,
      tags:          ['MX$5 fare', 'Avoid rush hour', 'Hard with luggage'],
    },
    {
      label:         'Metrobús + Walk',
      segments:      [
        { mode: 'bus',  provider: 'Metrobús', label: 'Line 4 → Insurgentes', durationMin: 38, cost: 22 },
        { mode: 'walk', provider: 'Walk',     label: 'Insurgentes → Roma Norte', durationMin: 15, cost: 0 },
      ],
      totalMin:      53, totalCost: 22, comfort: 2, co2Kg: 0.8,
      isRecommended: false, isFastest: false, isCheapest: false,
      tags:          ['Luggage-unfriendly', 'Scenic route'],
    },
  ],

  'cdmx-tulum': [
    {
      label:         'Fly + Rideshare',
      segments:      [
        { mode: 'rideshare', provider: 'Uber',         label: 'Hotel → AICM T1',         durationMin: 30,  cost: 200,   departTime: '08:00', arriveTime: '08:30' },
        { mode: 'flight',    provider: 'Aeromexico',   label: 'MEX → CUN (AM 664)',       durationMin: 90,  cost: 2800,  departTime: '09:30', arriveTime: '11:00' },
        { mode: 'rideshare', provider: 'Uber',         label: 'CUN Airport → Tulum',      durationMin: 90,  cost: 650,   departTime: '11:30', arriveTime: '13:00' },
      ],
      totalMin:      270, totalCost: 3650, comfort: 5, co2Kg: 98.4,
      isRecommended: true, isFastest: true, isCheapest: false,
      tags:          ['Fastest', 'Most comfortable', 'High carbon'],
    },
    {
      label:         'Fly + Car Rental',
      segments:      [
        { mode: 'rideshare',  provider: 'DiDi',       label: 'Hotel → AICM T1',     durationMin: 30, cost: 160,  departTime: '08:00', arriveTime: '08:30' },
        { mode: 'flight',     provider: 'Volaris',    label: 'MEX → CUN (Y4 118)',   durationMin: 90, cost: 1950, departTime: '09:30', arriveTime: '11:00' },
        { mode: 'car-rental', provider: 'Rentalcars', label: 'CUN → Tulum (Hwy 307)',durationMin: 95, cost: 480,  departTime: '11:30', arriveTime: '13:05' },
      ],
      totalMin:      275, totalCost: 2590, comfort: 4, co2Kg: 102.1,
      isRecommended: false, isFastest: false, isCheapest: false,
      tags:          ['Flexible in Tulum', 'Cheapest to fly', 'Rental fees apply'],
    },
    {
      label:         'Overnight ADO Bus',
      segments:      [
        { mode: 'bus',  provider: 'ADO GL',    label: 'TAPO → Tulum Bus Terminal', durationMin: 840, cost: 980, departTime: '20:00', arriveTime: '10:00' },
      ],
      totalMin:      840, totalCost: 980, comfort: 2, co2Kg: 14.2,
      isRecommended: false, isFastest: false, isCheapest: true,
      tags:          ['Cheapest', '14h overnight', 'Reclining seats', 'Low carbon'],
    },
    {
      label:         'Fly Budget + Colectivo',
      segments:      [
        { mode: 'rideshare', provider: 'Uber',          label: 'Hotel → AICM T1',   durationMin: 30,  cost: 200,  departTime: '08:00', arriveTime: '08:30' },
        { mode: 'flight',    provider: 'VivaAerobus',   label: 'MEX → CUN (VB 317)', durationMin: 90,  cost: 1600, departTime: '09:30', arriveTime: '11:00' },
        { mode: 'bus',       provider: 'Colectivo',     label: 'CUN → Tulum Colectivo', durationMin: 105, cost: 100, departTime: '11:30', arriveTime: '13:15' },
      ],
      totalMin:      285, totalCost: 1900, comfort: 3, co2Kg: 95.7,
      isRecommended: false, isFastest: false, isCheapest: false,
      tags:          ['Value pick', 'Colectivo experience', 'Shared van'],
    },
  ],

  'tulum-riviera': [
    {
      label:         'Rental Car (Hwy 307)',
      segments:      [{ mode: 'car-rental', provider: 'Turo', label: 'Tulum → Playa del Carmen', durationMin: 50, cost: 420, departTime: '09:00', arriveTime: '09:50' }],
      totalMin:      50, totalCost: 420, comfort: 5, co2Kg: 6.8,
      isRecommended: true, isFastest: true, isCheapest: false,
      tags:          ['Most flexible', 'Beach stops possible', 'Parking included'],
    },
    {
      label:         'ADO Bus (Direct)',
      segments:      [{ mode: 'bus', provider: 'ADO', label: 'Tulum Bus → Playa del Carmen', durationMin: 65, cost: 112, departTime: '09:00', arriveTime: '10:05' }],
      totalMin:      65, totalCost: 112, comfort: 3, co2Kg: 2.1,
      isRecommended: false, isFastest: false, isCheapest: false,
      tags:          ['Reliable', 'A/C', 'Hourly departures'],
    },
    {
      label:         'Colectivo Taxi',
      segments:      [{ mode: 'bus', provider: 'Colectivo', label: 'Tulum Pueblo → Playa del Carmen', durationMin: 75, cost: 55, departTime: '09:00', arriveTime: '10:15' }],
      totalMin:      75, totalCost: 55, comfort: 2, co2Kg: 1.4,
      isRecommended: false, isFastest: false, isCheapest: true,
      tags:          ['Local experience', 'Shared van', 'Cash only'],
    },
    {
      label:         'Uber Premium',
      segments:      [{ mode: 'rideshare', provider: 'Uber Black', label: 'Tulum → Playa del Carmen', durationMin: 48, cost: 580, departTime: '09:00', arriveTime: '09:48' }],
      totalMin:      48, totalCost: 580, comfort: 5, co2Kg: 5.9,
      isRecommended: false, isFastest: false, isCheapest: false,
      tags:          ['Luxury', 'Private', 'A/C guaranteed'],
    },
  ],

  'riviera-cabo': [
    {
      label:         'Aeromexico Direct',
      segments:      [{ mode: 'flight', provider: 'Aeromexico', label: 'CUN → SJD (AM 776)', durationMin: 155, cost: 3200, departTime: '07:30', arriveTime: '10:05' }],
      totalMin:      155, totalCost: 3200, comfort: 5, co2Kg: 134.2,
      isRecommended: true, isFastest: true, isCheapest: false,
      tags:          ['Best seat selection', 'Breakfast served', '2 checked bags'],
    },
    {
      label:         'Volaris Direct',
      segments:      [{ mode: 'flight', provider: 'Volaris', label: 'CUN → SJD (Y4 206)', durationMin: 155, cost: 2400, departTime: '09:15', arriveTime: '11:50' }],
      totalMin:      155, totalCost: 2400, comfort: 3, co2Kg: 134.2,
      isRecommended: false, isFastest: false, isCheapest: false,
      tags:          ['Budget carrier', 'Fees for bags', 'Web check-in required'],
    },
    {
      label:         'VivaAerobus Direct',
      segments:      [{ mode: 'flight', provider: 'VivaAerobus', label: 'CUN → SJD (VB 412)', durationMin: 158, cost: 1980, departTime: '13:00', arriveTime: '15:38' }],
      totalMin:      158, totalCost: 1980, comfort: 2, co2Kg: 134.2,
      isRecommended: false, isFastest: false, isCheapest: true,
      tags:          ['Cheapest', 'Afternoon flight', 'No frills'],
    },
    {
      label:         'Via MEX (Connecting)',
      segments:      [
        { mode: 'flight', provider: 'Aeromexico', label: 'CUN → MEX (AM 202)', durationMin: 135, cost: 1800, departTime: '06:00', arriveTime: '07:15' },
        { mode: 'flight', provider: 'Aeromexico', label: 'MEX → SJD (AM 344)', durationMin: 165, cost: 1400, departTime: '09:30', arriveTime: '12:15' },
      ],
      totalMin:      375, totalCost: 3200, comfort: 4, co2Kg: 198.8,
      isRecommended: false, isFastest: false, isCheapest: false,
      tags:          ['Extra CO₂', 'Layover in CDMX', 'More flexibility'],
    },
  ],

  'cabo-aicm': [
    {
      label:         'Aeromexico AM 341',
      segments:      [{ mode: 'flight', provider: 'Aeromexico', label: 'SJD → MEX (AM 341)', durationMin: 165, cost: 2950, departTime: '16:00', arriveTime: '19:45' }],
      totalMin:      165, totalCost: 2950, comfort: 5, co2Kg: 128.6,
      isRecommended: true, isFastest: false, isCheapest: false,
      tags:          ['Last Cabo morning free', 'Dinner in CDMX', 'Earns miles'],
    },
    {
      label:         'Volaris Early Bird',
      segments:      [{ mode: 'flight', provider: 'Volaris', label: 'SJD → MEX (Y4 209)', durationMin: 162, cost: 2100, departTime: '07:30', arriveTime: '11:12' }],
      totalMin:      162, totalCost: 2100, comfort: 3, co2Kg: 128.6,
      isRecommended: false, isFastest: true, isCheapest: false,
      tags:          ['Early departure', 'Afternoon arrival', 'Budget option'],
    },
    {
      label:         'VivaAerobus VB 88',
      segments:      [{ mode: 'flight', provider: 'VivaAerobus', label: 'SJD → MEX (VB 088)', durationMin: 165, cost: 1750, departTime: '12:00', arriveTime: '15:45' }],
      totalMin:      165, totalCost: 1750, comfort: 2, co2Kg: 128.6,
      isRecommended: false, isFastest: false, isCheapest: true,
      tags:          ['Cheapest return', 'Midday flight'],
    },
    {
      label:         'Aeromexico Morning',
      segments:      [{ mode: 'flight', provider: 'Aeromexico', label: 'SJD → MEX (AM 345)', durationMin: 165, cost: 3100, departTime: '10:15', arriveTime: '14:00' }],
      totalMin:      165, totalCost: 3100, comfort: 5, co2Kg: 128.6,
      isRecommended: false, isFastest: false, isCheapest: false,
      tags:          ['Premium seats', 'Arch sunrise views'],
    },
  ],
};

// ── Build TransitQuery objects ─────────────────────────────────────────────────

function buildQuery(template: Omit<TransitQuery, 'options'>, engineIds: string[]): TransitQuery {
  const rand    = seededRand(template.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0));
  const allOpts = ROUTE_OPTIONS[template.id] ?? [];
  const hasRouting = engineIds.some(id => ROUTING_ENGINE_IDS.has(id));

  const options: RouteOption[] = allOpts.map((opt, i) => ({
    ...opt,
    id: `${template.id}-opt-${i}`,
    // Slight price variation per engine selection
    totalCost: hasRouting ? Math.round(opt.totalCost * (0.92 + rand() * 0.16)) : opt.totalCost,
  }));

  return { ...template, options };
}

// ── Public export ─────────────────────────────────────────────────────────────

export function distillTransit(activeEngineIds: string[]): TransitQuery[] {
  return ROUTE_TEMPLATES.map(t => buildQuery(t, activeEngineIds));
}
