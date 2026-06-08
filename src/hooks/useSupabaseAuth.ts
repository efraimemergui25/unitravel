'use client';

import { useState, useEffect, useCallback } from 'react';
import type { User, Session }               from '@supabase/supabase-js';
import { getSupabaseClient }                from '@/lib/supabase';

export interface AuthState {
  user:        User | null;
  session:     Session | null;
  loading:     boolean;
  isConnected: boolean; // false when Supabase env vars are not set
}

export function useSupabaseAuth(): AuthState & {
  signInWithEmail: (email: string, password: string) => Promise<string | null>;
  signUpWithEmail: (email: string, password: string) => Promise<string | null>;
  signInWithGoogle: () => Promise<string | null>;
  signOut: () => Promise<void>;
} {
  const sb = getSupabaseClient();

  const [user,    setUser]    = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!!sb);

  useEffect(() => {
    if (!sb) return;

    sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [sb]);

  const signInWithEmail = useCallback(async (email: string, password: string): Promise<string | null> => {
    if (!sb) return 'Supabase is not configured.';
    const { error } = await sb.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  }, [sb]);

  const signUpWithEmail = useCallback(async (email: string, password: string): Promise<string | null> => {
    if (!sb) return 'Supabase is not configured.';
    const { error } = await sb.auth.signUp({ email, password });
    return error?.message ?? null;
  }, [sb]);

  const signInWithGoogle = useCallback(async (): Promise<string | null> => {
    if (!sb) return 'Supabase is not configured.';
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options:  { redirectTo: `${window.location.origin}/auth/callback` },
    });
    return error?.message ?? null;
  }, [sb]);

  const signOut = useCallback(async () => {
    if (!sb) return;
    await sb.auth.signOut();
  }, [sb]);

  return {
    user, session, loading,
    isConnected: !!sb,
    signInWithEmail, signUpWithEmail, signInWithGoogle, signOut,
  };
}
