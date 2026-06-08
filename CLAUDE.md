# UNITRAVEL — MASTER SPECIFICATION v2
## Read this ENTIRE file before every session. Every decision. Every line of code.
## This is the source of truth. Not the conversation. Not the summary. THIS FILE.

---

## THE VISION

The world's most advanced AI-powered travel OS. Not a demo. Not a prototype. A product that actually replaces every travel site — plan, discover, book, and manage any trip through one living interface powered by real data and real AI.

**Two halves:**
1. **Discovery Engine** — Real-time parallel search across 30 real sources per category (flights, hotels, dining, attractions, transit). Results are live, deep-linked, per-engine.
2. **Mission Control** — Budget engine, liquid timeline, calendar sync, crisis detection, AI concierge that controls everything.

---

## THE HONEST CURRENT STATE (as of May 2026)

Read this before every session. This is what is REAL vs. FAKE right now.

### ✅ ACTUALLY REAL (do not rebuild)
- **Claude API chat** — `/api/chat/route.ts` uses `@ai-sdk/anthropic`, `claude-sonnet-4-6`, real streaming, real system prompt with full trip context. REAL.
- **DnD → Zustand → localStorage** — DropCascade → placeEntity → persist middleware. REAL.
- **Budget math engine** — `FinancialEngine.ts`, regression, DNA-aware, zero Math.random for financial data. REAL.
- **CSS design system** — glass morphism, logical props, bright colors, Framer Motion springs. REAL.
- **Flight search form** — calls `/api/flights` → Amadeus if key set → `needs_api_key` state if not. REAL.
- **Hotel search form** — calls `/api/hotels` → Amadeus Hotels if key set → `needs_api_key` state if not. REAL.
- **Dining search** — calls `/api/dining` → Google Places + Yelp if keys set → `needs_api_key` if not. REAL.
- **Zustand persist** — trip/days/budget/DNA survive page refresh via localStorage. REAL.
- **Flight status API** — `/api/flights/status` → AviationStack if key set. REAL.
- **Google Calendar sync** — `SyncMatrix.syncToCalendar()` calls real Google Calendar API with OAuth token. REAL.
- **Attractions** — `/api/attractions` → `needs_api_key` state for GetYourGuide/Viator. REAL structure.
- **Zone routing** — all 7 zones have specific pages. REAL.
- **CrisisManager** — flight delay detection, timeline mutations. REAL.
- **i18n setup** — next-intl, en + he profiles, RTL switching. REAL structure.

### ❌ FAKE / FACADE (must fix, in priority order)

#### 1. ENGINE SELECTOR IS DECORATION (Critical)
`OmniSelectorConsole` renders 30 beautiful engine pills. User toggles them. Zustand stores selection.
**But:** Every zone page's `handleSearch(engineIds)` IGNORES `engineIds` completely.
**Fix required:** Implement `FlightEngineAdapter` pattern. Each selected engine = one real API call.

#### 2. PROGRESS ANIMATIONS ARE LIES (Critical)
Every zone shows "Scanning X engines..." with a `Math.random()` progress tick.
**Reality:** 0 or 1 API endpoint is called. The animation is theater.
**Fix required:** Progress must reflect REAL `Promise.allSettled()` results. Show which engines responded, which failed, which need a key.

#### 3. TRANSIT IS 100% FAKE (Critical)
`/zone/transit/page.tsx` line 55: `const queries = DEMO_TRANSIT_QUERIES ?? []`
`DEMO_TRANSIT_QUERIES` is hardcoded Mexico routes with a seeded PRNG for fake variety.
**Fix required:** Call real Google Maps Directions API or Rome2rio. Show `needs_api_key` if no key.

#### 4. THE 1/3 + 2/3 LAYOUT DOESN'T EXIST (Critical)
Spec says: `[Engine selector] [Center 2/3: Results] [Right 1/3: AI Concierge]` on EVERY zone page.
**Reality:** Zone layout has a global toggleable AI panel. Not the same. Not per-zone. Not always visible.
**Fix required:** Every zone page must embed `<ConciergePanel fitParent />` as a real 1/3 right column.

#### 5. AI TOOLS ARE COSMETIC (High)
`mutateTimeline` shows a draggable card (added "Add to Day" button this session) but the synthetic `AggregatedResult` it creates is always `category: 'flight'` regardless of the actual category.
`adjustFinancialModel` calls `calculatePredictiveBudget()` which recalculates existing entities — it doesn't add the AI's suggested amount to budget.
**Fix required:** Tool results must genuinely execute the action with correct category mapping.

