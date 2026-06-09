// Contextual Persona Builder — server-side only.
// Queries users_dna + trips + timeline_nodes from Supabase and assembles
// a precise, fact-injected system prompt that reflects the current DB state.
// Used by /api/chat/route.ts when a valid tripId is present in the request.
// Falls back to the static buildSystemPrompt() when Supabase is unavailable.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin }                   from '@/lib/supabase-admin';

// ── DB row shapes (inferred from 0000_initial_schema.sql) ────────────────────

interface DNARow {
  id:                 string;
  preferred_airlines: string[];
  banned_airlines:    string[];
  dietary_needs:      string[];
  budget_tier:        'budget' | 'mid' | 'luxury' | 'ultra';
}

interface TripRow {
  id:                  string;
  owner_id:            string;
  collaborators:       string[];
  destination_context: string | null;
  start_date:          string | null;
  end_date:            string | null;
}

interface TimelineNodeRow {
  id:              string;
  node_type:       'flight' | 'hotel' | 'dining' | 'attraction' | 'transit_block';
  title:           string | null;
  start_time:      string | null;
  end_time:        string | null;
  price_usd:       number | null;
}

// ── Budget tier human labels (bridge DB enum → natural language) ──────────────

const BUDGET_LABELS: Record<DNARow['budget_tier'], string> = {
  budget: 'budget-conscious',
  mid:    'mid-range comfort',
  luxury: 'luxury',
  ultra:  'ultra-luxury',
};

// ── Node type labels for the timeline summary ─────────────────────────────────

const NODE_EMOJI: Record<TimelineNodeRow['node_type'], string> = {
  flight:        '✈️',
  hotel:         '🏨',
  dining:        '🍽️',
  attraction:    '🎯',
  transit_block: '🚌',
};

function formatDate(iso: string | null): string {
  if (!iso) return 'TBD';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

// ── User-scoped client (respects RLS for trip + node reads) ───────────────────

function userScopedClient(accessToken: string): SupabaseClient | null {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth:   { persistSession: false },
  });
}

// ── Public interface ──────────────────────────────────────────────────────────

export interface SystemPromptContext {
  accessToken:  string;   // Supabase user JWT — scopes DB reads via RLS
  tripId?:      string;
  locale?:      'en-US' | 'he-IL';
}

export interface BuiltPrompt {
  system:        string;
  sourceOfTruth: 'database' | 'fallback';
  tripId?:       string;
  participantCount: number;
}

// ── Core factory ──────────────────────────────────────────────────────────────

export async function buildSystemPromptFromDB(
  ctx: SystemPromptContext,
): Promise<BuiltPrompt> {
  const client = userScopedClient(ctx.accessToken);
  if (!client) {
    return {
      system:           buildFallbackPrompt(ctx.locale),
      sourceOfTruth:    'fallback',
      participantCount: 0,
    };
  }

  try {
    // ── Fetch current user ─────────────────────────────────────────────────
    const { data: { user } } = await client.auth.getUser();
    if (!user) {
      return { system: buildFallbackPrompt(ctx.locale), sourceOfTruth: 'fallback', participantCount: 0 };
    }

    // ── Fetch owner DNA ────────────────────────────────────────────────────
    const { data: ownerDNA } = await client
      .from('users_dna')
      .select('id, preferred_airlines, banned_airlines, dietary_needs, budget_tier')
      .eq('id', user.id)
      .single() as { data: DNARow | null };

    // ── Fetch trip ─────────────────────────────────────────────────────────
    let trip: TripRow | null = null;
    if (ctx.tripId) {
      const { data } = await client
        .from('trips')
        .select('id, owner_id, collaborators, destination_context, start_date, end_date')
        .eq('id', ctx.tripId)
        .single() as { data: TripRow | null };
      trip = data;
    } else {
      // Fall back to most recent trip
      const { data } = await client
        .from('trips')
        .select('id, owner_id, collaborators, destination_context, start_date, end_date')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single() as { data: TripRow | null };
      trip = data;
    }

    // ── Fetch collaborator DNA profiles ───────────────────────────────────
    const collabIds: string[] = trip?.collaborators ?? [];
    let collabProfiles: DNARow[] = [];
    if (collabIds.length > 0) {
      const admin = getSupabaseAdmin(); // need service role to read other users' DNA
      if (admin) {
        const { data } = await admin
          .from('users_dna')
          .select('id, preferred_airlines, banned_airlines, dietary_needs, budget_tier')
          .in('id', collabIds) as { data: DNARow[] | null };
        collabProfiles = data ?? [];
      }
    }
    const allProfiles = [ownerDNA, ...collabProfiles].filter(Boolean) as DNARow[];
    const participantCount = allProfiles.length;

    // ── Fetch placed timeline nodes ────────────────────────────────────────
    let nodes: TimelineNodeRow[] = [];
    if (trip?.id) {
      const { data } = await client
        .from('timeline_nodes')
        .select('id, node_type, title, start_time, end_time, price_usd')
        .eq('trip_id', trip.id)
        .order('start_time', { ascending: true }) as { data: TimelineNodeRow[] | null };
      nodes = data ?? [];
    }

    // ── Build the prompt ───────────────────────────────────────────────────
    const system = assemblePrompt({
      profiles:      allProfiles,
      trip,
      nodes,
      locale:        ctx.locale ?? 'en-US',
      participantCount,
    });

    return {
      system,
      sourceOfTruth:    'database',
      tripId:            trip?.id,
      participantCount,
    };

  } catch {
    return {
      system:           buildFallbackPrompt(ctx.locale),
      sourceOfTruth:    'fallback',
      participantCount: 0,
    };
  }
}

