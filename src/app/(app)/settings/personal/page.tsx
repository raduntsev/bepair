'use client';

import { Droplet, Moon } from 'lucide-react';
import { useShowMoon } from '@/hooks/useImportantDates';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { AiExportCard } from '@/components/AiExportCard';
import { Page, PageHeader, RowGroup, SwitchRow } from '@/components/ui/Blocks';

export default function PersonalSettingsPage() {
  const { user, profile, updateProfile } = useSpaceAuth();
  const { showMoon, setShowMoon } = useShowMoon();
  return (
    <Page width="form">
      <PageHeader title="Личные и данные" back={{ href: '/settings', label: 'Настройки' }} />
      <p className="mb-4 text-sm text-ink-faint">Личные настройки видите только вы. Партнёр о них не узнаёт.</p>

      <div className="space-y-4">
        <RowGroup label="Только для вас">
          <SwitchRow
            Icon={Droplet}
            title="Отмечать дни цикла"
            sub="Тихая строка на экране дня. Видно только вам, нужно для будущего разбора"
            checked={profile?.cycle_tracking ?? false}
            onChange={(next) => updateProfile({ cycle_tracking: next })}
          />
          {showMoon !== null && (
            <SwitchRow
              Icon={Moon}
              title="Показывать фазу луны"
              sub="На экране дня и главные фазы в календаре. Видно только вам"
              checked={showMoon}
              onChange={setShowMoon}
            />
          )}
        </RowGroup>

        {user && <AiExportCard userId={user.id} name={profile?.display_name ?? ''} />}
      </div>
    </Page>
  );
}
