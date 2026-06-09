// env.ts — Zod fail-fast environment validation
//
// USAGE:
//   1. Import `env` in every API route that needs a key.
//      Accessing a missing key throws a ZodError → Next.js returns 500 immediately.
//   2. To fail at BUILD time, add this to next.config.ts:
//        import './src/env.ts'
//
// RULE: Never access process.env directly in application code.
//       Always go through `env.*` so missing keys surface as clear validation errors,
//       not silent `undefined` that propagates deep into API calls.

import { z } from 'zod';

// ── Server-side schema (never sent to browser) ────────────────────────────────

const serverSchema = z.object({

  // ── Anthropic AI (required — core product) ───────────────────────────────
  ANTHROPIC_API_KEY: z.string().min(10, 'ANTHROPIC_API_KEY is required'),

  // ── Flight engines ────────────────────────────────────────────────────────
  // Adapters check keys at runtime and return needs_api_key gracefully.
  AMADEUS_CLIENT_ID:     z.string().min(1).optional(),   // fallback: SerpAPI
  AMADEUS_CLIENT_SECRET: z.string().min(1).optional(),   // fallback: SerpAPI
  DUFFEL_API_KEY:        z.string().min(1).optional(),   // primary flights+stays
  DUFFEL_TOKEN:          z.string().min(1).optional(),   // legacy alias
  KIWI_API_KEY:          z.string().min(1).optional(),   // fallback: SerpApiBudget
  SERPAPI_KEY:           z.string().min(1).optional(),   // Google Flights scraper

  // ── Hotel engines ─────────────────────────────────────────────────────────
  BOOKING_AFFILIATE_ID:  z.string().min(1).optional(),   // optional — direct deeplink used as fallback

  // ── Dining engines ────────────────────────────────────────────────────────
  FOURSQUARE_API_KEY:    z.string().min(1).optional(),   // real data when set
  GOOGLE_PLACES_API_KEY: z.string().min(1).optional(),   // real data when set
  YELP_API_KEY:          z.string().min(1).optional(),   // fallback: OSMAdapter (no key needed)

  // ── Attractions ───────────────────────────────────────────────────────────
  GEOAPIFY_API_KEY:      z.string().min(1).optional(),   // real data when set

  // ── Transit ───────────────────────────────────────────────────────────────
  GOOGLE_MAPS_API_KEY:   z.string().min(1).optional(),   // real data when set
  GOOGLE_ROUTES_API_KEY: z.string().min(1).optional(),

  // ── Flight status ─────────────────────────────────────────────────────────
  AVIATIONSTACK_API_KEY: z.string().min(1).optional(),

  // ── Supabase (server-side admin) ──────────────────────────────────────────
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  SUPABASE_JWT_SECRET:       z.string().min(1).optional(),

  // ── Google Calendar OAuth (optional — ICS export works without it) ────────
  GOOGLE_CLIENT_ID:           z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET:       z.string().min(1).optional(),
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_OAUTH_CLIENT_ID:     z.string().min(1).optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_OAUTH_REDIRECT_URI:  z.string().url().optional(),

  // ── Web Push ──────────────────────────────────────────────────────────────
  VAPID_PRIVATE_KEY: z.string().min(1).optional(),

  // ── App internals ─────────────────────────────────────────────────────────
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

// ── Client-side schema (safe to expose to browser via NEXT_PUBLIC_) ───────────

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL:      z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),
  NEXT_PUBLIC_BASE_URL:          z.string().url().optional(),
});

// ── Validation logic ──────────────────────────────────────────────────────────

function validateEnv() {
  const isServer = typeof window === 'undefined';

  if (isServer) {
    const parsed = serverSchema.safeParse(process.env);
    if (!parsed.success) {
      const issues = parsed.error.flatten().fieldErrors;
      const lines  = Object.entries(issues)
        .map(([k, msgs]) => `  ✗ ${k}: ${(msgs ?? []).join(', ')}`)
        .join('\n');
      throw new Error(
        `\n\n❌ Invalid environment variables detected. Fix the following before starting:\n${lines}\n`,
      );
    }

    const clientParsed = clientSchema.safeParse(process.env);
    if (!clientParsed.success) {
      const issues = clientParsed.error.flatten().fieldErrors;
      const lines  = Object.entries(issues)
        .map(([k, msgs]) => `  ✗ ${k}: ${(msgs ?? []).join(', ')}`)
        .join('\n');
      throw new Error(
        `\n\n❌ Invalid NEXT_PUBLIC_ environment variables:\n${lines}\n`,
      );
    }

    return {
      ...parsed.data,
      ...clientParsed.data,
    };
  }

  // Client-side: only validate public vars
  const parsed = clientSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL:      process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_BASE_URL:          process.env.NEXT_PUBLIC_BASE_URL,
  });

  if (!parsed.success) {
    console.error('[env] Missing NEXT_PUBLIC_ vars:', parsed.error.flatten().fieldErrors);
  }

  return {
    // Stubs for server keys (undefined on client — never accessed)
    ANTHROPIC_API_KEY:          undefined as unknown as string,
    AMADEUS_CLIENT_ID:          undefined as string | undefined,
    AMADEUS_CLIENT_SECRET:      undefined as string | undefined,
    DUFFEL_API_KEY:             undefined as string | undefined,
    DUFFEL_TOKEN:               undefined as string | undefined,
    KIWI_API_KEY:               undefined as string | undefined,
    SERPAPI_KEY:                undefined as string | undefined,
    BOOKING_AFFILIATE_ID:       undefined as string | undefined,
    FOURSQUARE_API_KEY:         undefined as string | undefined,
    GOOGLE_PLACES_API_KEY:      undefined as string | undefined,
    YELP_API_KEY:               undefined as string | undefined,
    GEOAPIFY_API_KEY:           undefined as string | undefined,
    GOOGLE_MAPS_API_KEY:        undefined as string | undefined,
    GOOGLE_ROUTES_API_KEY:      undefined as string | undefined,
    AVIATIONSTACK_API_KEY:      undefined as string | undefined,
    SUPABASE_SERVICE_ROLE_KEY:  undefined as unknown as string,
    SUPABASE_JWT_SECRET:        undefined as string | undefined,
    VAPID_PRIVATE_KEY:          undefined as string | undefined,
    GOOGLE_CLIENT_ID:           undefined as string | undefined,
    GOOGLE_CLIENT_SECRET:       undefined as string | undefined,
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: undefined as string | undefined,
    GOOGLE_OAUTH_CLIENT_ID:     undefined as string | undefined,
    GOOGLE_OAUTH_CLIENT_SECRET: undefined as string | undefined,
    GOOGLE_OAUTH_REDIRECT_URI:  undefined as string | undefined,
    NODE_ENV:                   (process.env.NODE_ENV ?? 'development') as 'development' | 'production' | 'test',
    ...(parsed.success ? parsed.data : {}),
  };
}

export const env = validateEnv();

// ── Type export ───────────────────────────────────────────────────────────────

export type Env = typeof env;
