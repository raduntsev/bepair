'use client';

import { Bell, ListChecks, Mail, Send, Sun } from 'lucide-react';
import { useSpaceAuth, type Profile } from '@/hooks/useSpaceAuth';
import { Alert, Page, PageHeader, RowGroup, SwitchRow } from '@/components/ui/Blocks';
import { ReminderSettings } from '@/components/ReminderSettings';
import { useReminders } from '@/hooks/useReminders';
import { PushCard } from '@/components/PushCard';
import { InstallCard } from '@/components/InstallCard';
import { tr } from '@/lib/i18n';

type Key = keyof Pick<Profile, 'notify_pings' | 'notify_day' | 'notify_tasks' | 'notify_letters' | 'notify_sound'>;

export default function NotificationSettingsPage() {
  const { profile, updateProfile } = useSpaceAuth();
  const set = (key: Key) => (next: boolean) => updateProfile({ [key]: next });
  const { reminders, available, error: reminderError, update: updateReminders } = useReminders();

  return (
    <Page width="form">
      <PageHeader title={tr('Уведомления', 'Notifications')} back={{ href: '/settings', label: tr('Профиль', 'Profile') }} />
      <div className="space-y-4">
        <InstallCard />
        <PushCard />

        {available && reminders && (
          <section aria-labelledby="reminders-title" className="space-y-2">
            <h2 id="reminders-title" className="px-1 pt-2 text-sm font-medium text-ink-soft">
              {tr('Напоминания по времени', 'Timed reminders')}
            </h2>
            <ReminderSettings value={reminders} onChange={updateReminders} />
            <p className="px-1 text-sm text-ink-faint">{tr('По вашему местному времени, не чаще раза в день. Если повода нет — напоминания не будет.', 'In your local time, at most once a day. No reason, no reminder.')}</p>
            {reminderError && <Alert>{reminderError}</Alert>}
          </section>
        )}

        <RowGroup label={tr('Что присылать', 'What to send')}>
          <SwitchRow Icon={Send} title={tr('Весточки', 'Notes')} sub={tr('Приходят сразу, это их смысл', 'Arrive at once — that’s the point')} checked={profile?.notify_pings ?? true} onChange={set('notify_pings')} />
          <SwitchRow Icon={Sun} title={tr('Партнёр отметил день', 'Partner marked the day')} sub={tr('Только факт, без содержания', 'Just the fact, never the content')} checked={profile?.notify_day ?? true} onChange={set('notify_day')} />
          <SwitchRow Icon={ListChecks} title={tr('Просьбы и услуги', 'Requests and favours')} sub={tr('Новые просьбы и отметки «сделано»', 'New requests and “done” marks')} checked={profile?.notify_tasks ?? true} onChange={set('notify_tasks')} />
          <SwitchRow Icon={Mail} title={tr('Письма', 'Letters')} sub={tr('О приходе, но не о тексте', 'That one arrived, never what it says')} checked={profile?.notify_letters ?? true} onChange={set('notify_letters')} />
          <SwitchRow Icon={Bell} title={tr('Со звуком', 'With sound')} sub={tr('Кроме весточек — они всегда со звуком', 'Except notes — those always ring')} checked={profile?.notify_sound ?? true} onChange={set('notify_sound')} />
        </RowGroup>

        <p className="text-sm text-ink-faint">
          {tr('Уведомление никогда не раскрывает то, что закрыто до вашего хода: оно сообщает, что событие было, но не что в нём. В ленте приложения всё сохраняется в любом случае.', 'A notification never reveals what is closed until your move: it says something happened, not what’s inside. The in-app feed keeps everything either way.')}
        </p>
      </div>
    </Page>
  );
}
