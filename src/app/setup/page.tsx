'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence }           from 'framer-motion';
import { useRouter }                          from 'next/navigation';
import Link                                   from 'next/link';
import { useTravelEngine }                    from '@/store/useTravelEngine';
import type { EngineDay, TravelDNA }          from '@/store/useTravelEngine';
import {
  MapPin, Calendar, Users, Wallet, Plus, Minus,
  ArrowRight, Check, Sparkles, Plane, Hotel,
  UtensilsCrossed, Compass, Globe2,
  Zap, Leaf, Lightbulb, Search, Users2,
  Waves, Library, Music2, ShoppingBag, Star, Wine,
  AlertTriangle, Info, Car, Target, Sun, Moon,
  Shield, Bike,
} from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────────────────────

const SPRING = { type: 'spring', stiffness: 360, damping: 28 } as const;
const AZURE  = '#007AFF';

// ── Types ─────────────────────────────────────────────────────────────────────

type StepId       = 'destination' | 'dates' | 'travelers' | 'budget';
type IconComponent = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

interface TravelMode {
  id:         string;
  label:      string;
  subtitle:   string;
  icon:       IconComponent;
  steps:      StepId[];
  color:      string;
  rgb:        string;
  targetZone: string;
}

// ── Destination Intelligence Dataset ─────────────────────────────────────────

type DestIntel = {
  flag:       string;
  tags:       string[];
  bestMonths: number[];  // 0-indexed
  peakMonths: number[];  // 0-indexed
  costLevel:  0 | 1 | 2 | 3;  // 0=budget 1=mid 2=high 3=luxury
  currency:   string;
};

const DEST_INTEL: Record<string, DestIntel> = {
  'Paris':       { flag: '🇫🇷', tags: ['Romance', 'Art', 'Cuisine'],      bestMonths: [3,4,5,8,9],    peakMonths: [6,7],     costLevel: 2, currency: 'EUR' },
  'Rome':        { flag: '🇮🇹', tags: ['History', 'Food', 'Architecture'],bestMonths: [3,4,5,9,10],   peakMonths: [6,7,8],   costLevel: 1, currency: 'EUR' },
  'Tokyo':       { flag: '🇯🇵', tags: ['Tech', 'Culture', 'Food'],         bestMonths: [2,3,9,10],     peakMonths: [3,4,7,8], costLevel: 1, currency: 'JPY' },
  'Bali':        { flag: '🇮🇩', tags: ['Beaches', 'Wellness', 'Temples'],  bestMonths: [3,4,5,6,8],    peakMonths: [7],       costLevel: 0, currency: 'IDR' },
  'New York':    { flag: '🇺🇸', tags: ['Culture', 'Food', 'Urban'],        bestMonths: [3,4,5,8,9,10], peakMonths: [6,7,11],  costLevel: 3, currency: 'USD' },
  'Barcelona':   { flag: '🇪🇸', tags: ['Beach', 'Architecture', 'Nightlife'],bestMonths: [4,5,9,10],   peakMonths: [6,7,8],   costLevel: 1, currency: 'EUR' },
  'London':      { flag: '🇬🇧', tags: ['Museums', 'Theatre', 'History'],   bestMonths: [4,5,6,7,8],    peakMonths: [7,8,11],  costLevel: 2, currency: 'GBP' },
  'Dubai':       { flag: '🇦🇪', tags: ['Luxury', 'Desert', 'Shopping'],    bestMonths: [10,11,0,1,2],  peakMonths: [11,0],    costLevel: 2, currency: 'AED' },
  'Bangkok':     { flag: '🇹🇭', tags: ['Street Food', 'Temples', 'Nightlife'],bestMonths: [10,11,0,1,2],peakMonths: [11,0,1], costLevel: 0, currency: 'THB' },
  'Sydney':      { flag: '🇦🇺', tags: ['Beaches', 'Nature', 'Urban'],      bestMonths: [8,9,10,11,0,1],peakMonths: [11,0],    costLevel: 2, currency: 'AUD' },
  'Amsterdam':   { flag: '🇳🇱', tags: ['Canals', 'Museums', 'Cycling'],    bestMonths: [3,4,5,6,7,8],  peakMonths: [6,7],     costLevel: 2, currency: 'EUR' },
  'Lisbon':      { flag: '🇵🇹', tags: ['Culture', 'Seafood', 'Views'],     bestMonths: [3,4,5,8,9],    peakMonths: [6,7,8],   costLevel: 1, currency: 'EUR' },
  'Madrid':      { flag: '🇪🇸', tags: ['Art', 'Cuisine', 'Nightlife'],     bestMonths: [3,4,5,9,10],   peakMonths: [6,7,8],   costLevel: 1, currency: 'EUR' },
  'Kyoto':       { flag: '🇯🇵', tags: ['Temples', 'Traditions', 'Gardens'],bestMonths: [2,3,10,11],    peakMonths: [3,10],    costLevel: 1, currency: 'JPY' },
  'Santorini':   { flag: '🇬🇷', tags: ['Sunsets', 'Beaches', 'Luxury'],    bestMonths: [4,5,6,8,9],    peakMonths: [7,8],     costLevel: 2, currency: 'EUR' },
  'Maldives':    { flag: '🇲🇻', tags: ['Diving', 'Overwater', 'Luxury'],   bestMonths: [10,11,0,1,2,3],peakMonths: [11,0,1],  costLevel: 3, currency: 'USD' },
};

const COST_LABELS = ['Budget-friendly', 'Mid-range', 'Mid-high', 'Luxury'];
const COST_COLORS = ['#30D158', '#007AFF', '#5E5CE6', '#FF9F0A'];

function getDestIntel(dest: string): DestIntel | null {
  const key = Object.keys(DEST_INTEL).find(k => k.toLowerCase() === dest.trim().toLowerCase());
  return key ? DEST_INTEL[key] : null;
}

// ── Budget Tier Dataset ───────────────────────────────────────────────────────

const BUDGET_TIERS = [
  {
    id: 'explorer', label: 'Explorer', min: 0, max: 999,
    color: '#AEAEB2', rgb: '174,174,178',
    unlocks: ['Hostel or shared room', 'Economy class', 'Street food & markets'],
  },
  {
    id: 'traveler', label: 'Traveler', min: 1000, max: 4999,
    color: AZURE, rgb: '0,122,255',
    unlocks: ['3★ hotel or Airbnb', 'Economy with flexibility', 'Local restaurants'],
  },
  {
    id: 'voyager', label: 'Voyager', min: 5000, max: 14999,
    color: '#5E5CE6', rgb: '94,92,230',
    unlocks: ['4★ boutique hotel', 'Premium economy', 'Fine dining experiences'],
  },
  {
    id: 'elite', label: 'Elite', min: 15000, max: Infinity,
    color: '#FF9F0A', rgb: '255,159,10',
    unlocks: ['5★ luxury resort', 'Business / First class', 'Michelin-starred dining'],
  },
];

// ── DNA Quick Capture Dataset ──────────────────────────────────────────────────

const DNA_QUESTIONS: Array<{
  id: string;
  q:  string;
  a:  Array<{
    id:    string;
    icon:  React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
    label: string;
    sub:   string;
  }>;
}> = [
  {
    id: 'pace',
    q: 'Your travel pace?',
    a: [
      { id: 'packed',  icon: Zap,       label: 'Full schedule', sub: 'See everything' },
      { id: 'relaxed', icon: Leaf,      label: 'Slow & easy',   sub: 'Soak it in' },
    ],
  },
  {
    id: 'priority',
    q: 'What matters most?',
    a: [
      { id: 'value',      icon: Lightbulb, label: 'Smart value', sub: 'Best for money' },
      { id: 'experience', icon: Sparkles,  label: 'Best always', sub: 'No compromises' },
    ],
  },
  {
    id: 'vibe',
    q: 'Social style?',
    a: [
      { id: 'discover', icon: Search, label: 'Off-grid finds', sub: 'Explore alone' },
      { id: 'social',   icon: Users2, label: 'Meet locals',    sub: 'Real connections' },
    ],
  },
];

// ── Launch Overlay Stages ─────────────────────────────────────────────────────

const LAUNCH_STAGES = [
  { text: 'Connecting to 151 live engines…',  count: 151,  unit: 'engines'     },
  { text: 'Scanning flights & schedules…',    count: 2840, unit: 'routes'      },
  { text: 'Matching hotels & properties…',    count: 893,  unit: 'properties'  },
  { text: 'Curating dining & experiences…',   count: 1240, unit: 'options'     },
  { text: 'Your trip is ready',               count: null, unit: null          },
];

// ── Modes ─────────────────────────────────────────────────────────────────────

const MODES: TravelMode[] = [
  {
    id: 'full_trip',     label: 'Full Trip',
    subtitle: 'Flights, hotel, dining & experiences',
    icon: Globe2, steps: ['destination', 'dates', 'travelers', 'budget'],
    color: AZURE,      rgb: '0,122,255',   targetZone: '/zone/management',
  },
  {
    id: 'day_trip',      label: 'Day Trip',
    subtitle: 'No flights — local exploration',
    icon: MapPin, steps: ['destination', 'dates', 'travelers'],
    color: '#5E5CE6',  rgb: '94,92,230',   targetZone: '/zone/management',
  },
  {
    id: 'accommodation', label: 'Hotel & Stay',
    subtitle: 'Find the perfect place to stay',
    icon: Hotel, steps: ['destination', 'dates', 'travelers', 'budget'],
    color: '#FF9F0A',  rgb: '255,159,10',  targetZone: '/zone/lodging',
  },
  {
    id: 'dining',        label: 'Restaurants',
    subtitle: 'Discover dining experiences',
    icon: UtensilsCrossed, steps: ['destination', 'travelers'],
    color: '#FF375F',  rgb: '255,55,95',   targetZone: '/zone/dining',
  },
  {
    id: 'experiences',   label: 'Experiences',
    subtitle: 'Activities & attractions',
    icon: Compass, steps: ['destination', 'travelers'],
    color: '#30D158',  rgb: '48,209,88',   targetZone: '/zone/attractions',
  },
  {
    id: 'flights',       label: 'Flights Only',
    subtitle: 'Search and compare flights',
    icon: Plane, steps: ['destination', 'dates', 'travelers'],
    color: '#64D2FF',  rgb: '100,210,255', targetZone: '/zone/flights',
  },
];

const STEP_ICONS: Record<StepId, IconComponent> = {
  destination: MapPin,
  dates:       Calendar,
  travelers:   Users,
  budget:      Wallet,
};

const POPULAR = [
  'Paris', 'Rome', 'Tokyo', 'Bali', 'New York', 'Barcelona',
  'London', 'Dubai', 'Bangkok', 'Sydney', 'Amsterdam', 'Lisbon',
];

const TRIP_STYLES: { id: string; label: string; icon: IconComponent }[] = [
  { id: 'adventure', label: 'Adventure', icon: Compass },
  { id: 'culture',   label: 'Culture',   icon: Globe2 },
  { id: 'luxury',    label: 'Luxury',    icon: Sparkles },
  { id: 'budget',    label: 'Budget',    icon: Wallet },
  { id: 'food',      label: 'Foodie',    icon: UtensilsCrossed },
  { id: 'relax',     label: 'Relaxation',icon: Hotel },
];

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── Price index (100 = avg), day-preview, templates, NL parser ────────────────

const PRICE_INDEX: Record<string, number[]> = {
  'Paris':     [82,78,88,95,100,112,132,130,104,98,88,112],
  'Rome':      [78,74,88,100,112,118,142,140,108,102,84,88],
  'Tokyo':     [88,84,106,142,98,94,112,118,108,132,88,98],
  'Bali':      [112,102,94,88,84,78,102,124,88,84,94,118],
  'New York':  [88,84,94,108,116,122,132,130,114,112,98,132],
  'Barcelona': [78,74,88,104,116,132,152,150,120,108,84,88],
  'London':    [84,80,88,100,110,116,132,130,108,104,88,122],
  'Dubai':     [112,106,92,80,74,68,74,74,80,90,112,122],
  'Bangkok':   [112,106,92,80,74,78,84,84,78,84,90,122],
  'Sydney':    [132,122,116,98,88,84,90,94,100,112,116,126],
  'Amsterdam': [84,78,84,98,110,116,132,130,108,98,86,102],
  'Lisbon':    [78,74,84,98,112,122,142,140,108,104,84,88],
};
const DEFAULT_PRICE_IDX = [88,84,90,100,106,116,126,124,104,102,90,112];

