// DNAExtractor.ts — AI chat stream interceptor
// Parses user messages for travel identity signals and maps them to UserDNAProfile mutations.
// Called on every outgoing user message before it reaches the AI API.

import type { DNATrait, UserDNAProfile, BudgetTier } from '@/store/useUserDNA';

// ── Mutation record ───────────────────────────────────────────────────────────

export interface DNAMutation {
  trait: DNATrait;
  value: UserDNAProfile[DNATrait];
}

// ── Pattern library ───────────────────────────────────────────────────────────

const LOW_COST_CARRIERS = ['Ryanair', 'EasyJet', 'Spirit', 'Wizz', 'Frontier', 'Allegiant', 'Vueling', 'Norwegian'];
const LUXURY_CARRIERS   = ['Emirates', 'Singapore Airlines', 'Qatar Airways', 'Cathay Pacific', 'Lufthansa', 'Swiss', 'British Airways'];
const FULL_SERVICE      = ['Delta', 'United', 'American', 'Air France', 'KLM', 'Etihad', 'Turkish'];

const DIETARY_KEYWORDS: Array<[RegExp, string]> = [
  [/\bvegan\b/i,           'vegan'],
  [/\bvegetarian\b/i,      'vegetarian'],
  [/\bhalal\b/i,           'halal'],
  [/\bkosher\b/i,          'kosher'],
  [/\bgluten[\s-]free\b/i, 'gluten-free'],
  [/\bnut[\s-]allerg/i,    'nut-allergy'],
  [/\blactose[\s-]intol/i, 'lactose-intolerant'],
  [/\bno\s+pork\b/i,       'no-pork'],
  [/\bno\s+shellfish\b/i,  'no-shellfish'],
  [/\bketo\b/i,            'keto'],
];

const BUDGET_SIGNALS: Array<[RegExp, BudgetTier]> = [
  [/\bultra[\s-]lux|private\s+jet|penthouse|presidential\s+suite/i, 'Ultra-Luxury'],
  [/\bfive[\s-]star|luxury\s+(hotel|resort|flight)|first[\s-]class/i, 'Luxury'],
  [/\bbusiness[\s-]class|premium\s+economy|boutique\s+hotel/i, 'Premium'],
  [/\bbusiness\s+(trip|travel)|executive\b/i, 'Business'],
  [/\bbudget[\s-]?travel|best[\s-]deal|cheapest|save\s+money/i, 'Smart-Value'],
  [/\bhostel|backpack|tight\s+budget|lowest\s+price/i, 'Economy'],
];

const LAYOVER_PATTERNS: Array<[RegExp, number]> = [
  [/\bno[\s-]stop|direct\s+only|non[\s-]stop/i,     0],
  [/\bmax\s+(\d+)\s+hour/i,                          -1], // dynamic — captured below
  [/\bunder\s+(\d+)\s+hour/i,                        -1],
  [/\bless\s+than\s+(\d+)\s+hour/i,                  -1],
  [/\bshort\s+layover/i,                              2],
  [/\bdont?\s+mind\s+(long\s+)?layover/i,            99],
];

