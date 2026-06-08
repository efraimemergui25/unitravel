-- ============================================================
-- UNITRAVEL — MASTER SCHEMA v1
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLE 1: users_dna
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users_dna (
  id                uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_airlines jsonb       NOT NULL DEFAULT '[]'::jsonb,
  banned_airlines    jsonb       NOT NULL DEFAULT '[]'::jsonb,
  dietary_needs      jsonb       NOT NULL DEFAULT '[]'::jsonb,
  budget_tier        text        NOT NULL DEFAULT 'mid'
                                 CHECK (budget_tier IN ('budget', 'mid', 'luxury', 'ultra')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.users_dna ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_dna: owner read"
  ON public.users_dna FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "users_dna: owner write"
  ON public.users_dna FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================================
-- TABLE 2: trips
-- ============================================================
CREATE TABLE IF NOT EXISTS public.trips (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id            uuid        NOT NULL REFERENCES public.users_dna(id) ON DELETE CASCADE,
  collaborators       jsonb       NOT NULL DEFAULT '[]'::jsonb,
  destination_context text,
  start_date          date,
  end_date            date,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trips_dates_valid CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trips: owner full access"
  ON public.trips FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "trips: collaborator read"
  ON public.trips FOR SELECT
  USING (
    auth.uid() = owner_id
    OR collaborators @> to_jsonb(auth.uid()::text)
  );

CREATE POLICY "trips: collaborator update"
  ON public.trips FOR UPDATE
  USING (
    auth.uid() = owner_id
    OR collaborators @> to_jsonb(auth.uid()::text)
  )
  WITH CHECK (
    auth.uid() = owner_id
    OR collaborators @> to_jsonb(auth.uid()::text)
  );

-- ============================================================
-- TABLE 3: timeline_nodes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.timeline_nodes (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id          uuid        NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  node_type        text        NOT NULL
                               CHECK (node_type IN ('flight', 'hotel', 'dining', 'attraction', 'transit_block')),
  title            text,
  start_time       timestamptz,
  end_time         timestamptz,
  price_usd        numeric(12, 2),
  affiliate_rate   numeric(5, 4) DEFAULT 0,
  raw_api_payload  jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT timeline_nodes_times_valid CHECK (end_time IS NULL OR start_time IS NULL OR end_time >= start_time)
);

CREATE INDEX timeline_nodes_trip_id_idx   ON public.timeline_nodes(trip_id);
CREATE INDEX timeline_nodes_start_time_idx ON public.timeline_nodes(start_time);
CREATE INDEX timeline_nodes_node_type_idx  ON public.timeline_nodes(node_type);

ALTER TABLE public.timeline_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "timeline_nodes: trip member read"
  ON public.timeline_nodes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = timeline_nodes.trip_id
        AND (
          t.owner_id = auth.uid()
          OR t.collaborators @> to_jsonb(auth.uid()::text)
        )
    )
  );

CREATE POLICY "timeline_nodes: trip member write"
  ON public.timeline_nodes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = timeline_nodes.trip_id
        AND (
          t.owner_id = auth.uid()
          OR t.collaborators @> to_jsonb(auth.uid()::text)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = timeline_nodes.trip_id
        AND (
          t.owner_id = auth.uid()
          OR t.collaborators @> to_jsonb(auth.uid()::text)
        )
    )
  );

-- ============================================================
-- TABLE 4: ai_chat_sessions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ai_chat_sessions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id         uuid        NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  category_folder text        NOT NULL DEFAULT 'general'
                              CHECK (category_folder IN ('flights', 'hotels', 'dining', 'attractions', 'transit', 'budget', 'general')),
  messages        jsonb       NOT NULL DEFAULT '[]'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ai_chat_sessions_trip_id_idx        ON public.ai_chat_sessions(trip_id);
CREATE INDEX ai_chat_sessions_category_folder_idx ON public.ai_chat_sessions(category_folder);

ALTER TABLE public.ai_chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_chat_sessions: trip member read"
  ON public.ai_chat_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = ai_chat_sessions.trip_id
        AND (
          t.owner_id = auth.uid()
          OR t.collaborators @> to_jsonb(auth.uid()::text)
        )
    )
  );

CREATE POLICY "ai_chat_sessions: trip member write"
  ON public.ai_chat_sessions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = ai_chat_sessions.trip_id
        AND (
          t.owner_id = auth.uid()
          OR t.collaborators @> to_jsonb(auth.uid()::text)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = ai_chat_sessions.trip_id
        AND (
          t.owner_id = auth.uid()
          OR t.collaborators @> to_jsonb(auth.uid()::text)
        )
    )
  );

-- ============================================================
-- AUTO-UPDATE updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER users_dna_updated_at
  BEFORE UPDATE ON public.users_dna
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trips_updated_at
  BEFORE UPDATE ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER timeline_nodes_updated_at
  BEFORE UPDATE ON public.timeline_nodes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER ai_chat_sessions_updated_at
  BEFORE UPDATE ON public.ai_chat_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
