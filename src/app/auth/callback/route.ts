import { NextRequest, NextResponse } from 'next/server';

// ── Supabase OAuth callback ───────────────────────────────────────────────────
// Supabase redirects here after Google OAuth with a code in the URL fragment.
// The JS client (@supabase/supabase-js) handles the token exchange automatically
// when the page loads — this route just redirects back to the app.

export async function GET(req: NextRequest): Promise<NextResponse> {
  const origin = req.nextUrl.origin;
  // The actual code exchange happens in the browser via the Supabase JS client.
  // We just need to redirect to a page that loads the client.
  return NextResponse.redirect(`${origin}/`);
}
