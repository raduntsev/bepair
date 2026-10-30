'use client';

/*
  Bepair — session, profile, partner and the couple's paired settings.
  One provider, because nearly every screen needs all four, and because the
  partner and the paired settings change underneath you (they join, they agree).
*/

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Session, User } from '@supabase/supabase-js';
import supabase, { isNativeShell, NATIVE_AUTH_CALLBACK } from '@/lib/supabase';
import { localTimezone } from '@/lib/dates';
import { clearWidgets } from '@/lib/native';
import type { Gender } from '@/lib/words';

export interface Profile {
  id: string;
  space_id: string | null;
  display_name: string;
  avatar_url: string | null;
  timezone: string | null;
  gender: 'm' | 'f' | null;
  onboarded_at: string | null;
  cycle_tracking: boolean;
  notify_pings: boolean;
  notify_day: boolean;
  notify_tasks: boolean;
  notify_letters: boolean;
  notify_sound: boolean;
  widget_hide_colors: boolean;
}

export interface Partner {
  id: string;
  display_name: string;
  avatar_url: string | null;
  gender: Gender;
  timezone: string | null;
}

export interface SpaceSettings {
  space_id: string;
  reveal_first: boolean;
  chronicle_deletable: boolean;
  long_distance: boolean;
  count_streak: boolean;
  together_since: string | null;
  pending_key: string | null;
  pending_value: boolean | null;
  pending_by: string | null;
}

const PROFILE_COLUMNS =
  'id, space_id, display_name, avatar_url, timezone, gender, onboarded_at, cycle_tracking, notify_pings, notify_day, notify_tasks, notify_letters, notify_sound, widget_hide_colors';

export const INVITE_KEY = 'bepair-invite';

interface State {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  partner: Partner | null;
  settings: SpaceSettings | null;
  inviteCode: string | null;
  isLoading: boolean;
  /* A load failure, worded for the person — never raw PostgREST text. */
  error: string | null;
  /* The database is older than the app: migration 0002 has not been applied. */
  needsMigration: boolean;
}

interface Value extends State {
  spaceId: string | null;
  isAuthenticated: boolean;
  hasSpace: boolean;
  sendMagicLink: (email: string) => Promise<boolean>;
  signInWithGoogle: () => Promise<void>;
  createSpace: () => Promise<boolean>;
  joinSpace: (code: string) => Promise<boolean>;
  updateProfile: (patch: Partial<Omit<Profile, 'id' | 'space_id'>>) => Promise<boolean>;
  updateDisplayName: (name: string) => Promise<void>;
  refresh: () => Promise<void>;
  refreshSettings: () => Promise<void>;
  clearError: () => void;
  signOut: () => Promise<void>;
  getInviteUrl: () => string | null;
}

const Context = createContext<Value | null>(null);