#### 6. NO SUPABASE (Medium)
No auth. No user accounts. Chat history dies on page close. Trips are localStorage only.
**Fix required:** Supabase Auth + trips table + chat_history table.

#### 7. ONBOARDING HAS NO UI (Medium)
`completeTravelDNA()` action exists in store. `NeuralOnboarding.tsx` exists.
**Reality:** No route, no trigger, no flow to actually set a TravelDNA profile through the UI.
**Fix required:** Show onboarding on first visit when `onboardingComplete === false`.

---

## CORE PRINCIPLES — NEVER VIOLATE

### 1. Real Over Facade (Highest Priority)
Every feature must actually function. No fake data for meaningful outputs.
- Search calls real APIs or shows a clear `Connect [Provider]` empty state.
- **Never use `Math.random()` for prices, availability, times, distances, or progress that represents real API work.**
- If an API key is missing: `{ status: 'needs_api_key', provider: '...', setupUrl: '...', setupMessage: '...' }` — never fake the data.
- Real AI responses — always `@anthropic-ai/sdk` or `@ai-sdk/anthropic`. Never fake streams.

### 2. Engine Selection Must Route to Real APIs
The 30-engine selector is the heart of the Discovery Engine. Every selected engine must trigger a real adapter call.
```
User selects: [Amadeus ✓] [Skyscanner ✓] [Kayak ✗]
→ FlightEngine.search(params, ['amadeus', 'skyscanner'])
→ Promise.allSettled([amadeusAdapter.search(), skyscannerAdapter.search()])
→ Deduplicate by routeKey + normalizedPrice
→ Return merged results showing source per card
```
Engines without API keys must show a "Connect" badge, not silence. The UI shows ALL 30 engines always — connected ones return real data, unconnected ones show the badge.

### 3. Progress = Reality
Progress bars and "scanning engines" animations must reflect actual async work:
```typescript
// WRONG — fake theater
const interval = setInterval(() => { prog += Math.random() * 8; }, 120);

// RIGHT — tied to real work
const results = await Promise.allSettled(selectedEngines.map(e => e.search(params)));
// Update progress as each Promise settles
```
Show: "✅ Amadeus (12 results)", "⚠️ Skyscanner (no key)", "❌ Kayak (timeout)"

### 4. The 1/3 + 2/3 Layout Law — No Exceptions
EVERY zone page:
```
┌─────────────────────────────────────────────────────┐
│  [Zone nav bar — 54px]                               │
├──────────┬──────────────────────────┬───────────────┤
│ Engine   │                          │               │
│ Selector │    Results / Content     │  AI Concierge │
│  ~220px  │       ~flex: 1           │    ~360px     │
│          │                          │               │
└──────────┴──────────────────────────┴───────────────┘
```
The AI Concierge RIGHT panel is ALWAYS visible by default. It can be minimized to a 48px icon strip. It is NOT a global toggle — it is embedded in every zone page layout.

### 5. AI-First — Not AI-Decorative
The AI concierge must be able to perform EVERY action the UI can do:
- Search any zone (call `/api/[zone]` and show results in the results pane)
- Add entity to timeline (call `placeEntity()` with correct category)
- Navigate to any zone (call `router.push('/zone/...')`)
- Update budget parameters
- Read current trip state (always in system prompt)
- Remember last 50 messages + full trip context

### 6. Apple Glass Design — Bright Colors, Never Darkened
- Background: `rgba(255,255,255,0.82–0.94)` + `backdrop-filter: blur(40–56px) saturate(1.8–1.9)`
- Specular: `inset 0 1px 0 rgba(255,255,255,1)`
- Brand colors (FULL VIBRANCY — never tint, never darken, never reduce opacity on the color itself):
  `#007AFF` `#30D158` `#FF9F0A` `#FF453A` `#BF5AF2` `#5E5CE6` `#00C7BE` `#FF2D55`
- Typography: `-apple-system, 'SF Pro Display', Inter`, tracking `-0.02em` to `-0.04em`, weights 700–900
- All layout: CSS Logical Properties. Never `paddingLeft` — always `paddingInline`. Never `left:` — always `insetInlineStart:`.
- Framer Motion spring physics for ALL interactive elements. No CSS `transition:` for draggable/interactive components.