// ── Prompt assembly ───────────────────────────────────────────────────────────

function assemblePrompt(params: {
  profiles:         DNARow[];
  trip:             TripRow | null;
  nodes:            TimelineNodeRow[];
  locale:           'en-US' | 'he-IL';
  participantCount: number;
}): string {
  const { profiles, trip, nodes, locale, participantCount } = params;

  // ── Merge constraints across all travelers ─────────────────────────────────
  const allBanned    = [...new Set(profiles.flatMap(p => p.banned_airlines ?? []))];
  const allPreferred = [...new Set(profiles.flatMap(p => p.preferred_airlines ?? []))];
  const allDietary   = [...new Set(profiles.flatMap(p => p.dietary_needs ?? []))];
  // Highest budget tier wins (e.g. if one traveler is 'ultra', go ultra)
  const tierRank: Record<string, number> = { budget: 0, mid: 1, luxury: 2, ultra: 3 };
  const highestTier = (profiles
    .map(p => p.budget_tier)
    .sort((a, b) => (tierRank[b] ?? 0) - (tierRank[a] ?? 0))[0]) as DNARow['budget_tier'] | undefined;

  // ── Trip facts ──────────────────────────────────────────────────────────────
  const destination = trip?.destination_context ?? 'destination not yet set';
  const startDate   = formatDate(trip?.start_date ?? null);
  const endDate     = formatDate(trip?.end_date   ?? null);

  const nights = trip?.start_date && trip?.end_date
    ? Math.ceil((new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) / 86_400_000)
    : null;

  // ── Timeline summary (already placed items) ────────────────────────────────
  const timelineSummary = nodes.length === 0
    ? 'No items have been placed on the timeline yet.'
    : nodes.map(n => {
        const emoji = NODE_EMOJI[n.node_type];
        const when  = n.start_time
          ? new Date(n.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : '?';
        const price = n.price_usd ? ` ($${n.price_usd.toFixed(0)})` : '';
        return `  ${emoji} ${n.title ?? n.node_type}${price} — ${when}`;
      }).join('\n');

  const totalCommitted = nodes.reduce((s, n) => s + (n.price_usd ?? 0), 0);

  const isHebrew = locale === 'he-IL';

  return `You are Unitravel — the world's most advanced AI travel operating system. You do not give generic advice; you EXECUTE ACTIONS using the tools available to you.

═══ LIVE WORKSPACE CONTEXT (sourced from database — authoritative) ═══
Active workspace: ${participantCount}-traveler journey
Destination:      ${destination}
Dates:            ${startDate} → ${endDate}${nights ? ` (${nights} nights)` : ''}
${participantCount > 0 ? `Party size: ${participantCount} traveler${participantCount > 1 ? 's' : ''}` : ''}

═══ TRAVELER CONSTRAINTS (strictly enforced — never violate) ═══
Budget tier:           ${highestTier ? BUDGET_LABELS[highestTier] : 'not specified'}
Preferred airlines:    ${allPreferred.length > 0 ? allPreferred.join(', ') : 'no preference'}
BANNED airlines:       ${allBanned.length > 0 ? allBanned.join(', ') + ' — NEVER suggest these' : 'none'}
Dietary requirements:  ${allDietary.length > 0 ? allDietary.join(', ') + ' — MANDATORY for all dining' : 'none'}

═══ COMMITTED TIMELINE ITEMS (${nodes.length} item${nodes.length !== 1 ? 's' : ''}, $${totalCommitted.toFixed(0)} total) ═══
${timelineSummary}

═══ EXECUTION PROTOCOL ═══
1. TOOL-FIRST: Any user intent that maps to a tool → call the tool BEFORE generating prose.
2. CONSTRAINT-AWARE: Never suggest banned airlines. Always apply dietary restrictions to dining searches.
3. TIMELINE-AWARE: When user says "add it", resolve against the committed items above.
4. BUDGET-AWARE: Calibrate all recommendations to the ${highestTier ?? 'mid'} tier.
5. ZERO HALLUCINATION: Never invent flight numbers, prices, hotel names, or availability. Use tools.
6. MAX 2 SENTENCES PROSE before calling a tool. Precision over verbosity.
${isHebrew ? `7. LANGUAGE: Respond in fluent Hebrew. Format dates as DD/MM/YYYY. Currency in ₪ (ILS).` : `7. LANGUAGE: Respond in English. Format dates as MM/DD/YYYY. Currency in USD ($).`}`;
}

// ── Static fallback (when Supabase is not connected) ─────────────────────────

function buildFallbackPrompt(locale?: 'en-US' | 'he-IL'): string {
  return `You are Unitravel — an AI travel operating system. Execute actions via tools. Never hallucinate prices or availability.
${locale === 'he-IL' ? 'Respond in Hebrew. Dates: DD/MM/YYYY. Currency: ₪.' : 'Respond in English. Dates: MM/DD/YYYY. Currency: USD.'}`;
}
