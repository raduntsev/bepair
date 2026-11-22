'use client';

import { useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';
import supabase from '@/lib/supabase';
import { QUESTIONS, DATE_QUESTION } from '@/lib/questions';
import { fmt, todayISO } from '@/lib/dates';
import { displayName } from '@/lib/words';
import { useSpaceAuth } from '@/hooks/useSpaceAuth';
import { usePresence } from '@/hooks/usePresence';
import { Counters } from '@/components/Counters';
import { Avatar } from '@/components/Avatar';
import { PartnerRhythm } from '@/components/PartnerRhythm';
import { Button, LinkButton } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Segment } from '@/components/ui/Controls';
import { Card, Page, PageHeader } from '@/components/ui/Blocks';
import { tr } from '@/lib/i18n';

interface Facts {
  letters: number;
  pings: number;
  tasks_done: number;
  both_days: number;
}

export default function CouplePage() {
  const { user, partner, profile, settings, refreshSettings } = useSpaceAuth();
  const presence = usePresence();
  const [facts, setFacts] = useState<Facts | null>(null);
  const [answers, setAnswers] = useState<{ user_id: string; question: number; answer: string }[]>([]);
  const [whose, setWhose] = useState<'mine' | 'theirs'>('theirs');
  const [editingDate, setEditingDate] = useState(false);
  const [date, setDate] = useState('');

  useEffect(() => {
    supabase.rpc('bp_couple_facts').then(({ data }) => {
      const row = Array.isArray(data) ? data[0] : data;
      if (row) setFacts(row as Facts);
    });
    supabase
      .from('couple_answers')
      .select('user_id, question, answer')
      .order('question')
      .then(({ data }) => setAnswers((data ?? []) as typeof answers));
  }, []);

  const name = displayName(partner?.display_name);
  const shown = answers.filter((a) => (whose === 'mine' ? a.user_id === user?.id : a.user_id !== user?.id) && a.question !== DATE_QUESTION);

  return (
    <Page>
      <PageHeader title={partner ? tr(`Вы и ${name}`, `You and ${name}`) : tr('Пара', 'Couple')} back={{ href: '/settings', label: tr('Профиль', 'Profile') }} />

      {partner && (
        <div aria-hidden className="-mt-2 mb-5 flex">
          <Avatar path={profile?.avatar_url} name={profile?.display_name ?? ''} who="me" className="size-16 text-title-2 ring-4 ring-canvas" />
          <Avatar path={partner.avatar_url} name={name} who="partner" className="-ml-4 size-16 text-title-2 ring-4 ring-canvas" />
        </div>
      )}

      <Counters
        togetherSince={settings?.together_since ?? null}
        showStreak={settings?.count_streak ?? true}
        current={presence.current}
        best={presence.best}
      />

      <div className="mt-6 space-y-4">
        {partner && <PartnerRhythm partner={partner} showClock={!!settings?.long_distance} />}

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">{tr('Начало', 'The beginning')}</h2>
              <p className="mt-1 text-sm text-ink-soft">
                {settings?.together_since
                  ? tr(`Вы считаете началом ${fmt(settings.together_since, 'd MMMM yyyy')}.`, `You count ${fmt(settings.together_since, 'd MMMM yyyy')} as the beginning.`)
                  : tr('Дата не указана.', 'No date set.')}
              </p>
            </div>
            {!editingDate && (
              <Button
                variant="secondary"
                onClick={() => {
                  setDate(settings?.together_since ?? '');
                  setEditingDate(true);
                }}
              >
                <Pencil className="size-4" aria-hidden /> {settings?.together_since ? tr('Изменить', 'Change') : tr('Указать', 'Set')}
              </Button>
            )}
          </div>
          {editingDate && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Input type="date" aria-label={tr('День, который вы считаете началом', 'The day you count as the beginning')} max={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} className="max-w-xs" />
              <Button
                disabled={!date}
                onClick={async () => {
                  await supabase.rpc('bp_set_together_since', { d: date });
                  await refreshSettings();
                  setEditingDate(false);
                }}
              >
                {tr('Сохранить', 'Save')}
              </Button>
              <Button variant="ghost" onClick={() => setEditingDate(false)}>
                {tr('Отмена', 'Cancel')}
              </Button>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="font-semibold">{tr('Вы вдвоём', 'The two of you')}</h2>
          <dl className="mt-3 divide-y divide-line text-sm">
            {[
              [tr('Дней, отмеченных обоими', 'Days you both marked'), facts?.both_days],
              [tr('Писем отправлено', 'Letters sent'), facts?.letters],
              [tr('Весточек', 'Notes'), facts?.pings],
              [tr('Просьб выполнено', 'Requests done'), facts?.tasks_done],
            ].map(([label, value]) => (
              <div key={label as string} className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-ink-soft">{label}</dt>
                <dd className="font-medium tabular-nums">{value ?? 0}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">{tr('Ответы на вопросы', 'Answers to the questions')}</h2>
            <LinkButton href="/onboarding" variant="ghost">
              {tr('Ответить ещё раз', 'Answer again')}
            </LinkButton>
          </div>
          {partner && (
            <div className="mt-3">
              <Segment
                legend={tr('Чьи ответы', 'Whose answers')}
                options={[
                  { value: 'theirs' as const, label: name },
                  { value: 'mine' as const, label: tr('Мои', 'Mine') },
                ]}
                value={whose}
                onChange={setWhose}
              />
            </div>
          )}
          {shown.length === 0 ? (
            <p className="mt-4 text-sm text-ink-soft">
              {whose === 'mine' || !partner ? tr('Вы пока ни на что не ответили.', 'You haven’t answered anything yet.') : tr('Партнёр пока ни на что не ответил.', 'Your partner hasn’t answered anything yet.')}
            </p>
          ) : (
            <ul className="mt-4 space-y-5">
              {shown.map((a) => (
                <li key={`${a.user_id}-${a.question}`}>
                  <p className="text-sm font-medium text-ink-soft">{QUESTIONS[a.question - 1]}</p>
                  <p className="measure mt-1 text-[15px] leading-relaxed whitespace-pre-wrap">{a.answer}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </Page>
  );
}