### 7. True Bilingual — Cultural Adaptation, Not Translation
- **en-US**: English UI, USD, MM/DD/YYYY, American-market APIs (Skyscanner, Google, Booking)
- **he-IL**: RTL layout (`dir="rtl"`), Hebrew UI, NIS + USD, DD/MM/YYYY, Israeli market (El Al, israir, booking.com IL)
- Toggle always visible. Switches `document.documentElement.dir` and `lang` instantly.
- Every component uses `useLocaleEngine()` for direction. Never hardcode `direction: 'ltr'`.
- `next-intl` for all user-visible strings. No hardcoded English/Hebrew text in components.

### 8. No Hardcoded Trip Data — Ever
Zero hardcoded destinations, dates, names, prices, or person names in any page or component.
Always read from `useTravelEngine` store. If store is empty: show an empty/context hint state.

---

## ARCHITECTURE

**Framework**: Next.js 16 App Router, TypeScript strict mode
**AI**: `@ai-sdk/anthropic` — `claude-sonnet-4-6`, streaming, tool use
**State**: Zustand + Immer + persist (localStorage). All mutations via `set(s => { s.field = value })`
**Animation**: Framer Motion v12 — spring physics, LayoutGroup for shared transitions
**i18n**: next-intl (en + he messages in `/messages/`)
**Styling**: Inline styles with CSS Logical Properties. No Tailwind for layout-critical components.
**Validation**: Zod on EVERY API route input
**DB**: Supabase (user trips, preferences, chat history) — not yet connected, must be added
**Cache**: Upstash Redis 60s TTL — not yet connected, must be added
**Deploy**: Vercel

---

## THE ADAPTER PATTERN (How Engine Selection Actually Works)

This is the architecture that makes the 30-engine selector REAL. Every zone must implement this.

```typescript
// src/lib/engines/flights/FlightEngineAdapter.ts

export interface FlightSearchParams {
  origin: string; destination: string; date: string;
  adults: number; cabinClass: string;
}

export interface FlightEngineResult {
  engineId:   string;
  engineName: string;
  status:     'ok' | 'needs_api_key' | 'error' | 'timeout';
  results:    BentoFlight[];
  latencyMs:  number;
  setupUrl?:  string;
}

export interface FlightEngineAdapter {
  id:     string;  // 'amadeus', 'skyscanner', 'kayak', etc.
  name:   string;
  search(params: FlightSearchParams): Promise<FlightEngineResult>;
}

// src/lib/engines/flights/AmadeusAdapter.ts
export const AmadeusAdapter: FlightEngineAdapter = {
  id: 'amadeus', name: 'Amadeus GDS',
  async search(params) {
    const key = process.env.AMADEUS_CLIENT_ID;
    if (!key) return { engineId: 'amadeus', engineName: 'Amadeus GDS', status: 'needs_api_key',
      results: [], latencyMs: 0, setupUrl: 'https://developers.amadeus.com/register' };
    // ... real Amadeus call
  }
};

// src/app/api/flights/route.ts
import { AmadeusAdapter, SkyscannerAdapter, KayakAdapter } from '@/lib/engines/flights';

const ADAPTERS: Record<string, FlightEngineAdapter> = {
  amadeus: AmadeusAdapter,
  skyscanner: SkyscannerAdapter,  // returns needs_api_key until key set
  kayak: KayakAdapter,            // returns needs_api_key until key set
  // ... all 30
};

export async function GET(req: NextRequest) {
  const engineIds = req.nextUrl.searchParams.get('engines')?.split(',') ?? ['amadeus'];
  const adapters = engineIds.map(id => ADAPTERS[id]).filter(Boolean);

  const settled = await Promise.allSettled(
    adapters.map(a => a.search(params))
  );

  const results = settled.flatMap(r =>
    r.status === 'fulfilled' && r.value.status === 'ok' ? r.value.results : []
  );
  const engineStatus = settled.map((r, i) => ({
    engineId: adapters[i].id,
    status: r.status === 'fulfilled' ? r.value.status : 'error',
    count: r.status === 'fulfilled' ? r.value.results.length : 0,
    setupUrl: r.status === 'fulfilled' ? r.value.setupUrl : undefined,
  }));

  // Deduplicate by routeKey + price band
  const deduped = deduplicateFlights(results);

  return NextResponse.json({ status: 'ok', results: deduped, engineStatus });
}
```