type DayAct = { time: string; activity: string };
const DEST_DAY_PREVIEW: Record<string, DayAct[][]> = {
  'Paris': [
    [{time:'9am', activity:'Louvre Museum'},{time:'2pm', activity:'Seine River cruise'},{time:'7pm', activity:'Bistro dinner, Marais'}],
    [{time:'9am', activity:'Versailles Palace'},{time:'3pm', activity:'Saint-Germain shopping'},{time:'8pm', activity:'Rooftop cocktails'}],
    [{time:'10am',activity:"Musée d'Orsay"},{time:'1pm', activity:'Montmartre café'},{time:'9pm', activity:'Eiffel Tower at night'}],
  ],
  'Rome': [
    [{time:'8am', activity:'Colosseum & Roman Forum'},{time:'1pm', activity:'Trastevere lunch'},{time:'7pm', activity:'Piazza Navona at sunset'}],
    [{time:'9am', activity:'Vatican Museums'},{time:'2pm', activity:'Pizza in city center'},{time:'6pm', activity:'Trevi Fountain (golden hour)'}],
    [{time:'10am',activity:'Via Condotti shopping'},{time:'2pm', activity:'Gelato crawl'},{time:'7pm', activity:'Ponte Milvio walk'}],
  ],
  'Tokyo': [
    [{time:'8am', activity:'Senso-ji Temple'},{time:'2pm', activity:'Akihabara tech district'},{time:'7pm', activity:'Ramen dinner, Shinjuku'}],
    [{time:'7am', activity:'Ueno Park morning'},{time:'1pm', activity:'Shibuya shopping'},{time:'7pm', activity:'Sushi omakase dinner'}],
    [{time:'9am', activity:'Meiji Shrine'},{time:'1pm', activity:'TeamLab digital art'},{time:'6pm', activity:'Izakaya hopping, Ginza'}],
  ],
  'Bali': [
    [{time:'6am', activity:'Sunrise at rice terraces'},{time:'10am',activity:'Uluwatu Temple'},{time:'4pm', activity:'Surf lesson, Kuta'}],
    [{time:'7am', activity:'Morning yoga'},{time:'11am',activity:'Sacred Monkey Forest'},{time:'6pm', activity:'Jimbaran seafood'}],
    [{time:'9am', activity:'Batik workshop'},{time:'1pm', activity:'Balinese spa massage'},{time:'5pm', activity:'Sunset cocktails, Seminyak'}],
  ],
  'Barcelona': [
    [{time:'9am', activity:'Sagrada Família'},{time:'1pm', activity:'Barceloneta beach'},{time:'7pm', activity:'Tapas dinner, El Born'}],
    [{time:'10am',activity:'Picasso Museum'},{time:'2pm', activity:'La Boqueria Market'},{time:'9pm', activity:'Flamenco, Gothic Quarter'}],
    [{time:'9am', activity:'Park Güell'},{time:'1pm', activity:'Montjuïc cable car'},{time:'7pm', activity:'Craft beer, Gràcia'}],
  ],
  'London': [
    [{time:'9am', activity:'Tower of London'},{time:'1pm', activity:'Borough Market'},{time:'7pm', activity:'West End theatre'}],
    [{time:'10am',activity:'British Museum'},{time:'3pm', activity:'Afternoon tea, Mayfair'},{time:'7pm', activity:'Thames walk'}],
    [{time:'9am', activity:'Buckingham Palace'},{time:'1pm', activity:'Hyde Park cycle'},{time:'6pm', activity:'Traditional pub, Soho'}],
  ],
  'New York': [
    [{time:'9am', activity:'Statue of Liberty'},{time:'2pm', activity:'MoMA Museum'},{time:'7pm', activity:'Pizza, Greenwich Village'}],
    [{time:'8am', activity:'Central Park morning'},{time:'11am',activity:'Fifth Avenue'},{time:'7pm', activity:'Broadway show'}],
    [{time:'7am', activity:'Brooklyn Bridge sunrise'},{time:'12pm',activity:'Chinatown lunch'},{time:'8pm', activity:'Jazz club, Harlem'}],
  ],
  'Dubai': [
    [{time:'9am', activity:'Burj Khalifa'},{time:'1pm', activity:'Dubai Mall'},{time:'7pm', activity:'Dubai Creek dinner'}],
    [{time:'6am', activity:'Desert safari'},{time:'11am',activity:'Sheikh Zayed Mosque'},{time:'7pm', activity:'Marina dinner cruise'}],
    [{time:'9am', activity:'Luxury spa'},{time:'1pm', activity:'Palm Jumeirah yacht'},{time:'8pm', activity:'Rooftop dining, DIFC'}],
  ],
};
const GENERIC_PREVIEW: DayAct[][] = [
  [{time:'Morning',  activity:'Explore the city center'},{time:'Afternoon',activity:'Local lunch & highlights'},{time:'Evening',activity:'Rooftop dinner'}],
  [{time:'Morning',  activity:'Top cultural attraction'},{time:'Afternoon',activity:'Market & shopping'},{time:'Evening',activity:'Nightlife & live music'}],
  [{time:'Morning',  activity:'Scenic neighbourhood walk'},{time:'Afternoon',activity:'Food tour & tasting'},{time:'Evening',activity:'Best sunset viewpoint'}],
];

interface TripTemplate {
  name: string;
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  color: string;
  desc: string; modeId: string;
  dest: string; nights: number; travelerCount: number; budget: number;
  styles: string[]; dna: Record<string, string>;
}
const TRIP_TEMPLATES: TripTemplate[] = [
  { name:'Romantic Paris', icon: Wine,          color:'#FF375F', desc:'4 nights · 2 people · Fine dining',
    modeId:'full_trip', dest:'Paris', nights:4, travelerCount:2, budget:4000, styles:['luxury','culture'], dna:{pace:'relaxed',priority:'experience',vibe:'social'} },
  { name:'Bali Wellness',  icon: Leaf,          color:'#30D158', desc:'7 nights · Solo · Spa & nature',
    modeId:'full_trip', dest:'Bali', nights:7, travelerCount:1, budget:2200, styles:['relax','adventure'], dna:{pace:'relaxed',priority:'value',vibe:'discover'} },
  { name:'Tokyo Culture',  icon: UtensilsCrossed, color:'#FF9F0A', desc:'7 nights · Duo · Food & tech',
    modeId:'full_trip', dest:'Tokyo', nights:7, travelerCount:2, budget:5500, styles:['food','culture'], dna:{pace:'packed',priority:'experience',vibe:'discover'} },
  { name:'Barcelona Sun',  icon: Waves,         color:'#5AC8FA', desc:'5 nights · Group 4 · Sun & nightlife',
    modeId:'full_trip', dest:'Barcelona', nights:5, travelerCount:4, budget:8000, styles:['adventure','culture'], dna:{pace:'packed',priority:'value',vibe:'social'} },
  { name:'Dubai Luxury',   icon: Star,          color:'#FF9F0A', desc:'5 nights · Couple · All-inclusive',
    modeId:'full_trip', dest:'Dubai', nights:5, travelerCount:2, budget:12000, styles:['luxury'], dna:{pace:'relaxed',priority:'experience',vibe:'social'} },
  { name:'Bangkok Budget', icon: Bike,          color:'#5E5CE6', desc:'10 nights · Solo · Temples & street food',
    modeId:'day_trip', dest:'Bangkok', nights:10, travelerCount:1, budget:1500, styles:['budget','food'], dna:{pace:'packed',priority:'value',vibe:'discover'} },
];

interface ParsedTrip {
  dest?: string; nights?: number; startDate?: string; endDate?: string;
  travelerCount?: number; budget?: number; styles?: string[]; modeId?: string;
}
function parseNL(text: string): ParsedTrip {
  const result: ParsedTrip = {};
  const t = text.toLowerCase();
  const allDests = [...Object.keys(DEST_INTEL), ...POPULAR];
  const destHit  = allDests.find(d => t.includes(d.toLowerCase()));
  if (destHit) result.dest = destHit;
  const nightsM = text.match(/(\d+)\s*nights?/i);
  const daysM   = !nightsM && text.match(/(\d+)\s*days?/i);
  if (nightsM) result.nights = parseInt(nightsM[1]);
  else if (daysM) result.nights = Math.max(1, parseInt(daysM[1]) - 1);
  else if (/weekend/i.test(t)) result.nights = 2;
  else if (/\bweek\b/i.test(t)) result.nights = 7;
  const budgetM = text.match(/\$\s*(\d[\d,]*)\s*k?/i) || text.match(/(\d+)\s*k\b/i);
  if (budgetM) { const raw = budgetM[1].replace(/,/g,''); const isK = /k/i.test(budgetM[0]); result.budget = parseInt(raw) * (isK ? 1000 : 1); if (result.budget < 200) result.budget *= 1000; }
  const familyM = t.match(/family of (\d)/i); const groupM = t.match(/(\d+)\s*(?:people|persons?|traveler)/i);
  if (familyM) result.travelerCount = parseInt(familyM[1]);
  else if (groupM) result.travelerCount = parseInt(groupM[1]);
  else if (/\bsolo\b|\bjust me\b/.test(t)) result.travelerCount = 1;
  else if (/girlfriend|boyfriend|partner|wife|husband/.test(t)) result.travelerCount = 2;
  const monthIdx = MONTHS_SHORT.findIndex(m => t.includes(m.toLowerCase()));
  if (monthIdx >= 0 && result.nights) {
    const now = new Date(); const year = monthIdx < now.getMonth() ? now.getFullYear()+1 : now.getFullYear();
    const start = new Date(year, monthIdx, 10); const end = new Date(start); end.setDate(end.getDate() + result.nights);
    result.startDate = start.toISOString().split('T')[0]; result.endDate = end.toISOString().split('T')[0];
  }
  const styles: string[] = [];
  if (/romantic|romance|honeymoon/.test(t)) styles.push('luxury');
  if (/adventure|hiking|outdoor/.test(t))  styles.push('adventure');
  if (/food|foodie|culinary/.test(t))      styles.push('food');
  if (/luxury|5.?star|high.?end/.test(t))  styles.push('luxury');
  if (/budget|cheap|backpack/.test(t))     styles.push('budget');
  if (/culture|museum|art|history/.test(t)) styles.push('culture');
  if (/relax|spa|wellness/.test(t))         styles.push('relax');
  if (styles.length) result.styles = [...new Set(styles)];
  if (/hotel only|accommodation/.test(t)) result.modeId = 'accommodation';
  else if (/restaurant only|dining only/.test(t)) result.modeId = 'dining';
  else if (/flight only/.test(t)) result.modeId = 'flights';
  else if (/day trip/.test(t)) result.modeId = 'day_trip';
  else if (result.nights || result.budget) result.modeId = 'full_trip';
  return result;
}

interface Conflict { type: string; title: string; body: string; warn: boolean; }
function detectConflicts(dest: string, nights: number, budget: number, startDate: string): Conflict[] {
  const out: Conflict[] = [];
  const intel = getDestIntel(dest);
  if (!intel || !dest) return out;
  const BASE = [90, 180, 320, 600][intel.costLevel];
  const FLIGHT = [350, 650, 1100, 2000][intel.costLevel];
  const minEst = FLIGHT + BASE * nights;
  if (budget > 0 && nights > 0 && budget < minEst * 0.65)
    out.push({ type:'budget', warn:true, title:'Budget may be tight', body:`${dest} typically needs ~$${minEst.toLocaleString()} for ${nights} nights. Consider adding ~$${Math.max(0, minEst - budget).toLocaleString()}.` });
  if (startDate) {
    const m = new Date(startDate + 'T12:00:00').getMonth();
    if (intel.peakMonths.includes(m))
      out.push({ type:'peak', warn:false, title:'Peak season selected', body:`${MONTHS_SHORT[m]} is high season in ${dest}. Prices run 30–50% above average — book early.` });
  }
  if (nights > 0 && nights <= 2 && ['Tokyo','Bali','Sydney','Bangkok'].includes(dest))
    out.push({ type:'short', warn:false, title:'Very short trip', body:`${dest} is far — ${nights} nights may feel rushed. Most visitors stay 5+ nights.` });
  return out;
}

