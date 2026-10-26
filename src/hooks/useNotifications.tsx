'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import supabase from '@/lib/supabase';
import { flushPush, registerServiceWorker } from '@/lib/push';
import type { NoticeKind } from '@/lib/notices';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';

export interface Notice {
  id: string;
  kind: NoticeKind;
  actor_id: string | null;
  ref_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
  read_at: string | null;
}

interface Value {
  notices: Notice[];
  unread: number;
  isLoading: boolean;
  error: string | null;
  markAllRead: () => Promise<void>;
  reload: () => Promise<void>;
}

const Context = createContext<Value | null>(null);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user, spaceId } = useSpaceAuth();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user || !spaceId) return;
    const { data, error: loadError } = await supabase
      .from('notifications')
      .select('id, kind, actor_id, ref_id, payload, created_at, read_at')
      .eq('space_id', spaceId)
      .order('created_at', { ascending: false })
      .limit(60);
    if (!loadError) setNotices((data ?? []) as Notice[]);
    setError(loadError ? 'Не удалось загрузить уведомления. Проверьте связь и обновите страницу.' : null);
    setIsLoading(false);
  }, [user, spaceId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!user) return;
    /* Anything left unpushed — a letter delivered by the scheduler — goes out now. */
    registerServiceWorker();
    flushPush();
    const channel = supabase
      .channel(`notices:${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (payload) => {
        const next = payload.new as Notice;
        setNotices((list) => (list.some((n) => n.id === next.id) ? list : [next, ...list]));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, spaceId]);

  const markAllRead = useCallback(async () => {
    if (!notices.some((n) => !n.read_at)) return;
    const stamp = new Date().toISOString();
    setNotices((list) => list.map((n) => (n.read_at ? n : { ...n, read_at: stamp })));
    await supabase.rpc('bp_mark_notifications_read');
  }, [notices]);

  const value = useMemo<Value>(
    () => ({
      notices,
      unread: notices.filter((n) => !n.read_at).length,
      isLoading,
      error,
      markAllRead,
      reload: load,
    }),
    [notices, isLoading, error, markAllRead, load],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useNotifications() {
  const context = useContext(Context);
  if (!context) throw new Error('useNotifications must be used within <NotificationsProvider>');
  return context;
}
