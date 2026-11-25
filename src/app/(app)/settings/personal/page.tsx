'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Droplet, Moon } from 'lucide-react';
import { useShowMoon } from '@/hooks/useImportantDates';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { AiExportCard } from '@/components/AiExportCard';
import { Alert, Card, Page, PageHeader, RowGroup, SwitchRow } from '@/components/ui/Blocks';
import { Button } from '@/components/ui/Button';
import { Segment } from '@/components/ui/Controls';
import { tr } from '@/lib/i18n';

export default function PersonalSettingsPage() {
  const { user, profile, updateProfile, giveConsent, withdrawHealthConsent } = useSpaceAuth();
  const { showMoon, setShowMoon } = useShowMoon();
  /* Cycle marks are health data: switching on asks for its own consent, switching off deletes them. */
  const [cycleStep, setCycleStep] = useState<'ask' | 'off' | null>(null);
  const hasHealthConsent = !!profile?.health_consent_at;
  const tracking = !!profile?.cycle_tracking;
  /* Tracking switched on before the consent existed: ask once, or switch off. */
  const step = cycleStep ?? (tracking && !hasHealthConsent ? 'ask' : null);
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
              checked={tracking}
              onChange={(next) => {
                if (!next) setCycleStep('off');
                else if (hasHealthConsent) updateProfile({ cycle_tracking: true });
                else setCycleStep('ask');
              }}
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

        {profile?.gender === 'f' && step && (
          <CycleConsent
            step={step}
            tracking={tracking}
            onClose={() => setCycleStep(null)}
            onGive={async () => {
              if (!(await giveConsent('health'))) return false;
              if (!tracking && !(await updateProfile({ cycle_tracking: true }))) return false;
              setCycleStep(null);
              return true;
            }}
            onWithdraw={async () => {
              if (!(await withdrawHealthConsent())) return false;
              setCycleStep(null);
              return true;
            }}
          />
        )}

        {user && <AiExportCard userId={user.id} name={profile?.display_name ?? ''} />}
      </div>
    </Page>
  );
}

function CycleConsent({
  step,
  tracking,
  onGive,
  onWithdraw,
  onClose,
}: {
  step: 'ask' | 'off';
  tracking: boolean;
  onGive: () => Promise<boolean>;
  onWithdraw: () => Promise<boolean>;
  onClose: () => void;
}) {
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const run = async (action: () => Promise<boolean>) => {
    setBusy(true);
    setFailed(false);
    const ok = await action();
    setBusy(false);
    if (!ok) setFailed(true);
  };

  return (
    <Card>
      {step === 'ask' ? (
        <>
          <h2 className="text-headline font-semibold">{tr('Отдельное согласие на дни цикла', 'A separate consent for cycle days')}</h2>
          <p className="measure mt-1.5 text-subhead text-ink-soft">
            {tr(
              'Дни цикла — это сведения о здоровье, и на них по закону нужно отдельное согласие. Отметки видите только вы, партнёр — нет. Выключите отслеживание — согласие отзовётся, а отметки удалятся.',
              'Cycle days are health data, and the law asks for a separate consent. Only you see the marks, not your partner. Switch tracking off and the consent is withdrawn and the marks deleted.',
            )}
          </p>
          <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm text-ink">
            <input
              type="checkbox"
              checked={checked}
              onChange={(event) => setChecked(event.target.checked)}
              className="mt-0.5 size-5 shrink-0 cursor-pointer accent-[var(--c-accent)]"
            />
            <span>
              {tr('Я даю ', 'I give my ')}
              <Link href="/consent/health" target="_blank" className="font-medium text-accent underline-offset-2 hover:underline">
                {tr('согласие на обработку сведений о состоянии здоровья', 'consent to the processing of health data')}
              </Link>
            </span>
          </label>
          {failed && (
            <div className="mt-3">
              <Alert>{tr('Не получилось сохранить. Попробуйте ещё раз.', 'Couldn’t save. Please try again.')}</Alert>
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button loading={busy} disabled={!checked} onClick={() => run(onGive)}>
              {tracking ? tr('Подтвердить', 'Confirm') : tr('Включить', 'Switch on')}
            </Button>
            {tracking ? (
              <Button variant="ghost" disabled={busy} onClick={() => run(onWithdraw)}>
                {tr('Выключить и удалить отметки', 'Switch off and delete the marks')}
              </Button>
            ) : (
              <Button variant="ghost" disabled={busy} onClick={onClose}>
                {tr('Отмена', 'Cancel')}
              </Button>
            )}
          </div>
        </>
      ) : (
        <>
          <h2 className="text-headline font-semibold">{tr('Выключить отслеживание цикла?', 'Switch cycle tracking off?')}</h2>
          <p className="measure mt-1.5 text-subhead text-ink-soft">
            {tr(
              'Согласие на эти данные отзовётся, и все отметки дней цикла удалятся. Вернуть их будет нельзя.',
              'The consent for this data is withdrawn and every cycle mark is deleted. They can’t be brought back.',
            )}
          </p>
          {failed && (
            <div className="mt-3">
              <Alert>{tr('Не получилось. Попробуйте ещё раз.', 'That didn’t work. Please try again.')}</Alert>
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="danger" loading={busy} onClick={() => run(onWithdraw)}>
              {tr('Выключить и удалить', 'Switch off and delete')}
            </Button>
            <Button variant="ghost" disabled={busy} onClick={onClose}>
              {tr('Оставить', 'Keep it')}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
