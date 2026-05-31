// Long-term sentience layer — Pinecone-compatible vector schema.
// Swap IN_MEMORY_STORE for a real Pinecone client in production.
// Embedding model: text-embedding-3-small (1536-dim) from OpenAI, or
// voyage-large-2-instruct (1024-dim) from Anthropic's partner Voyage.

// ── Namespaces ────────────────────────────────────────────────────────────────

export const MEMORY_NAMESPACE = {
  USER_PERSONA:    'user-persona',
  TRIP_CONTEXT:    'trip-context',
  SEARCH_HISTORY:  'search-history',
  BOOKING_HISTORY: 'booking-history',
  PREFERENCE_LOG:  'preference-log',
} as const;

export type MemoryNamespace = typeof MEMORY_NAMESPACE[keyof typeof MEMORY_NAMESPACE];

// ── DNA vector keys ───────────────────────────────────────────────────────────
// Each key maps to a normalized float in the embedding metadata.

export const DNA_VECTOR_KEYS = [
  'paceIndex',          // 0 = slow travel, 1 = high-velocity
  'culinaryAffinity',   // 0 = secondary, 1 = Michelin mandatory
  'accommodationTier',  // 0 = value, 1 = ultra-luxury
  'experienceWeight',   // weight given to activities vs rest
  'flexibilityScore',   // 0 = rigid, 1 = fully flexible
  'luxuryAffinity',     // cross-category luxury signal
  'adventureScore',     // adrenaline vs relaxation
  'socialDynamics',     // solo < couple < group
  'noLayoverStrength',  // 0 = doesn't care, 1 = non-stop only
  'budgetSensitivity',  // 0 = price-insensitive, 1 = deals-first
] as const;

export type DNAVectorKey = (typeof DNA_VECTOR_KEYS)[number];

// ── Schemas ───────────────────────────────────────────────────────────────────

export interface TripMemoryMetadata {
  userId:       string;
  tripId:       string;
  sessionId:    string;
  travelers:    string[];
  destination:  string;
  startDate:    string;
  endDate:      string;
  budgetTotal:  number;
  currency:     string;
  locale:       string;    // 'en-US' | 'he-IL'
  createdAt:    number;
  updatedAt:    number;
  tags:         string[];
}

export interface TripMemoryDocument {
  id:        string;                                // Pinecone vector ID — use UUID
  values:    number[];                              // embedding vector (1536d)
  namespace: MemoryNamespace;
  metadata:  TripMemoryMetadata & Record<string, string | number | boolean | string[]>;
  sourceText: string;                               // raw text fed to embedding model
}

export interface PersonaVector {
  dna: Partial<Record<DNAVectorKey, number>>;
  hardConstraints: {
    noLayover:       boolean;
    earlyCheckin:    boolean;
    oceanView:       boolean;
    veganOptions:    boolean;
    quietFloors:     boolean;
    accessibilityNeeds: boolean;
  };
  locale:        string;
  currency:      string;
  travelerNames: string[];
  tripCount:     number;  // how many past trips — affects confidence weighting
}

// ── Text serializer ───────────────────────────────────────────────────────────
// This text is sent to the embedding API. Quality of retrieval depends on quality of text.

export function buildPersonaText(
  persona:  PersonaVector,
  snapshot: Pick<TripMemoryMetadata, 'destination' | 'startDate' | 'endDate' | 'budgetTotal'>,
): string {
  const d = persona.dna;
  const c = persona.hardConstraints;
  const pace =
    (d.paceIndex ?? 0.5) > 0.65 ? 'high-velocity explorer — dense itinerary preferred'
    : (d.paceIndex ?? 0.5) < 0.35 ? 'slow travel devotee — depth over breadth'
    : 'balanced pace traveler';
  const culinary =
    (d.culinaryAffinity ?? 0.5) > 0.75 ? 'serious gastronome — Michelin and chef tables mandatory'
    : (d.culinaryAffinity ?? 0.5) > 0.5 ? 'food-forward traveler'
    : 'dining secondary to other experiences';
  const accommodation =
    (d.accommodationTier ?? 0.5) > 0.7  ? 'ultra-luxury 5-star only, no exceptions'
    : (d.accommodationTier ?? 0.5) > 0.45 ? 'premium boutique hotels'
    : 'quality-to-price ratio focused';

  const constraints = [
    c.noLayover       && 'non-stop flights only',
    c.earlyCheckin    && 'early hotel check-in required',
    c.oceanView       && 'ocean or sea-view room preferred',
    c.veganOptions    && 'vegan dining options required',
    c.quietFloors     && 'quiet hotel floors, high-floor preference',
    c.accessibilityNeeds && 'accessibility accommodations needed',
  ].filter(Boolean).join('; ');

  return [
    `Travelers: ${persona.travelerNames.join(' and ')}.`,
    `Destination: ${snapshot.destination}.`,
    `Dates: ${snapshot.startDate} to ${snapshot.endDate}.`,
    `Total budget: $${snapshot.budgetTotal.toLocaleString()} ${persona.currency}.`,
    `Interface language: ${persona.locale}.`,
    `Travel style: ${pace}.`,
    `Culinary preferences: ${culinary}.`,
    `Accommodation preference: ${accommodation}.`,
    `Adventure score: ${Math.round((d.adventureScore ?? 0.5) * 100)}%.`,
    `Flexibility: ${Math.round((d.flexibilityScore ?? 0.5) * 100)}%.`,
    `Budget sensitivity: ${Math.round((d.budgetSensitivity ?? 0.3) * 100)}%.`,
    constraints && `Hard constraints: ${constraints}.`,
    `Past trips logged: ${persona.tripCount}.`,
  ].filter(Boolean).join(' ');
}

