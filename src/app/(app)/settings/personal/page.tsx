'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Droplet, Heart, Moon } from 'lucide-react';
import { useShowMoon } from '@/hooks/useImportantDates';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { useDayEvents } from '@/hooks/useDayEvents';
import { todayISO } from '@/lib/dates';
import { AiExportCard } from '@/components/AiExportCard';
import { Alert, Card, Page, PageHeader, RowGroup, SwitchRow } from '@/components/ui/Blocks';
import { Button } from '@/components/ui/Button';
import { Segment } from '@/components/ui/Controls';
import { tr } from '@/lib/i18n';

export default function PersonalSettingsPage() {
  const { user, profile, partner, updateProfile, giveConsent, withdrawHealthConsent, withdrawIntimacyConsent } = useSpaceAuth();
  /* «Близость» is shared, so it asks for a consent of its own and appears once both have given it. */
  const today = todayISO();
  const events = useDayEvents(today, today);
  const [intimacyStep, setIntimacyStep] = useState<'ask' | 'off' | null>(null);
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

        {events.available && partner && (
          <RowGroup
            label={tr('Для вас двоих', 'For you both')}
            footer={tr('«Ссора» есть у всех на главном экране; отметки дня видите вы оба.', '«A fight» is always on the home screen; you both see the day’s marks.')}
          >
            <SwitchRow
              Icon={Heart}
              title={tr('Отмечать близость', 'Mark intimacy')}
              sub={
                events.intimacy.mine && !events.intimacy.partner
                  ? tr('Включено у вас. Появится, когда включит и партнёр', 'On for you. It appears once your partner switches it on too')
                  : tr('Отметка на главном и в календаре, когда включили оба', 'A mark on the home screen and calendar, once you both switch it on')
              }
              checked={events.intimacy.mine}
              onChange={(next) => setIntimacyStep(next ? 'ask' : 'off')}
            />
          </RowGroup>
        )}

        {intimacyStep && (
          <ConsentCard
            step={intimacyStep}
            tracking={events.intimacy.mine}
            text={intimacyText()}
            onClose={() => setIntimacyStep(null)}
            onGive={async () => {
              if (!(await giveConsent('intimacy'))) return false;
              await events.reload();
              setIntimacyStep(null);
              return true;
            }}
            onWithdraw={async () => {
              if (!(await withdrawIntimacyConsent())) return false;
              await events.reload();
              setIntimacyStep(null);
              return true;
            }}
          />
        )}

        {profile?.gender === 'f' && step && (
          <ConsentCard
            step={step}
            tracking={tracking}
            text={cycleText()}
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

interface ConsentText {
  askTitle: string;
  askBody: string;
  href: string;
  link: string;
  withdrawAndDelete: string;
  offTitle: string;
  offBody: string;
}

/* Functions, not constants: tr() reads the language at render time. */
const cycleText = (): ConsentText => ({
  askTitle: tr('Отдельное согласие на дни цикла', 'A separate consent for cycle days'),
  askBody: tr(
    'Дни цикла — это сведения о здоровье, и на них по закону нужно отдельное согласие. Отметки видите только вы, партнёр — нет. Выключите отслеживание — согласие отзовётся, а отметки удалятся.',
    'Cycle days are health data, and the law asks for a separate consent. Only you see the marks, not your partner. Switch tracking off and the consent is withdrawn and the marks deleted.',
  ),
  href: '/consent/health',
  link: tr('согласие на обработку сведений о состоянии здоровья', 'consent to the processing of health data'),
  withdrawAndDelete: tr('Выключить и удалить отметки', 'Switch off and delete the marks'),
  offTitle: tr('Выключить отслеживание цикла?', 'Switch cycle tracking off?'),
  offBody: tr(
    'Согласие на эти данные отзовётся, и все отметки дней цикла удалятся. Вернуть их будет нельзя.',
    'The consent for this data is withdrawn and every cycle mark is deleted. They can’t be brought back.',
  ),
});

const intimacyText = (): ConsentText => ({
  askTitle: tr('Отдельное согласие на отметки близости', 'A separate consent for intimacy marks'),
  askBody: tr(
    'Это сведения об интимной жизни, и на них по закону нужно отдельное согласие — от каждого из вас. Отметка общая: её видите вы оба, поставить и снять может любой. Появится, когда согласие дадут оба. Выключит любой — отметки пары удалятся.',
    'This is information about intimate life, and the law asks for a separate consent — from each of you. The mark is shared: you both see it, either can set or remove it. It appears once you have both agreed. If either switches it off, the couple’s marks are deleted.',
  ),
  href: '/consent/intimacy',
  link: tr('согласие на обработку сведений об интимной жизни', 'consent to the processing of information about intimate life'),
  withdrawAndDelete: tr('Выключить и удалить отметки', 'Switch off and delete the marks'),
  offTitle: tr('Выключить отметки близости?', 'Switch intimacy marks off?'),
  offBody: tr(
    'Согласие отзовётся, и все отметки близости вашей пары удалятся — у вас и у партнёра. Вернуть их будет нельзя.',
    'The consent is withdrawn and all of your couple’s intimacy marks are deleted — for you and your partner. They can’t be brought back.',
  ),
});

function ConsentCard({
  step,
  tracking,
  text,
  onGive,
  onWithdraw,
  onClose,
}: {
  step: 'ask' | 'off';
  tracking: boolean;
  text: ConsentText;
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
          <h2 className="text-headline font-semibold">{text.askTitle}</h2>
          <p className="measure mt-1.5 text-subhead text-ink-soft">{text.askBody}</p>
          <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm text-ink">
            <input
              type="checkbox"
              checked={checked}
              onChange={(event) => setChecked(event.target.checked)}
              className="mt-0.5 size-5 shrink-0 cursor-pointer accent-[var(--c-accent)]"
            />
            <span>
              {tr('Я даю ', 'I give my ')}
              <Link href={text.href} target="_blank" className="font-medium text-accent underline-offset-2 hover:underline">
                {text.link}
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
                {text.withdrawAndDelete}
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
          <h2 className="text-headline font-semibold">{text.offTitle}</h2>
          <p className="measure mt-1.5 text-subhead text-ink-soft">{text.offBody}</p>
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
