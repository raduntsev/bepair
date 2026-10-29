'use client';

import { useState } from 'react';
import { Download, Droplet } from 'lucide-react';
import supabase from '@/lib/supabase';
import { todayISO } from '@/lib/dates';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { Button } from '@/components/ui/Button';
import { Alert, Card, Page, PageHeader, RowGroup, SwitchRow } from '@/components/ui/Blocks';

export default function PersonalSettingsPage() {
  const { user, profile, updateProfile } = useSpaceAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Only your own: your days, what you wrote, what was written to you and opened. Never the partner's days. */
  const exportData = async () => {
    if (!user) return;
    setBusy(true);
    setError(null);
    const [days, letters, pings, answers, cycle] = await Promise.all([
      supabase.from('day_entries').select('entry_date, mood, note, updated_at').eq('user_id', user.id).order('entry_date'),
      supabase
        .from('letters')
        .select('title, content, status, deliver_at, delivered_at, author_id, created_at')
        .or(`author_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order('created_at'),
      supabase.from('pings').select('body, track_url, track_title, track_artist, created_at').eq('author_id', user.id).order('created_at'),
      supabase.from('couple_answers').select('question, answer, updated_at').eq('user_id', user.id).order('question'),
      supabase.from('cycle_days').select('day').eq('user_id', user.id).order('day'),
    ]);

    if (days.error || letters.error) {
      setBusy(false);
      setError('Не удалось собрать данные. Проверьте связь и попробуйте ещё раз.');
      return;
    }

    const file = {
      exported_at: new Date().toISOString(),
      app: 'Впаре',
      note: 'Настроение — число от 0 (лёгкий день) до 1 (тяжёлый). Дни партнёра в выгрузку не входят.',
      name: profile?.display_name,
      days: days.data,
      letters: (letters.data ?? []).map(({ author_id, ...rest }) => ({ ...rest, direction: author_id === user.id ? 'sent' : 'received' })),
      pings: pings.data ?? [],
      onboarding_answers: answers.data ?? [],
      cycle_days: (cycle.data ?? []).map((row) => row.day),
    };

    const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vpare-${todayISO()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setBusy(false);
  };

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
        </RowGroup>

        <Card>
          <h2 className="font-semibold">Выгрузить данные</h2>
          <p className="mt-1.5 mb-4 text-sm text-ink-soft">
            Файл со всеми вашими днями, заметками, письмами и весточками. Дни партнёра в выгрузку не попадают.
          </p>
          <Button variant="secondary" loading={busy} onClick={exportData}>
            <Download className="size-4" aria-hidden /> Выгрузить
          </Button>
          {error && <div className="mt-3"><Alert>{error}</Alert></div>}
        </Card>
      </div>
    </Page>
  );
}
