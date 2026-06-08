import { NextRequest, NextResponse } from 'next/server';
import { z }                         from 'zod';
import { getSupabaseAdmin }          from '@/lib/supabase-admin';

const SaveSchema = z.object({
  tripId:  z.string().uuid().optional(),
  userId:  z.string().uuid(),
  role:    z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1),
});

// ── GET — fetch last 50 messages for a trip ──────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ status: 'needs_api_key', messages: [] });

  const userId = req.nextUrl.searchParams.get('userId');
  const tripId = req.nextUrl.searchParams.get('tripId');
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  let query = sb.from('chat_history').select('*').eq('user_id', userId)
    .order('created_at', { ascending: false }).limit(50);
  if (tripId) query = query.eq('trip_id', tripId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ status: 'ok', messages: (data ?? []).reverse() });
}

// ── POST — append a message ──────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ status: 'needs_api_key' });

  const body   = await req.json().catch(() => ({}));
  const parsed = SaveSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { tripId, userId, role, content } = parsed.data;
  const { error } = await sb.from('chat_history').insert({
    user_id: userId, trip_id: tripId ?? null, role, content,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ status: 'ok' });
}
