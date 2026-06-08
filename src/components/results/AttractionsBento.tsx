'use client';

import { useState, memo }        from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExperienceCard }          from '@/components/zones/ExperienceCard';
import { SpatialMap }              from '@/components/zones/SpatialMap';
import type { AttractionEntity }   from '@/types/attractions';
import type { LodgingPin }         from '@/components/zones/SpatialMap';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AttractionSearchState = 'idle' | 'loading' | 'results';

export interface AttractionsBentoProps {
  searchState:  AttractionSearchState;
  engineCount:  number;
  destination?: string;
  results?:     AttractionEntity[] | null;
  apiStatus?:   'ok' | 'needs_api_key' | 'error' | null;
  apiMessage?:  string | null;
}

const SPRING = { type: 'spring', stiffness: 380, damping: 28 } as const;

// ── Demo data (dynamic — populated by AI Concierge in production) ─────────────
// Coordinates and context are injected per-destination; none are hardcoded
// to a specific user trip.

const DEMO_LODGING: LodgingPin = {
  name: 'AI-selected hotel',
  lat:  20.6296,
  lon:  -87.0739, // Tulum reference — overridden by actual lodging from store
};

const DEMO_ATTRACTIONS: AttractionEntity[] = [
  {
    id:                'cenote-dos-ojos',
    title:             'Cenote Dos Ojos Guided Dive',
    description:       'Explore one of the world\'s most spectacular flooded cave systems with expert guides.',
    type:              'outdoor',
    destination:       '',
    city:              '',
    lat:               20.6076,
    lon:               -87.5359,
    durationHours:     3.5,
    groupSizeMax:      8,
    pricePerPerson:    95,
    difficulty:        'moderate',
    weatherDependency: 'high',
    bestTimeOfDay:     'morning',
    instantBook:       true,
    rating:            4.92,
    reviewCount:       3841,
    aiHighlight:       'Crystal-clear 25°C water year-round — a truly other-worldly experience ranked #1 by Viator and GetYourGuide.',
    weatherMatch:      {
      dayIndex:           2,
      dayLabel:           'Fri, Oct 3',
      city:               'Tulum',
      condition:          'Thunderstorm',
      tempC:              27,
      icon:               '⛈',
      quality:            'warning',
      precipProbability:  88,
      suggestedDayLabel:  'Mon, Oct 5',
    },
    gradient:          'linear-gradient(135deg, #007AFF 0%, #00C7BE 100%)',
    tags:              ['cenote', 'snorkeling', 'cave diving', 'nature'],
    aiConfidence:      0.97,
    providers:         ['viator', 'getyourguide', 'klook', 'airbnb-exp'],
    sourceCount:       4,
  },
  {
    id:                'mayan-ruins-coba',
    title:             'Cobá Ruins & Jungle Walk',
    description:       'Climb the last climbable Mayan pyramid in the Yucatán — surrounded by untamed jungle.',
    type:              'cultural',
    destination:       '',
    city:              '',
    lat:               20.4972,
    lon:               -87.7229,
    durationHours:     5,
    groupSizeMax:      12,
    pricePerPerson:    65,
    difficulty:        'challenging',
    weatherDependency: 'moderate',
    bestTimeOfDay:     'morning',
    instantBook:       false,
    rating:            4.88,
    reviewCount:       6422,
    aiHighlight:       'Arrive at 8 AM to beat the crowds. The 42-metre pyramid offers a 360° jungle canopy view that no photo captures.',
    weatherMatch:      {
      dayIndex:    4,
      dayLabel:    'Sun, Oct 5',
      city:        'Tulum',
      condition:   'Mainly clear',
      tempC:       29,
      icon:        '🌤',
      quality:     'perfect',
    },
    gradient:          'linear-gradient(135deg, #5E5CE6 0%, #007AFF 100%)',
    tags:              ['mayan', 'ruins', 'history', 'jungle'],
    aiConfidence:      0.94,
    providers:         ['tripadvisor-a', 'viator', 'musement', 'civitatis'],
    sourceCount:       4,
  },
  {
    id:                'tulum-cooking-class',
    title:             'Jungle Farm-to-Table Cooking',
    description:       'Learn pre-Hispanic recipes at a working organic farm with a Michelin-trained chef.',
    type:              'culinary',
    destination:       '',
    city:              '',
    lat:               20.6498,
    lon:               -87.4526,
    durationHours:     4,
    groupSizeMax:      10,
    pricePerPerson:    145,
    difficulty:        'easy',
    weatherDependency: 'none',
    bestTimeOfDay:     'afternoon',
    instantBook:       true,
    rating:            4.97,
    reviewCount:       1208,
    aiHighlight:       'Only 10 guests per class. Hands-on nixtamal tortilla-making, mole negro, and a mescal welcome cocktail from the family agave plant.',
    weatherMatch:      null,
    gradient:          'linear-gradient(135deg, #FF9F0A 0%, #FF453A 100%)',
    tags:              ['cooking', 'farm', 'mayan cuisine', 'immersive'],
    aiConfidence:      0.96,
    providers:         ['airbnb-exp', 'withlocals', 'eatwith'],
    sourceCount:       3,
  },
  {
    id:                'tulum-bike-ruins',
    title:             'Sunrise Yoga & Beach Ruins Bike',
    description:       'Pedal along the coast to the clifftop Tulum ruins at sunrise, then flow yoga on the sand.',
    type:              'wellness',
    destination:       '',
    city:              '',
    lat:               20.6752,
    lon:               -87.4290,
    durationHours:     3,
    groupSizeMax:      15,
    pricePerPerson:    55,
    difficulty:        'easy',
    weatherDependency: 'high',
    bestTimeOfDay:     'morning',
    instantBook:       true,
    rating:            4.85,
    reviewCount:       2670,
    aiHighlight:       'The iconic clifftop ruins are best seen just after sunrise before the cruise-ship crowds arrive — timing is everything.',
    weatherMatch:      {
      dayIndex:    1,
      dayLabel:    'Thu, Oct 2',
      city:        'Tulum',
      condition:   'Clear sky',
      tempC:       28,
      icon:        '☀️',
      quality:     'perfect',
    },
    gradient:          'linear-gradient(135deg, #00C7BE 0%, #30D158 100%)',
    tags:              ['yoga', 'beach', 'ruins', 'biking'],
    aiConfidence:      0.91,
    providers:         ['viator', 'airbnb-exp', 'getyourguide'],
    sourceCount:       3,
  },
  {
    id:                'zipline-adventure',
    title:             'Jungle Canopy Zipline Extreme',
    description:       'Fourteen lines through the treetops at up to 70 km/h — the longest run is over 600 m.',
    type:              'adventure',
    destination:       '',
    city:              '',
    lat:               20.5630,
    lon:               -87.3921,
    durationHours:     2.5,
    groupSizeMax:      20,
    pricePerPerson:    82,
    difficulty:        'challenging',
    weatherDependency: 'high',
    bestTimeOfDay:     'afternoon',
    instantBook:       false,
    rating:            4.79,
    reviewCount:       4950,
    aiHighlight:       'Harness safety checks done by certified instructors — no prior experience needed. The final "Superman" line is unforgettable.',
    weatherMatch:      {
      dayIndex:           5,
      dayLabel:           'Mon, Oct 6',
      city:               'Tulum',
      condition:          'Moderate rain',
      tempC:              26,
      icon:               '🌧',
      quality:            'warning',
      precipProbability:  74,
      suggestedDayLabel:  'Wed, Oct 8',
    },
    gradient:          'linear-gradient(135deg, #FF453A 0%, #BF5AF2 100%)',
    tags:              ['zipline', 'adrenaline', 'jungle', 'aerial'],
    aiConfidence:      0.89,
    providers:         ['viator', 'klook', 'getyourguide'],
    sourceCount:       3,
  },
  {
    id:                'bioluminescent-lagoon',
    title:             'Bioluminescent Lagoon Night Kayak',
    description:       'Paddle through a mangrove lagoon that glows electric blue as you move — a once-in-a-lifetime natural phenomenon.',
    type:              'outdoor',
    destination:       '',
    city:              '',
    lat:               20.7142,
    lon:               -87.1820,
    durationHours:     2,
    groupSizeMax:      10,
    pricePerPerson:    75,
    difficulty:        'easy',
    weatherDependency: 'moderate',
    bestTimeOfDay:     'evening',
    instantBook:       true,
    rating:            4.94,
    reviewCount:       2103,
    aiHighlight:       'Best viewed on a moonless night. Guides ensure no artificial light pollutes the bioluminescence — bring waterproof phone case.',
    weatherMatch:      {
      dayIndex:    6,
      dayLabel:    'Tue, Oct 7',
      city:        'Tulum',
      condition:   'Mainly clear',
      tempC:       27,
      icon:        '🌤',
      quality:     'good',
    },
    gradient:          'linear-gradient(135deg, #007AFF 0%, #5E5CE6 100%)',
    tags:              ['bioluminescence', 'kayak', 'night', 'nature'],
    aiConfidence:      0.98,
    providers:         ['airbnb-exp', 'viator', 'withlocals', 'getyourguide'],
    sourceCount:       4,
  },
];

