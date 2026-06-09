// Zone engine definitions — pure data, no React/UI imports.

export type ZoneId = 'flights' | 'lodging' | 'dining' | 'attractions' | 'transit' | 'map';

export type EngineStatus =
  | 'live'       // real API call, no key needed (e.g. Open-Meteo)
  | 'needs-key'  // real API exists but requires a credentials setup
  | 'aggregated' // search engine aggregator — results via Amadeus/similar GDS
  | 'ui-only';   // chip is decorative; direct integration not yet built

export interface Engine {
  id:      string;
  name:    string;
  icon:    string;
  tier:    1 | 2 | 3;        // 1 = top tier (included in AI picks)
  status?: EngineStatus;      // defaults: tier-1 → 'aggregated', tier-2/3 → 'ui-only'
}

/** Resolve effective status — use explicit field or derive from tier. */
export function resolveStatus(e: Engine): EngineStatus {
  if (e.status) return e.status;
  return e.tier === 1 ? 'aggregated' : 'ui-only';
}

export const ZONE_META: Record<ZoneId, { label: string; icon: string; color: string; gradient: string }> = {
  flights:     { label: 'Flights',     icon: '✈️',  color: '#007AFF', gradient: 'linear-gradient(135deg, #007AFF, #5E5CE6)' },
  lodging:     { label: 'Lodging',     icon: '🏨',  color: '#00C7BE', gradient: 'linear-gradient(135deg, #00C7BE, #007AFF)' },
  dining:      { label: 'Dining',      icon: '🍽',  color: '#FF9F0A', gradient: 'linear-gradient(135deg, #FF9F0A, #FF6B6B)' },
  attractions: { label: 'Attractions', icon: '🎭',  color: '#30D158', gradient: 'linear-gradient(135deg, #30D158, #00C7BE)' },
  transit:     { label: 'Transit',     icon: '🚗',  color: '#BF5AF2', gradient: 'linear-gradient(135deg, #BF5AF2, #5E5CE6)' },
  map:         { label: 'Map',         icon: '🗺',  color: '#5E5CE6', gradient: 'linear-gradient(135deg, #5E5CE6, #007AFF)' },
};

