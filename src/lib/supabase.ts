import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

// ── Supabase client (browser-safe) ────────────────────────────────────────────
// Returns null when env vars are not set, so features degrade gracefully.

let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (typeof window === 'undefined') return null; // server: use getSupabaseAdmin
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!_client) _client = createClient(url, key);
  return _client;
}

// ── Required SQL (run once in Supabase dashboard / migrations) ────────────────
/*
create table if not exists trips (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  title       text,
  payload     jsonb not null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
alter table trips enable row level security;
create policy "Users own their trips"
  on trips for all using (auth.uid() = user_id);

create table if not exists chat_history (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  trip_id     uuid references trips(id) on delete cascade,
  role        text check (role in ('user','assistant','system')),
  content     text not null,
  created_at  timestamptz default now()
);
alter table chat_history enable row level security;
create policy "Users own their chat history"
  on chat_history for all using (auth.uid() = user_id);
*/
