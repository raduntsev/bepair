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
      <PageHeader title="Личные и данные" back={{ href: '/settings', label: 'Профиль' }} />

      <div className="space-y-4">
        <RowGroup label="Только для вас">
          {profile?.gender === 'f' && (
            <SwitchRow
              Icon={Droplet}
              title="Отмечать дни цикла"
              sub="Отметка в окне дня. Видно только вам"
              checked={profile?.cycle_tracking ?? false}
              onChange={(next) => updateProfile({ cycle_tracking: next })}
            />
          )}
          {showMoon !== null && (
            <SwitchRow
              Icon={Moon}
              title="Показывать фазу луны"
              sub="Главные фазы в календаре. Видно только вам"
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
