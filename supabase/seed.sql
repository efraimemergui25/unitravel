-- ============================================================
-- UNITRAVEL — GENESIS SEED v1
-- Development workspace initializer.
-- Run via: supabase db seed
-- Seeds: 2 auth users → users_dna → 1 trip → 3 timeline_nodes
-- UUIDs are fixed so the seed is idempotent (safe to re-run).
-- ============================================================

-- Fixed dev UUIDs — stable across resets
-- Effi:  a1b2c3d4-0001-0000-0000-000000000001
-- Nofar: a1b2c3d4-0002-0000-0000-000000000002
-- Trip:  b2c3d4e5-0001-0000-0000-000000000001

-- ============================================================
-- STEP 1: Auth users (auth schema — service role only)
-- ============================================================

INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  created_at,
  updated_at
) VALUES
(
  '00000000-0000-0000-0000-000000000000',
  'a1b2c3d4-0001-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'effi@unitravel.dev',
  crypt('dev-password-2026', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Effi","display_name":"Effi"}'::jsonb,
  false,
  now(),
  now()
),
(
  '00000000-0000-0000-0000-000000000000',
  'a1b2c3d4-0002-0000-0000-000000000002',
  'authenticated',
  'authenticated',
  'nofar@unitravel.dev',
  crypt('dev-password-2026', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Nofar","display_name":"Nofar"}'::jsonb,
  false,
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 2: users_dna — traveler identity profiles
-- ============================================================

INSERT INTO public.users_dna (
  id,
  preferred_airlines,
  banned_airlines,
  dietary_needs,
  budget_tier
) VALUES
(
  -- Effi: luxury tier, prefers El Al + Emirates, no low-cost
  'a1b2c3d4-0001-0000-0000-000000000001',
  '["El Al", "Emirates", "Lufthansa"]'::jsonb,
  '["Ryanair", "EasyJet", "Spirit", "Wizz Air"]'::jsonb,
  '["kosher"]'::jsonb,
  'luxury'
),
(
  -- Nofar: luxury tier, same airlines, vegetarian, window-seat preference
  'a1b2c3d4-0002-0000-0000-000000000002',
  '["El Al", "Emirates", "Qatar Airways"]'::jsonb,
  '["Ryanair", "EasyJet", "Spirit", "Frontier"]'::jsonb,
  '["vegetarian", "gluten-free"]'::jsonb,
  'luxury'
)
ON CONFLICT (id) DO UPDATE SET
  preferred_airlines = EXCLUDED.preferred_airlines,
  banned_airlines    = EXCLUDED.banned_airlines,
  dietary_needs      = EXCLUDED.dietary_needs,
  budget_tier        = EXCLUDED.budget_tier,
  updated_at         = now();

-- ============================================================
-- STEP 3: trips — the master workspace
-- ============================================================

INSERT INTO public.trips (
  id,
  owner_id,
  collaborators,
  destination_context,
  start_date,
  end_date
) VALUES (
  'b2c3d4e5-0001-0000-0000-000000000001',
  'a1b2c3d4-0001-0000-0000-000000000001',
  '["a1b2c3d4-0002-0000-0000-000000000002"]'::jsonb,
  'Multi-leg honeymoon: Miami (MIA) → Mexico City (MEX) → Bahamas (NAS)',
  '2026-10-02',
  '2026-10-25'
)
ON CONFLICT (id) DO UPDATE SET
  destination_context = EXCLUDED.destination_context,
  start_date          = EXCLUDED.start_date,
  end_date            = EXCLUDED.end_date,
  updated_at          = now();

-- ============================================================
-- STEP 4: timeline_nodes — 3 seed nodes
-- Node 1: Flight TLV → MIA (Oct 2)
-- Node 2: Hotel in Mexico City (Oct 6–12)
-- Node 3: Dinner reservation in Mexico City (Oct 8)
-- ============================================================

INSERT INTO public.timeline_nodes (
  id,
  trip_id,
  node_type,
  title,
  start_time,
  end_time,
  price_usd,
  affiliate_rate,
  raw_api_payload
) VALUES
(
  -- Node 1: El Al TLV → MIA business class
  'c3d4e5f6-0001-0000-0000-000000000001',
  'b2c3d4e5-0001-0000-0000-000000000001',
  'flight',
  'El Al LY027 · TLV → MIA · Business Class',
  '2026-10-02T06:30:00+00:00',
  '2026-10-02T16:45:00+00:00',
  2840.00,
  0.020,
  '{
    "flight_iata":      "LY027",
    "airline_iata":     "LY",
    "airline_name":     "El Al Israel Airlines",
    "origin":           "TLV",
    "destination":      "MIA",
    "cabin_class":      "business",
    "passengers":       2,
    "booking_ref":      "SEED-001",
    "source":           "amadeus"
  }'::jsonb
),
(
  -- Node 2: Boutique hotel in Polanco, Mexico City
  'c3d4e5f6-0002-0000-0000-000000000002',
  'b2c3d4e5-0001-0000-0000-000000000001',
  'hotel',
  'Camino Real Polanco México · Junior Suite · 6 nights',
  '2026-10-06T15:00:00-06:00',
  '2026-10-12T12:00:00-06:00',
  2100.00,
  0.050,
  '{
    "property_name":    "Camino Real Polanco México",
    "property_id":      "camino-real-polanco-mx",
    "room_type":        "Junior Suite",
    "check_in":         "2026-10-06",
    "check_out":        "2026-10-12",
    "nights":           6,
    "price_per_night":  350.00,
    "provider":         "booking.com",
    "source":           "booking"
  }'::jsonb
),
(
  -- Node 3: Dinner at Pujol (Michelin), Mexico City
  'c3d4e5f6-0003-0000-0000-000000000003',
  'b2c3d4e5-0001-0000-0000-000000000001',
  'dining',
  'Pujol · Chef Enrique Olvera · Tasting Menu (kosher-verified)',
  '2026-10-08T19:00:00-06:00',
  '2026-10-08T22:30:00-06:00',
  420.00,
  0.010,
  '{
    "restaurant_name":  "Pujol",
    "chef":             "Enrique Olvera",
    "cuisine":          "Contemporary Mexican",
    "michelin_stars":   1,
    "menu_type":        "Omakase Tasting Menu",
    "covers":           2,
    "dietary_verified": ["vegetarian-options", "kosher-request-noted"],
    "reservation_platform": "resy",
    "address":          "Tennyson 133, Polanco, 11550 Mexico City",
    "source":           "resy"
  }'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  title            = EXCLUDED.title,
  start_time       = EXCLUDED.start_time,
  end_time         = EXCLUDED.end_time,
  price_usd        = EXCLUDED.price_usd,
  affiliate_rate   = EXCLUDED.affiliate_rate,
  raw_api_payload  = EXCLUDED.raw_api_payload,
  updated_at       = now();

-- ============================================================
-- STEP 5: AI chat session scaffold (empty, ready for use)
-- ============================================================

INSERT INTO public.ai_chat_sessions (
  id,
  trip_id,
  category_folder,
  messages
) VALUES (
  'd4e5f6a7-0001-0000-0000-000000000001',
  'b2c3d4e5-0001-0000-0000-000000000001',
  'general',
  '[]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Verify seed loaded correctly
-- ============================================================

DO $$
DECLARE
  dna_count   int;
  trip_count  int;
  node_count  int;
BEGIN
  SELECT COUNT(*) INTO dna_count  FROM public.users_dna        WHERE id IN ('a1b2c3d4-0001-0000-0000-000000000001','a1b2c3d4-0002-0000-0000-000000000002');
  SELECT COUNT(*) INTO trip_count FROM public.trips             WHERE id = 'b2c3d4e5-0001-0000-0000-000000000001';
  SELECT COUNT(*) INTO node_count FROM public.timeline_nodes    WHERE trip_id = 'b2c3d4e5-0001-0000-0000-000000000001';

  IF dna_count < 2 OR trip_count < 1 OR node_count < 3 THEN
    RAISE EXCEPTION 'Genesis seed verification failed: dna=%, trips=%, nodes=%', dna_count, trip_count, node_count;
  END IF;

  RAISE NOTICE 'Genesis seed OK — % DNA profiles, % trip, % timeline nodes', dna_count, trip_count, node_count;
END;
$$;