// ── Search result ─────────────────────────────────────────────────────────────

export interface MemorySearchResult {
  id:         string;
  score:      number;
  namespace:  MemoryNamespace;
  metadata:   TripMemoryMetadata & Record<string, string | number | boolean | string[]>;
  sourceText?: string;
}

// ── Service interface ─────────────────────────────────────────────────────────
// Swap stub for real Pinecone client:
//   import { Pinecone } from '@pinecone-database/pinecone';
//   const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
//   const index = pc.index(process.env.PINECONE_INDEX!);

export interface TravelMemoryService {
  upsert(doc: TripMemoryDocument): Promise<{ upsertedCount: number }>;
  search(
    queryVector: number[],
    namespace:   MemoryNamespace,
    topK?:       number,
    filter?:     Partial<Record<keyof TripMemoryMetadata, string | number | boolean>>,
  ): Promise<MemorySearchResult[]>;
  delete(ids: string[], namespace: MemoryNamespace): Promise<void>;
  fetchById(id: string, namespace: MemoryNamespace): Promise<TripMemoryDocument | null>;
}

// ── Cosine similarity (stub only — Pinecone does this server-side) ─────────────

function cosineSim(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot  += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

// ── In-memory stub (replace with Pinecone in production) ──────────────────────

const STORE = new Map<string, TripMemoryDocument>();

export const TravelMemoryEngine: TravelMemoryService = {

  async upsert(doc) {
    STORE.set(doc.id, doc);
    return { upsertedCount: 1 };
  },

  async search(queryVector, namespace, topK = 5, filter) {
    const results: MemorySearchResult[] = [];
    for (const doc of STORE.values()) {
      if (doc.namespace !== namespace) continue;
      if (filter) {
        const passes = (Object.entries(filter) as [string, string | number | boolean][])
          .every(([k, v]) => doc.metadata[k] === v);
        if (!passes) continue;
      }
      results.push({
        id:         doc.id,
        score:      cosineSim(queryVector, doc.values),
        namespace:  doc.namespace,
        metadata:   doc.metadata,
        sourceText: doc.sourceText,
      });
    }
    return results.sort((a, b) => b.score - a.score).slice(0, topK);
  },

  async delete(ids, namespace) {
    for (const id of ids) {
      const doc = STORE.get(id);
      if (doc?.namespace === namespace) STORE.delete(id);
    }
  },

  async fetchById(id, namespace) {
    const doc = STORE.get(id);
    return doc?.namespace === namespace ? doc : null;
  },
};

// ── Session memory builder ────────────────────────────────────────────────────
// Call this at the end of each chat session to persist context for next time.

export function buildSessionMemory(
  sessionId:   string,
  userId:      string,
  tripId:      string,
  persona:     PersonaVector,
  snapshot:    Pick<TripMemoryMetadata, 'destination' | 'startDate' | 'endDate' | 'budgetTotal'>,
  locale:      string,
  currency:    string,
): TripMemoryDocument {
  const sourceText = buildPersonaText(persona, snapshot);
  // Zero-vector placeholder — replace `values` with a real embedding API call:
  //   const { data } = await openai.embeddings.create({ model: 'text-embedding-3-small', input: sourceText });
  //   values = data[0].embedding;
  const values = new Array(1536).fill(0) as number[];

  return {
    id:        `${userId}-${sessionId}-persona`,
    values,
    namespace: MEMORY_NAMESPACE.USER_PERSONA,
    metadata:  {
      userId, tripId, sessionId,
      travelers:   persona.travelerNames,
      destination: snapshot.destination,
      startDate:   snapshot.startDate,
      endDate:     snapshot.endDate,
      budgetTotal: snapshot.budgetTotal,
      currency,
      locale,
      createdAt:   Date.now(),
      updatedAt:   Date.now(),
      tags:        [
        locale === 'he-IL' ? 'hebrew' : 'english',
        ...(persona.hardConstraints.noLayover ? ['no-layover'] : []),
        ...(persona.dna.culinaryAffinity && persona.dna.culinaryAffinity > 0.7 ? ['gastronome'] : []),
        ...(persona.dna.accommodationTier && persona.dna.accommodationTier > 0.7 ? ['ultra-luxury'] : []),
      ],
    },
    sourceText,
  };
}