**THIS PATTERN APPLIES TO ALL 6 ZONES.** Hotels, dining, attractions, transit — all use the same adapter architecture.

---

## REAL API STRATEGY

### Flights (30 engines)
| Engine | Adapter Status | API Access |
|---|---|---|
| Amadeus GDS | ✅ REAL | Free tier: AMADEUS_CLIENT_ID + AMADEUS_CLIENT_SECRET |
| Skyscanner | ⚠️ needs_api_key | Partner approval: partners.skyscanner.net |
| Kayak | ⚠️ needs_api_key | $20-300/mo after 500 free |
| Kiwi / Tequila | ⚠️ needs_api_key | KIWI_API_KEY from tequila.kiwi.com |
| Travelpayouts | ⚠️ needs_api_key | Free: TRAVELPAYOUTS_TOKEN |
| Google Flights (SerpAPI) | ⚠️ needs_api_key | SERPAPI_KEY |
| Hopper | ⚠️ needs_api_key | Partner program |
| Expedia EAN | ⚠️ needs_api_key | Application-based |
| 22 more | ⚠️ needs_api_key | Show connect badge |

### Hotels (30 engines)
| Engine | Adapter Status | API Access |
|---|---|---|
| Amadeus Hotels | ✅ REAL | Same Amadeus credentials |
| Booking.com | ⚠️ needs_api_key | BOOKING_API_KEY — affiliate immediate |
| Expedia Rapid | ⚠️ needs_api_key | Application-based |
| Airbnb | ⚠️ needs_api_key | Affiliate deeplinks only |
| Agoda | ⚠️ needs_api_key | Commission-based |
| Marriott Direct | ⚠️ needs_api_key | Partner |
| 24 more | ⚠️ needs_api_key | Show connect badge |

### Restaurants (30 engines)
| Engine | Adapter Status | API Access |
|---|---|---|
| Google Places | ✅ REAL | GOOGLE_PLACES_API_KEY |
| Yelp Fusion | ✅ REAL | YELP_API_KEY — free 500/day |
| OpenTable | ⚠️ needs_api_key | OPENTABLE_API_KEY |
| Resy | ⚠️ needs_api_key | Partnership |
| Foursquare | ⚠️ needs_api_key | Free tier available |
| TheFork | ⚠️ needs_api_key | Affiliate |
| 24 more | ⚠️ needs_api_key | Show connect badge |

### Attractions (30 engines)
| Engine | Adapter Status | API Access |
|---|---|---|
| GetYourGuide | ⚠️ needs_api_key | GETYOURGUIDE_API_KEY |
| Viator | ⚠️ needs_api_key | VIATOR_API_KEY |
| Klook | ⚠️ needs_api_key | Partner program |
| Google Things To Do | ⚠️ needs_api_key | GOOGLE_PLACES_API_KEY (same) |
| 26 more | ⚠️ needs_api_key | Show connect badge |

### Transit (30 engines)
| Engine | Adapter Status | API Access |
|---|---|---|
| Google Maps Directions | ⚠️ needs_api_key | GOOGLE_MAPS_API_KEY |
| Rome2rio | ⚠️ needs_api_key | ROME2RIO_API_KEY — free |
| Uber Estimates | ⚠️ needs_api_key | UBER_SERVER_TOKEN |
| Lyft Estimates | ⚠️ needs_api_key | LYFT_CLIENT_ID + SECRET |
| 26 more | ⚠️ needs_api_key | Show connect badge |

**ALL transit `DEMO_TRANSIT_QUERIES` hardcoded data must be deleted. Transit shows `needs_api_key` until `GOOGLE_MAPS_API_KEY` is set.**

---

## THE AI CONCIERGE — EXACT IMPLEMENTATION

