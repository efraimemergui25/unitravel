// Supabase browser-safe singleton.
// Used by the Management zone for WebSocket presence (live cursors).
// For server-side admin operations (bypassing RLS), use @/lib/supabase-admin.ts instead.

import { createClient, type SupabaseClient, type RealtimeChannel } from '@supabase/supabase-js';

// ── Typed database schema — mirrors 0000_initial_schema.sql exactly ──────────
// Insert/Update types are written out explicitly (no self-referencing Omit)
// so that supabase-js GenericSchema constraints resolve correctly.

type BudgetTierDB = 'budget' | 'mid' | 'luxury' | 'ultra';
type NodeTypeDB   = 'flight' | 'hotel' | 'dining' | 'attraction' | 'transit_block';
type ChatFolderDB = 'flights' | 'hotels' | 'dining' | 'attractions' | 'transit' | 'budget' | 'general';

export interface Database {
  public: {
    Tables: {
      users_dna: {
        Row: {
          id:                 string;
          preferred_airlines: string[];
          banned_airlines:    string[];
          dietary_needs:      string[];
          budget_tier:        BudgetTierDB;
          created_at:         string;
          updated_at:         string;
        };
        Insert: {
          id:                  string;
          preferred_airlines?: string[];
          banned_airlines?:    string[];
          dietary_needs?:      string[];
          budget_tier?:        BudgetTierDB;
        };
        Update: {
          preferred_airlines?: string[];
          banned_airlines?:    string[];
          dietary_needs?:      string[];
          budget_tier?:        BudgetTierDB;
        };
      };
      trips: {
        Row: {
          id:                  string;
          owner_id:            string;
          collaborators:       string[];
          destination_context: string | null;
          start_date:          string | null;
          end_date:            string | null;
          created_at:          string;
          updated_at:          string;
        };
        Insert: {
          id?:                 string;
          owner_id:            string;
          collaborators?:      string[];
          destination_context?:string | null;
          start_date?:         string | null;
          end_date?:           string | null;
        };
        Update: {
          owner_id?:            string;
          collaborators?:       string[];
          destination_context?: string | null;
          start_date?:          string | null;
          end_date?:            string | null;
        };
      };
      timeline_nodes: {
        Row: {
          id:              string;
          trip_id:         string;
          node_type:       NodeTypeDB;
          title:           string | null;
          start_time:      string | null;
          end_time:        string | null;
          price_usd:       number | null;
          affiliate_rate:  number | null;
          raw_api_payload: Record<string, unknown>;
          created_at:      string;
          updated_at:      string;
        };
        Insert: {
          id?:             string;
          trip_id:         string;
          node_type:       NodeTypeDB;
          title?:          string | null;
          start_time?:     string | null;
          end_time?:       string | null;
          price_usd?:      number | null;
          affiliate_rate?: number | null;
          raw_api_payload?:Record<string, unknown>;
        };
        Update: {
          node_type?:       NodeTypeDB;
          title?:           string | null;
          start_time?:      string | null;
          end_time?:        string | null;
          price_usd?:       number | null;
          affiliate_rate?:  number | null;
          raw_api_payload?: Record<string, unknown>;
        };
      };
      ai_chat_sessions: {
        Row: {
          id:              string;
          trip_id:         string;
          category_folder: ChatFolderDB;
          messages:        unknown[];
          created_at:      string;
          updated_at:      string;
        };
        Insert: {
          id?:              string;
          trip_id:          string;
          category_folder?: ChatFolderDB;
          messages?:        unknown[];
        };
        Update: {
          category_folder?: ChatFolderDB;
          messages?:        unknown[];
        };
      };
    };
    Views:     Record<string, never>;
    Functions: Record<string, never>;
    Enums:     Record<string, never>;
  };
}

// ── Live cursor presence type (Management zone multiplayer) ───────────────────

export interface CursorPresence {
  userId:     string;
  displayName:string;
  color:      string;    // CSS hex
  x:          number;    // viewport-relative 0–1
  y:          number;
  zone:       string;    // active zone slug
  updatedAt:  number;    // Date.now()
}

// ── Singleton factory ─────────────────────────────────────────────────────────
// Returns an untyped SupabaseClient so callers can use raw column names without
// fighting the generic constraint. Use createClient<Database>(...) directly
// in server-side code (SystemPromptFactory, etc.) for fully-typed queries.

let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (typeof window === 'undefined') return null;
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!_client) {
    _client = createClient(url, key, {
      realtime: { params: { eventsPerSecond: 10 } },
    });
  }
  return _client;
}

// ── Live cursor channel helpers ───────────────────────────────────────────────
// Used exclusively by components/management/MultiplayerCanvas.tsx

export function getPresenceChannel(tripId: string): RealtimeChannel | null {
  const client = getSupabaseClient();
  if (!client) return null;
  return client.channel(`cursors:${tripId}`, {
    config: { presence: { key: tripId } },
  });
}

export function broadcastCursor(
  channel: RealtimeChannel,
  presence: CursorPresence,
): void {
  channel.track(presence);
}
