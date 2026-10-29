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
import { Button, LinkButton } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Segment } from '@/components/ui/Controls';
import { Card, Page, PageHeader } from '@/components/ui/Blocks';

interface Facts {
  letters: number;
  pings: number;
  tasks_done: number;
  both_days: number;
}

export default function CouplePage() {
  const { user, partner, settings, refreshSettings } = useSpaceAuth();
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
      <PageHeader title="Профиль пары" />

      <Counters
        togetherSince={settings?.together_since ?? null}
        showStreak={settings?.count_streak ?? true}
        current={presence.current}
        best={presence.best}
      />

      <div className="mt-6 space-y-4">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Начало</h2>
              <p className="mt-1 text-sm text-ink-soft">
                {settings?.together_since ? `Вы считаете началом ${fmt(settings.together_since, 'd MMMM yyyy')}.` : 'Дата не указана.'}
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
                <Pencil className="size-4" aria-hidden /> {settings?.together_since ? 'Изменить' : 'Указать'}
              </Button>
            )}
          </div>
          {editingDate && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Input type="date" aria-label="День, который вы считаете началом" max={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} className="max-w-xs" />
              <Button
                disabled={!date}
                onClick={async () => {
                  await supabase.rpc('bp_set_together_since', { d: date });
                  await refreshSettings();
                  setEditingDate(false);
                }}
              >
                Сохранить
              </Button>
              <Button variant="ghost" onClick={() => setEditingDate(false)}>
                Отмена
              </Button>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="font-semibold">Вы вдвоём</h2>
          <dl className="mt-3 divide-y divide-line text-sm">
            {[
              ['Дней, отмеченных обоими', facts?.both_days],
              ['Писем отправлено', facts?.letters],
              ['Весточек', facts?.pings],
              ['Просьб выполнено', facts?.tasks_done],
            ].map(([label, value]) => (
              <div key={label as string} className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-ink-soft">{label}</dt>
                <dd className="font-medium tabular-nums">{value ?? '—'}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <p className="text-sm text-ink-faint">
          Здесь только то, что вы сделали вдвоём. Ни подписчиков, ни рейтингов, ни сравнения друг с другом.
        </p>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">Ответы на вопросы</h2>
            <LinkButton href="/onboarding" variant="ghost">
              Ответить ещё раз
            </LinkButton>
          </div>
          {partner && (
            <div className="mt-3">
              <Segment
                legend="Чьи ответы"
                options={[
                  { value: 'theirs' as const, label: name },
                  { value: 'mine' as const, label: 'Мои' },
                ]}
                value={whose}
                onChange={setWhose}
              />
            </div>
          )}
          {shown.length === 0 ? (
            <p className="mt-4 text-sm text-ink-soft">
              {whose === 'mine' || !partner ? 'Вы пока ни на что не ответили.' : 'Партнёр пока ни на что не ответил.'}
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
