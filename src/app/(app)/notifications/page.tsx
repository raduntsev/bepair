'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Bell, Gift, ListChecks, Mail, Moon, Send, Settings2, SlidersHorizontal, Sun, Sunrise, UserPlus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { relativeStamp } from '@/lib/dates';
import { noticeHref, noticeText, type NoticeKind } from '@/lib/notices';
import { displayName } from '@/lib/words';
import { useNotifications } from '@/hooks/useNotifications';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { Alert, EmptyState, Loading, Page, PageHeader } from '@/components/ui/Blocks';
import { LinkButton } from '@/components/ui/Button';

const ICONS: Record<NoticeKind, LucideIcon> = {
  ping: Send,
  day: Sun,
  task_new: ListChecks,
  task_done: ListChecks,
  task_seen: ListChecks,
  letter: Mail,
  service: Gift,
  paired_proposal: SlidersHorizontal,
  paired_answer: Settings2,
  joined: UserPlus,
  remind_morning: Sunrise,
  remind_evening: Moon,
};

export default function NotificationsPage() {
  const { partner } = useSpaceAuth();
  const { notices, isLoading, error, markAllRead } = useNotifications();
  const name = displayName(partner?.display_name);

  /* Opening the list is reading it; new ones keep their highlight until you leave. */
  useEffect(() => {
    if (isLoading) return;
    const timer = window.setTimeout(markAllRead, 1500);
    return () => window.clearTimeout(timer);
  }, [isLoading, markAllRead]);

  return (
    <Page width="form">
      <PageHeader
        title="Уведомления"
        action={
          <LinkButton href="/notifications/settings" variant="secondary">
            <Bell className="size-4" aria-hidden /> Что присылать
          </LinkButton>
        }
      />

      {error && <div className="mb-4"><Alert>{error}</Alert></div>}

      {isLoading ? (
        <Loading label="Загружаем уведомления…" />
      ) : notices.length === 0 ? (
        <EmptyState title="Пока тихо" variant="quiet">
          Здесь появится то, что случилось, пока вас не было.
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {notices.map((notice) => {
            const Icon = ICONS[notice.kind] ?? Bell;
            const fresh = !notice.read_at;
            return (
              <li key={notice.id}>
                <Link
                  href={noticeHref(notice.kind, notice.payload)}
                  className={`flex items-start gap-3 rounded-2xl border border-line px-5 py-4 transition-colors hover:border-line-strong ${
                    fresh ? 'bg-surface shadow-card' : 'bg-transparent'
                  }`}
                >
                  <span
                    className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
                      fresh ? 'bg-accent-soft text-accent-soft-ink' : 'bg-sunken text-ink-soft'
                    }`}
                  >
                    <Icon className="size-4.5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm font-medium ${fresh ? 'text-ink' : 'text-ink-soft'}`}>
                      {noticeText(notice, name, partner?.gender)}
                    </span>
                    <span className="block text-sm text-ink-faint">
                      {relativeStamp(notice.created_at)}
                      {fresh && <span className="sr-only">, новое</span>}
                    </span>
                  </span>
                  {fresh && <span className="mt-2 size-2 shrink-0 rounded-full bg-accent" aria-hidden />}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Page>
  );
}