```typescript
// /api/chat/route.ts — ALREADY REAL. Keep as-is.
// Uses: @ai-sdk/anthropic, streamText, claude-sonnet-4-6
// System prompt: full trip context, DNA profile, budget state, active zone
// Tools: navigateWorkspace, executeOmniSearch, mutateTimeline, adjustFinancialModel, adjustDNA

// ConciergePanel.tsx — what must be true:
// 1. Always visible as right 1/3 panel inside every zone page (not global toggle)
// 2. Receives currentZone prop so AI knows context
// 3. Tool results apply to store immediately:
//    - navigateWorkspace → router.push()  ✅ (already implemented)
//    - mutateTimeline → placeEntity() with correct category  ⚠️ (needs category fix)
//    - adjustFinancialModel → calculatePredictiveBudget()  ✅ (implemented this session)
//    - adjustDNA → patchDNA()  ✅ (implemented this session)
// 4. Chat history: last 50 messages always in messages array
// 5. System prompt always includes placed entities from days[]
```

---

## ZONE PAGE STRUCTURE — EXACT TEMPLATE

Every zone page MUST follow this structure. No exceptions.

```tsx
// /zone/[zonename]/page.tsx

export default function ZonePage() {
  const { profile } = useLocaleEngine();
  const isRtl = profile.direction === 'rtl';

  return (
    <div style={{
      display: 'flex', width: '100%', height: '100%', overflow: 'hidden',
      direction: isRtl ? 'rtl' : 'ltr',
      background: /* zone gradient */,
    }}>
      {/* LEFT: Engine selector ~220px */}
      <OmniSelectorConsole zone="flights" onSearch={handleSearch} />

      {/* CENTER: Results — flex:1 */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Search form + results */}
        <ZoneSearchBar ... />
        <ZoneResults ... />
      </div>

      {/* RIGHT: AI Concierge — always 360px */}
      <ConciergePanel fitParent currentZone="flights" />
    </div>
  );
}
```

The ConciergePanel is NOT wrapped in AnimatePresence — it is always present. The zone layout.tsx global panel is for when users are NOT on a zone page (e.g. home page).

---

## SEARCH FLOW — REAL IMPLEMENTATION

```
1. User fills search form → clicks Search
2. OmniSelectorConsole emits: handleSearch(selectedEngineIds: string[])
3. Zone page calls: /api/[zone]?...params&engines=amadeus,skyscanner,yelp
4. API route: Promise.allSettled(selectedEngineIds.map(id => ADAPTERS[id].search(params)))
5. Each adapter: calls real API if key present, returns { status: 'needs_api_key' } if not
6. Results merged, deduplicated, DNA-ranked
7. Response: { status: 'ok', results: [...], engineStatus: [{engineId, status, count}] }
8. Client: renders real cards with source badge per card
9. Progress bar: updates as each Promise settles (NOT Math.random timer)
10. Engine pills: show green checkmark (got results), yellow (needs key), red (error)
```

If ALL selected engines need API keys → show `ConnectEnginesState` component, not fake results.

---

## WHAT "NEEDS_API_KEY" LOOKS LIKE

```tsx
// Standard empty state — used across ALL zones when no API key
function NeedsApiKeyState({ provider, setupUrl, message }: ...) {
  return (
    <div style={{ /* centered, glass card */ }}>
      <div>🔑</div>
      <h3>Connect {provider}</h3>
      <p>{message}</p>
      <a href={setupUrl} target="_blank">
        Get API Key →
      </a>
      <p>Add to .env.local: {ENV_VAR_NAME}=your_key_here</p>
    </div>
  );
}
```

---

## QUALITY GATES — BEFORE EVERY COMMIT

1. `tsc --noEmit` — zero errors
2. `npm run build` — must pass, all 21+ routes compile
3. Every API route has Zod validation on input
4. Every component reads from store, not hardcoded data
5. Every AI response calls real `@ai-sdk/anthropic`
6. Every search result comes from a real API adapter OR shows `needs_api_key`
7. No `Math.random()` for prices, availability, times, or progress presented as real work
8. No `setTimeout` + fake progress instead of real async work
9. No hardcoded `DEMO_*` data imported in production zone pages
10. DnD → placeEntity → calculatePredictiveBudget chain verified
11. All CSS uses logical properties (`paddingInline` not `paddingLeft`)
12. Both `en` and `he` translations exist in `/messages/`
13. RTL tested: flip `document.dir` and check layout

---

## WHAT MUST NEVER HAPPEN AGAIN

These specific patterns caused the "beautiful facade" problem:

```typescript
// ❌ NEVER — fake progress animation
const interval = setInterval(() => {
  prog += Math.random() * 8 + 3;  // LYING about scan progress
  setScanProgress(Math.min(prog, 96));
}, 80);
setTimeout(() => setSearchState('results'), 2800);  // LYING about completion

// ✅ ALWAYS — real progress from real work
const results = await Promise.allSettled(
  selectedAdapters.map(a => a.search(params))
);
// Progress is the count of settled promises / total

// ❌ NEVER — ignore selected engines
const handleSearch = (engineIds: string[]) => {
  // ... engineIds is never used
  fetch('/api/flights?origin=TLV&dest=CUN');  // ALWAYS calls same endpoint
};

// ✅ ALWAYS — pass engines to API
const handleSearch = (engineIds: string[]) => {
  fetch(`/api/flights?origin=${origin}&dest=${dest}&engines=${engineIds.join(',')}`);
};

// ❌ NEVER — hardcoded demo data in production
import { DEMO_TRANSIT_QUERIES } from '@/services/TransitDistillation';
const queries = DEMO_TRANSIT_QUERIES ?? [];  // ALWAYS Mexico, ALWAYS fake

// ✅ ALWAYS — real data or honest empty state
if (!process.env.GOOGLE_MAPS_API_KEY) {
  return { status: 'needs_api_key', provider: 'Google Maps', setupUrl: '...' };
}

// ❌ NEVER — AI tool that lies
execute: async (params) => ({
  adjusted: true, status: 'applied',  // LYING — nothing was applied
})

// ✅ ALWAYS — tool result that triggers real mutation
// Client-side useEffect detects tool result → calls store action
```

---

## STEP SEQUENCE (Current Priority Order)

### Priority 1 — Kill All Fakes
- P1.1: Transit zone: delete `DEMO_TRANSIT_QUERIES`, implement Google Maps + Rome2rio adapters with `needs_api_key` state
- P1.2: Replace ALL `Math.random()` progress animations with real `Promise.allSettled` progress
- P1.3: Wire `OmniSelectorConsole` engine selection to API routes (pass `engineIds` param)
- P1.4: Implement `FlightEngineAdapter` pattern in `/api/flights` (Amadeus real, others `needs_api_key`)

### Priority 2 — Complete the Layout
- P2.1: Add `<ConciergePanel fitParent currentZone="..." />` as permanent right 1/3 in EVERY zone page
- P2.2: Remove the global AI panel toggle from zone layout.tsx (replaced by per-zone panel)
- P2.3: Pass `currentZone` prop through to system prompt so AI knows where user is

### Priority 3 — Real AI Tools
- P3.1: `mutateTimeline` — fix category mapping so hotels/restaurants place correctly
- P3.2: `executeOmniSearch` — results must appear in the zone's results pane, not just in chat
- P3.3: Add `searchFlights`/`searchHotels`/`searchDining` as separate focused tools

### Priority 4 — Complete Real APIs
- P4.1: Hotel adapters: Booking.com deeplink adapter (immediate, no approval needed)
- P4.2: Dining adapters: OpenTable widget embed for reservations
- P4.3: Attractions: GetYourGuide + Viator adapters (need keys)
- P4.4: Transit: Google Maps Directions adapter (needs GOOGLE_MAPS_API_KEY)

### Priority 5 — Supabase + Auth
- P5.1: Supabase Auth (email + Google OAuth)
- P5.2: `trips` table — save/load trips across devices
- P5.3: `chat_history` table — persist across sessions
- P5.4: Upstash Redis — 60s cache for API responses

### Priority 6 — Onboarding + TravelDNA
- P6.1: Show `NeuralOnboarding` on first visit when `onboardingComplete === false`
- P6.2: 5-step questionnaire: pace / cuisine / tier / flexibility / destinations
- P6.3: DNA profile drives search ranking, AI recommendations, budget defaults

---

## FILE STRUCTURE (Critical paths)

