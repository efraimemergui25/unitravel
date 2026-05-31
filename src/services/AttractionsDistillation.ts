import type { AttractionEntity, ExperienceType, WeatherDependency, WeatherMatch } from '@/types/attractions';

// ── Trip day weather (Mexico Oct 2026) ────────────────────────────────────────

interface TripDay {
  day:     number;
  label:   string;
  city:    string;
  cond:    string;
  tempC:   number;
  icon:    string;
  outdoor: 'perfect' | 'good' | 'fair';
}

const TRIP_DAYS: TripDay[] = [
  { day: 1,  label: 'Day 1',  city: 'Mexico City',    cond: 'Partly Cloudy', tempC: 22, icon: '⛅', outdoor: 'good'    },
  { day: 2,  label: 'Day 2',  city: 'Mexico City',    cond: 'Sunny',         tempC: 24, icon: '☀',  outdoor: 'perfect' },
  { day: 3,  label: 'Day 3',  city: 'Tulum',          cond: 'Sunny',         tempC: 28, icon: '☀',  outdoor: 'perfect' },
  { day: 4,  label: 'Day 4',  city: 'Tulum',          cond: 'Partly Cloudy', tempC: 26, icon: '⛅', outdoor: 'good'    },
  { day: 5,  label: 'Day 5',  city: 'Tulum',          cond: 'Sunny',         tempC: 27, icon: '☀',  outdoor: 'perfect' },
  { day: 6,  label: 'Day 6',  city: 'Riviera Maya',   cond: 'Sunny',         tempC: 30, icon: '☀',  outdoor: 'perfect' },
  { day: 7,  label: 'Day 7',  city: 'Riviera Maya',   cond: 'Brief Showers', tempC: 27, icon: '🌦', outdoor: 'fair'    },
  { day: 8,  label: 'Day 8',  city: 'Cabo San Lucas', cond: 'Sunny',         tempC: 32, icon: '☀',  outdoor: 'perfect' },
  { day: 9,  label: 'Day 9',  city: 'Cabo San Lucas', cond: 'Sunny',         tempC: 31, icon: '☀',  outdoor: 'perfect' },
  { day: 10, label: 'Day 10', city: 'Mexico City',    cond: 'Partly Cloudy', tempC: 23, icon: '⛅', outdoor: 'good'    },
];

// ── Weather match logic ───────────────────────────────────────────────────────

function computeWeatherMatch(
  city:              string,
  weatherDependency: WeatherDependency,
): WeatherMatch | null {
  if (weatherDependency === 'none') return null;

  const days = TRIP_DAYS.filter(d =>
    d.city.toLowerCase().includes(city.toLowerCase()) ||
    city.toLowerCase().includes(d.city.toLowerCase()),
  );
  if (days.length === 0) return null;

  const best = days.find(d => d.outdoor === 'perfect') ?? days[0];
  if (best.outdoor === 'fair' && weatherDependency === 'high') return null;

  const quality: WeatherMatch['quality'] =
    best.outdoor === 'perfect' && weatherDependency !== 'low' ? 'perfect' :
    best.outdoor === 'good'    ? 'good' : 'fair';

  return { dayIndex: best.day, dayLabel: best.label, city: best.city, condition: best.cond, tempC: best.tempC, icon: best.icon, quality };
}

// ── Mock attraction catalogue ─────────────────────────────────────────────────

interface RawAttraction {
  id:                string;
  title:             string;
  description:       string;
  type:              ExperienceType;
  city:              string;
  destination:       string;
  durationHours:     number;
  groupSizeMax:      number;
  pricePerPerson:    number;
  difficulty:        'easy' | 'moderate' | 'challenging';
  weatherDependency: WeatherDependency;
  bestTimeOfDay:     'morning' | 'afternoon' | 'evening' | 'anytime';
  instantBook:       boolean;
  rating:            number;
  reviewCount:       number;
  aiHighlight:       string;
  gradient:          string;
  tags:              string[];
  providers:         string[];
}

