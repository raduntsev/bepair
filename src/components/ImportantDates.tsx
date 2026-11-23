'use client';

import { useState } from 'react';
import { CalendarHeart, ChevronRight, Plus, X } from 'lucide-react';
import { fmt, todayISO } from '@/lib/dates';
import { upcoming, whenText, withAnniversary, type ImportantDate } from '@/lib/importantDates';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Toggle } from '@/components/ui/Controls';
import { Alert } from '@/components/ui/Blocks';
import { Sheet } from '@/components/ui/Sheet';
import { tr } from '@/lib/i18n';

interface Props {
  items: ImportantDate[];
  togetherSince: string | null;
  error: string | null;
  onAdd: (title: string, date: string, yearly: boolean) => Promise<boolean>;
  onRemove: (id: string) => void;
}

/*
  One row under the calendar: the nearest date and how soon. The list and the
  form live in a sheet — dates are added a few times a year, so they do not
  take the page. «Скоро» first: the point is to see a birthday coming.
*/
export function ImportantDates({ items, togetherSince, error, onAdd, onRemove }: Props) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [yearly, setYearly] = useState(true);
  const [busy, setBusy] = useState(false);

  const list = upcoming(withAnniversary(items, togetherSince), todayISO());

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !date) return;
    setBusy(true);
    const ok = await onAdd(title, date, yearly);
    setBusy(false);
    if (ok) {
      setTitle('');
      setDate('');
      setYearly(true);
      setAdding(false);
    }
  };

  const next = list[0];
  const close = () => {
    setOpen(false);
    setAdding(false);
  };

  return (
    <>
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-haspopup="dialog"
      className="flex min-h-14 w-full items-center gap-3.5 rounded-2xl bg-surface px-4 py-2.5 text-left shadow-card transition-colors hover:bg-sunken"
    >
      <CalendarHeart className="size-5 shrink-0 text-accent" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-body font-medium">{tr('Важные даты', 'Important dates')}</span>
        <span className="block truncate text-footnote text-ink-faint">
          {next ? `${next.title} · ${whenText(next.inDays)}` : tr('Дни рождения, годовщины, праздники', 'Birthdays, anniversaries, holidays')}
        </span>
      </span>
      {list.length > 0 && <span className="shrink-0 text-footnote tabular-nums text-ink-faint">{list.length}</span>}
      <ChevronRight className="size-5 shrink-0 text-line-strong" aria-hidden />
    </button>

    <Sheet open={open} onClose={close} title={tr('Важные даты', 'Important dates')}>
      {!adding && (
        <Button variant="secondary" block onClick={() => setAdding(true)}>
          <Plus className="size-4" aria-hidden /> {tr('Добавить дату', 'Add a date')}
        </Button>
      )}

      {adding && (
        <form onSubmit={submit} className="space-y-3 rounded-xl bg-sunken p-4">
          <div>
            <label htmlFor="date-title" className="mb-2 block text-sm font-medium">
              {tr('Что это за день', 'What day is it')}
            </label>
            <Input id="date-title" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder={tr('День рождения Ани', 'Anna’s birthday')} />
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label htmlFor="date-value" className="mb-2 block text-sm font-medium">
                {tr('Дата', 'Date')}
              </label>
              <Input id="date-value" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
            </div>
            <div className="flex items-center gap-1">
              <Toggle checked={yearly} onChange={setYearly} label={tr('Каждый год', 'Every year')} />
              <span className="text-sm">{tr('Каждый год', 'Every year')}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="submit" loading={busy} disabled={!title.trim() || !date}>
              {tr('Сохранить', 'Save')}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
              {tr('Отмена', 'Cancel')}
            </Button>
          </div>
        </form>
      )}

      {list.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft">
          {tr('Дни рождения, годовщины, общие праздники — всё, что не хочется пропустить. Видно вам обоим.', 'Birthdays, anniversaries, your own holidays — anything you don’t want to miss. Visible to you both.')}
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {list.map((o) => (
            <li key={`${o.id ?? 'anniversary'}-${o.on}`} className="flex items-center gap-3 py-2.5">
              <span className="flex size-2 shrink-0 rounded-full bg-accent" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{o.title}</span>
                <span className="block text-sm text-ink-faint">
                  {fmt(o.on, 'd MMMM')} · {whenText(o.inDays)}
                </span>
              </span>
              {o.id && (
                <button
                  type="button"
                  aria-label={tr(`Убрать «${o.title}»`, `Remove “${o.title}”`)}
                  onClick={() => onRemove(o.id!)}
                  className="tap flex items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-sunken hover:text-ink"
                >
                  <X className="size-4" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {error && (
        <div className="mt-3">
          <Alert>{error}</Alert>
        </div>
      )}
    </Sheet>
    </>
  );
}