```
src/
  app/
    api/
      flights/route.ts          ← GET: Zod + Amadeus (real) + other adapters
      flights/status/route.ts   ← GET: AviationStack real-time status
      hotels/route.ts           ← POST: Amadeus Hotels (real) + others
      dining/route.ts           ← POST: Google Places + Yelp (real) + others
      attractions/route.ts      ← POST: GetYourGuide + Viator (needs_api_key)
      transit/route.ts          ← POST: Google Maps + Rome2rio (needs_api_key)
      chat/route.ts             ← POST: @ai-sdk/anthropic streaming (real)
      calendar/callback/route.ts← GET: Google OAuth token exchange (real)
    zone/
      flights/page.tsx          ← [OmniSelector | Results | ConciergePanel]
      lodging/page.tsx          ← [OmniSelector | Results | ConciergePanel]
      dining/page.tsx           ← [OmniSelector | Results | ConciergePanel]
      attractions/page.tsx      ← [OmniSelector | Results | ConciergePanel]
      transit/page.tsx          ← [OmniSelector | Results | ConciergePanel]
      management/page.tsx       ← [LiquidTimeline | FinancialWidget | ConciergePanel]
      map/page.tsx              ← [Map | Legend | ConciergePanel] — Phase D
  lib/
    engines/                    ← NEW: adapter pattern per zone
      flights/
        index.ts                ← exports all FlightEngineAdapters
        AmadeusAdapter.ts       ← real Amadeus implementation
        SkyscannerAdapter.ts    ← needs_api_key shell
        KayakAdapter.ts         ← needs_api_key shell
        ... (30 total)
      hotels/
        index.ts
        AmadeusHotelsAdapter.ts
        BookingAdapter.ts
        ... (30 total)
      dining/restaurants/
        GooglePlacesAdapter.ts
        YelpAdapter.ts
        ... (30 total)
      attractions/
        GetYourGuideAdapter.ts
        ViatorAdapter.ts
        ... (30 total)
      transit/
        GoogleMapsAdapter.ts    ← GOOGLE_MAPS_API_KEY
        Rome2rioAdapter.ts      ← ROME2RIO_API_KEY
        ... (30 total)
  components/
    ai/
      ConciergePanel.tsx        ← RIGHT 1/3 panel, embedded per zone
    zones/
      OmniSelectorConsole.tsx   ← engine pills, passes engineIds to onSearch
    results/
      AviationBento.tsx
      LodgingBento.tsx
      DiningBento.tsx
      AttractionsBento.tsx
      TransitBento.tsx          ← NEW: replaces MultiModalGraph fake data
    management/
      LiquidTimeline.tsx
      FinancialWidget.tsx
  store/
    useTravelEngine.ts          ← Zustand + Immer + persist
    useZoneStore.ts             ← selected engines per zone
    useLocaleEngine.ts          ← en-US / he-IL profile
  services/
    AITools.ts                  ← Claude tool definitions
    CalendarSync.ts             ← Google Calendar OAuth + event push
    CrisisManager.ts            ← flight delay detection
  lib/
    amadeus.ts                  ← BentoFlight type + transformAmadeusOffer
    zoneEngines.ts              ← ZoneId, ZONE_META, ZONE_ENGINES (30 per zone)
```

---

## ENVIRONMENT VARIABLES

Required for full functionality (all others show `needs_api_key` state):

```bash
# AI — required for chat to work
ANTHROPIC_API_KEY=

# Flights — required for flight search
AMADEUS_CLIENT_ID=
AMADEUS_CLIENT_SECRET=

# Hotels — required for hotel search
# Amadeus Hotels uses same credentials as flights

# Restaurants — required for dining
GOOGLE_PLACES_API_KEY=
YELP_API_KEY=

# Transit — required for transit zone
GOOGLE_MAPS_API_KEY=

# Calendar sync
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXT_PUBLIC_GOOGLE_CLIENT_ID=

# Flight status
AVIATIONSTACK_API_KEY=

# App URL (for OAuth redirects)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Coming soon (Supabase + Redis)
# NEXT_PUBLIC_SUPABASE_URL=
# NEXT_PUBLIC_SUPABASE_ANON_KEY=
# UPSTASH_REDIS_REST_URL=
# UPSTASH_REDIS_REST_TOKEN=
```

---

## ALWAYS REMEMBER

1. **This product must actually work** — not look good and be hollow
2. **Every "30 engines" pill is backed by a real adapter** — connected ones search, unconnected ones show a Connect badge
3. **The AI Concierge is always in the right 1/3** of every zone — not a toggle
4. **Progress animations must tell the truth** — tied to real `Promise.allSettled` results
5. **No `DEMO_*` data in production zone pages** — ever
6. **Hebrew users get a complete RTL experience** — not just flipped English
7. **`needs_api_key` is always better than fake data**
8. **If you're not sure something actually works, test it** — don't assume

---

*Last updated: 2026-05-31. Update this file when architecture decisions change. Never let it drift from reality.*