function diffDays(a: string, b: string): number {
  if (!a || !b) return 0;
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000));
}

// ── Shared: Gradient Title ────────────────────────────────────────────────────

function GradientTitle({ children, color = AZURE, subtitle }: {
  children: React.ReactNode; color?: string; subtitle?: string;
}) {
  return (
    <div>
      <div style={{
        fontSize: 22, fontWeight: 900, letterSpacing: '-0.035em', marginBottom: 6,
        background: `linear-gradient(135deg, ${color} 0%, #5E5CE6 100%)`,
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
      }}>
        {children}
      </div>
      {subtitle && <div style={{ fontSize: 13, color: '#6E6E73', letterSpacing: '-0.01em' }}>{subtitle}</div>}
    </div>
  );
}

// ── Feature 1: Destination Intelligence Card ───────────────────────────────────

function DestIntelCard({ dest, color, rgb }: { dest: string; color: string; rgb: string }) {
  const intel = getDestIntel(dest);
  if (!intel) return null;

  const currentMonth = new Date().getMonth();
  const isBest = intel.bestMonths.includes(currentMonth);
  const isPeak = intel.peakMonths.includes(currentMonth);
  const seasonLabel = isBest ? 'Great time to visit' : isPeak ? 'Peak — busy & pricey' : 'Shoulder season';
  const seasonColor = isBest ? '#30D158' : isPeak ? '#FF9F0A' : '#AEAEB2';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
    >
      <div style={{
        padding: '14px 16px', borderRadius: 16,
        background: `rgba(${rgb}, 0.05)`,
        border: `1.5px solid rgba(${rgb}, 0.18)`,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 22 }}>{intel.flag}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.02em' }}>{dest}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: COST_COLORS[intel.costLevel] }}>
                {COST_LABELS[intel.costLevel]} · {intel.currency}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 100, background: `${seasonColor}18`, border: `1px solid ${seasonColor}40` }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: seasonColor, flexShrink: 0 }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: seasonColor, whiteSpace: 'nowrap' }}>{seasonLabel}</span>
          </div>
        </div>

        {/* Tags */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {intel.tags.map(tag => (
            <span key={tag} style={{ fontSize: 11, fontWeight: 600, color: '#3C3C43', padding: '3px 9px', borderRadius: 100, background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.08)' }}>
              {tag}
            </span>
          ))}
        </div>

        {/* Best months mini strip */}
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#AEAEB2', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 5 }}>Best months</div>
          <div style={{ display: 'flex', gap: 3 }}>
            {Array.from({ length: 12 }, (_, i) => {
              const isBestM = intel.bestMonths.includes(i);
              const isPeakM = intel.peakMonths.includes(i);
              const isCurrent = i === currentMonth;
              const bg = isBestM ? '#30D158' : isPeakM ? '#FF9F0A' : 'rgba(0,0,0,0.08)';
              return (
                <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{
                    height: 18, borderRadius: 4, background: bg, opacity: isCurrent ? 1 : 0.65,
                    boxShadow: isCurrent ? `0 0 0 2px white, 0 0 0 3px ${bg}` : 'none',
                    transform: isCurrent ? 'scaleY(1.15)' : 'none',
                    transition: 'all 0.15s ease',
                  }} />
                  <div style={{ fontSize: 8, fontWeight: isCurrent ? 800 : 400, color: isCurrent ? '#1D1D1F' : '#AEAEB2', marginTop: 3, letterSpacing: '0em' }}>
                    {MONTHS_SHORT[i].slice(0, 1)}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            {[['#30D158','Great'],['#FF9F0A','Busy'],['rgba(0,0,0,0.08)','Off-peak']].map(([c,l]) => (
              <div key={l as string} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: c as string }} />
                <span style={{ fontSize: 9, fontWeight: 600, color: '#6E6E73' }}>{l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Feature 4: Seasonal Signal (in StepDates) ─────────────────────────────────

function SeasonalSignal({ dest }: { dest: string }) {
  const intel = getDestIntel(dest);
  if (!intel) return null;

  const currentMonth = new Date().getMonth();

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: 2 }}>
      <div style={{
        padding: '12px 14px', borderRadius: 14,
        background: 'rgba(255,255,255,0.70)',
        border: '1px solid rgba(0,0,0,0.08)',
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#AEAEB2', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
          Best time to visit {dest}
        </div>
        <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end' }}>
          {Array.from({ length: 12 }, (_, i) => {
            const isBest = intel.bestMonths.includes(i);
            const isPeak = intel.peakMonths.includes(i);
            const isCurr = i === currentMonth;
            const height = isBest ? 32 : isPeak ? 22 : 14;
            const bg = isBest ? '#30D158' : isPeak ? '#FF9F0A66' : 'rgba(0,0,0,0.08)';
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                <div style={{
                  width: '100%', borderRadius: 4, background: bg, height,
                  boxShadow: isCurr ? `0 0 0 2px white, 0 0 0 3.5px ${isBest ? '#30D158' : isPeak ? '#FF9F0A' : '#AEAEB2'}` : 'none',
                  transition: 'all 0.2s ease',
                }} />
                <div style={{ fontSize: 8, fontWeight: isCurr ? 800 : 400, color: isCurr ? '#1D1D1F' : '#AEAEB2' }}>
                  {MONTHS_SHORT[i].slice(0, 1)}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          {[['#30D158','Best'],['#FF9F0A','Busy & pricey'],['rgba(0,0,0,0.12)','Off-season']].map(([c,l]) => (
            <div key={l as string} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: c as string }} />
              <span style={{ fontSize: 9, fontWeight: 600, color: '#6E6E73' }}>{l}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ── Design 3: Avatar Row ──────────────────────────────────────────────────────

function AvatarRow({ count, color }: { count: number; color: string }) {
  const avatarColors = ['#007AFF','#5E5CE6','#FF9F0A','#30D158','#FF375F','#64D2FF','#FF6B35','#BF5AF2'];
  return (
    <div style={{ display: 'flex', gap: 5, justifyContent: 'center', marginTop: 8 }}>
      {Array.from({ length: 8 }, (_, i) => {
        const active = i < count;
        const bg = active
          ? `linear-gradient(135deg, ${avatarColors[i % avatarColors.length]}, ${color})`
          : 'rgba(0,0,0,0.06)';
        return (
          <motion.div
            key={i}
            animate={{ scale: active ? 1 : 0.7, opacity: active ? 1 : 0.18 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            style={{
              width: 26, height: 26, borderRadius: '50%', background: bg,
              border: active ? 'none' : '1.5px dashed rgba(0,0,0,0.14)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {active && <Users size={11} color="rgba(255,255,255,0.92)" strokeWidth={2} />}
          </motion.div>
        );
      })}
    </div>
  );
}

// ── Feature 3: DNA Quick Capture ──────────────────────────────────────────────

function DNACapture({ answers, onAnswer }: {
  answers: Record<string, string>;
  onAnswer: (qId: string, aId: string) => void;
}) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#AEAEB2', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
        Your preferences · optional
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {DNA_QUESTIONS.map(q => (
          <div key={q.id}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#6E6E73', marginBottom: 5 }}>{q.q}</div>
            <div style={{ display: 'flex', gap: 7 }}>
              {q.a.map(opt => {
                const selected = answers[q.id] === opt.id;
                const Icon = opt.icon;
                return (
                  <motion.button
                    key={opt.id}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={() => onAnswer(q.id, opt.id)}
                    style={{
                      flex: 1, padding: '9px 10px', borderRadius: 12, cursor: 'pointer',
                      fontFamily: 'inherit', textAlign: 'left',
                      background: selected ? 'rgba(0,122,255,0.09)' : 'rgba(0,0,0,0.03)',
                      border: `1.5px solid ${selected ? 'rgba(0,122,255,0.30)' : 'rgba(0,0,0,0.08)'}`,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ marginBottom: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 7, background: selected ? 'rgba(0,122,255,0.12)' : 'rgba(0,0,0,0.05)' }}>
                      <Icon size={13} color={selected ? AZURE : '#6E6E73'} strokeWidth={2} />
                    </div>
                    <div style={{ fontSize: 11, fontWeight: selected ? 800 : 600, color: selected ? AZURE : '#1D1D1F' }}>{opt.label}</div>
                    <div style={{ fontSize: 10, fontWeight: 400, color: '#6E6E73' }}>{opt.sub}</div>
                  </motion.button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Feature 2: Budget Tier Visualizer ─────────────────────────────────────────

function BudgetTierBar({ budget }: { budget: number }) {
  const tierIdx = BUDGET_TIERS.findIndex(t => budget <= t.max);
  const idx     = tierIdx === -1 ? 3 : tierIdx;
  const tier    = BUDGET_TIERS[idx];
  const fillPct = tier.max === Infinity
    ? Math.min(1, (budget - tier.min) / 10000)
    : Math.min(1, (budget - tier.min) / (tier.max - tier.min));

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      style={{ padding: '14px 16px', borderRadius: 16, background: `rgba(${tier.rgb},0.06)`, border: `1.5px solid rgba(${tier.rgb},0.20)`, marginTop: 2 }}>
      {/* Tier tabs */}
      <div style={{ display: 'flex', gap: 5, marginBottom: 12 }}>
        {BUDGET_TIERS.map((t, i) => (
          <div key={t.id} style={{
            flex: 1, textAlign: 'center', padding: '5px 0', borderRadius: 8,
            background: i === idx ? `rgba(${t.rgb},0.15)` : 'transparent',
            border: `1px solid ${i === idx ? `rgba(${t.rgb},0.35)` : 'transparent'}`,
            transition: 'all 0.2s ease',
          }}>
            <div style={{ fontSize: 10, fontWeight: i === idx ? 800 : 500, color: i === idx ? t.color : '#AEAEB2' }}>
              {t.label}
            </div>
          </div>
        ))}
      </div>

      {/* Progress within tier */}
      {tier.max !== Infinity && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ height: 4, borderRadius: 100, background: 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <motion.div
              initial={{ width: '0%' }}
              animate={{ width: `${fillPct * 100}%` }}
              transition={{ type: 'spring', stiffness: 200, damping: 30 }}
              style={{ height: '100%', borderRadius: 100, background: `linear-gradient(90deg, ${tier.color}, rgba(${tier.rgb},0.5))`, willChange: 'width' }}
            />
          </div>
          {idx < 3 && (
            <div style={{ fontSize: 10, fontWeight: 600, color: '#6E6E73', marginTop: 4, textAlign: 'right' }}>
              ${(BUDGET_TIERS[idx + 1].min - budget).toLocaleString()} to {BUDGET_TIERS[idx + 1].label}
            </div>
          )}
        </div>
      )}

      {/* Unlocks */}
      <div style={{ fontSize: 10, fontWeight: 700, color: '#AEAEB2', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 7 }}>
        What you unlock
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {tier.unlocks.map(u => (
          <div key={u} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <Check size={11} color={tier.color} strokeWidth={2.5} />
            <span style={{ fontSize: 11, fontWeight: 600, color: '#3C3C43' }}>{u}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ── Feature 5: Launch Overlay ─────────────────────────────────────────────────

function LaunchOverlay({ mode, onDone }: { mode: TravelMode; onDone: () => void }) {
  const [stage, setStage] = useState(0);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    LAUNCH_STAGES.forEach((s, i) => {
      timers.push(setTimeout(() => {
        setStage(i);
        if (s.count) {
          let start = 0;
          const target = s.count;
          const duration = 550;
          const step = 16;
          const increment = target / (duration / step);
          const interval = setInterval(() => {
            start += increment;
            if (start >= target) { setCount(target); clearInterval(interval); }
            else { setCount(Math.round(start)); }
          }, step);
          timers.push(interval as unknown as ReturnType<typeof setTimeout>);
        }
      }, i * 700));
    });
    timers.push(setTimeout(onDone, LAUNCH_STAGES.length * 700 + 400));
    return () => timers.forEach(t => clearTimeout(t));
  }, [onDone]);

  const current = LAUNCH_STAGES[stage];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 24,
        background: 'rgba(248,248,250,0.92)',
        backdropFilter: 'blur(40px) saturate(200%)',
      }}
    >
      {/* Pulsing orb */}
      <div style={{ position: 'relative', width: 120, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {[120, 90, 64].map((size, i) => (
          <motion.div
            key={size}
            animate={{ scale: [1, 1.1, 1], opacity: [0.15, 0.3, 0.15] }}
            transition={{ duration: 2, delay: i * 0.3, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              position: 'absolute',
              width: size, height: size, borderRadius: '50%',
              background: `radial-gradient(circle, rgba(${mode.rgb},${0.35 - i * 0.08}) 0%, transparent 70%)`,
            }}
          />
        ))}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          style={{
            width: 44, height: 44, borderRadius: '50%',
            border: `3px solid rgba(${mode.rgb},0.15)`,
            borderTopColor: mode.color,
          }}
        />
        <div style={{ position: 'absolute' }}><mode.icon size={18} color={mode.color} /></div>
      </div>

      {/* Text */}
      <div style={{ textAlign: 'center', maxWidth: 280 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={stage}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1D1D1F', letterSpacing: '-0.02em', marginBottom: 4 }}>
              {current.text}
            </div>
            {current.count && (
              <div style={{ fontSize: 26, fontWeight: 900, color: mode.color, letterSpacing: '-0.04em' }}>
                {count.toLocaleString()}
                <span style={{ fontSize: 12, fontWeight: 600, color: '#6E6E73', marginLeft: 5 }}>{current.unit}</span>
              </div>
            )}
            {!current.count && (
              <div style={{ fontSize: 13, fontWeight: 600, color: '#30D158' }}>
                Your workspace is ready ✓
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Stage dots */}
      <div style={{ display: 'flex', gap: 6 }}>
        {LAUNCH_STAGES.map((_, i) => (
          <motion.div
            key={i}
            animate={{ width: i === stage ? 20 : 6, background: i <= stage ? mode.color : 'rgba(0,0,0,0.12)' }}
            style={{ height: 6, borderRadius: 100 }}
            transition={{ duration: 0.3 }}
          />
        ))}
      </div>
    </motion.div>
  );
}

// ── D1 new: Ambient floating particles ────────────────────────────────────────

const AMBIENT_PTS = [
  {x:8,y:12,s:4,d:6},{x:88,y:18,s:3,d:9},{x:22,y:78,s:5,d:7},{x:76,y:65,s:3,d:11},
  {x:45,y:90,s:4,d:8},{x:92,y:82,s:3,d:6},{x:14,y:44,s:3,d:10},{x:68,y:28,s:4,d:7},
  {x:36,y:55,s:3,d:9},{x:82,y:48,s:4,d:6},{x:55,y:14,s:3,d:8},{x:28,y:92,s:4,d:11},
];

function AmbientParticles({ rgb }: { rgb: string }) {
  return (
    <div style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:1, overflow:'hidden' }}>
      {AMBIENT_PTS.map((p,i) => (
        <motion.div key={i}
          animate={{ y:[-10,10,-10], x:[-6,6,-6], opacity:[0.18,0.35,0.18] }}
          transition={{ duration:p.d, repeat:Infinity, ease:'easeInOut', delay:i*0.6 }}
          style={{ position:'absolute', left:`${p.x}%`, top:`${p.y}%`, width:p.s, height:p.s,
            borderRadius:'50%', background:`rgba(${rgb},0.5)` }}
        />
      ))}
    </div>
  );
}

// ── F1 new: Natural Language Quick-Fill ───────────────────────────────────────

function NLQuickFill({ onApply }: { onApply: (p: ParsedTrip) => void }) {
  const [text, setText] = useState('');
  const parsed: ParsedTrip = text.length > 8 ? parseNL(text) : {};
  const hits = Object.keys(parsed).filter(k => (parsed as Record<string, unknown>)[k] !== undefined);

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, color: '#AEAEB2', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 7 }}>
        <Zap size={9} color="#AEAEB2" strokeWidth={2.5} />
        Quick-fill — describe in one line
      </div>
      <div style={{ position: 'relative' }}>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder='"Paris, 7 nights, April, girlfriend, $4k, romantic"'
          style={{ width: '100%', padding: '11px 40px 11px 14px', borderRadius: 12, border: '1.5px solid rgba(0,0,0,0.10)',
            background: 'rgba(255,255,255,0.80)', fontSize: 12, fontWeight: 500, color: '#1D1D1F',
            fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', backdropFilter: 'blur(8px)' }}
        />
        {hits.length > 0 && (
          <motion.button initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={() => { onApply(parsed); setText(''); }}
            style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '5px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: AZURE, color: '#fff', fontSize: 11, fontWeight: 800, fontFamily: 'inherit' }}>
            Fill <ArrowRight size={9} color="#fff" strokeWidth={2.5} />
          </motion.button>
        )}
      </div>
      {hits.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
          style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 7 }}>
          {parsed.dest          && <ParsedChip color={AZURE}     icon={<MapPin    size={8} color={AZURE}     strokeWidth={2} />}>{parsed.dest}</ParsedChip>}
          {parsed.nights        && <ParsedChip color="#5E5CE6"   icon={<Moon      size={8} color="#5E5CE6"   strokeWidth={2} />}>{parsed.nights}n</ParsedChip>}
          {parsed.travelerCount && <ParsedChip color="#FF9F0A"   icon={<Users     size={8} color="#FF9F0A"   strokeWidth={2} />}>{parsed.travelerCount}</ParsedChip>}
          {parsed.budget        && <ParsedChip color="#30D158"   icon={<Wallet    size={8} color="#30D158"   strokeWidth={2} />}>${parsed.budget.toLocaleString()}</ParsedChip>}
          {parsed.styles?.map(s => <ParsedChip key={s} color="#FF375F" icon={<Sparkles size={8} color="#FF375F" strokeWidth={2} />}>{s}</ParsedChip>)}
        </motion.div>
      )}
    </div>
  );
}
function ParsedChip({ color, icon, children }: { color: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color, padding: '3px 8px', borderRadius: 100, background: `${color}18`, border: `1px solid ${color}40` }}>
      {icon}{children}
    </span>
  );
}

// ── F2 new: Trip Templates ────────────────────────────────────────────────────

function TripTemplates({ onApply }: { onApply: (t: TripTemplate) => void }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#AEAEB2', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
        Popular templates
      </div>
      <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}>
        {TRIP_TEMPLATES.map(t => {
          const Icon = t.icon;
          return (
            <motion.button key={t.name} whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }}
              onClick={() => onApply(t)}
              style={{ flexShrink: 0, padding: '10px 12px', borderRadius: 14, cursor: 'pointer',
                fontFamily: 'inherit', textAlign: 'left', minWidth: 130,
                background: 'rgba(255,255,255,0.75)', border: '1.5px solid rgba(0,0,0,0.08)',
                backdropFilter: 'blur(8px)' }}>
              <div style={{ width: 28, height: 28, borderRadius: 9, background: `${t.color}14`, border: `1px solid ${t.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 7 }}>
                <Icon size={14} color={t.color} strokeWidth={2} />
              </div>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#1D1D1F', lineHeight: 1.3, marginBottom: 3 }}>{t.name}</div>
              <div style={{ fontSize: 9, fontWeight: 500, color: '#6E6E73' }}>{t.desc}</div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// ── F5 new: Step Particles (celebration on advance) ───────────────────────────

function StepParticles({ trigger, color }: { trigger: number; color: string }) {
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (trigger === 0) return;
    setActive(true);
    const t = setTimeout(() => setActive(false), 900);
    return () => clearTimeout(t);
  }, [trigger]);

  const pts = Array.from({length:14}, (_,i) => {
    const angle = (i / 14) * 2 * Math.PI;
    return { x: Math.cos(angle)*55, y: Math.sin(angle)*55 };
  });

  if (!active) return null;
  return (
    <div style={{ position:'absolute', bottom:30, right:30, pointerEvents:'none', zIndex:200 }}>
      {pts.map((p,i) => (
        <motion.div key={i}
          initial={{ x:0, y:0, opacity:1, scale:1 }}
          animate={{ x:p.x, y:p.y, opacity:0, scale:0.2 }}
          transition={{ duration:0.75, delay:i*0.015, ease:'easeOut' }}
          style={{ position:'absolute', width:5, height:5, borderRadius:'50%', background:color, top:0, left:0 }}
        />
      ))}
    </div>
  );
}

// ── F7 new: DNA Radar Chart ───────────────────────────────────────────────────

function DNARadar({ answers, color, rgb }: { answers: Record<string,string>; color: string; rgb: string }) {
  if (Object.keys(answers).length === 0) return null;
  const cx = 65, cy = 65, r = 48;
  const dims = [
    { label:'Pace',    val: answers.pace === 'packed'      ? 0.85 : answers.pace === 'relaxed' ? 0.25 : 0.5 },
    { label:'Social',  val: answers.vibe === 'social'      ? 0.82 : answers.vibe === 'discover' ? 0.28 : 0.5 },
    { label:'Comfort', val: answers.priority === 'experience' ? 0.80 : answers.priority === 'value' ? 0.30 : 0.5 },
    { label:'Explore', val: answers.vibe === 'discover'    ? 0.75 : answers.vibe === 'social' ? 0.38 : 0.5 },
    { label:'Flex',    val: answers.pace === 'relaxed'     ? 0.80 : answers.pace === 'packed' ? 0.22 : 0.5 },
  ];
  const pt = (i: number, v: number) => {
    const a = (i / 5) * 2 * Math.PI - Math.PI / 2;
    return { x: cx + r * v * Math.cos(a), y: cy + r * v * Math.sin(a) };
  };
  const axis = (i: number) => {
    const a = (i / 5) * 2 * Math.PI - Math.PI / 2;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  };
  const polygon = dims.map((d,i) => { const p = pt(i, d.val); return `${p.x},${p.y}`; }).join(' ');
  const grid = [0.25, 0.5, 0.75, 1].map(lv => dims.map((_,i) => { const ax = axis(i); return `${cx+(ax.x-cx)*lv},${cy+(ax.y-cy)*lv}`; }).join(' '));

  return (
    <motion.div initial={{opacity:0,scale:0.92}} animate={{opacity:1,scale:1}}
      style={{ padding:'12px 14px', borderRadius:14, background:`rgba(${rgb},0.05)`, border:`1px solid rgba(${rgb},0.18)`, marginTop:10 }}>
      <div style={{ fontSize:10, fontWeight:700, color:'#AEAEB2', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:8 }}>Your Travel DNA</div>
      <div style={{ display:'flex', justifyContent:'center' }}>
        <svg width={130} height={130} viewBox="0 0 130 130">
          {grid.map((pts,i) => <polygon key={i} points={pts} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="1" />)}
          {dims.map((_,i) => { const a = axis(i); return <line key={i} x1={cx} y1={cy} x2={a.x} y2={a.y} stroke="rgba(0,0,0,0.07)" strokeWidth="1" />; })}
          <motion.polygon points={polygon} fill={`rgba(${rgb},0.18)`} stroke={color} strokeWidth="1.5"
            initial={{opacity:0}} animate={{opacity:1}} transition={{duration:0.6}} />
          {dims.map((d,i) => { const p = pt(i, d.val); return <circle key={i} cx={p.x} cy={p.y} r={3} fill={color} />; })}
          {dims.map((d,i) => {
            const a = axis(i); const lx = cx+(a.x-cx)*1.28; const ly = cy+(a.y-cy)*1.28;
            return <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="central" fontSize="8" fill="#6E6E73" fontWeight="600">{d.label}</text>;
          })}
        </svg>
      </div>
    </motion.div>
  );
}

// ── F8 new: Traveler Tags (dietary + interests) ───────────────────────────────

const TRAVELER_TAGS: Array<{
  id:    string;
  icon:  React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  label: string;
  group: string;
}> = [
  { id: 'vegan',       icon: Leaf,        label: 'Vegan',       group: 'diet' },
  { id: 'kosher',      icon: Star,        label: 'Kosher',      group: 'diet' },
  { id: 'gluten-free', icon: Shield,      label: 'Gluten-free', group: 'diet' },
  { id: 'nut-allergy', icon: AlertTriangle,label:'Nut allergy', group: 'diet' },
  { id: 'wheelchair',  icon: Users,       label: 'Accessible',  group: 'access' },
  { id: 'beaches',     icon: Waves,       label: 'Beaches',     group: 'interest' },
  { id: 'museums',     icon: Library,     label: 'Museums',     group: 'interest' },
  { id: 'nightlife',   icon: Music2,      label: 'Nightlife',   group: 'interest' },
  { id: 'shopping',    icon: ShoppingBag, label: 'Shopping',    group: 'interest' },
];

function TravelerTags({ selected, onToggle }: { selected: string[]; onToggle: (id: string) => void }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#AEAEB2', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
        Group needs &amp; interests · optional
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {TRAVELER_TAGS.map(tag => {
          const on   = selected.includes(tag.id);
          const Icon = tag.icon;
          return (
            <motion.button key={tag.id} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
              onClick={() => onToggle(tag.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 10px', borderRadius: 100, cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 11, fontWeight: on ? 700 : 500,
                background: on ? 'rgba(0,122,255,0.10)' : 'rgba(0,0,0,0.04)',
                border: `1.5px solid ${on ? 'rgba(0,122,255,0.30)' : 'rgba(0,0,0,0.08)'}`,
                color: on ? AZURE : '#3C3C43', transition: 'all 0.15s ease',
              }}>
              <Icon size={10} color={on ? AZURE : '#6E6E73'} strokeWidth={2} />
              {tag.label}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// ── F4 new: Monthly Price Signal ──────────────────────────────────────────────

function PriceSignal({ dest, color, rgb }: { dest: string; color: string; rgb: string }) {
  const intel = getDestIntel(dest);
  if (!intel) return null;
  const idx   = PRICE_INDEX[dest] ?? DEFAULT_PRICE_IDX;
  const curM  = new Date().getMonth();
  const minIdx = idx.indexOf(Math.min(...idx));
  const maxIdx = idx.indexOf(Math.max(...idx));

  return (
    <motion.div initial={{opacity:0,y:6}} animate={{opacity:1,y:0}}
      style={{ padding:'11px 13px', borderRadius:13, background:'rgba(255,255,255,0.65)', border:'1px solid rgba(0,0,0,0.08)', marginTop:2, backdropFilter:'blur(8px)' }}>
      <div style={{ fontSize:10, fontWeight:700, color:'#AEAEB2', letterSpacing:'0.05em', textTransform:'uppercase', marginBottom:7 }}>
        Estimated flight price — {dest}
      </div>
      <div style={{ display:'flex', alignItems:'flex-end', gap:2, height:36 }}>
        {idx.map((v,i) => {
          const norm = (v - 60) / 100;
          const h    = Math.max(8, Math.round(norm * 36));
          const isMin = i === minIdx; const isMax = i === maxIdx; const isCur = i === curM;
          const bg = isMin ? '#30D158' : isMax ? '#FF375F' : `rgba(${rgb},0.55)`;
          return (
            <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
              <div style={{ width:'100%', height:h, borderRadius:3, background:bg, opacity: isCur ? 1 : 0.6,
                boxShadow: isCur ? `0 0 0 2px white, 0 0 0 3px ${bg}` : 'none',
                transform: isCur ? 'scaleY(1.12)' : 'none', transition:'all 0.2s ease' }} />
              <div style={{ fontSize:7, fontWeight: isCur ? 800 : 400, color: isCur ? '#1D1D1F' : '#AEAEB2' }}>
                {MONTHS_SHORT[i][0]}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display:'flex', gap:10, marginTop:8 }}>
        {[{c:'#30D158',l:'Cheapest'},{c:`rgba(${rgb},0.55)`,l:'Average'},{c:'#FF375F',l:'Peak price'}].map(({c,l}) => (
          <div key={l} style={{ display:'flex', alignItems:'center', gap:3 }}>
            <div style={{ width:7, height:7, borderRadius:2, background:c }} />
            <span style={{ fontSize:9, fontWeight:600, color:'#6E6E73' }}>{l}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ── F6 new: Budget Allocation Bar ─────────────────────────────────────────────

const BUDGET_CATS: Array<{
  id: string; label: string;
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  pct: number; color: string;
}> = [
  { id: 'flights',    label: 'Flights',     icon: Plane,           pct: 35, color: '#007AFF' },
  { id: 'hotel',      label: 'Hotel',       icon: Hotel,           pct: 30, color: '#5E5CE6' },
  { id: 'food',       label: 'Food',        icon: UtensilsCrossed, pct: 20, color: '#FF9F0A' },
  { id: 'activities', label: 'Experiences', icon: Target,          pct: 10, color: '#30D158' },
  { id: 'transport',  label: 'Transport',   icon: Car,             pct:  5, color: '#FF375F' },
];

function BudgetAllocationBar({ budget }: { budget: number }) {
  return (
    <motion.div initial={{opacity:0,y:6}} animate={{opacity:1,y:0}}
      style={{ padding:'12px 14px', borderRadius:14, background:'rgba(255,255,255,0.70)', border:'1px solid rgba(0,0,0,0.08)', marginTop:4, backdropFilter:'blur(8px)' }}>
      <div style={{ fontSize:10, fontWeight:700, color:'#AEAEB2', letterSpacing:'0.05em', textTransform:'uppercase', marginBottom:10 }}>
        Suggested allocation
      </div>
      {/* Stacked bar */}
      <div style={{ display:'flex', height:8, borderRadius:100, overflow:'hidden', marginBottom:12, gap:1 }}>
        {BUDGET_CATS.map(c => (
          <motion.div key={c.id}
            initial={{ width:0 }} animate={{ width:`${c.pct}%` }}
            transition={{ duration:0.6, delay:BUDGET_CATS.indexOf(c)*0.08, ease:'easeOut' }}
            style={{ height:'100%', background:c.color }} />
        ))}
      </div>
      {/* Category rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {BUDGET_CATS.map(c => {
          const CIcon = c.icon;
          return (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 20, height: 20, borderRadius: 6, background: `${c.color}14`, border: `1px solid ${c.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <CIcon size={11} color={c.color} strokeWidth={2} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#3C3C43', flex: 1 }}>{c.label}</span>
            <span style={{ fontSize: 11, fontWeight: 800, color: c.color }}>{c.pct}%</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#6E6E73', minWidth: 60, textAlign: 'right' }}>
              ${Math.round(budget * c.pct / 100).toLocaleString()}
            </span>
          </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ── F9 new: Smart Budget Warning ──────────────────────────────────────────────

function SmartBudgetWarning({ dest, nights, budget, startDate, color, rgb }: {
  dest: string; nights: number; budget: number; startDate: string; color: string; rgb: string;
}) {
  const conflicts = detectConflicts(dest, nights, budget, startDate);
  if (!conflicts.length) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {conflicts.map(c => (
        <div key={c.type} style={{ padding: '10px 12px', borderRadius: 12,
          background: c.warn ? 'rgba(255,159,10,0.07)' : 'rgba(0,122,255,0.05)',
          border: `1px solid ${c.warn ? 'rgba(255,159,10,0.28)' : 'rgba(0,122,255,0.18)'}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 800, color: c.warn ? '#FF9F0A' : AZURE, marginBottom: 2 }}>
            {c.warn
              ? <AlertTriangle size={11} color="#FF9F0A" strokeWidth={2.5} />
              : <Info          size={11} color={AZURE}    strokeWidth={2.5} />
            }
            {c.title}
          </div>
          <div style={{ fontSize: 11, fontWeight: 500, color: '#3C3C43', lineHeight: 1.4 }}>{c.body}</div>
        </div>
      ))}
    </motion.div>
  );
}

// ── F3 new: Day Preview (shown on last step) ──────────────────────────────────

function timeSlotColor(time: string): string {
  const t = time.toLowerCase();
  if (t.includes('morning') || /\b[4-9]am\b/.test(t) || /\b1[01]am\b/.test(t)) return '#FF9F0A';
  if (t.includes('afternoon') || /\b1[2-5]pm\b/.test(t)) return '#007AFF';
  return '#5E5CE6';
}

function DayPreview({ dest, nights }: { dest: string; nights: number }) {
  const raw  = DEST_DAY_PREVIEW[dest] ?? GENERIC_PREVIEW;
  const days = raw.slice(0, Math.min(3, nights || 3));
  if (!dest) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
      style={{ marginTop: 12, padding: '12px 14px', borderRadius: 14,
        background: 'rgba(255,255,255,0.65)', border: '1px solid rgba(0,0,0,0.08)', backdropFilter: 'blur(8px)' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#AEAEB2', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
        What Unit will build for you
      </div>
      {days.map((acts, di) => (
        <div key={di} style={{ marginBottom: di < days.length - 1 ? 10 : 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6E6E73', marginBottom: 5 }}>Day {di + 1}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {acts.map((a, ai) => {
              const slotColor = timeSlotColor(a.time);
              return (
                <div key={ai} style={{ flex: 1, padding: '7px 8px', borderRadius: 10,
                  background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.07)' }}>
                  <div style={{ width: 20, height: 20, borderRadius: 6, background: `${slotColor}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
                    <Sun size={10} color={slotColor} strokeWidth={2} />
                  </div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#AEAEB2', marginBottom: 2 }}>{a.time}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#1D1D1F', lineHeight: 1.3 }}>{a.activity}</div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {nights > 3 && (
        <div style={{ fontSize: 10, fontWeight: 600, color: '#AEAEB2', marginTop: 8, textAlign: 'center' }}>
          + {nights - 3} more days auto-planned by Unit AI
        </div>
      )}
    </motion.div>
  );
}

// ── F10 new: Conflict Alert ───────────────────────────────────────────────────

function ConflictAlert({ conflicts, onContinue, onBack }: {
  conflicts: Conflict[]; onContinue: () => void; onBack: () => void;
}) {
  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
      style={{ position:'fixed', inset:0, zIndex:9998, display:'flex', alignItems:'center', justifyContent:'center',
        background:'rgba(0,0,0,0.35)', backdropFilter:'blur(12px)' }}>
      <motion.div initial={{scale:0.9,y:20}} animate={{scale:1,y:0}} transition={SPRING}
        style={{ width:'100%', maxWidth:380, margin:24, padding:'28px 26px',
          borderRadius:24, background:'rgba(255,255,255,0.96)',
          boxShadow:'0 24px 60px rgba(0,0,0,0.18)' }}>
        <div style={{ fontSize:18, fontWeight:900, color:'#1D1D1F', letterSpacing:'-0.03em', marginBottom:6 }}>
          Before you continue
        </div>
        <div style={{ fontSize:13, color:'#6E6E73', marginBottom:16 }}>
          Unit noticed a few things worth knowing:
        </div>
        {conflicts.map(c => (
          <div key={c.type} style={{ padding: '11px 13px', borderRadius: 12, marginBottom: 8,
            background: c.warn ? 'rgba(255,159,10,0.07)' : 'rgba(0,122,255,0.06)',
            border: `1px solid ${c.warn ? 'rgba(255,159,10,0.28)' : 'rgba(0,122,255,0.20)'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 800, color: c.warn ? '#FF9F0A' : AZURE, marginBottom: 3 }}>
              {c.warn
                ? <AlertTriangle size={12} color="#FF9F0A" strokeWidth={2.5} />
                : <Info          size={12} color={AZURE}    strokeWidth={2.5} />
              }
              {c.title}
            </div>
            <div style={{ fontSize: 11, fontWeight: 500, color: '#3C3C43' }}>{c.body}</div>
          </div>
        ))}
        <div style={{ display:'flex', gap:10, marginTop:20 }}>
          <motion.button whileHover={{scale:1.03}} whileTap={{scale:0.97}} onClick={onBack}
            style={{ flex:1, padding:'11px', borderRadius:12, cursor:'pointer', fontFamily:'inherit',
              background:'rgba(0,0,0,0.05)', border:'1.5px solid rgba(0,0,0,0.10)',
              fontSize:13, fontWeight:600, color:'#6E6E73' }}>
            Go back & adjust
          </motion.button>
          <motion.button whileHover={{scale:1.03}} whileTap={{scale:0.97}} onClick={onContinue}
            style={{ flex:1, padding:'11px', borderRadius:12, cursor:'pointer', fontFamily:'inherit',
              background:`linear-gradient(135deg,${AZURE},#5E5CE6)`, border:'none',
              fontSize:13, fontWeight:800, color:'#fff' }}>
            Continue anyway
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Step 0: Mode Selection (D1 — step trails) ──────────────────────────────────

function StepMode({ onSelect, onNLApply, onTemplate }: {
  onSelect: (m: TravelMode) => void;
  onNLApply: (p: ParsedTrip) => void;
  onTemplate: (t: TripTemplate) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 900, color: '#1D1D1F', letterSpacing: '-0.035em', marginBottom: 4 }}>
          What are you planning?
        </div>
        <div style={{ fontSize: 13, color: '#6E6E73', letterSpacing: '-0.01em' }}>
          Choose a mode — or describe your trip below
        </div>
      </div>

      <NLQuickFill onApply={onNLApply} />
      <TripTemplates onApply={onTemplate} />

      <div style={{ fontSize:10, fontWeight:700, color:'#AEAEB2', letterSpacing:'0.06em', textTransform:'uppercase' }}>
        Or choose manually
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 9 }}>
        {MODES.map((m, mIdx) => {
          const Icon = m.icon;
          return (
            <motion.button
              key={m.id}
              initial={{ opacity: 0, y: 10, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28, delay: mIdx * 0.055 }}
              whileHover={{ scale: 1.03, y: -2, boxShadow: `0 8px 24px rgba(${m.rgb},0.20)` }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onSelect(m)}
              style={{
                padding: '13px 13px 11px', borderRadius: 16,
                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                background: `rgba(${m.rgb}, 0.06)`,
                border: `1.5px solid rgba(${m.rgb}, 0.18)`,
              }}
            >
              {/* Icon + label */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `rgba(${m.rgb}, 0.18)` }}>
                  <Icon size={14} color={m.color} strokeWidth={2} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#1D1D1F', letterSpacing: '-0.02em' }}>{m.label}</span>
              </div>

              <div style={{ fontSize: 10, fontWeight: 500, color: '#6E6E73', letterSpacing: '-0.01em', lineHeight: 1.4, marginBottom: 10 }}>
                {m.subtitle}
              </div>

              {/* D1: Step trail */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                {m.steps.map((sid, i) => {
                  const SIcon = STEP_ICONS[sid];
                  return (
                    <div key={sid} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <div style={{ width: 18, height: 18, borderRadius: 5, background: `rgba(${m.rgb},0.14)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <SIcon size={10} color={m.color} strokeWidth={2} />
                      </div>
                      {i < m.steps.length - 1 && (
                        <div style={{ width: 8, height: 1, background: `rgba(${m.rgb},0.25)`, borderRadius: 1 }} />
                      )}
                    </div>
                  );
                })}
                <span style={{ fontSize: 9, fontWeight: 600, color: `rgba(${m.rgb},0.7)`, marginLeft: 4 }}>
                  {m.steps.length} step{m.steps.length !== 1 ? 's' : ''}
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// ── Step: Destination (with D4 locked chip + F1 intel card) ───────────────────

function StepDestination({ value, onChange, origin, onOrigin, showOrigin = false, color, rgb }: {
  value: string; onChange: (v: string) => void;
  origin?: string; onOrigin?: (v: string) => void;
  showOrigin?: boolean;
  color: string; rgb: string;
}) {
  const [input, setInput] = useState(value);
  const intel = getDestIntel(input);
  const update = (v: string) => { setInput(v); onChange(v); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <GradientTitle color={color} subtitle="Enter a city, country or region">
        Where are you going?
      </GradientTitle>

      {/* D4: Destination input FIRST — always the primary field */}
      {showOrigin && (
        <div style={{ fontSize: 10, fontWeight: 700, color: '#6E6E73', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Flying to</div>
      )}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderRadius: 16,
        background: 'rgba(255,255,255,0.90)',
        border: `2px solid ${intel ? `rgba(${rgb},0.35)` : input ? `rgba(${rgb},0.20)` : 'rgba(0,0,0,0.10)'}`,
        boxShadow: input ? `0 0 0 4px rgba(${rgb},0.07)` : 'none',
        transition: 'all 0.18s ease',
      }}>
        {intel
          ? <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1 }}>{intel.flag}</span>
          : <MapPin size={18} color={input ? color : '#AEAEB2'} strokeWidth={2} />
        }
        <input
          value={input}
          onChange={e => update(e.target.value)}
          placeholder="e.g. Paris, Japan, Bali…"
          autoFocus
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 16, fontWeight: 700, color: '#1D1D1F', letterSpacing: '-0.02em', fontFamily: 'inherit' }}
        />
        {intel && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 100, background: `rgba(${rgb},0.12)`, color, flexShrink: 0 }}>
            ✓ Recognized
          </span>
        )}
      </div>

      {/* F1: Destination Intelligence Card */}
      <AnimatePresence>
        {intel && <DestIntelCard dest={input} color={color} rgb={rgb} />}
      </AnimatePresence>

      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#AEAEB2', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 9 }}>Popular destinations</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {POPULAR.map(city => {
            const d = DEST_INTEL[city];
            const active = input.toLowerCase() === city.toLowerCase();
            return (
              <motion.button
                key={city}
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                onClick={() => update(city)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '6px 12px', borderRadius: 100, cursor: 'pointer', fontFamily: 'inherit',
                  background: active ? `rgba(${rgb},0.10)` : 'rgba(0,0,0,0.04)',
                  border: `1.5px solid ${active ? `rgba(${rgb},0.30)` : 'rgba(0,0,0,0.08)'}`,
                  fontSize: 12, fontWeight: active ? 800 : 500,
                  color: active ? color : '#3C3C43', transition: 'all 0.15s ease',
                }}
              >
                {d && <span style={{ fontSize: 12 }}>{d.flag}</span>}
                {city}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Origin city field — secondary, at bottom */}
      {showOrigin && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#AEAEB2', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Flying from (optional)</div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', borderRadius: 14,
            background: 'rgba(255,255,255,0.75)',
            border: `1.5px solid ${origin ? `rgba(${rgb},0.20)` : 'rgba(0,0,0,0.08)'}`,
            transition: 'all 0.18s ease',
          }}>
            <Plane size={15} color={origin ? color : '#AEAEB2'} strokeWidth={2} />
            <input
              value={origin ?? ''}
              onChange={e => onOrigin?.(e.target.value)}
              placeholder="Departure city or airport code"
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, fontWeight: 600, color: '#1D1D1F', letterSpacing: '-0.01em', fontFamily: 'inherit' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Step: Dates (with F4 seasonal signal) ────────────────────────────────────

function StepDates({ startDate, endDate, onChange, dest, color, rgb }: {
  startDate: string; endDate: string;
  onChange: (s: string, e: string) => void;
  dest: string; color: string; rgb: string;
}) {
  const nights = diffDays(startDate, endDate);
  const dateError = startDate && endDate && endDate < startDate
    ? 'Return date must be after departure date'
    : startDate && endDate && endDate === startDate
    ? 'Same-day trips aren\'t supported — choose at least 1 night'
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <GradientTitle color={color} subtitle="Select your departure and return dates">
        When are you traveling?
      </GradientTitle>

      {/* F4: Seasonal signal + Price signal */}
      {dest && <SeasonalSignal dest={dest} />}
      {dest && <PriceSignal dest={dest} color={color} rgb={rgb} />}

      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6E6E73', marginBottom: 6, letterSpacing: '-0.01em' }}>DEPARTURE</div>
          <div style={{ padding: '12px 14px', borderRadius: 14, background: 'rgba(255,255,255,0.90)', border: `2px solid ${startDate ? `rgba(${rgb},0.25)` : 'rgba(0,0,0,0.10)'}`, boxShadow: startDate ? `0 0 0 4px rgba(${rgb},0.06)` : 'none', transition: 'all 0.18s ease' }}>
            <input type="date" value={startDate} min={new Date().toISOString().split('T')[0]} onChange={e => onChange(e.target.value, endDate)}
              style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 15, fontWeight: 700, color: '#1D1D1F', fontFamily: 'inherit', width: '100%', cursor: 'pointer' }} />
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6E6E73', marginBottom: 6, letterSpacing: '-0.01em' }}>RETURN</div>
          <div style={{ padding: '12px 14px', borderRadius: 14, background: 'rgba(255,255,255,0.90)', border: `2px solid ${endDate ? 'rgba(94,92,230,0.25)' : 'rgba(0,0,0,0.10)'}`, boxShadow: endDate ? '0 0 0 4px rgba(94,92,230,0.06)' : 'none', transition: 'all 0.18s ease' }}>
            <input type="date" value={endDate} min={startDate || new Date().toISOString().split('T')[0]} onChange={e => onChange(startDate, e.target.value)}
              style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 15, fontWeight: 700, color: '#1D1D1F', fontFamily: 'inherit', width: '100%', cursor: 'pointer' }} />
          </div>
        </div>
      </div>

      {/* Date error */}
      <AnimatePresence>
        {dateError && (
          <motion.div
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{
              padding: '9px 14px', borderRadius: 12,
              background: 'rgba(255,69,58,0.07)', border: '1.5px solid rgba(255,69,58,0.25)',
              fontSize: 12, fontWeight: 600, color: '#FF453A', letterSpacing: '-0.01em',
            }}
          >
            {dateError}
          </motion.div>
        )}
      </AnimatePresence>

      {nights > 0 && !dateError && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          style={{ padding: '12px 16px', borderRadius: 14, background: `rgba(${rgb},0.07)`, border: `1.5px solid rgba(${rgb},0.20)`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <span style={{ fontSize: 24, fontWeight: 900, color, letterSpacing: '-0.04em' }}>{nights}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color }}>night{nights !== 1 ? 's' : ''} · {nights + 1} day{nights + 1 !== 1 ? 's' : ''}</span>
        </motion.div>
      )}

      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#AEAEB2', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 9 }}>Quick select</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[3, 5, 7, 10, 14].map(n => {
            const s = new Date(); s.setDate(s.getDate() + 7);
            const e = new Date(s); e.setDate(e.getDate() + n);
            const sStr = s.toISOString().split('T')[0];
            const eStr = e.toISOString().split('T')[0];
            return (
              <motion.button key={n} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                onClick={() => onChange(sStr, eStr)}
                style={{ padding: '6px 13px', borderRadius: 100, cursor: 'pointer', fontFamily: 'inherit', background: nights === n ? `rgba(${rgb},0.10)` : 'rgba(0,0,0,0.04)', border: `1.5px solid ${nights === n ? `rgba(${rgb},0.28)` : 'rgba(0,0,0,0.08)'}`, fontSize: 12, fontWeight: nights === n ? 800 : 500, color: nights === n ? color : '#3C3C43', transition: 'all 0.15s ease' }}>
                {n} nights
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Step: Travelers (with D3 avatars + F3 DNA capture) ────────────────────────

function StepTravelers({ count, styles, dnaAnswers, travelerTags, onCount, onStyles, onDNA, onTag, color, rgb }: {
  count: number; styles: string[]; dnaAnswers: Record<string, string>; travelerTags: string[];
  onCount: (n: number) => void; onStyles: (s: string[]) => void;
  onDNA: (qId: string, aId: string) => void; onTag: (id: string) => void;
  color: string; rgb: string;
}) {
  const setCount = (n: number) => onCount(Math.max(1, Math.min(8, n)));
  const toggleStyle = (id: string) => {
    onStyles(styles.includes(id) ? styles.filter(s => s !== id) : [...styles, id]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <GradientTitle color={color} subtitle="Set the number of travelers and your preferences">
        Who&apos;s coming?
      </GradientTitle>

      {/* Counter + D3 avatar row */}
      <div style={{ padding: '18px 20px', borderRadius: 18, background: 'rgba(255,255,255,0.85)', border: '1.5px solid rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            onClick={() => setCount(count - 1)} disabled={count <= 1}
            style={{ width: 40, height: 40, borderRadius: '50%', background: count <= 1 ? 'rgba(0,0,0,0.04)' : `rgba(${rgb},0.09)`, border: `1.5px solid ${count <= 1 ? 'rgba(0,0,0,0.08)' : `rgba(${rgb},0.25)`}`, cursor: count <= 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Minus size={16} color={count <= 1 ? '#AEAEB2' : color} strokeWidth={2.5} />
          </motion.button>

          <div style={{ textAlign: 'center' }}>
            <motion.div
              key={count}
              initial={{ scale: 1.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              style={{ fontSize: 44, fontWeight: 900, color: '#1D1D1F', letterSpacing: '-0.05em', lineHeight: 1 }}
            >
              {count}
            </motion.div>
            <div style={{ fontSize: 12, color: '#6E6E73', fontWeight: 500, marginTop: 3 }}>traveler{count !== 1 ? 's' : ''}</div>
          </div>

          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            onClick={() => setCount(count + 1)} disabled={count >= 8}
            style={{ width: 40, height: 40, borderRadius: '50%', background: count >= 8 ? 'rgba(0,0,0,0.04)' : `rgba(${rgb},0.09)`, border: `1.5px solid ${count >= 8 ? 'rgba(0,0,0,0.08)' : `rgba(${rgb},0.25)`}`, cursor: count >= 8 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Plus size={16} color={count >= 8 ? '#AEAEB2' : color} strokeWidth={2.5} />
          </motion.button>
        </div>

        {/* D3: Avatar row */}
        <AvatarRow count={count} color={color} />
      </div>

      {/* Trip style */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#AEAEB2', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 9 }}>Trip style</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 7 }}>
          {TRIP_STYLES.map(({ id, label, icon: Icon }) => {
            const active = styles.includes(id);
            return (
              <motion.button key={id} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={() => toggleStyle(id)}
                style={{ padding: '11px 8px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, background: active ? `rgba(${rgb},0.09)` : 'rgba(0,0,0,0.03)', border: `1.5px solid ${active ? `rgba(${rgb},0.28)` : 'rgba(0,0,0,0.08)'}`, transition: 'all 0.15s ease' }}>
                <Icon size={16} color={active ? color : '#6E6E73'} strokeWidth={active ? 2.5 : 2} />
                <span style={{ fontSize: 10, fontWeight: active ? 800 : 500, color: active ? color : '#3C3C43' }}>{label}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* F3: DNA Quick Capture */}
      <DNACapture answers={dnaAnswers} onAnswer={onDNA} />

      {/* F7: DNA Radar */}
      <DNARadar answers={dnaAnswers} color={color} rgb={rgb} />

      {/* F8: Traveler tags */}
      <TravelerTags selected={travelerTags} onToggle={onTag} />
    </div>
  );
}

// ── Step: Budget (with F2 tier visualizer) ────────────────────────────────────

function StepBudget({ budget, onBudget, dest, nights, startDate, color, rgb }: {
  budget: number; onBudget: (n: number) => void;
  dest: string; nights: number; startDate: string;
  color: string; rgb: string;
}) {
  const PRESETS = [1000, 2500, 5000, 10000, 20000];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <GradientTitle color={color} subtitle="Total trip budget for all travelers combined">
        What&apos;s your budget?
      </GradientTitle>

      <div style={{ padding: '18px', borderRadius: 18, background: 'rgba(255,255,255,0.88)', border: `2px solid ${budget ? 'rgba(48,209,88,0.28)' : 'rgba(0,0,0,0.10)'}`, boxShadow: budget ? '0 0 0 4px rgba(48,209,88,0.07)' : 'none', transition: 'all 0.18s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 28, fontWeight: 900, color: '#30D158', flexShrink: 0 }}>$</span>
          <input
            type="number" value={budget || ''} onChange={e => onBudget(parseInt(e.target.value) || 0)}
            placeholder="0" autoFocus
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 36, fontWeight: 900, color: '#1D1D1F', letterSpacing: '-0.05em', fontFamily: 'inherit', width: 0 }}
          />
        </div>
      </div>

      {/* F9: Smart budget warning (only when budget is set) */}
      {budget > 0 && <SmartBudgetWarning dest={dest} nights={nights} budget={budget} startDate={startDate} color={color} rgb={rgb} />}

      {/* F6: Budget allocation — shown when budget is set */}
      {budget > 0 && <BudgetAllocationBar budget={budget} />}

      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#AEAEB2', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 9 }}>Quick presets</div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {PRESETS.map(p => (
            <motion.button key={p} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
              onClick={() => onBudget(p)}
              style={{ padding: '6px 13px', borderRadius: 100, cursor: 'pointer', fontFamily: 'inherit', background: budget === p ? 'rgba(48,209,88,0.10)' : 'rgba(0,0,0,0.04)', border: `1.5px solid ${budget === p ? 'rgba(48,209,88,0.28)' : 'rgba(0,0,0,0.08)'}`, fontSize: 12, fontWeight: budget === p ? 800 : 500, color: budget === p ? '#30D158' : '#3C3C43', transition: 'all 0.15s ease' }}>
              ${p.toLocaleString()}
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SetupPage() {
  const router          = useRouter();
  const setupTrip       = useTravelEngine(s => s.setupTrip);
  const addDay          = useTravelEngine(s => s.addDay);
  const completeDNA     = useTravelEngine(s => s.completeTravelDNA);

  // Flow state
  const [mode,           setMode]          = useState<TravelMode | null>(null);
  const [step,           setStep]          = useState(0);
  const [isLaunching,    setIsLaunching]   = useState(false);
  const [showConflict,   setShowConflict]  = useState(false);
  const [particleTick,   setParticleTick]  = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  // Scroll content to top whenever step changes
  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [step]);

  // Form state
  const [dest,           setDest]          = useState('');
  const [origin,         setOrigin]        = useState('');
  const [startDate,      setStartDate]     = useState('');
  const [endDate,        setEndDate]       = useState('');
  const [travelerCount,  setTravelerCount] = useState(2);
  const [travConfirmed,  setTravConfirmed] = useState(false);
  const [tripStyles,     setTripStyles]    = useState<string[]>([]);
  const [dnaAnswers,     setDnaAnswers]    = useState<Record<string,string>>({});
  const [travelerTags,   setTravelerTags]  = useState<string[]>([]);
  const [budget,         setBudget]        = useState(0);

  const nights         = diffDays(startDate, endDate);
  const currentStepId: StepId | null = mode && step > 0 ? mode.steps[step - 1] : null;
  const totalSteps     = mode ? mode.steps.length : 0;
  const isLastStep     = step === totalSteps;
  const isOptional     = currentStepId !== null && currentStepId !== 'destination';

  const datesInvalid = currentStepId === 'dates' && startDate && endDate && endDate <= startDate;
  const canContinue =
    step === 0 ? false :
    currentStepId === 'destination' ? dest.trim().length > 0 :
    datesInvalid ? false :
    true;

  const handleDNA = useCallback((qId: string, aId: string) => {
    setDnaAnswers(prev => ({ ...prev, [qId]: aId }));
  }, []);

  const handleTag = useCallback((id: string) => {
    setTravelerTags(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  }, []);

  const handleNLApply = useCallback((p: ParsedTrip) => {
    if (p.dest)          setDest(p.dest);
    if (p.travelerCount) setTravelerCount(p.travelerCount);
    if (p.budget)        setBudget(p.budget);
    if (p.startDate)     setStartDate(p.startDate);
    if (p.endDate)       setEndDate(p.endDate);
    if (p.styles)        setTripStyles(p.styles);
    const m = MODES.find(m => m.id === (p.modeId ?? 'full_trip')) ?? MODES[0];
    setMode(m);
    setStep(1);
  }, []);

  const handleTemplate = useCallback((t: TripTemplate) => {
    setDest(t.dest);
    setTravelerCount(t.travelerCount);
    setBudget(t.budget);
    setTripStyles(t.styles);
    setDnaAnswers(t.dna);
    const now = new Date(); now.setDate(now.getDate() + 30);
    const end = new Date(now); end.setDate(end.getDate() + t.nights);
    setStartDate(now.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
    const m = MODES.find(m => m.id === t.modeId) ?? MODES[0];
    setMode(m);
    setStep(1);
  }, []);

  const buildDNA = useCallback((): TravelDNA => {
    const pace     = dnaAnswers['pace'] ?? 'relaxed';
    const priority = dnaAnswers['priority'] ?? 'value';
    const vibe     = dnaAnswers['vibe'] ?? 'discover';
    return {
      paceIndex:         pace === 'packed' ? 0.85 : 0.30,
      culinaryAffinity:  vibe === 'social' ? 0.80 : 0.45,
      accommodationTier: priority === 'experience' ? 0.80 : 0.35,
      experienceWeight:  vibe === 'discover' ? 0.75 : 0.50,
      flexibilityScore:  pace === 'relaxed' ? 0.80 : 0.40,
      spendingCurve:     priority === 'experience' ? 'front-loaded' : 'uniform',
      diningSelections:  tripStyles.filter(s => s === 'food' || s === 'luxury'),
      activitySelections:tripStyles.filter(s => s === 'adventure' || s === 'culture'),
    };
  }, [dnaAnswers, tripStyles]);

  const executeLaunch = useCallback(() => {
    // Signal the destination page to show a welcome banner
    sessionStorage.setItem('unitravel-welcome', dest ? `${dest} Trip` : (mode?.label ?? 'Your Trip'));
    router.push(mode?.targetZone ?? '/zone/management');
  }, [router, mode, dest]);

  const finish = useCallback(() => {
    const travelers = Array.from({ length: travConfirmed ? travelerCount : 0 }, (_, i) => `Traveler ${i + 1}`);

    setupTrip({
      title:       dest ? `${dest} Trip` : mode!.label,
      travelers,
      startDate,
      endDate,
      nights,
      totalBudget: budget,
      origin:      origin.trim(),
    });

    if (nights > 0 && startDate && endDate) {
      const start = new Date(startDate);
      for (let i = 0; i <= nights; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        const day: EngineDay = {
          id:          `day-${i + 1}`,
          date:        d.toISOString().split('T')[0],
          dayNumber:   i + 1,
          destination: dest,
          entities:    [],
          budget:      budget > 0 ? Math.round(budget / (nights + 1)) : 0,
          weather:     { temp: 0, icon: '', condition: '' },
        };
        addDay(day);
      }
    }

    if (Object.keys(dnaAnswers).length > 0) {
      completeDNA(buildDNA());
    }

    setIsLaunching(true);
  }, [dest, startDate, endDate, travelerCount, travConfirmed, budget, nights, tripStyles, dnaAnswers, setupTrip, addDay, completeDNA, buildDNA, mode]);

  const advance = useCallback(() => {
    if (step < totalSteps) setStep(s => s + 1);
    else finish();
  }, [step, totalSteps, finish]);

  const handleContinue = () => {
    if (currentStepId === 'travelers') setTravConfirmed(true);
    setParticleTick(t => t + 1);
    if (isLastStep) {
      const conflicts = detectConflicts(dest, nights, budget, startDate);
      if (conflicts.length > 0) { setShowConflict(true); return; }
    }
    advance();
  };

  const handleSkip = () => { setParticleTick(t => t + 1); advance(); };

  const handleBack = () => {
    if (step === 1) { setMode(null); setStep(0); }
    else setStep(s => Math.max(0, s - 1));
  };

  const handleModeSelect = (m: TravelMode) => {
    setMode(m);
    setStep(1);
  };

  // D5: Card glow based on mode
  const cardGlow = mode
    ? `0 16px 56px rgba(0,0,0,0.09), 0 4px 16px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,1), 0 0 0 1.5px rgba(${mode.rgb},0.14), 0 0 40px rgba(${mode.rgb},0.10)`
    : '0 16px 56px rgba(0,0,0,0.09), 0 4px 16px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,1)';


  // NL quick-apply helper
  const applyNLAndLaunch = useCallback((text: string) => {
    const p = parseNL(text);
    if (p.dest)          setDest(p.dest);
    if (p.travelerCount) setTravelerCount(p.travelerCount);
    if (p.budget)        setBudget(p.budget);
    if (p.startDate)     setStartDate(p.startDate);
    if (p.endDate)       setEndDate(p.endDate);
    if (p.styles)        setTripStyles(p.styles);
  }, []);

  // NL query state (used in new single-screen UI)
  const [nlInput,   setNlInput]   = useState('');
  const [nlFocused, setNlFocused] = useState(false);
  const inputRef2 = useRef<HTMLInputElement>(null);

  // Live parse preview
  const livePreview = nlInput.length > 6 ? parseNL(nlInput) : null;

  // DNA toggles for quick capture
  const pace     = dnaAnswers['pace']     ?? '';
  const priority = dnaAnswers['priority'] ?? '';

  const handleLaunch = useCallback(() => {
    applyNLAndLaunch(nlInput);
    // Small delay so state updates propagate
    setTimeout(() => {
      const m = MODES[0]!;
      setMode(m);
      // Call finish logic inline
      const parsed   = nlInput.length > 6 ? parseNL(nlInput) : {};
      const destVal  = parsed.dest ?? dest;
      const scVal    = parsed.startDate ?? startDate;
      const ecVal    = parsed.endDate ?? endDate;
      const tcVal    = parsed.travelerCount ?? travelerCount;
      const bgVal    = parsed.budget ?? budget;
      const nightsVal = diffDays(scVal, ecVal);
      const travelers = Array.from({ length: tcVal > 0 ? tcVal : 2 }, (_, i) => `Traveler ${i + 1}`);

      setupTrip({ title: destVal ? `${destVal} Trip` : 'My Trip', travelers, startDate: scVal, endDate: ecVal, nights: nightsVal > 0 ? nightsVal : 7, totalBudget: bgVal, origin: '' });

      if (nightsVal > 0 && scVal && ecVal) {
        const start = new Date(scVal);
        for (let i = 0; i <= nightsVal; i++) {
          const d = new Date(start); d.setDate(d.getDate() + i);
          addDay({ id: `day-${i+1}`, date: d.toISOString().split('T')[0], dayNumber: i+1, destination: destVal, entities: [], budget: bgVal > 0 ? Math.round(bgVal / (nightsVal+1)) : 0, weather: { temp: 0, icon: '', condition: '' } });
        }
      }

      if (pace || priority) completeDNA(buildDNA());

      sessionStorage.setItem('unitravel-welcome', destVal ? `${destVal} Trip` : 'Your Trip');
      router.push(m.targetZone);
    }, 80);
  }, [nlInput, dest, startDate, endDate, travelerCount, budget, pace, priority, applyNLAndLaunch, setupTrip, addDay, completeDNA, buildDNA, router]);

  const canLaunch = nlInput.trim().length > 3 || dest.length > 0;

  return (
    <main style={{
      position: 'relative', width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden', padding: '20px',
    }}>
      {/* Ambient background */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 30% 20%, rgba(0,122,255,0.08) 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(94,92,230,0.06) 0%, transparent 60%)',
      }} />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        style={{
          width: '100%', maxWidth: 540,
          borderRadius: 28,
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(64px) saturate(220%)',
          WebkitBackdropFilter: 'blur(64px) saturate(220%)',
          border: '1px solid rgba(255,255,255,0.98)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.06), inset 0 1.5px 0 rgba(255,255,255,1)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Specular */}
        <div aria-hidden style={{ position: 'absolute', left: '6%', right: '6%', top: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,1) 25%, rgba(255,255,255,1) 75%, transparent)', pointerEvents: 'none', zIndex: 4 }} />

        {/* Header */}
        <div style={{ padding: '28px 32px 20px', textAlign: 'center' }}>
          <div style={{
            width: 52, height: 52, borderRadius: 16, margin: '0 auto 14px',
            background: 'linear-gradient(138deg, #007AFF 0%, #5E5CE6 52%, #BF5AF2 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 6px 24px rgba(0,122,255,0.36)',
          }}>
            <Sparkles size={22} color="#fff" strokeWidth={1.8} />
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#1D1D1F', letterSpacing: '-0.04em', lineHeight: 1.15 }}>
            Where are you going?
          </div>
          <div style={{ fontSize: 13, color: '#8E8E93', fontWeight: 500, marginTop: 6, letterSpacing: '-0.01em' }}>
            Tell Unit naturally — destination, dates, travelers, budget
          </div>
        </div>

        {/* NL Hero Input */}
        <div style={{ paddingInline: 24, paddingBottom: 4 }}>
          <motion.div
            animate={{ boxShadow: nlFocused ? '0 0 0 2.5px rgba(0,122,255,0.22), 0 6px 24px rgba(0,122,255,0.14)' : '0 2px 10px rgba(0,0,0,0.06)' }}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
              borderRadius: 18,
              background: nlFocused ? 'rgba(252,252,255,0.98)' : 'rgba(248,248,252,0.92)',
              border: `1.5px solid ${nlFocused ? 'rgba(0,122,255,0.30)' : 'rgba(0,0,0,0.08)'}`,
              transition: 'background 0.18s, border-color 0.18s',
            }}
          >
            <motion.div
              animate={{ color: nlFocused ? '#007AFF' : '#AEAEB2', scale: nlFocused ? 1 : 0.88 }}
              transition={{ duration: 0.16 }}
            >
              <Globe2 size={18} strokeWidth={2} style={{ display: 'block' }} />
            </motion.div>
            <input
              ref={inputRef2}
              value={nlInput}
              onChange={e => setNlInput(e.target.value)}
              onFocus={() => setNlFocused(true)}
              onBlur={() => setNlFocused(false)}
              onKeyDown={e => { if (e.key === 'Enter' && canLaunch) handleLaunch(); }}
              placeholder='"Paris for 7 nights in October, 2 people, $4000"'
              autoFocus
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                fontSize: 14.5, fontWeight: 500, color: '#1D1D1F',
                letterSpacing: '-0.018em', fontFamily: 'inherit',
              }}
            />
          </motion.div>
        </div>

        {/* Live parse preview */}
        <AnimatePresence>
          {livePreview && (livePreview.dest || livePreview.startDate || livePreview.travelerCount || livePreview.budget) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              style={{ overflow: 'hidden', paddingInline: 24, paddingTop: 10 }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {livePreview.dest && (
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: '#007AFF', background: 'rgba(0,122,255,0.09)', border: '1px solid rgba(0,122,255,0.20)', borderRadius: 100, padding: '4px 12px' }}>
                    {getDestIntel(livePreview.dest)?.flag ?? ''} {livePreview.dest}
                  </span>
                )}
                {livePreview.startDate && livePreview.endDate && (
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: '#5E5CE6', background: 'rgba(94,92,230,0.09)', border: '1px solid rgba(94,92,230,0.20)', borderRadius: 100, padding: '4px 12px' }}>
                    {diffDays(livePreview.startDate, livePreview.endDate)}n
                  </span>
                )}
                {livePreview.travelerCount && (
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: '#FF9F0A', background: 'rgba(255,159,10,0.09)', border: '1px solid rgba(255,159,10,0.20)', borderRadius: 100, padding: '4px 12px' }}>
                    {livePreview.travelerCount} {livePreview.travelerCount === 1 ? 'person' : 'people'}
                  </span>
                )}
                {livePreview.budget && livePreview.budget > 0 && (
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: '#30D158', background: 'rgba(48,209,88,0.09)', border: '1px solid rgba(48,209,88,0.20)', borderRadius: 100, padding: '4px 12px' }}>
                    ${livePreview.budget.toLocaleString()}
                  </span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick DNA */}
        <div style={{ paddingInline: 24, paddingTop: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#AEAEB2', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            Travel style <span style={{ fontWeight: 400 }}>(optional)</span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { qId: 'pace',     aId: 'packed',     label: 'Full schedule', sub: 'See everything', color: '#007AFF' },
              { qId: 'pace',     aId: 'relaxed',    label: 'Slow & easy',   sub: 'Soak it in',     color: '#5AC8FA' },
              { qId: 'priority', aId: 'experience', label: 'Best always',   sub: 'No compromises', color: '#FF9F0A' },
              { qId: 'priority', aId: 'value',      label: 'Smart value',   sub: 'Best for money', color: '#30D158' },
            ].map(opt => {
              const isActive = dnaAnswers[opt.qId] === opt.aId;
              return (
                <motion.button
                  key={opt.qId + opt.aId}
                  onClick={() => handleDNA(opt.qId, opt.aId)}
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '7px 14px', borderRadius: 100, cursor: 'pointer',
                    background: isActive ? `${opt.color}14` : 'rgba(0,0,0,0.04)',
                    border: `1.5px solid ${isActive ? `${opt.color}35` : 'rgba(0,0,0,0.07)'}`,
                    fontFamily: 'inherit', transition: 'all 0.16s ease',
                  }}
                >
                  <span style={{ fontSize: 11.5, fontWeight: isActive ? 700 : 500, color: isActive ? opt.color : '#48484A', letterSpacing: '-0.01em' }}>
                    {opt.label}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* CTA */}
        <div style={{ padding: '20px 24px 28px' }}>
          <motion.button
            onClick={handleLaunch}
            disabled={!canLaunch}
            whileHover={canLaunch ? { scale: 1.02, boxShadow: '0 10px 36px rgba(0,122,255,0.38)' } : {}}
            whileTap={canLaunch ? { scale: 0.98 } : {}}
            animate={{ opacity: canLaunch ? 1 : 0.44 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            style={{
              width: '100%', padding: '14px 28px', borderRadius: 16, border: 'none',
              background: canLaunch ? 'linear-gradient(135deg, #007AFF 0%, #5E5CE6 100%)' : 'rgba(0,0,0,0.08)',
              color: 'white', fontSize: 15, fontWeight: 800, letterSpacing: '-0.02em',
              cursor: canLaunch ? 'pointer' : 'default', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              boxShadow: canLaunch ? '0 6px 24px rgba(0,122,255,0.32), inset 0 1px 0 rgba(255,255,255,0.22)' : 'none',
              transition: 'background 0.22s',
            }}
          >
            <Sparkles size={16} color="rgba(255,255,255,0.9)" strokeWidth={2} />
            Start planning
            <ArrowRight size={16} color="rgba(255,255,255,0.9)" strokeWidth={2.5} />
          </motion.button>

          {/* Or — back to home */}
          <div style={{ textAlign: 'center', marginTop: 14 }}>
            <Link href="/" style={{ fontSize: 12, color: '#AEAEB2', fontWeight: 500, textDecoration: 'none', letterSpacing: '-0.01em' }}>
              ← Back to home
            </Link>
          </div>
        </div>
      </motion.div>

      {/* Launch overlay */}
      <AnimatePresence>
        {isLaunching && mode && <LaunchOverlay mode={mode} onDone={executeLaunch} />}
      </AnimatePresence>
    </main>
  );
}