const EMPTY: State = {
  user: null,
  session: null,
  profile: null,
  partner: null,
  settings: null,
  inviteCode: null,
  isLoading: true,
  error: null,
  needsMigration: false,
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<State>(EMPTY);
  const sessionRef = useRef<Session | null>(null);

  const loadSettings = useCallback(async () => {
    const { data, error } = await supabase.rpc('bp_settings');
    if (error) return null;
    return (data as SpaceSettings | null) ?? null;
  }, []);

  const load = useCallback(
    async (session: Session | null) => {
      sessionRef.current = session;
      if (!session?.user) {
        setState({ ...EMPTY, isLoading: false });
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select(PROFILE_COLUMNS)
        .eq('id', session.user.id)
        .maybeSingle();

      if (profileError) {
        setState((s) => ({
          ...s,
          user: session.user,
          session,
          isLoading: false,
          needsMigration: profileError.code === '42703',
          error: 'Не удалось загрузить профиль. Проверьте связь и обновите страницу.',
        }));
        return;
      }

      let current = (profile as Profile | null) ?? null;

      /* «Сегодня» is computed in the person's own zone; keep the database told. */
      const zone = localTimezone();
      if (current && zone && current.timezone !== zone) {
        const { error: zoneError } = await supabase.from('profiles').update({ timezone: zone }).eq('id', current.id);
        if (!zoneError) current = { ...current, timezone: zone };
      }

      let partner: Partner | null = null;
      let inviteCode: string | null = null;
      let settings: SpaceSettings | null = null;

      if (current?.space_id) {
        const [partnerResult, spaceResult, settingsResult] = await Promise.all([
          supabase
            .from('profiles')
            .select('id, display_name, avatar_url, gender, timezone')
            .eq('space_id', current.space_id)
            .neq('id', current.id)
            .maybeSingle(),
          supabase.from('spaces').select('invite_code').eq('id', current.space_id).maybeSingle(),
          loadSettings(),
        ]);
        partner = (partnerResult.data as Partner | null) ?? null;
        inviteCode = spaceResult.data?.invite_code ?? null;
        settings = settingsResult;
      }

      setState({
        user: session.user,
        session,
        profile: current,
        partner,
        settings,
        inviteCode,
        isLoading: false,
        error: null,
        needsMigration: false,
      });
    },
    [loadSettings],
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => load(session));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      /* Token refreshes arrive hourly; re-reading everything for them only flickers the UI. */
      if (event === 'TOKEN_REFRESHED') {
        sessionRef.current = session;
        return;
      }
      load(session);
    });
    return () => subscription.unsubscribe();
  }, [load]);

  const spaceId = state.profile?.space_id ?? null;

  /* The partner joining, and paired settings agreed on the other phone. */
  useEffect(() => {
    if (!spaceId) return;
    const channel = supabase
      .channel(`space:${spaceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'space_settings', filter: `space_id=eq.${spaceId}` }, async () => {
        const settings = await loadSettings();
        if (settings) setState((s) => ({ ...s, settings }));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        const kind = (payload.new as { kind?: string }).kind;
        if (kind === 'joined') load(sessionRef.current);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [spaceId, loadSettings, load]);

  const refresh = useCallback(() => load(sessionRef.current), [load]);

  const refreshSettings = useCallback(async () => {
    const settings = await loadSettings();
    if (settings) setState((s) => ({ ...s, settings }));
  }, [loadSettings]);

  const sendMagicLink = useCallback(async (email: string) => {
    setState((s) => ({ ...s, error: null }));
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: isNativeShell() ? NATIVE_AUTH_CALLBACK : `${window.location.origin}/auth/callback`,
        shouldCreateUser: true,
      },
    });
    if (error) {
      setState((s) => ({
        ...s,
        error:
          error.status === 429
            ? 'Слишком много попыток подряд. Подождите минуту и попробуйте снова.'
            : 'Не получилось отправить ссылку. Проверьте адрес и попробуйте ещё раз.',
      }));
      return false;
    }
    return true;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setState((s) => ({ ...s, error: null }));
    /*
      Google refuses to sign in inside an embedded web view, so the native app
      opens the system browser and waits for vpare://auth-callback.
    */
    if (isNativeShell()) {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: NATIVE_AUTH_CALLBACK, skipBrowserRedirect: true },
      });
      if (!error && data.url) {
        const { Browser } = await import('@capacitor/browser');
        await Browser.open({ url: data.url, presentationStyle: 'popover' });
        return;
      }
      setState((s) => ({ ...s, error: 'Вход через Google сейчас недоступен. Войдите по ссылке на почту.' }));
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setState((s) => ({
        ...s,
        error: 'Вход через Google сейчас недоступен. Войдите по ссылке на почту.',
      }));
    }
  }, []);

  const createSpace = useCallback(async () => {
    const user = sessionRef.current?.user;
    if (!user) return false;
    setState((s) => ({ ...s, error: null }));

    const { data: space, error: spaceError } = await supabase
      .from('spaces')
      .insert({ name: 'Наше пространство' })
      .select('id, invite_code')
      .single();

    if (spaceError || !space) {
      setState((s) => ({ ...s, error: 'Не получилось создать пространство. Попробуйте ещё раз.' }));
      return false;
    }

    const { error: profileError } = await supabase.from('profiles').update({ space_id: space.id }).eq('id', user.id);
    if (profileError) {
      setState((s) => ({ ...s, error: 'Пространство создано, но не привязалось к вам. Попробуйте ещё раз.' }));
      return false;
    }

    await supabase.from('wallet').insert({ space_id: space.id, balance: 0 });
    await load(sessionRef.current);
    return true;
  }, [load]);

  const joinSpace = useCallback(
    async (rawCode: string) => {
      const user = sessionRef.current?.user;
      if (!user) return false;
      const code = rawCode.trim().toLowerCase();
      setState((s) => ({ ...s, error: null }));

      const { data: space } = await supabase.from('spaces').select('id').eq('invite_code', code).maybeSingle();
      if (!space) {
        setState((s) => ({ ...s, error: 'Такого кода нет. Проверьте, что он скопирован целиком.' }));
        return false;
      }

      const { count } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('space_id', space.id);

      if ((count ?? 0) >= 2) {
        setState((s) => ({ ...s, error: 'В этом пространстве уже двое. Попросите у партнёра свежий код.' }));
        return false;
      }

      const { error: joinError } = await supabase.from('profiles').update({ space_id: space.id }).eq('id', user.id);
      if (joinError) {
        setState((s) => ({ ...s, error: 'Не получилось войти в пространство. Попробуйте ещё раз.' }));
        return false;
      }

      try {
        localStorage.removeItem(INVITE_KEY);
      } catch {}
      await load(sessionRef.current);
      return true;
    },
    [load],
  );

  const updateProfile = useCallback(async (patch: Partial<Omit<Profile, 'id' | 'space_id'>>) => {
    const user = sessionRef.current?.user;
    if (!user) return false;
    const { error } = await supabase.from('profiles').update(patch).eq('id', user.id);
    if (error) return false;
    setState((s) => ({ ...s, profile: s.profile ? { ...s.profile, ...patch } : s.profile }));
    return true;
  }, []);

  const updateDisplayName = useCallback(
    async (name: string) => {
      await updateProfile({ display_name: name });
    },
    [updateProfile],
  );

  const signOut = useCallback(async () => {
    /* The widget's key belongs to this account; a signed-out phone shows nothing private. */
    await clearWidgets();
    await supabase.auth.signOut();
    setState({ ...EMPTY, isLoading: false });
    router.push('/');
  }, [router]);

  const getInviteUrl = useCallback(() => {
    if (!state.inviteCode) return null;
    return `${window.location.origin}/join/${state.inviteCode}`;
  }, [state.inviteCode]);

  const clearError = useCallback(() => setState((s) => ({ ...s, error: null })), []);

  const value = useMemo<Value>(
    () => ({
      ...state,
      spaceId,
      isAuthenticated: !!state.user,
      hasSpace: !!spaceId,
      sendMagicLink,
      signInWithGoogle,
      createSpace,
      joinSpace,
      updateProfile,
      updateDisplayName,
      refresh,
      refreshSettings,
      clearError,
      signOut,
      getInviteUrl,
    }),
    [
      state,
      spaceId,
      sendMagicLink,
      signInWithGoogle,
      createSpace,
      joinSpace,
      updateProfile,
      updateDisplayName,
      refresh,
      refreshSettings,
      clearError,
      signOut,
      getInviteUrl,
    ],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSpaceAuth() {
  const context = useContext(Context);
  if (!context) throw new Error('useSpaceAuth must be used within <AuthProvider>');
  return context;
}
