'use client';

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { CalendarHeart, Plus, X } from 'lucide-react';
import { todayISO } from '@/lib/dates';
import { upcoming, whenText, withAnniversary, type ImportantDate } from '@/lib/importantDates';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Toggle } from '@/components/ui/Controls';
import { Alert, Card } from '@/components/ui/Blocks';

interface Props {
  items: ImportantDate[];
  togetherSince: string | null;
  error: string | null;
  onAdd: (title: string, date: string, yearly: boolean) => Promise<boolean>;
  onRemove: (id: string) => void;
}

/* «Скоро» first — the point is to see a birthday coming, not to keep a register. */
export function ImportantDates({ items, togetherSince, error, onAdd, onRemove }: Props) {
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

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <CalendarHeart className="size-4.5 text-ink-soft" aria-hidden /> Важные даты
        </h2>
        {!adding && (
          <Button variant="secondary" onClick={() => setAdding(true)}>
            <Plus className="size-4" aria-hidden /> Добавить
          </Button>
        )}
      </div>

      {adding && (
        <form onSubmit={submit} className="mt-4 space-y-3 rounded-xl bg-sunken p-4">
          <div>
            <label htmlFor="date-title" className="mb-2 block text-sm font-medium">
              Что это за день
            </label>
            <Input id="date-title" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="День рождения Ани" />
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label htmlFor="date-value" className="mb-2 block text-sm font-medium">
                Дата
              </label>
              <Input id="date-value" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
            </div>
            <div className="flex items-center gap-1">
              <Toggle checked={yearly} onChange={setYearly} label="Каждый год" />
              <span className="text-sm">Каждый год</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="submit" loading={busy} disabled={!title.trim() || !date}>
              Сохранить
            </Button>
            <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
              Отмена
            </Button>
          </div>
        </form>
      )}

      {list.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft">
          Дни рождения, годовщины, общие праздники — всё, что не хочется пропустить. Видно вам обоим.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {list.map((o) => (
            <li key={`${o.id ?? 'anniversary'}-${o.on}`} className="flex items-center gap-3 py-2.5">
              <span className="flex size-2 shrink-0 rounded-full bg-accent" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{o.title}</span>
                <span className="block text-sm text-ink-faint">
                  {format(parseISO(o.on), 'd MMMM', { locale: ru })} · {whenText(o.inDays)}
                </span>
              </span>
              {o.id && (
                <button
                  type="button"
                  aria-label={`Убрать «${o.title}»`}
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
    </Card>
  );
}
