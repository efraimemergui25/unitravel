import { NextRequest, NextResponse } from 'next/server';
import { z }                         from 'zod';
import { getSupabaseAdmin }          from '@/lib/supabase-admin';

// ── GET — list user's trips ──────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const sb = getSupabaseAdmin();
  if (!sb) {
    return NextResponse.json({ status: 'needs_api_key', trips: [],
      setupMessage: 'Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.' });
  }

  const userId = req.headers.get('x-user-id');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await sb
    .from('trips')
    .select('id, title, created_at, updated_at, payload')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ status: 'ok', trips: data });
}

// ── POST — save/upsert a trip ────────────────────────────────────────────────

const SaveSchema = z.object({
  id:      z.string().uuid().optional(),
  title:   z.string().min(1).max(120),
  payload: z.record(z.string(), z.unknown()),
  userId:  z.string().uuid(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const sb = getSupabaseAdmin();
  if (!sb) {
    return NextResponse.json({ status: 'needs_api_key',
      setupMessage: 'Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.' });
  }

  const body   = await req.json().catch(() => ({}));
  const parsed = SaveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { id, title, payload, userId } = parsed.data;

  const { data, error } = await sb.from('trips').upsert({
    ...(id ? { id } : {}),
    user_id:    userId,
    title,
    payload,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ status: 'ok', trip: data });
}

// ── DELETE — remove a trip ───────────────────────────────────────────────────

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });

  const { id, userId } = await req.json().catch(() => ({}));
  if (!id || !userId) return NextResponse.json({ error: 'id and userId required' }, { status: 400 });

  const { error } = await sb.from('trips').delete().eq('id', id).eq('user_id', userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ status: 'ok' });
}