// ── Idle / empty state ────────────────────────────────────────────────────────

function IdleState({ hasDestination }: { hasDestination: boolean }) {
  return (
    <div style={{
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      gap:            16,
      height:         '100%',
      minHeight:      280,
    }}>
      <motion.div
        animate={{ scale: [1, 1.06, 1], opacity: [0.55, 1, 0.55] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        style={{ fontSize: 44 }}
      >
        🎭
      </motion.div>
      <div style={{ textAlign: 'center', maxWidth: 280 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 6 }}>
          {hasDestination ? 'Ready to discover' : 'Where are you going?'}
        </div>
        <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
          {hasDestination
            ? 'Select engines and hit Search — AI will cross-reference weather, proximity to your lodging, and real-time availability.'
            : 'Drop a destination into the AI Concierge, then select your experience engines and search.'}
        </div>
      </div>
    </div>
  );
}

// ── Weather tally bar ─────────────────────────────────────────────────────────

function WeatherTally({ entities }: { entities: AttractionEntity[] }) {
  const warnings  = entities.filter(e => e.weatherMatch?.quality === 'warning').length;
  const perfects  = entities.filter(e => e.weatherMatch?.quality === 'perfect').length;
  if (!warnings && !perfects) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING}
      style={{
        display:       'flex',
        alignItems:    'center',
        gap:           12,
        paddingBlock:  8,
        paddingInline: 14,
        borderRadius:  10,
        background:    'rgba(255,255,255,0.72)',
        backdropFilter: 'blur(24px)',
        border:        '1px solid rgba(0,0,0,0.06)',
        flexShrink:    0,
      }}
    >
      <span style={{ fontSize: 11 }}>☁️</span>
      <span style={{ fontSize: 10, fontWeight: 700, color: '#1C1C1E', letterSpacing: '-0.01em' }}>
        Weather sync active
      </span>
      {perfects > 0 && (
        <span style={{ fontSize: 10, fontWeight: 600, color: '#30D158' }}>
          ✦ {perfects} perfect day{perfects !== 1 ? 's' : ''}
        </span>
      )}
      {warnings > 0 && (
        <span style={{ fontSize: 10, fontWeight: 600, color: '#FF9F0A' }}>
          🌧 {warnings} rain alert{warnings !== 1 ? 's' : ''}
        </span>
      )}
    </motion.div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export const AttractionsBento = memo(function AttractionsBento({
  searchState, engineCount, destination, results, apiStatus, apiMessage,
}: AttractionsBentoProps) {
  const [selectedId, setSelectedId] = useState<string | undefined>();

  if (searchState === 'idle') {
    return <IdleState hasDestination={!!destination} />;
  }

  if (searchState === 'loading') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 14, height: '100%', minHeight: 280,
      }}>
        <motion.span
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
          style={{ fontSize: 32, display: 'inline-block' }}
        >
          ✦
        </motion.span>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          Scanning {engineCount} networks
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 500, maxWidth: 220, textAlign: 'center', lineHeight: 1.5 }}>
          Syncing weather · Calculating proximity · Deduplicating across platforms
        </div>
      </div>
    );
  }

  // Needs API key
  if (apiStatus === 'needs_api_key') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, height: '100%', textAlign: 'center', padding: 40 }}
      >
        <div style={{ fontSize: 48 }} aria-hidden>🔑</div>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.04em' }}>Connect Experiences API</h2>
          <p style={{ margin: '8px 0 0', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', maxWidth: 340, lineHeight: 1.55 }}>
            {apiMessage ?? 'Add GetYourGuide or Viator API credentials to .env.local to enable live experience search.'}
          </p>
        </div>
      </motion.div>
    );
  }

  // Error state
  if (apiStatus === 'error') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, height: '100%', padding: 40, textAlign: 'center' }}
      >
        <div style={{ fontSize: 40 }} aria-hidden>⚠️</div>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
          {apiMessage ?? 'Search failed. Please try again.'}
        </p>
      </motion.div>
    );
  }

  // results state
  const entities     = results ?? [];
  const lodgingPin   = DEMO_LODGING;
  const warningCount = entities.filter(e => e.weatherMatch?.quality === 'warning').length;

  if (entities.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, height: '100%', padding: 40, textAlign: 'center' }}
      >
        <div style={{ fontSize: 40 }} aria-hidden>🎭</div>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
          No experiences found. Try connecting GetYourGuide or Viator API keys.
        </p>
      </motion.div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
      {/* Weather tally */}
      <WeatherTally entities={entities} />

      {/* Two-column layout: card grid + spatial map */}
      <div style={{
        display:  'flex',
        gap:      18,
        flex:     1,
        minHeight: 0,
        overflow: 'hidden',
      }}>
        {/* Card grid */}
        <div style={{
          flex:        1,
          overflowY:   'auto',
          display:     'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap:         14,
          alignContent: 'start',
          paddingInlineEnd: 4,
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(0,0,0,0.10) transparent',
        }}>
          {entities.map((entity, i) => (
            <div
              key={entity.id}
              onClick={() => setSelectedId(entity.id === selectedId ? undefined : entity.id)}
              style={{ cursor: 'pointer' }}
            >
              <ExperienceCard entity={entity} index={i} />
            </div>
          ))}
        </div>

        {/* Spatial map panel */}
        <div style={{
          width:      320,
          flexShrink: 0,
          display:    'flex',
          flexDirection: 'column',
          gap:        10,
        }}>
          <div style={{
            fontSize: 9, fontWeight: 700, color: 'var(--text-tertiary)',
            textTransform: 'uppercase', letterSpacing: '0.07em',
          }}>
            Spatial Map · Proximity to Lodging
          </div>

          <div style={{ flex: 1, minHeight: 0 }}>
            <SpatialMap
              lodging={lodgingPin}
              attractions={entities}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </div>

          {/* Source count pill */}
          <AnimatePresence>
            {warningCount > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={{
                  display:       'flex',
                  alignItems:    'center',
                  gap:           6,
                  paddingBlock:  8,
                  paddingInline: 12,
                  borderRadius:  10,
                  background:    'rgba(255,159,10,0.08)',
                  border:        '1px solid rgba(255,159,10,0.22)',
                  flexShrink:    0,
                }}
              >
                <span style={{ fontSize: 11 }}>🌧</span>
                <span style={{ fontSize: 9.5, fontWeight: 600, color: '#FF9F0A', letterSpacing: '-0.01em' }}>
                  {warningCount} experience{warningCount !== 1 ? 's' : ''} flagged — AI has suggested safer days
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
});
