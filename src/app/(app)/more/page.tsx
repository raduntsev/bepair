'use client';

import { Bell, Gift, Mail, Settings, Users } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { LinkRow, Page, PageHeader, RowGroup } from '@/components/ui/Blocks';
import { InstallCard } from '@/components/InstallCard';

export default function MorePage() {
  const { unread } = useNotifications();
  return (
    <Page width="form">
      <PageHeader title="Ещё" />
      <RowGroup label="Разделы">
        <LinkRow href="/letters" Icon={Mail} title="Письма" sub="То, что не помещается в заметку дня" />
        <LinkRow href="/store" Icon={Gift} title="Услуги" sub="Просьбы за баллы" />
        <LinkRow href="/notifications" Icon={Bell} title="Уведомления" sub="Что случилось, пока вас не было" badge={unread} />
        <LinkRow href="/couple" Icon={Users} title="Профиль пары" sub="Дни вместе и общие факты" />
        <LinkRow href="/settings" Icon={Settings} title="Настройки" sub="Имя, тема, код приглашения" />
      </RowGroup>
      <div className="mt-4">
        <InstallCard />
      </div>
    </Page>
  );
}
