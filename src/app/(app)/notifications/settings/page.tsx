'use client';

import { Bell, ListChecks, Mail, Send, Sun } from 'lucide-react';
import { useSpaceAuth, type Profile } from '@/hooks/useSpaceAuth';
import { Alert, Page, PageHeader, RowGroup, SwitchRow } from '@/components/ui/Blocks';
import { ReminderSettings } from '@/components/ReminderSettings';
import { useReminders } from '@/hooks/useReminders';
import { PushCard } from '@/components/PushCard';
import { InstallCard } from '@/components/InstallCard';

type Key = keyof Pick<Profile, 'notify_pings' | 'notify_day' | 'notify_tasks' | 'notify_letters' | 'notify_sound'>;

export default function NotificationSettingsPage() {
  const { profile, updateProfile } = useSpaceAuth();
  const set = (key: Key) => (next: boolean) => updateProfile({ [key]: next });
  const { reminders, available, error: reminderError, update: updateReminders } = useReminders();

  return (
    <Page width="form">
      <PageHeader title="Что присылать" back={{ href: '/notifications', label: 'Уведомления' }} />
      <div className="space-y-4">
        <InstallCard />
        <PushCard />

        {available && reminders && (
          <section aria-labelledby="reminders-title" className="space-y-2">
            <h2 id="reminders-title" className="px-1 pt-2 text-sm font-medium text-ink-soft">
              Напоминания по времени
            </h2>
            <ReminderSettings value={reminders} onChange={updateReminders} />
            <p className="px-1 text-sm text-ink-faint">По вашему местному времени, не чаще раза в день. Если повода нет — напоминания не будет.</p>
            {reminderError && <Alert>{reminderError}</Alert>}
          </section>
        )}

        <RowGroup label="Что присылать">
          <SwitchRow Icon={Send} title="Весточки" sub="Приходят сразу, это их смысл" checked={profile?.notify_pings ?? true} onChange={set('notify_pings')} />
          <SwitchRow Icon={Sun} title="Партнёр отметил день" sub="Только факт, без содержания" checked={profile?.notify_day ?? true} onChange={set('notify_day')} />
          <SwitchRow Icon={ListChecks} title="Просьбы и услуги" sub="Новые просьбы и отметки «сделано»" checked={profile?.notify_tasks ?? true} onChange={set('notify_tasks')} />
          <SwitchRow Icon={Mail} title="Письма" sub="О приходе, но не о тексте" checked={profile?.notify_letters ?? true} onChange={set('notify_letters')} />
          <SwitchRow Icon={Bell} title="Со звуком" sub="Кроме весточек — они всегда со звуком" checked={profile?.notify_sound ?? true} onChange={set('notify_sound')} />
        </RowGroup>

        <p className="text-sm text-ink-faint">
          Уведомление никогда не раскрывает то, что закрыто до вашего хода: оно сообщает, что событие было, но не что в нём. В ленте приложения всё сохраняется в любом случае.
        </p>
      </div>
    </Page>
  );
}
