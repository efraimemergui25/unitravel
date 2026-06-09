import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, subject, message, extra, urgent } = body;

    if (!name || !email || !subject || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { error } = await supabase.from('contact_messages').insert({
      name:      name.trim(),
      email:     email.trim().toLowerCase(),
      subject,
      message:   message.trim(),
      extra:     extra ?? null,
      urgent:    !!urgent,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error('[contact] supabase insert error:', error.message);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[contact] unexpected error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
