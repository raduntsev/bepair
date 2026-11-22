'use client';

import { useState } from 'react';
import { Download, FileText, Sparkles } from 'lucide-react';
import { subDays } from 'date-fns';
import { isoDate, todayISO } from '@/lib/dates';
import { GOALS, buildMarkdown, collectExport, download, exportSummary, type ExportData, type ExportGoal } from '@/lib/aiExport';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Field';
import { Segment } from '@/components/ui/Controls';
import { Alert, Card } from '@/components/ui/Blocks';
import { tr } from '@/lib/i18n';

type Period = '30' | '90' | 'all' | 'custom';

const PERIODS: { value: Period; label: string }[] = [
  { value: '30', label: tr('30 дней', '30 days') },
  { value: '90', label: tr('3 месяца', '3 months') },
  { value: 'all', label: tr('Всё время', 'All time') },
  { value: 'custom', label: tr('Свой период', 'Custom') },
];

/*
  Two steps on purpose: first you see what will go into the file, then you
  download it. The file carries a prompt for the goal you picked, so it can be
  handed to any neural network as is.
*/
export function AiExportCard({ userId, name }: { userId: string; name: string }) {
  const [period, setPeriod] = useState<Period>('30');
  const [from, setFrom] = useState(isoDate(subDays(new Date(), 30)));
  const [to, setTo] = useState(todayISO());
  const [goal, setGoal] = useState<ExportGoal>('closer');
  const [concern, setConcern] = useState('');
  const [data, setData] = useState<ExportData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const range = (): [string | null, string] => {
    const today = todayISO();
    if (period === '30') return [isoDate(subDays(new Date(), 29)), today];
    if (period === '90') return [isoDate(subDays(new Date(), 89)), today];
    if (period === 'all') return [null, today];
    return [from, to];
  };

  const reset = () => setData(null);

  const collect = async () => {
    const [lo, hi] = range();
    if (lo && lo > hi) {
      setError(tr('Начало периода позже конца.', 'The start is after the end.'));
      return;
    }
    setBusy(true);
    setError(null);
    const result = await collectExport(userId, name, lo, hi);
    setBusy(false);
    if (!result) {
      setError(tr('Не удалось собрать данные. Проверьте связь и попробуйте ещё раз.', 'Couldn’t gather the data. Check your connection and try again.'));
      return;
    }
    setData(result);
  };

  const stamp = data ? `${data.from ?? 'start'}_${data.to}` : todayISO();

  return (
    <Card>
      <h2 className="flex items-center gap-2 font-semibold">
        <Sparkles className="size-4.5 text-ink-soft" aria-hidden /> {tr('Выгрузка для нейросети', 'Export for an AI')}
      </h2>
      <p className="mt-1.5 text-sm text-ink-soft">
        {tr('Файл с вашими записями и готовой инструкцией внутри: отдайте его любой нейросети, и она поймёт, что с ним делать. Только ваша сторона — дни и заметки партнёра в файл не попадают.', 'A file with your entries and ready instructions inside: give it to any AI and it will know what to do. Only your side — your partner’s days and notes are not included.')}
      </p>

      <fieldset className="mt-5">
        <legend className="mb-2 text-sm font-medium">{tr('За какой период', 'Period')}</legend>
        <Segment
          legend={tr('За какой период', 'Period')}
          options={PERIODS}
          value={period}
          onChange={(next) => {
            setPeriod(next);
            reset();
          }}
        />
        {period === 'custom' && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Input type="date" aria-label={tr('С', 'From')} max={to} value={from} onChange={(e) => (setFrom(e.target.value), reset())} className="max-w-44" />
            <span className="text-sm text-ink-faint">—</span>
            <Input type="date" aria-label={tr('По', 'To')} max={todayISO()} value={to} onChange={(e) => (setTo(e.target.value), reset())} className="max-w-44" />
          </div>
        )}
      </fieldset>

      <fieldset className="mt-5">
        <legend className="mb-2 text-sm font-medium">{tr('Зачем', 'Why')}</legend>
        <Segment legend={tr('Зачем', 'Why')} options={GOALS} value={goal} onChange={setGoal} />
        {goal === 'problem' && (
          <div className="mt-3">
            <label htmlFor="concern" className="mb-2 block text-sm text-ink-soft">
              {tr('Что беспокоит', 'What worries you')} <span className="text-ink-faint">{tr('— по желанию, попадёт в инструкцию', '— optional, goes into the instructions')}</span>
            </label>
            <Textarea id="concern" rows={3} value={concern} onChange={(e) => setConcern(e.target.value)} placeholder={tr('Например: часто ссоримся по выходным', 'For example: we often argue at weekends')} />
          </div>
        )}
      </fieldset>

      {!data ? (
        <div className="mt-5">
          <Button variant="secondary" loading={busy} onClick={collect}>
            <FileText className="size-4" aria-hidden /> {tr('Посмотреть, что попадёт', 'Preview what’s included')}
          </Button>
        </div>
      ) : (
        <div className="mt-5 rounded-xl bg-sunken p-4">
          <p className="text-sm font-medium">{tr('В файл попадёт', 'The file will include')}</p>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
            {exportSummary(data).map(([label, value, hint]) => (
              <div key={label}>
                <dt className="inline text-ink-soft">{label}: </dt>
                <dd className="inline font-medium tabular-nums" title={hint}>
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => download(`vpare-${stamp}.md`, buildMarkdown(data, goal, concern), 'text/markdown;charset=utf-8')}>
              <Download className="size-4" aria-hidden /> {tr('Скачать для нейросети', 'Download for an AI')}
            </Button>
            <Button variant="ghost" onClick={() => download(`vpare-${stamp}.json`, JSON.stringify(data, null, 2), 'application/json')}>
              {tr('Только данные, JSON', 'Data only, JSON')}
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3">
          <Alert>{error}</Alert>
        </div>
      )}
    </Card>
  );
}
