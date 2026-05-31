// LLM output → DraggableEntity constructor
// Intercepts AI chat responses and extracts structured travel entities

export type EntityCategory = 'flight' | 'hotel' | 'restaurant' | 'activity' | 'transport';

export interface ParsedEntity {
  id:           string;
  category:     EntityCategory;
  title:        string;
  subtitle:     string;
  price:        number;
  currency:     'USD';
  time?:        string;
  duration?:    string;
  rating?:      number;
  location?:    string;
  destination?: string;
  tags:         string[];
  aiConfidence: number;
  rawText:      string;
  sourceSpan:   [number, number]; // char offsets in original LLM output
}

export interface ParseResult {
  entities:      ParsedEntity[];
  parsedAt:      number;
  inputLength:   number;
  hasEntities:   boolean;
  remainingText: string; // LLM output with entity spans removed
}

// ── Pattern registry ─────────────────────────────────────────────────────────

interface EntityPattern {
  category:  EntityCategory;
  patterns:  RegExp[];
  extractor: (match: RegExpMatchArray, fullText: string) => Partial<ParsedEntity>;
}

// Currency extraction
const PRICE_RE = /\$\s*([\d,]+(?:\.\d{2})?)/;
const RATING_RE = /(\d(?:\.\d)?)\s*(?:star|★|\/5|\s*stars?)/i;
const TIME_RE   = /\b(\d{1,2}:\d{2}(?:\s*[APap][Mm])?)\b/;

function extractPrice(text: string): number | undefined {
  const m = text.match(PRICE_RE);
  return m ? parseFloat(m[1].replace(/,/g, '')) : undefined;
}

function extractRating(text: string): number | undefined {
  const m = text.match(RATING_RE);
  return m ? parseFloat(m[1]) : undefined;
}

function extractTime(text: string): string | undefined {
  const m = text.match(TIME_RE);
  return m ? m[1] : undefined;
}

function extractDestination(text: string): string | undefined {
  const destinations = ['Mexico City', 'Tulum', 'Riviera Maya', 'Cabo San Lucas', 'Cancun', 'Playa del Carmen', 'Oaxaca'];
  return destinations.find(d => text.toLowerCase().includes(d.toLowerCase()));
}

