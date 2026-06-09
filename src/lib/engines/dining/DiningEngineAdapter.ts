// ── Shared types for all dining engine adapters ───────────────────────────────

export interface DiningSearchParams {
  destination: string;
  date:        string;
  adults:      number;
  vibes:       string[];
  diets:       string[];
  priceMax?:   number;
  tier:        'economy' | 'premium' | 'luxury' | 'ultra-luxury';
}

export interface RawDiningSource {
  source:            string;
  name:              string;
  cuisine:           string;
  location:          string;
  destination:       string;
  pricePerPerson:    number;
  rating:            number;
  michelinStars?:    number;
  bestIn50?:         number;
  slots:             RawTimeSlot[];
  uberMinutes:       number;
  uberCost:          number;
  aiHighlight:       string;
  reservationWindow: string;
  tags:              string[];
  imageGradient:     string;
  reservationUrl?:   string;  // deeplink to external reservation (Google Maps / OpenTable / Resy)
  placeId?:          string;  // Google place_id for exact Maps link
  lat?:              number;
  lon?:              number;
}

export interface RawTimeSlot {
  time:   string;
  label:  string;
  source: string;
  party:  number;
}

export interface DiningEngineResult {
  engineId:      string;
  engineName:    string;
  status:        'ok' | 'needs_api_key' | 'error';
  results:       RawDiningSource[];
  latencyMs:     number;
  deepLinkUrl?:  string;
  setupUrl?:     string;
  setupMessage?: string;
}

export interface DiningEngineAdapter {
  id:   string;
  name: string;
  search(params: DiningSearchParams): Promise<DiningEngineResult>;
}

// ── Cuisine → gradient ────────────────────────────────────────────────────────

export function cuisineGradient(types: string[]): string {
  if (types.some(t => /japanese|sushi|ramen/.test(t)))  return 'linear-gradient(135deg, #1565C0 0%, #42A5F5 100%)';
  if (types.some(t => /italian|pizza|pasta/.test(t)))   return 'linear-gradient(135deg, #C62828 0%, #EF9A9A 100%)';
  if (types.some(t => /mexican|taco|burrito/.test(t)))  return 'linear-gradient(135deg, #6B4226 0%, #CD853F 100%)';
  if (types.some(t => /seafood|fish/.test(t)))          return 'linear-gradient(135deg, #00838F 0%, #80DEEA 100%)';
  if (types.some(t => /french|brasserie/.test(t)))      return 'linear-gradient(135deg, #4A148C 0%, #CE93D8 100%)';
  if (types.some(t => /steakhouse|bbq|grill/.test(t))) return 'linear-gradient(135deg, #BF360C 0%, #FF8A65 100%)';
  if (types.some(t => /cafe|coffee|bakery/.test(t)))   return 'linear-gradient(135deg, #5D4037 0%, #A1887F 100%)';
  return 'linear-gradient(135deg, #1B5E20 0%, #43A047 100%)';
}

// ── needs_api_key shell factory ───────────────────────────────────────────────

export function needsDiningKey(
  id: string, name: string, setupUrl: string, envVar: string,
  deepLinkFn?: (p: DiningSearchParams) => string,
): DiningEngineAdapter {
  return {
    id, name,
    async search(params) {
      return {
        engineId: id, engineName: name, status: 'needs_api_key',
        results: [], latencyMs: 0,
        deepLinkUrl: deepLinkFn ? deepLinkFn(params) : undefined,
        setupUrl, setupMessage: `Add ${envVar} to .env.local to enable ${name}.`,
      };
    },
  };
}
