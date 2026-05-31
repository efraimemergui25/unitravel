import { NextRequest, NextResponse } from 'next/server';

// ── Google Calendar OAuth callback ────────────────────────────────────────────
//
// Flow: CalendarSync.connectGoogle() opens a popup → Google redirects here
// with ?code=... → we exchange the code for tokens → postMessage to opener
// → popup closes.
//
// Production: swap the token exchange below with a real server-side POST to
// https://oauth2.googleapis.com/token using your GOOGLE_CLIENT_SECRET.
//
// ─────────────────────────────────────────────────────────────────────────────

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code    = searchParams.get('code');
  const state   = searchParams.get('state');
  const error   = searchParams.get('error');

  // Handle OAuth denial
  if (error || !code) {
    return new NextResponse(buildPopupHtml({ success: false, error: error ?? 'no_code' }), {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  // Validate state contains our prefix (CSRF guard)
  if (!state?.startsWith('unitravel_')) {
    return new NextResponse(buildPopupHtml({ success: false, error: 'invalid_state' }), {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  // Exchange authorization code for access + refresh tokens
  const clientId     = process.env.GOOGLE_CLIENT_ID ?? process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? '';
  const redirectUri  = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/calendar/callback`;

  let accessToken = '';
  let expiresIn   = 3600;

  if (clientId && clientSecret) {
    try {
      const res = await fetch(GOOGLE_TOKEN_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id:     clientId,
          client_secret: clientSecret,
          redirect_uri:  redirectUri,
          grant_type:    'authorization_code',
        }),
      });
      const data = await res.json() as { access_token?: string; expires_in?: number };
      accessToken = data.access_token ?? '';
      expiresIn   = data.expires_in   ?? 3600;
    } catch {
      return new NextResponse(buildPopupHtml({ success: false, error: 'token_exchange_failed' }), {
        headers: { 'Content-Type': 'text/html' },
      });
    }
  } else {
    // Demo mode: generate a mock token so the UI can proceed
    accessToken = `demo_${Date.now()}`;
  }

  return new NextResponse(buildPopupHtml({ success: true, accessToken, expiresIn }), {
    headers: { 'Content-Type': 'text/html' },
  });
}

// ── Popup HTML shell ──────────────────────────────────────────────────────────
// postMessage relays the token back to the main window, then self-closes.

function buildPopupHtml(payload: { success: boolean; error?: string; accessToken?: string; expiresIn?: number }): string {
  return `<!DOCTYPE html>
<html>
<head><title>Unitravel · Calendar Sync</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
         display:flex; align-items:center; justify-content:center; min-height:100vh;
         margin:0; background:#F5F5F7; color:#1D1D1F; }
  .card { text-align:center; padding:40px; background:rgba(255,255,255,0.82);
          border-radius:24px; border:1px solid rgba(255,255,255,0.9);
          backdrop-filter:blur(40px); box-shadow:0 8px 40px rgba(0,0,0,0.10); max-width:320px; }
  .icon { font-size:48px; margin-bottom:16px; }
  h1 { font-size:18px; font-weight:800; margin:0 0 8px; }
  p  { font-size:13px; color:#6E6E73; margin:0; }
</style>
</head>
<body>
<div class="card">
  <div class="icon">${payload.success ? '✅' : '❌'}</div>
  <h1>${payload.success ? 'Connected!' : 'Connection Failed'}</h1>
  <p>${payload.success ? 'Google Calendar is now synced. This window will close...' : `Error: ${payload.error}`}</p>
</div>
<script>
  try {
    window.opener?.postMessage(
      ${JSON.stringify({ type: 'unitravel-calendar-auth', ...payload })},
      window.location.origin
    );
  } catch {}
  setTimeout(() => window.close(), ${payload.success ? 1500 : 3000});
</script>
</body>
</html>`;
}
