'use client';

import { useState } from 'react';
import { BookOpen, Flame, Lock, MapPin } from 'lucide-react';
import supabase from '@/lib/supabase';
import { pairedLabel } from '@/lib/notices';
import { flushPush } from '@/lib/push';
import { displayName, verb } from '@/lib/words';
import { useSpaceAuth, type SpaceSettings } from '@/hooks/useSpaceAuth';
import { Button } from '@/components/ui/Button';
import { Alert, Page, PageHeader, RowGroup, SwitchRow } from '@/components/ui/Blocks';
import { tr } from '@/lib/i18n';

type Key = 'reveal_first' | 'chronicle_deletable' | 'long_distance' | 'count_streak';

const ROWS: { key: Key; Icon: typeof Lock; sub: string }[] = [
  { key: 'reveal_first', Icon: Lock, sub: tr('День и письма партнёра закрыты, пока вы не отметились', 'Your partner’s day and letters stay closed until you mark yours') },
  { key: 'chronicle_deletable', Icon: BookOpen, sub: tr('Автор может убрать свою запись из летописи. Выключено — отправленное остаётся навсегда', 'Authors can remove their own entries. Off — what’s sent stays for good') },
  { key: 'long_distance', Icon: MapPin, sub: tr('Показывает время партнёра рядом с его днём', 'Shows your partner’s local time next to their day') },
  { key: 'count_streak', Icon: Flame, sub: tr('Дни, когда отметились оба', 'Days when you both marked the day') },
];

export default function PairedSettingsPage() {
  const { user, partner, settings, refreshSettings } = useSpaceAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = displayName(partner?.display_name);

  const pending = settings?.pending_key ? settings : null;
  const pendingMine = pending?.pending_by === user?.id;

  const call = async (fn: () => PromiseLike<{ error: unknown }>) => {
    setBusy(true);
    setError(null);
    const { error: callError } = await fn();
    if (callError) setError(tr('Не получилось. Проверьте связь и попробуйте ещё раз.', 'That didn’t work. Check your connection and try again.'));
    else flushPush();
    await refreshSettings();
    setBusy(false);
  };

  const propose = (key: Key, value: boolean) => call(() => supabase.rpc('bp_propose_setting', { setting: key, val: value }));

  const label = (s: SpaceSettings) => pairedLabel(s.pending_key ?? '');

  return (
    <Page width="form">
      <PageHeader title={tr('Парные настройки', 'Shared settings')} back={{ href: '/settings', label: tr('Профиль', 'Profile') }} />
      <p className="mb-4 text-sm text-ink-faint">
        {tr('Парные настройки включаются у обоих или ни у кого. Изменение, которое предложил один, вступает в силу, когда согласится второй.', 'Shared settings are on for both of you or for neither. A change one of you suggests takes effect when the other agrees.')}
      </p>

      {pending && !pendingMine && (
        <section className="mb-4 rounded-2xl border border-accent/30 bg-accent-soft p-5" role="status">
          <p className="text-sm font-medium text-accent-soft-ink">
            {tr(`${name} ${verb(partner?.gender, 'предложил')} ${pending.pending_value ? 'включить' : 'выключить'} «${label(pending)}»`, `${name} suggests turning ${pending.pending_value ? 'on' : 'off'} “${label(pending)}”`)}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button loading={busy} onClick={() => call(() => supabase.rpc('bp_answer_setting', { accept: true }))}>
              {tr('Согласиться', 'Agree')}
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => call(() => supabase.rpc('bp_answer_setting', { accept: false }))}>
              {tr('Оставить как есть', 'Keep as is')}
            </Button>
          </div>
        </section>
      )}

      {error && <div className="mb-4"><Alert>{error}</Alert></div>}

      <RowGroup label={tr('Общие для двоих', 'Shared by both')}>
        {ROWS.map(({ key, Icon, sub }) => {
          const value = settings?.[key] ?? false;
          const isPending = pending?.pending_key === key;
          return (
            <SwitchRow
              key={key}
              Icon={Icon}
              title={pairedLabel(key)}
              sub={sub}
              checked={value}
              disabled={busy || !settings || (isPending && !pendingMine)}
              onChange={(next) => propose(key, next)}
              note={isPending && pendingMine ? tr(`Ждёт согласия: ${pending?.pending_value ? 'включить' : 'выключить'}`, `Waiting for agreement: turn ${pending?.pending_value ? 'on' : 'off'}`) : undefined}
            />
          );
        })}
      </RowGroup>

      {pending && pendingMine && (
        <div className="mt-3">
          <Button variant="ghost" disabled={busy} onClick={() => call(() => supabase.rpc('bp_withdraw_setting'))}>
            {tr('Отозвать предложение', 'Withdraw')}
          </Button>
        </div>
      )}

      {!partner && <p className="mt-4 text-sm text-ink-faint">{tr('Пока вы в пространстве один, изменения применяются сразу.', 'While you’re alone in the space, changes apply at once.')}</p>}
    </Page>
  );
}
