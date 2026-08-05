// src/hooks/useSpaceAuth.ts
// Lumina — Authentication & Space Linking Logic
// "Secret Link" invitation flow: no passwords, no friction.

'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

// ── Interfaces ────────────────────────────────────────────────────────────────

interface Profile {
  id:            string;
  space_id:      string | null;
  display_name:  string;
  avatar_url:    string | null;
  total_balance: number;
}

interface SpaceAuthState {
  user:       User | null;
  session:    Session | null;
  profile:    Profile | null;
  spaceId:    string | null;
  inviteCode: string | null;
  isLoading:  boolean;
  error:      string | null;
}

interface SpaceAuthValue extends SpaceAuthState {
  sendMagicLink:     (email: string) => Promise<boolean>;
  createSpace:       (spaceName?: string) => Promise<any | null>;
  joinSpace:         (inviteCode: string) => Promise<boolean>;
  updateDisplayName: (name: string) => Promise<void>;
  signOut:           () => Promise<void>;
  getInviteUrl:      () => string | null;
  isAuthenticated:   boolean;
  hasSpace:          boolean;
}

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<SpaceAuthValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const [state, setState] = useState<SpaceAuthState>({
    user:       null,
    session:    null,
    profile:    null,
    spaceId:    null,
    inviteCode: null,
    isLoading:  true,
    error:      null,
  });

  // ── Core: load profile from session ────────────────────────────────────────

  const loadData = useCallback(async (session: Session | null) => {
    if (!session?.user) {
      setState(s => ({
        ...s,
        user: null, session: null, profile: null, spaceId: null,
        isLoading: false,
      }));
      return;
    }

    try {
      const { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('id, space_id, display_name, avatar_url, total_balance')
        .eq('id', session.user.id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      /*
        The invite code must be re-read on every load. It was previously set
        only by createSpace, so after any reload the UI fell back to showing the
        raw space_id — which joinSpace looks up by invite_code and never finds.
      */
      let inviteCode: string | null = null;
      if (profile?.space_id) {
        const { data: space } = await supabase
          .from('spaces')
          .select('invite_code')
          .eq('id', profile.space_id)
          .maybeSingle();
        inviteCode = space?.invite_code ?? null;
      }

      setState(s => ({
        ...s,
        user:      session.user,
        session,
        profile:   profile || null,
        spaceId:   profile?.space_id || null,
        inviteCode,
        isLoading: false,
        error:     null,
      }));
    } catch {
      setState(s => ({ ...s, isLoading: false, error: 'Ошибка загрузки профиля' }));
    }
  }, []);

  // ── Init: session + auth listener ──────────────────────────────────────────

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => loadData(session));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      loadData(session);
    });

    return () => subscription.unsubscribe();
  }, [loadData]);

  // ── STEP 1: Send magic link ─────────────────────────────────────────────────

  const sendMagicLink = useCallback(async (email: string) => {
    setState(s => ({ ...s, isLoading: true, error: null }));
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        shouldCreateUser: true,
      },
    });
    setState(s => ({ ...s, isLoading: false, error: error?.message ?? null }));
    return !error;
  }, []);

  // ── STEP 2 (Creator): Create space + get invite code ───────────────────────

  const createSpace = useCallback(async (spaceName?: string) => {
    if (!state.user) return null;
    setState(s => ({ ...s, isLoading: true, error: null }));

    const { data: space, error: spaceError } = await supabase
      .from('spaces')
      .insert({ name: spaceName ?? 'Our Space' })
      .select()
      .single();

    if (spaceError) {
      setState(s => ({ ...s, isLoading: false, error: spaceError.message }));
      return null;
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ space_id: space.id })
      .eq('id', state.user.id);

    if (profileError) {
      setState(s => ({ ...s, isLoading: false, error: profileError.message }));
      return null;
    }

    await supabase.from('wallet').insert({ space_id: space.id, balance: 0 });

    setState(s => ({
      ...s,
      spaceId:    space.id,
      inviteCode: space.invite_code,
      isLoading:  false,
    }));

    return space;
  }, [state.user]);

  // ── STEP 2 (Partner): Join via invite code ─────────────────────────────────

  const joinSpace = useCallback(async (inviteCode: string) => {
    if (!state.user) return false;
    setState(s => ({ ...s, isLoading: true, error: null }));

    const { data: space, error: findError } = await supabase
      .from('spaces')
      .select('id, invite_code')
      .eq('invite_code', inviteCode.trim().toLowerCase())
      .single();

    if (findError || !space) {
      setState(s => ({
        ...s,
        isLoading: false,
        error: 'Invite code not found. Check the link and try again.',
      }));
      return false;
    }

    const { count } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('space_id', space.id);

    if ((count ?? 0) >= 2) {
      setState(s => ({
        ...s,
        isLoading: false,
        error: 'This space is already full (2 partners maximum).',
      }));
      return false;
    }

    const { error: joinError } = await supabase
      .from('profiles')
      .update({ space_id: space.id })
      .eq('id', state.user!.id);

    if (joinError) {
      setState(s => ({ ...s, isLoading: false, error: joinError.message }));
      return false;
    }

    setState(s => ({ ...s, spaceId: space.id, isLoading: false }));
    return true;
  }, [state.user]);

  // ── Update display name ────────────────────────────────────────────────────

  const updateDisplayName = useCallback(async (name: string) => {
    if (!state.user) return;
    await supabase.from('profiles').update({ display_name: name }).eq('id', state.user.id);
    setState(s => ({
      ...s,
      profile: s.profile ? { ...s.profile, display_name: name } : null,
    }));
  }, [state.user]);

  // ── Sign out ───────────────────────────────────────────────────────────────

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setState({
      user: null, session: null, profile: null,
      spaceId: null, inviteCode: null, isLoading: false, error: null,
    });
    router.push('/');
  }, [router]);

  // ── Generate shareable invite URL ──────────────────────────────────────────

  const getInviteUrl = useCallback(() => {
    const code = state.inviteCode ?? state.profile?.space_id;
    if (!code) return null;
    return `${window.location.origin}/join/${code}`;
  }, [state.inviteCode, state.profile?.space_id]);

  // ── Memoized context value ─────────────────────────────────────────────────

  const value = useMemo<SpaceAuthValue>(() => ({
    ...state,
    sendMagicLink,
    createSpace,
    joinSpace,
    updateDisplayName,
    signOut,
    getInviteUrl,
    isAuthenticated: !!state.user,
    hasSpace:        !!state.spaceId,
  }), [state, sendMagicLink, createSpace, joinSpace, updateDisplayName, signOut, getInviteUrl]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSpaceAuth(): SpaceAuthValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useSpaceAuth must be used within <AuthProvider>');
  return context;
}