const SEAT_PATTERNS: Array<[RegExp, UserDNAProfile['seatPreference']]> = [
  [/\bwindow\s+seat|by\s+the\s+window/i, 'window'],
  [/\baisle\s+seat|aisle\s+side/i,       'aisle'],
  [/\bmiddle\s+seat/i,                   'middle'],
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function matchDynamic(text: string, pattern: RegExp): number | null {
  const m = text.match(pattern);
  return m?.[1] ? parseInt(m[1]!, 10) : null;
}

// ── Core extractor ────────────────────────────────────────────────────────────

export function extractDNAMutations(message: string): DNAMutation[] {
  const mutations: DNAMutation[] = [];
  const lower = message.toLowerCase();

  // ── Banned low-cost carriers ───────────────────────────────────────────────
  const banLCC =
    /\b(never|don'?t|hate|avoid|no|won'?t)\s+(fly|use|book|take)\s+(low[\s-]cost|budget[\s-]airline|lcc|cheap[\s-]airline)/i;
  if (banLCC.test(message)) {
    mutations.push({ trait: 'bannedAirlines', value: LOW_COST_CARRIERS });
  }

  // ── Specific airline bans ──────────────────────────────────────────────────
  const allCarriers = [...LOW_COST_CARRIERS, ...LUXURY_CARRIERS, ...FULL_SERVICE];
  for (const carrier of allCarriers) {
    const banPattern = new RegExp(
      `\\b(never|don'?t|avoid|hate|no|won'?t)\\s+[a-z ]{0,20}${carrier}\\b`, 'i',
    );
    if (banPattern.test(message)) {
      mutations.push({ trait: 'bannedAirlines', value: [carrier] });
    }
  }

  // ── Preferred luxury carriers ──────────────────────────────────────────────
  const prefLux = /\b(always|only|prefer|love|stick to)\s+(fly|use|book)\s+(first[\s-]class|business[\s-]class|luxury)/i;
  if (prefLux.test(message)) {
    mutations.push({ trait: 'preferredAirlines', value: LUXURY_CARRIERS.slice(0, 4) });
  }

  // ── Specific airline preferences ──────────────────────────────────────────
  for (const carrier of allCarriers) {
    const prefPattern = new RegExp(
      `\\b(always|only|prefer|love)\\s+[a-z ]{0,20}${carrier}\\b`, 'i',
    );
    if (prefPattern.test(message)) {
      mutations.push({ trait: 'preferredAirlines', value: [carrier] });
    }
  }

  // ── Budget tier ───────────────────────────────────────────────────────────
  for (const [pattern, tier] of BUDGET_SIGNALS) {
    if (pattern.test(message)) {
      mutations.push({ trait: 'budgetTier', value: tier });
      break; // take first match only
    }
  }

  // ── Dietary restrictions ──────────────────────────────────────────────────
  for (const [pattern, label] of DIETARY_KEYWORDS) {
    if (pattern.test(message)) {
      mutations.push({ trait: 'dietaryRestrictions', value: [label] });
    }
  }

  // ── Max layover hours ─────────────────────────────────────────────────────
  if (/\bno[\s-]stop|direct\s+only|non[\s-]stop/i.test(message)) {
    mutations.push({ trait: 'maxLayoverHours', value: 0 });
  } else {
    const dynamicHours =
      matchDynamic(message, /\bmax\s+(\d+)\s+hour/i) ??
      matchDynamic(message, /\bunder\s+(\d+)\s+hour/i) ??
      matchDynamic(message, /\bless\s+than\s+(\d+)\s+hour/i);
    if (dynamicHours !== null) {
      mutations.push({ trait: 'maxLayoverHours', value: dynamicHours });
    } else if (/\bshort\s+layover/i.test(message)) {
      mutations.push({ trait: 'maxLayoverHours', value: 2 });
    } else if (/\bdont?\s+mind\s+(long\s+)?layover/i.test(message)) {
      mutations.push({ trait: 'maxLayoverHours', value: 99 });
    }
  }

  // ── Seat preference ───────────────────────────────────────────────────────
  for (const [pattern, pref] of SEAT_PATTERNS) {
    if (pattern.test(message)) {
      mutations.push({ trait: 'seatPreference', value: pref });
      break;
    }
  }

  // ── Interests ────────────────────────────────────────────────────────────
  const interestMap: Array<[RegExp, string]> = [
    [/\beach|beach(?:es)?|swimming|surf/i, 'beach'],
    [/\bcity[\s-]hop|urban|metropolis/i,   'city'],
    [/\bmuseum|historic|culture|art\s+gallery/i, 'culture'],
    [/\bhike|trek|climb|adventure|extreme/i, 'adventure'],
    [/\bfoodie|michelin|fine\s+dining|cuisine/i, 'food'],
    [/\bnightclub|nightlife|bar\s+scene|party/i, 'nightlife'],
    [/\bspa|yoga|wellness|retreat|meditation/i, 'wellness'],
    [/\bsport|golf|ski|diving|surfing/i, 'sports'],
  ];
  for (const [pattern, interest] of interestMap) {
    if (pattern.test(lower)) {
      mutations.push({ trait: 'interests', value: [interest] });
    }
  }

  // Deduplicate trait mutations — keep last value per trait
  const seen = new Map<DNATrait, DNAMutation>();
  for (const m of mutations) {
    seen.set(m.trait, m);
  }
  return Array.from(seen.values());
}

// ── Apply to store ────────────────────────────────────────────────────────────

export function applyDNAMutations(
  mutations:  DNAMutation[],
  mutateDNA: (trait: DNATrait, value: UserDNAProfile[DNATrait]) => void,
): void {
  for (const { trait, value } of mutations) {
    mutateDNA(trait, value);
  }
}