const MOCK_ATTRACTIONS: RawAttraction[] = [
  {
    id: 'attr-lucha', title: 'Lucha Libre at Arena México',
    description: 'Iconic Mexican wrestling with acrobatic Luchadores in the world\'s most famous lucha arena.',
    type: 'cultural', city: 'Mexico City', destination: 'Mexico City',
    durationHours: 2.5, groupSizeMax: 500, pricePerPerson: 35,
    difficulty: 'easy', weatherDependency: 'none', bestTimeOfDay: 'evening',
    instantBook: true, rating: 4.89, reviewCount: 12840,
    aiHighlight: 'AI-ranked #1 cultural experience in CDMX. Unmissable for first-time visitors.',
    gradient: 'linear-gradient(145deg, #b71c1c 0%, #f44336 60%, #ff5722 100%)',
    tags: ['Cultural', 'Entertainment', 'Iconic'],
    providers: ['Viator', 'GetYourGuide', 'Airbnb Experiences', 'Klook'],
  },
  {
    id: 'attr-frida', title: 'Frida Kahlo Museum — Casa Azul',
    description: 'The legendary Blue House in Coyoacán where Frida Kahlo was born, lived, and created.',
    type: 'cultural', city: 'Mexico City', destination: 'Mexico City',
    durationHours: 2, groupSizeMax: 20, pricePerPerson: 28,
    difficulty: 'easy', weatherDependency: 'none', bestTimeOfDay: 'morning',
    instantBook: false, rating: 4.82, reviewCount: 31200,
    aiHighlight: 'Book 30+ days ahead — sells out daily. AI recommends Tuesday 9AM slot for fewer crowds.',
    gradient: 'linear-gradient(145deg, #1565c0 0%, #0277bd 50%, #01579b 100%)',
    tags: ['Cultural', 'Art', 'Historic', 'Must-Book Early'],
    providers: ['Tiqets', 'GetYourGuide', 'Musement', 'Civitatis'],
  },
  {
    id: 'attr-teotihuacan', title: 'Teotihuacán Pyramids at Sunrise',
    description: 'Climb the Pyramid of the Sun and Moon at the ancient Mesoamerican city, built 2,000 years ago.',
    type: 'outdoor', city: 'Mexico City', destination: 'Mexico City',
    durationHours: 6, groupSizeMax: 15, pricePerPerson: 72,
    difficulty: 'moderate', weatherDependency: 'moderate', bestTimeOfDay: 'morning',
    instantBook: true, rating: 4.94, reviewCount: 28410,
    aiHighlight: 'UNESCO World Heritage Site. Sunrise timing avoids 95% of crowds and the midday heat.',
    gradient: 'linear-gradient(145deg, #e65100 0%, #bf360c 50%, #4e342e 100%)',
    tags: ['UNESCO', 'Adventure', 'Historic', 'Sunrise'],
    providers: ['Viator', 'GetYourGuide', 'Context Travel', 'Walks'],
  },
  {
    id: 'attr-balloon', title: 'Hot Air Balloon over Teotihuacán',
    description: 'Float above the Valley of Teotihuacán at dawn in a luxury hot air balloon with champagne.',
    type: 'adventure', city: 'Mexico City', destination: 'Mexico City',
    durationHours: 4, groupSizeMax: 8, pricePerPerson: 265,
    difficulty: 'easy', weatherDependency: 'high', bestTimeOfDay: 'morning',
    instantBook: false, rating: 4.97, reviewCount: 4820,
    aiHighlight: 'Highest-rated experience in Mexico on AI aggregate. Cancel-free if winds are unfavorable.',
    gradient: 'linear-gradient(145deg, #ff6f00 0%, #ff8f00 50%, #ffc107 100%)',
    tags: ['Luxury', 'Adventure', 'Unique', 'Weather-Dependent'],
    providers: ['Viator', 'GetYourGuide', 'Airbnb Experiences'],
  },
  {
    id: 'attr-cdmx-food', title: 'CDMX Street Food & Market Tour',
    description: 'A guided deep-dive into Mexico City\'s Mercado de la Merced, Tepito and Roma Norte.',
    type: 'culinary', city: 'Mexico City', destination: 'Mexico City',
    durationHours: 3.5, groupSizeMax: 10, pricePerPerson: 88,
    difficulty: 'easy', weatherDependency: 'low', bestTimeOfDay: 'morning',
    instantBook: true, rating: 4.91, reviewCount: 9340,
    aiHighlight: 'Pairs perfectly with Pujol dinner same evening. Builds palate context for fine dining.',
    gradient: 'linear-gradient(145deg, #2e7d32 0%, #388e3c 50%, #43a047 100%)',
    tags: ['Culinary', 'Local Culture', 'Food', 'Tasting'],
    providers: ['Airbnb Experiences', 'WithLocals', 'Context Travel', 'GetYourGuide'],
  },
  {
    id: 'attr-tulum-ruins', title: 'Tulum Ruins at Sunrise',
    description: 'Private guided tour of the only ancient Maya city built directly on a Caribbean cliff.',
    type: 'cultural', city: 'Tulum', destination: 'Tulum',
    durationHours: 2.5, groupSizeMax: 12, pricePerPerson: 45,
    difficulty: 'easy', weatherDependency: 'moderate', bestTimeOfDay: 'morning',
    instantBook: true, rating: 4.88, reviewCount: 18920,
    aiHighlight: 'Enter before public opening. Best light for the cliff-top temple photographs.',
    gradient: 'linear-gradient(145deg, #004d40 0%, #00695c 50%, #00897b 100%)',
    tags: ['UNESCO', 'Cultural', 'Maya', 'Sunrise'],
    providers: ['Viator', 'GetYourGuide', 'Airbnb Experiences', 'Klook'],
  },
  {
    id: 'attr-cenote', title: 'Cenote Dos Ojos Snorkeling & Cave Dive',
    description: 'Snorkel or scuba through the world\'s largest underwater cave system in crystal-clear water.',
    type: 'adventure', city: 'Tulum', destination: 'Tulum',
    durationHours: 3, groupSizeMax: 8, pricePerPerson: 110,
    difficulty: 'moderate', weatherDependency: 'low', bestTimeOfDay: 'morning',
    instantBook: true, rating: 4.96, reviewCount: 11600,
    aiHighlight: 'Best cenote for snorkeling on AI composite score. Light shafts peak 10-11AM.',
    gradient: 'linear-gradient(145deg, #006064 0%, #00838f 50%, #00acc1 100%)',
    tags: ['Adventure', 'Snorkeling', 'UNESCO', 'Underwater'],
    providers: ['Viator', 'GetYourGuide', 'Airbnb Experiences', 'Klook', 'Musement'],
  },
  {
    id: 'attr-jungle-bike', title: 'Tulum Jungle & Cenote Cycling Tour',
    description: 'Off-road jungle cycling between three cenotes and the Coba ruins, max 8 guests.',
    type: 'outdoor', city: 'Tulum', destination: 'Tulum',
    durationHours: 5, groupSizeMax: 8, pricePerPerson: 95,
    difficulty: 'moderate', weatherDependency: 'moderate', bestTimeOfDay: 'morning',
    instantBook: true, rating: 4.85, reviewCount: 3240,
    aiHighlight: 'Low-crowd route through protected biosphere. Guides are certified ecologists.',
    gradient: 'linear-gradient(145deg, #1b5e20 0%, #2e7d32 60%, #388e3c 100%)',
    tags: ['Outdoor', 'Cycling', 'Eco', 'Active'],
    providers: ['Airbnb Experiences', 'WithLocals', 'GetYourGuide'],
  },
  {
    id: 'attr-whale-shark', title: 'Whale Shark Snorkeling — Holbox',
    description: 'Swim with the world\'s largest fish in the open Caribbean. October is peak season.',
    type: 'outdoor', city: 'Riviera Maya', destination: 'Riviera Maya',
    durationHours: 7, groupSizeMax: 10, pricePerPerson: 160,
    difficulty: 'moderate', weatherDependency: 'high', bestTimeOfDay: 'morning',
    instantBook: false, rating: 4.95, reviewCount: 7840,
    aiHighlight: 'October peak season: 98% whale shark encounter rate per AI analysis. Book early.',
    gradient: 'linear-gradient(145deg, #0277bd 0%, #0288d1 50%, #29b6f6 100%)',
    tags: ['Wildlife', 'Snorkeling', 'Adventure', 'Peak Season'],
    providers: ['Viator', 'GetYourGuide', 'Klook', 'Local Experts'],
  },
  {
    id: 'attr-xcaret', title: 'Xcaret Cultural & Nature Park',
    description: 'All-day immersive park with underground rivers, Maya culture, sea turtles and coral reef snorkeling.',
    type: 'cultural', city: 'Riviera Maya', destination: 'Riviera Maya',
    durationHours: 10, groupSizeMax: 999, pricePerPerson: 120,
    difficulty: 'easy', weatherDependency: 'moderate', bestTimeOfDay: 'anytime',
    instantBook: true, rating: 4.78, reviewCount: 52100,
    aiHighlight: 'Best for honeymooners. The Xcaret night show is the most romantic experience in Riviera Maya.',
    gradient: 'linear-gradient(145deg, #00838f 0%, #0097a7 60%, #00b8d4 100%)',
    tags: ['Family', 'Cultural', 'Nature', 'Full Day'],
    providers: ['Viator', 'GetYourGuide', 'Tiqets', 'Klook'],
  },
  {
    id: 'attr-cabo-catamaran', title: 'Sunset Catamaran Cruise with Dinner',
    description: 'Sail past El Arco at sunset aboard a luxury catamaran with open bar and chef-prepared dinner.',
    type: 'outdoor', city: 'Cabo San Lucas', destination: 'Cabo San Lucas',
    durationHours: 3, groupSizeMax: 12, pricePerPerson: 140,
    difficulty: 'easy', weatherDependency: 'moderate', bestTimeOfDay: 'evening',
    instantBook: true, rating: 4.93, reviewCount: 8910,
    aiHighlight: 'Cabo sunset visibility: 94% clear sky probability in October per meteorological data.',
    gradient: 'linear-gradient(145deg, #e65100 0%, #bf360c 40%, #1a237e 100%)',
    tags: ['Romantic', 'Luxury', 'Sunset', 'Dining'],
    providers: ['Viator', 'GetYourGuide', 'Airbnb Experiences'],
  },
  {
    id: 'attr-cabo-arch', title: 'Arch of Cabo Snorkeling & Sea Lions',
    description: 'Kayak to El Arco, snorkel Pelican Rock, and encounter the famous Lands End sea lion colony.',
    type: 'outdoor', city: 'Cabo San Lucas', destination: 'Cabo San Lucas',
    durationHours: 3, groupSizeMax: 10, pricePerPerson: 85,
    difficulty: 'easy', weatherDependency: 'moderate', bestTimeOfDay: 'morning',
    instantBook: true, rating: 4.91, reviewCount: 14380,
    aiHighlight: 'Sea lion activity peak: 7-9AM. October water clarity: exceptional (30m+ visibility).',
    gradient: 'linear-gradient(145deg, #0277bd 0%, #0288d1 50%, #f57f17 100%)',
    tags: ['Wildlife', 'Snorkeling', 'Kayaking', 'Photography'],
    providers: ['Viator', 'GetYourGuide', 'Airbnb Experiences', 'Klook'],
  },
  {
    id: 'attr-atv', title: 'Desert ATV & Sierra de la Laguna',
    description: 'Off-road ATV through Sonoran desert terrain to hidden mountain waterfalls and canyon views.',
    type: 'adventure', city: 'Cabo San Lucas', destination: 'Cabo San Lucas',
    durationHours: 4, groupSizeMax: 16, pricePerPerson: 95,
    difficulty: 'moderate', weatherDependency: 'low', bestTimeOfDay: 'afternoon',
    instantBook: true, rating: 4.86, reviewCount: 6720,
    aiHighlight: 'Best afternoon activity in Cabo — canyon light is golden after 3PM.',
    gradient: 'linear-gradient(145deg, #5d4037 0%, #8d6e63 60%, #a1887f 100%)',
    tags: ['Adventure', 'ATV', 'Desert', 'Nature'],
    providers: ['Viator', 'GetYourGuide', 'Klook'],
  },
];

