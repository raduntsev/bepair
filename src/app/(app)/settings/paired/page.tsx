'use client';

import { useState } from 'react';
import { BookOpen, Flame, Lock, MapPin } from 'lucide-react';
import supabase from '@/lib/supabase';
import { PAIRED_LABELS } from '@/lib/notices';
import { flushPush } from '@/lib/push';
import { displayName, verb } from '@/lib/words';
import { useSpaceAuth, type SpaceSettings } from '@/hooks/useSpaceAuth';
import { Button } from '@/components/ui/Button';
import { Alert, Page, PageHeader, RowGroup, SwitchRow } from '@/components/ui/Blocks';

type Key = 'reveal_first' | 'chronicle_deletable' | 'long_distance' | 'count_streak';

const ROWS: { key: Key; Icon: typeof Lock; sub: string }[] = [
  { key: 'reveal_first', Icon: Lock, sub: 'День и письма партнёра закрыты, пока вы не отметились' },
  { key: 'chronicle_deletable', Icon: BookOpen, sub: 'Автор может убрать свою запись из летописи. Выключено — отправленное остаётся навсегда' },
  { key: 'long_distance', Icon: MapPin, sub: 'Показывает время партнёра рядом с его днём' },
  { key: 'count_streak', Icon: Flame, sub: 'Дни, когда отметились оба' },
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
    if (callError) setError('Не получилось. Проверьте связь и попробуйте ещё раз.');
    else flushPush();
    await refreshSettings();
    setBusy(false);
  };

  const propose = (key: Key, value: boolean) => call(() => supabase.rpc('bp_propose_setting', { setting: key, val: value }));

  const label = (s: SpaceSettings) => PAIRED_LABELS[s.pending_key ?? ''] ?? 'настройку';

  return (
    <Page width="form">
      <PageHeader title="Парные настройки" back={{ href: '/settings', label: 'Настройки' }} />
      <p className="mb-4 text-sm text-ink-faint">
        Парные настройки включаются у обоих или ни у кого. Изменение, которое предложил один, вступает в силу, когда согласится второй.
      </p>

      {pending && !pendingMine && (
        <section className="mb-4 rounded-2xl border border-accent/30 bg-accent-soft p-5" role="status">
          <p className="text-sm font-medium text-accent-soft-ink">
            {name} {verb(partner?.gender, 'предложил')} {pending.pending_value ? 'включить' : 'выключить'} «{label(pending)}»
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button loading={busy} onClick={() => call(() => supabase.rpc('bp_answer_setting', { accept: true }))}>
              Согласиться
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => call(() => supabase.rpc('bp_answer_setting', { accept: false }))}>
              Оставить как есть
            </Button>
          </div>
        </section>
      )}

      {error && <div className="mb-4"><Alert>{error}</Alert></div>}

      <RowGroup label="Общие для двоих">
        {ROWS.map(({ key, Icon, sub }) => {
          const value = settings?.[key] ?? false;
          const isPending = pending?.pending_key === key;
          return (
            <SwitchRow
              key={key}
              Icon={Icon}
              title={PAIRED_LABELS[key]}
              sub={sub}
              checked={value}
              disabled={busy || !settings || (isPending && !pendingMine)}
              onChange={(next) => propose(key, next)}
              note={isPending && pendingMine ? `Ждёт согласия: ${pending?.pending_value ? 'включить' : 'выключить'}` : undefined}
            />
          );
        })}
      </RowGroup>

      {pending && pendingMine && (
        <div className="mt-3">
          <Button variant="ghost" disabled={busy} onClick={() => call(() => supabase.rpc('bp_withdraw_setting'))}>
            Отозвать предложение
          </Button>
        </div>
      )}

      {!partner && <p className="mt-4 text-sm text-ink-faint">Пока вы в пространстве один, изменения применяются сразу.</p>}
    </Page>
  );
}