function mkId(): string {
  return `parsed-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const ENTITY_PATTERNS: EntityPattern[] = [
  // ── FLIGHTS ─────────────────────────────────────────────────────────────
  {
    category: 'flight',
    patterns: [
      /(?:found|there'?s?|book|booked?|I(?:'ve)? (?:found|got)|try|check out?)\s+(?:a|an|the)?\s*(?:flight|connecting flight|direct flight|non-?stop)[^.!?]{0,120}/gi,
      /(?:flies?|departing|arriving|flight\s+\w+)\s+(?:from|to)\s+\w[^.!?]{0,100}/gi,
      /(?:business|first|economy)\s+class[^.!?]{0,120}/gi,
    ],
    extractor: (match, fullText) => {
      const text    = match[0];
      const price   = extractPrice(text) || extractPrice(fullText.slice(match.index! - 50, match.index! + 200));
      const airline = text.match(/\b(?:El Al|AeroMéxico|Aeromexico|Iberia|Lufthansa|Delta|United|American|Latam)\b/i)?.[0];
      const route   = text.match(/\b([A-Z]{3})\s*(?:→|->|to)\s*([A-Z]{3})\b/)?.[0];
      const cls     = text.match(/\b(business|first|economy|premium)\b/i)?.[1];
      return {
        title:    airline ? `${airline}${route ? ` · ${route}` : ''}` : 'Flight',
        subtitle: [cls ? `${cls.charAt(0).toUpperCase() + cls.slice(1)} Class` : '', route || ''].filter(Boolean).join(' · '),
        price:    price ?? 0,
        tags:     [cls || 'Economy', 'Flight'].filter(Boolean),
      };
    },
  },

  // ── HOTELS ──────────────────────────────────────────────────────────────
  {
    category: 'hotel',
    patterns: [
      /(?:found|recommend|suggest|book|staying at|check(?:ing)? in(?:to)?|property|suite|room at)\s+(?:the\s+)?(?:[A-Z][a-zA-Z&' ]+(?:Hotel|Resort|Spa|Mayakoba|Palmilla|Seasons|Ritz|Azulik|Rosewood|Four Seasons|One&Only)[^.!?]{0,80})/g,
      /(?:[A-Z][a-zA-Z&' ]+(?:Hotel|Resort|Spa|Boutique|Villa|Hacienda))[^.!?]{0,100}/g,
    ],
    extractor: (match) => {
      const text  = match[0];
      const price = extractPrice(text);
      const name  = text.match(/([A-Z][a-zA-Z&' ]+(?:Hotel|Resort|Spa|Mayakoba|Palmilla|Seasons|Ritz|Azulik|Rosewood))/)?.[1]?.trim();
      const room  = text.match(/\b(suite|villa|bungalow|overwater|deluxe|ocean view|garden)\b/i)?.[1];
      const nights = text.match(/(\d+)\s*nights?/i)?.[1];
      return {
        title:    name || 'Hotel',
        subtitle: [room ? `${room.charAt(0).toUpperCase() + room.slice(1)} Room` : 'Luxury Room', nights ? `${nights} nights` : ''].filter(Boolean).join(' · '),
        price:    price ?? 0,
        tags:     ['Hotel', name?.split(' ')[0] || 'Luxury'].filter(Boolean),
      };
    },
  },

  // ── RESTAURANTS ─────────────────────────────────────────────────────────
  {
    category: 'restaurant',
    patterns: [
      /(?:great table|reservation|dinner|lunch|breakfast|dining|restaurant|a table)\s+(?:at|@)\s+(?:the\s+)?([A-Z][a-zA-Z' ]+)[^.!?]{0,100}/gi,
      /\b(?:Pujol|Quintonil|Hartwood|El Farallon|Manta|Rosewood Casa Marina|Axiom|Contramar|Máximo Bistrot)[^.!?]{0,120}/gi,
      /(?:michelin|3-course|tasting menu|chef'?s? table)[^.!?]{0,120}/gi,
    ],
    extractor: (match) => {
      const text  = match[0];
      const price = extractPrice(text);
      const time  = extractTime(text);
      const name  = text.match(/\bat\s+(?:the\s+)?([A-Z][a-zA-Z' ]+)/i)?.[1]?.trim() ||
                    text.match(/\b(Pujol|Quintonil|Hartwood|El Farallon|Manta|Axiom|Contramar)/)?.[1];
      const stars = text.match(/(\d)\s*(?:michelin|★)/i)?.[1];
      return {
        title:    name || 'Restaurant',
        subtitle: [stars ? `${stars}★ Michelin` : 'Fine Dining', 'Dinner Reservation'].join(' · '),
        price:    price ?? 0,
        time:     time,
        duration: '2h 30m',
        tags:     ['Dining', stars ? `${stars}★ Michelin` : 'Fine Dining'].filter(Boolean),
      };
    },
  },

  // ── ACTIVITIES ──────────────────────────────────────────────────────────
  {
    category: 'activity',
    patterns: [
      /(?:cenote|snorkel|diving|kayak|yacht|helicopter|tour|excursion|zip.?line|ruins|chichen itza|tulum ruins|whale shark)[^.!?]{0,120}/gi,
      /(?:private|exclusive|VIP)\s+(?:tour|access|experience|charter)[^.!?]{0,100}/gi,
    ],
    extractor: (match) => {
      const text     = match[0];
      const price    = extractPrice(text);
      const time     = extractTime(text);
      const activity = text.match(/\b(cenote|snorkel|diving|kayak|yacht|helicopter|zip.?line|ruins|chichen itza)\b/i)?.[1];
      const isPrivate = /private|exclusive|VIP/i.test(text);
      return {
        title:    activity ? activity.charAt(0).toUpperCase() + activity.slice(1) + ' Experience' : 'Activity',
        subtitle: [isPrivate ? 'Private / Exclusive' : 'Group Tour', 'Activity'].join(' · '),
        price:    price ?? 0,
        time,
        duration: '3h',
        tags:     [isPrivate ? 'Private' : 'Tour', 'Activity', activity || 'Experience'].filter(Boolean),
      };
    },
  },

  // ── TRANSPORT ───────────────────────────────────────────────────────────
  {
    category: 'transport',
    patterns: [
      /(?:uber|taxi|transfer|shuttle|limo|private\s+driver|car service|helicopter\s+transfer)[^.!?]{0,100}/gi,
    ],
    extractor: (match) => {
      const text      = match[0];
      const price     = extractPrice(text);
      const provider  = text.match(/\b(uber|taxi|limo|helicopter|shuttle|driver)\b/i)?.[1];
      const from      = text.match(/(?:from|at)\s+([A-Z][a-zA-Z ]+)/)?.[1]?.trim();
      const to        = text.match(/(?:to|→)\s+([A-Z][a-zA-Z ]+)/)?.[1]?.trim();
      return {
        title:    provider ? `${provider.charAt(0).toUpperCase() + provider.slice(1)} Transfer` : 'Transfer',
        subtitle: [from, to].filter(Boolean).join(' → ') || 'Private Transfer',
        price:    price ?? 0,
        tags:     ['Transport', provider || 'Transfer'].filter(Boolean),
      };
    },
  },
];

// ── Main parser ──────────────────────────────────────────────────────────────

export function parseIntentFromLLMOutput(llmText: string): ParseResult {
  const entities: ParsedEntity[] = [];
  const usedSpans: Array<[number, number]> = [];

  for (const ep of ENTITY_PATTERNS) {
    for (const pattern of ep.patterns) {
      const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
      let match: RegExpMatchArray | null;

      while ((match = re.exec(llmText)) !== null) {
        if (match.index === undefined) continue;
        const span: [number, number] = [match.index, match.index + match[0].length];

        // Skip overlapping spans
        const overlaps = usedSpans.some(([s, e]) => span[0] < e && s < span[1]);
        if (overlaps) continue;

        const extracted = ep.extractor(match, llmText);

        // Only emit if we have at least a title
        if (!extracted.title || extracted.title === ep.category) continue;

        const destination = extractDestination(match[0]) || extractDestination(llmText);
        const rating      = extractRating(match[0]);

        entities.push({
          id:           mkId(),
          category:     ep.category,
          title:        extracted.title || 'Unknown',
          subtitle:     extracted.subtitle || ep.category,
          price:        extracted.price ?? 0,
          currency:     'USD',
          time:         extracted.time,
          duration:     extracted.duration,
          rating:       rating ?? extracted.rating,
          location:     destination,
          destination,
          tags:         extracted.tags ?? [ep.category],
          aiConfidence: 0.72 + Math.random() * 0.22,
          rawText:      match[0],
          sourceSpan:   span,
        });

        usedSpans.push(span);
      }
    }
  }

  // Remove duplicate titles (keep highest confidence)
  const deduped = entities
    .sort((a, b) => b.aiConfidence - a.aiConfidence)
    .filter((e, i, arr) => arr.findIndex(x => x.title === e.title) === i);

  // Build remaining text (strip entity spans)
  let remaining = llmText;
  for (const [s, end] of [...usedSpans].sort((a, b) => b[0] - a[0])) {
    remaining = remaining.slice(0, s) + remaining.slice(end);
  }

  return {
    entities:      deduped,
    parsedAt:      Date.now(),
    inputLength:   llmText.length,
    hasEntities:   deduped.length > 0,
    remainingText: remaining.trim(),
  };
}

// ── Streaming parser — process LLM token chunks as they arrive ───────────────

export class StreamingIntentParser {
  private buffer   = '';
  private emitted  = new Set<string>();
  private onEntity: (entity: ParsedEntity) => void;

  constructor(onEntity: (entity: ParsedEntity) => void) {
    this.onEntity = onEntity;
  }

  push(chunk: string): void {
    this.buffer += chunk;

    // Parse every time we have a complete sentence
    if (/[.!?\n]/.test(chunk)) {
      const result = parseIntentFromLLMOutput(this.buffer);
      for (const entity of result.entities) {
        const key = `${entity.category}::${entity.title}`;
        if (!this.emitted.has(key)) {
          this.emitted.add(key);
          this.onEntity(entity);
        }
      }
    }
  }

  flush(): ParsedEntity[] {
    const result = parseIntentFromLLMOutput(this.buffer);
    this.buffer  = '';
    return result.entities;
  }

  reset(): void {
    this.buffer  = '';
    this.emitted = new Set();
  }
}

// ── Convenience: parse a single AI suggestion string ─────────────────────────

export function quickParse(text: string): ParsedEntity | null {
  const result = parseIntentFromLLMOutput(text);
  return result.entities[0] ?? null;
}

// ── Locale-aware parse wrapper ────────────────────────────────────────────────

export type SupportedLocale = 'en' | 'he';

const HE_TRANSLATIONS: Partial<Record<string, string>> = {
  'Flight':        'טיסה',
  'Hotel':         'מלון',
  'Dining':        'אוכל',
  'Activity':      'פעילות',
  'Transport':     'תחבורה',
  'Business Class':'מחלקת עסקים',
  'First Class':   'מחלקה ראשונה',
  'Economy':       'כלכלה',
  'Fine Dining':   'מסעדת שף',
  'Private':       'פרטי',
};

function localizeEntity(entity: ParsedEntity, locale: SupportedLocale): ParsedEntity {
  if (locale === 'en') return entity;
  return {
    ...entity,
    subtitle: HE_TRANSLATIONS[entity.subtitle] ?? entity.subtitle,
    tags:     entity.tags.map(t => HE_TRANSLATIONS[t] ?? t),
  };
}

export function parseIntentLocalized(
  llmText: string,
  locale:  SupportedLocale = 'en'
): ParseResult {
  const result = parseIntentFromLLMOutput(llmText);
  return {
    ...result,
    entities: result.entities.map(e => localizeEntity(e, locale)),
  };
}

export class LocalizedStreamingParser extends StreamingIntentParser {
  private locale: SupportedLocale;
  constructor(locale: SupportedLocale, onEntity: (entity: ParsedEntity) => void) {
    super((entity) => onEntity(localizeEntity(entity, locale)));
    this.locale = locale;
  }
}