// ── Provider → engine ID mapping ──────────────────────────────────────────────

const PROVIDER_ENGINE_MAP: Record<string, string> = {
  'TripAdvisor':        'tripadvisor-a',
  'Viator':             'viator',
  'GetYourGuide':       'getyourguide',
  'Airbnb Experiences': 'airbnb-exp',
  'Klook':              'klook',
  'Musement':           'musement',
  'Tiqets':             'tiqets',
  'Headout':            'headout',
  'Civitatis':          'civitatis',
  'Context Travel':     'context',
  'Walks':              'walks',
  'WithLocals':         'withlocals',
  'Local Experts':      'local-experts',
};

// ── Main export ───────────────────────────────────────────────────────────────

export function distillAttractions(activeEngineIds: string[]): AttractionEntity[] {
  return MOCK_ATTRACTIONS
    .filter(a => {
      if (activeEngineIds.length === 0) return true;
      return a.providers.some(p => {
        const id = PROVIDER_ENGINE_MAP[p];
        return id && activeEngineIds.includes(id);
      });
    })
    .map((a, idx) => ({
      id:                a.id,
      title:             a.title,
      description:       a.description,
      type:              a.type,
      destination:       a.destination,
      city:              a.city,
      durationHours:     a.durationHours,
      groupSizeMax:      a.groupSizeMax,
      pricePerPerson:    a.pricePerPerson,
      difficulty:        a.difficulty,
      weatherDependency: a.weatherDependency,
      bestTimeOfDay:     a.bestTimeOfDay,
      instantBook:       a.instantBook,
      rating:            a.rating,
      reviewCount:       a.reviewCount,
      aiHighlight:       a.aiHighlight,
      weatherMatch:      computeWeatherMatch(a.city, a.weatherDependency),
      gradient:          a.gradient,
      tags:              a.tags,
      aiConfidence:      parseFloat((0.82 + idx * 0.01).toFixed(2)),
      providers:         a.providers,
      sourceCount:       a.providers.length,
    }));
}
