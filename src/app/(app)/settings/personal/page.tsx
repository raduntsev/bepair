'use client';

import { Droplet, Moon } from 'lucide-react';
import { useShowMoon } from '@/hooks/useImportantDates';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { AiExportCard } from '@/components/AiExportCard';
import { Page, PageHeader, RowGroup, SwitchRow } from '@/components/ui/Blocks';
import { tr } from '@/lib/i18n';

export default function PersonalSettingsPage() {
  const { user, profile, updateProfile } = useSpaceAuth();
  const { showMoon, setShowMoon } = useShowMoon();
  return (
    <Page width="form">
      <PageHeader title={tr('Личные и данные', 'Personal and data')} back={{ href: '/settings', label: tr('Профиль', 'Profile') }} />

      <div className="space-y-4">
        <RowGroup label={tr('Только для вас', 'Only for you')}>
          {profile?.gender === 'f' && (
            <SwitchRow
              Icon={Droplet}
              title={tr('Отмечать дни цикла', 'Track cycle days')}
              sub={tr('Отметка в окне дня. Видно только вам', 'A mark on the day. Only you see it')}
              checked={profile?.cycle_tracking ?? false}
              onChange={(next) => updateProfile({ cycle_tracking: next })}
            />
          )}
          {showMoon !== null && (
            <SwitchRow
              Icon={Moon}
              title={tr('Показывать фазу луны', 'Show the moon phase')}
              sub={tr('Главные фазы в календаре. Видно только вам', 'Main phases in the calendar. Only you see them')}
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