export const ZONE_ENGINES: Record<ZoneId, Engine[]> = {

  // ── Flights ──────────────────────────────────────────────────────────────────

  flights: [
    // ── Tier 1: Real-search engines (require API key) ────────────────────────
    { id: 'google-flights',  name: 'Google Flights',  icon: '🔍', tier: 1, status: 'needs-key'  },
    { id: 'amadeus',         name: 'Amadeus GDS',     icon: '✈️', tier: 1, status: 'needs-key'  },
    // ── Tier 1: Deep-link aggregators (require partner API key) ─────────────
    { id: 'kayak',           name: 'Kayak',           icon: '🎯', tier: 1, status: 'needs-key'  },
    { id: 'skyscanner',      name: 'Skyscanner',      icon: '🛸', tier: 1, status: 'needs-key'  },
    { id: 'expedia-f',       name: 'Expedia',         icon: '💼', tier: 1, status: 'needs-key'  },
    { id: 'momondo',         name: 'Momondo',         icon: '🌍', tier: 1, status: 'needs-key'  },
    // ── Tier 2: Smart aggregators ────────────────────────────────────────────
    { id: 'kiwi',            name: 'Budget Fares',    icon: '💰', tier: 2, status: 'needs-key'  },
    { id: 'hopper',          name: 'Hopper',          icon: '🐰', tier: 2, status: 'ui-only'    },
    { id: 'priceline',       name: 'Priceline',       icon: '💰', tier: 2, status: 'ui-only'    },
    { id: 'cheapoair',       name: 'CheapOAir',       icon: '💸', tier: 2, status: 'ui-only'    },
    { id: 'orbitz',          name: 'Orbitz',          icon: '🌐', tier: 2, status: 'ui-only'    },
    // ── Tier 2: Major global airlines (top traffic worldwide) ─────────────────
    { id: 'elal',            name: 'El Al',           icon: '🇮🇱', tier: 2, status: 'ui-only'    },
    { id: 'emirates',        name: 'Emirates',        icon: '🌟', tier: 2, status: 'ui-only'    },
    { id: 'turkish',         name: 'Turkish Airlines',icon: '🌙', tier: 2, status: 'ui-only'    },
    { id: 'united',          name: 'United',          icon: '✈️', tier: 2, status: 'ui-only'    },
    { id: 'delta',           name: 'Delta',           icon: '△',  tier: 2, status: 'ui-only'    },
    { id: 'american',        name: 'American',        icon: '🦅', tier: 2, status: 'ui-only'    },
    // ── Tier 3: Global majors ─────────────────────────────────────────────────
    { id: 'lufthansa',       name: 'Lufthansa',       icon: '🟨', tier: 3, status: 'ui-only'    },
    { id: 'airfrance',       name: 'Air France',      icon: '🔵', tier: 3, status: 'ui-only'    },
    { id: 'british',         name: 'British Airways', icon: '🟥', tier: 3, status: 'ui-only'    },
    { id: 'qatar',           name: 'Qatar Airways',   icon: '🟤', tier: 3, status: 'ui-only'    },
    { id: 'etihad',          name: 'Etihad',          icon: '🇦🇪', tier: 3, status: 'ui-only'    },
    { id: 'klm',             name: 'KLM',             icon: '🟦', tier: 3, status: 'ui-only'    },
    { id: 'singapore',       name: 'Singapore Air',   icon: '🇸🇬', tier: 3, status: 'ui-only'    },
    { id: 'cathay',          name: 'Cathay Pacific',  icon: '🇭🇰', tier: 3, status: 'ui-only'    },
    { id: 'iberia',          name: 'Iberia',          icon: '🌊', tier: 3, status: 'ui-only'    },
    { id: 'ryanair',         name: 'Ryanair',         icon: '💙', tier: 3, status: 'ui-only'    },
    { id: 'easyjet',         name: 'EasyJet',         icon: '🟠', tier: 3, status: 'ui-only'    },
    { id: 'wizzair',         name: 'Wizz Air',        icon: '💜', tier: 3, status: 'ui-only'    },
    { id: 'southwest',       name: 'Southwest',       icon: '❤️', tier: 3, status: 'ui-only'    },
    { id: 'aircanada',       name: 'Air Canada',      icon: '🍁', tier: 3, status: 'ui-only'    },
  ],

  // ── Lodging ───────────────────────────────────────────────────────────────────

  lodging: [
    { id: 'google-hotels',   name: 'Google Hotels',   icon: '🔍', tier: 1, status: 'needs-key'},
    { id: 'amadeus-hotels',  name: 'Amadeus Hotels',  icon: '🏢', tier: 1, status: 'needs-key'},
    { id: 'airbnb',          name: 'Airbnb',          icon: '🏠', tier: 1, status: 'needs-key'},
    { id: 'booking',         name: 'Booking.com',     icon: '📘', tier: 1, status: 'needs-key'},
    { id: 'hotels-com',      name: 'Hotels.com',      icon: '🏨', tier: 1, status: 'needs-key'},
    { id: 'expedia-h',       name: 'Expedia Hotels',  icon: '💼', tier: 1, status: 'needs-key'},
    { id: 'marriott',        name: 'Marriott',        icon: '⭐', tier: 1, status: 'needs-key'},
    { id: 'hilton',          name: 'Hilton',          icon: '🏛',  tier: 2 },
    { id: 'hyatt',           name: 'Hyatt',           icon: '🌹', tier: 2 },
    { id: 'ihg',             name: 'IHG',             icon: '🌐', tier: 2 },
    { id: 'four-seasons',    name: 'Four Seasons',    icon: '🌟', tier: 2 },
    { id: 'ritz-carlton',    name: 'Ritz-Carlton',    icon: '👑', tier: 2 },
    { id: 'rosewood',        name: 'Rosewood',        icon: '🌺', tier: 2 },
    { id: 'one-only',        name: 'One&Only',        icon: '💎', tier: 2 },
    { id: 'vrbo',            name: 'VRBO',            icon: '🏡', tier: 2 },
    { id: 'hostelworld',     name: 'Hostelworld',     icon: '🎒', tier: 3 },
    { id: 'agoda',           name: 'Agoda',           icon: '🔴', tier: 3 },
    { id: 'trip-com',        name: 'Trip.com',        icon: '🛩', tier: 3 },
    { id: 'mr-mrs-smith',    name: 'Mr & Mrs Smith',  icon: '💑', tier: 3 },
    { id: 'design-hotels',   name: 'Design Hotels',   icon: '🎨', tier: 3 },
    { id: 'slh',             name: 'Small Luxury H.', icon: '✨', tier: 3 },
    { id: 'secret-escapes',  name: 'Secret Escapes',  icon: '🔐', tier: 3 },
    { id: 'tablet-hotels',   name: 'Tablet Hotels',   icon: '📱', tier: 3 },
    { id: 'preferred',       name: 'Preferred Hotels',icon: '⭐', tier: 3 },
    { id: 'relais',          name: 'Relais & Ch.',    icon: '🏰', tier: 3 },
    { id: 'leading',         name: 'Leading Hotels',  icon: '🏆', tier: 3 },
    { id: 'wyndham',         name: 'Wyndham',         icon: '🔷', tier: 3 },
    { id: 'kimpton',         name: 'Kimpton',         icon: '🦋', tier: 3 },
    { id: 'autograph',       name: 'Autograph Coll.', icon: '✍️', tier: 3 },
    { id: 'omni-hotels',     name: 'Omni Hotels',     icon: '🔵', tier: 3 },
    { id: 'i-escape',        name: 'i-escape',        icon: '🌿', tier: 3 },
    { id: 'belmond',         name: 'Belmond',         icon: '🚂', tier: 3 },
  ],

  // ── Dining ────────────────────────────────────────────────────────────────────

  dining: [
    { id: 'yelp',            name: 'Local Discovery', icon: '🗺', tier: 1, status: 'live'      }, // OSM — free, no key
    { id: 'google-maps-d',   name: 'Google Maps',     icon: '📍', tier: 1, status: 'needs-key' },
    { id: 'opentable',       name: 'OpenTable',       icon: '🍽', tier: 1, status: 'needs-key' },
    { id: 'resy',            name: 'Resy',            icon: '📅', tier: 1, status: 'needs-key' },
    { id: 'tripadvisor-d',   name: 'TripAdvisor',     icon: '🦉', tier: 1, status: 'needs-key' },
    { id: 'michelin',        name: 'Michelin Guide',  icon: '⭐', tier: 1, status: 'needs-key' },
    { id: 'infatuation',     name: 'Infatuation',     icon: '💕', tier: 2 },
    { id: 'eater',           name: 'Eater',           icon: '📰', tier: 2 },
    { id: 'zagat',           name: 'Zagat',           icon: '🟥', tier: 2 },
    { id: 'thefork',         name: 'TheFork',         icon: '🍴', tier: 2 },
    { id: 'tock',            name: 'Tock',            icon: '🕐', tier: 2 },
    { id: 'quandoo',         name: 'Quandoo',         icon: '🟢', tier: 2 },
    { id: 'zomato',          name: 'Zomato',          icon: '🔴', tier: 2 },
    { id: 'worlds50best',    name: "World's 50 Best", icon: '🏆', tier: 2 },
    { id: 'jamesbeard',      name: 'James Beard',     icon: '🎖',  tier: 3 },
    { id: 'oad',             name: 'OAD Awards',      icon: '🥇', tier: 3 },
    { id: 'lafourchette',    name: 'LaFourchette',    icon: '🍴', tier: 3 },
    { id: 'timeout-d',       name: 'Timeout Dining',  icon: '⏱', tier: 3 },
    { id: 'bonappetit',      name: 'Bon Appétit',     icon: '📸', tier: 3 },
    { id: 'foodwine',        name: 'Food & Wine',     icon: '🍷', tier: 3 },
    { id: 'lonelyplanet-d',  name: 'Lonely Planet',   icon: '📖', tier: 3 },
    { id: 'instagram-d',     name: 'Instagram',       icon: '📷', tier: 3 },
    { id: 'ubereats-r',      name: 'Uber Eats',       icon: '🚴', tier: 3 },
    { id: 'doordash-r',      name: 'DoorDash',        icon: '🚗', tier: 3 },
    { id: 'eatwith',         name: 'EatWith',         icon: '🤝', tier: 3 },
    { id: 'deliveroo-r',     name: 'Deliveroo',       icon: '🦘', tier: 3 },
    { id: 'noma',            name: 'Noma Projects',   icon: '🌱', tier: 3 },
    { id: 'cdmx',            name: 'CDMX Gourmet',    icon: '🇲🇽', tier: 3 },
    { id: 'local-guide',     name: 'Local Guides',    icon: '🗺', tier: 3 },
    { id: 'guia-roji',       name: 'Guía Roji',       icon: '📌', tier: 3 },
  ],

  // ── Attractions ──────────────────────────────────────────────────────────────

  attractions: [
    { id: 'geoapify',        name: 'Geoapify',        icon: '📍', tier: 1, status: 'needs-key' },
    { id: 'tripadvisor-a',   name: 'TripAdvisor',     icon: '🦉', tier: 1, status: 'needs-key' },
    { id: 'google-places',   name: 'Google Places',   icon: '🔍', tier: 1, status: 'needs-key' },
    { id: 'viator',          name: 'Viator',          icon: '🎫', tier: 1, status: 'needs-key' },
    { id: 'getyourguide',    name: 'GetYourGuide',    icon: '🎟', tier: 1, status: 'needs-key' },
    { id: 'airbnb-exp',      name: 'Airbnb Exp.',     icon: '🌟', tier: 1, status: 'needs-key' },
    { id: 'klook',           name: 'Klook',           icon: '🎪', tier: 2 },
    { id: 'musement',        name: 'Musement',        icon: '🎨', tier: 2 },
    { id: 'tiqets',          name: 'Tiqets',          icon: '🎭', tier: 2 },
    { id: 'headout',         name: 'Headout',         icon: '🎯', tier: 2 },
    { id: 'civitatis',       name: 'Civitatis',       icon: '🏛',  tier: 2 },
    { id: 'lonely-planet-a', name: 'Lonely Planet',   icon: '📖', tier: 2 },
    { id: 'culture-trip',    name: 'Culture Trip',    icon: '🗿', tier: 2 },
    { id: 'atlas-obscura',   name: 'Atlas Obscura',   icon: '🔮', tier: 2 },
    { id: 'timeout-a',       name: 'Timeout',         icon: '⏱', tier: 2 },
    { id: 'unesco',          name: 'UNESCO Sites',    icon: '🏛',  tier: 3 },
    { id: 'natgeo',          name: 'Nat Geographic',  icon: '📸', tier: 3 },
    { id: 'fodors',          name: "Fodor's",         icon: '📚', tier: 3 },
    { id: 'frommers',        name: "Frommer's",       icon: '📕', tier: 3 },
    { id: 'context',         name: 'Context Travel',  icon: '🎓', tier: 3 },
    { id: 'walks',           name: 'Walks',           icon: '🚶', tier: 3 },
    { id: 'topdeck',         name: 'Topdeck',         icon: '🚌', tier: 3 },
    { id: 'withlocals',      name: 'Withlocals',      icon: '🤝', tier: 3 },
    { id: 'toursbylocals',   name: 'Tours by Locals', icon: '🗺', tier: 3 },
    { id: 'peek',            name: 'Peek.com',        icon: '👀', tier: 3 },
    { id: 'urban-adv',       name: 'Urban Adventures',icon: '🏙', tier: 3 },
    { id: 'g-adventures',    name: 'G Adventures',    icon: '🌍', tier: 3 },
    { id: 'intrepid',        name: 'Intrepid Travel', icon: '🧭', tier: 3 },
    { id: 'expedia-act',     name: 'Expedia Activ.',  icon: '💼', tier: 3 },
    { id: 'booking-att',     name: 'Booking Attract.',icon: '📘', tier: 3 },
    { id: 'local-experts',   name: 'Local Experts',   icon: '⭐', tier: 3 },
  ],

  // ── Transit ───────────────────────────────────────────────────────────────────

  transit: [
    { id: 'google-maps',     name: 'Google Maps',     icon: '📍', tier: 1, status: 'needs-key' },
    { id: 'rome2rio',        name: 'Rome2rio',        icon: '🗺', tier: 1 },
    { id: 'uber',            name: 'Uber',            icon: '⚫', tier: 1 },
    { id: 'lyft',            name: 'Lyft',            icon: '🟣', tier: 1 },
    { id: 'bolt',            name: 'Bolt',            icon: '⚡', tier: 1 },
    { id: 'grab',            name: 'Grab',            icon: '🟢', tier: 2 },
    { id: 'didi',            name: 'DiDi',            icon: '🟠', tier: 2 },
    { id: 'cabify',          name: 'Cabify',          icon: '🟣', tier: 2 },
    { id: 'europcar',        name: 'Europcar',        icon: '🚗', tier: 2 },
    { id: 'hertz',           name: 'Hertz',           icon: '🏎',  tier: 2 },
    { id: 'avis',            name: 'Avis',            icon: '🔴', tier: 2 },
    { id: 'budget-car',      name: 'Budget Car',      icon: '💰', tier: 2 },
    { id: 'sixt',            name: 'Sixt',            icon: '🟠', tier: 2 },
    { id: 'enterprise',      name: 'Enterprise',      icon: '🟢', tier: 2 },
    { id: 'turo',            name: 'Turo',            icon: '🚘', tier: 3 },
    { id: 'zipcar',          name: 'Zipcar',          icon: '🔵', tier: 3 },
    { id: 'blablacar',       name: 'BlaBlaCar',       icon: '💙', tier: 3 },
    { id: 'flixbus',         name: 'FlixBus',         icon: '🟢', tier: 3 },
    { id: 'busbud',          name: 'Busbud',          icon: '🚌', tier: 3 },
    { id: 'omio',            name: 'Omio',            icon: '🚄', tier: 3 },
    { id: 'trainline',       name: 'Trainline',       icon: '🚂', tier: 3 },
    { id: 'rail-europe',     name: 'Rail Europe',     icon: '🛤',  tier: 3 },
    { id: 'moovit',          name: 'Moovit',          icon: '🚇', tier: 3 },
    { id: 'citymapper',      name: 'Citymapper',      icon: '🗺', tier: 3 },
    { id: 'transit-app',     name: 'Transit App',     icon: '🚊', tier: 3 },
    { id: 'waze',            name: 'Waze',            icon: '📡', tier: 3 },
    { id: 'national-car',    name: 'National Car',    icon: '🏁', tier: 3 },
    { id: 'alamo',           name: 'Alamo',           icon: '🤠', tier: 3 },
    { id: 'ola',             name: 'Ola',             icon: '🟡', tier: 3 },
    { id: 'gett',            name: 'Gett',            icon: '🟦', tier: 3 },
  ],

  map: [],
};
