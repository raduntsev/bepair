'use client';

import { Droplet, Moon } from 'lucide-react';
import { useShowMoon } from '@/hooks/useImportantDates';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { AiExportCard } from '@/components/AiExportCard';
import { Card, Page, PageHeader, RowGroup, SwitchRow } from '@/components/ui/Blocks';
import { Segment } from '@/components/ui/Controls';
import { tr } from '@/lib/i18n';

export default function PersonalSettingsPage() {
  const { user, profile, updateProfile } = useSpaceAuth();
  const { showMoon, setShowMoon } = useShowMoon();
  return (
    <Page width="form">
      <PageHeader title={tr('Личные и данные', 'Personal and data')} back={{ href: '/settings', label: tr('Профиль', 'Profile') }} />

      <div className="space-y-4">
        {/* Set once, at onboarding; it lives here rather than at the top of Профиль. */}
        <Card>
          <Segment
            legend={tr('Как о вас писать', 'How to address you')}
            options={[
              { value: 'f' as const, label: tr('Она', 'She') },
              { value: 'm' as const, label: tr('Он', 'He') },
            ]}
            value={profile?.gender ?? null}
            onChange={(gender) => updateProfile({ gender })}
          />
          <p className="mt-2 px-1 text-footnote text-ink-faint">
            {tr('Чтобы уведомления партнёру звучали по-человечески: «отметила», «отметил».', 'So notifications to your partner read naturally.')}
          </p>
        </Card>

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
