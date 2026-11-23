'use client';

import { useId, useState } from 'react';
import { MoreHorizontal, Plus } from 'lucide-react';
import { DIARY_COLUMNS } from '@/lib/courses';
import { relativeStamp } from '@/lib/dates';
import type { CoursesStore, JournalEntry } from '@/hooks/useCourses';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Field';
import { AutoHeight } from '@/components/ui/AutoHeight';
import { isEnglish, tr } from '@/lib/i18n';

const label = (c: (typeof DIARY_COLUMNS)[number]) => (isEnglish() ? c.en : c.label);
const empty = () => Object.fromEntries(DIARY_COLUMNS.map((c) => [c.id, ''])) as Record<string, string>;

/*
  The thought diary from CBT: situation → thought → emotion → reaction. One
  diary for the whole course — lesson 3.1 starts it, later lessons ask to keep
  it, and the journal holds it. An entry is four short answers, newest first.
*/
export function ThoughtDiary({
  store,
  entries,
  readOnly = false,
  limit,
}: {
  store?: CoursesStore;
  entries: JournalEntry[];
  readOnly?: boolean;
  /* Show only the newest few (inside a lesson); the journal shows them all. */
  limit?: number;
}) {
  const [draft, setDraft] = useState<Record<string, string> | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const thoughts = entries.filter((e) => e.kind === 'thought');
  const shown = limit ? thoughts.slice(0, limit) : thoughts;
  const id = useId();

  const save = async () => {
    if (!store || !draft || !Object.values(draft).some((v) => v.trim())) return;
    setSaving(true);
    const ok = editing ? await store.updateEntry(editing, { data: draft }) : !!(await store.addEntry('thought', '', draft));
    setSaving(false);
    if (ok) {
      setDraft(null);
      setEditing(null);
    }
  };

  return (
    <div className="space-y-3">
      {!readOnly && (
        <AutoHeight>
          {draft ? (
            <div className="space-y-3 rounded-xl bg-sunken/60 p-3.5">
              {DIARY_COLUMNS.map((c) => (
                <div key={c.id}>
                  <label htmlFor={`${id}-${c.id}`} className="mb-1 block text-footnote font-medium text-ink-soft">
                    {label(c)}
                  </label>
                  <Textarea
                    id={`${id}-${c.id}`}
                    rows={2}
                    className="bg-surface"
                    placeholder={isEnglish() ? undefined : c.hint}
                    value={draft[c.id] ?? ''}
                    onChange={(event) => setDraft({ ...draft, [c.id]: event.target.value })}
                  />
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setDraft(null);
                    setEditing(null);
                  }}
                >
                  {tr('Отмена', 'Cancel')}
                </Button>
                <Button className="flex-1" loading={saving} disabled={!Object.values(draft).some((v) => v.trim())} onClick={save}>
                  {tr('Сохранить', 'Save')}
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="secondary" block onClick={() => setDraft(empty())}>
              <Plus className="size-4" aria-hidden /> {tr('Новая запись в дневник', 'New diary entry')}
            </Button>
          )}
        </AutoHeight>
      )}

      {shown.map((entry) => (
        <article key={entry.id} className="rounded-xl bg-sunken/60 px-3.5 py-3">
          <div className="flex items-center justify-between gap-2">
            <time dateTime={entry.created_at} className="text-footnote text-ink-faint first-letter:uppercase">
              {relativeStamp(entry.created_at)}
            </time>
            {!readOnly && store && (
              <button
                type="button"
                aria-label={tr('Ещё', 'More')}
                aria-expanded={menu === entry.id}
                onClick={() => setMenu(menu === entry.id ? null : entry.id)}
                className="tap -my-2 -mr-2 flex items-center justify-center rounded-full text-ink-faint hover:text-ink"
              >
                <MoreHorizontal className="size-5" aria-hidden />
              </button>
            )}
          </div>
          <dl className="mt-1 space-y-1.5">
            {DIARY_COLUMNS.map((c) =>
              entry.data?.[c.id]?.trim() ? (
                <div key={c.id}>
                  <dt className="text-footnote text-ink-faint">{label(c)}</dt>
                  <dd className="text-body whitespace-pre-wrap text-ink">{entry.data[c.id]}</dd>
                </div>
              ) : null,
            )}
          </dl>
          {menu === entry.id && store && (
            <div className="mt-2 flex gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setDraft({ ...empty(), ...entry.data });
                  setEditing(entry.id);
                  setMenu(null);
                }}
              >
                {tr('Изменить', 'Edit')}
              </Button>
              <Button variant="danger" onClick={() => store.removeEntry(entry.id)}>
                {tr('Удалить', 'Delete')}
              </Button>
            </div>
          )}
        </article>
      ))}

      {limit && thoughts.length > limit && (
        <p className="px-1 text-footnote text-ink-faint">{tr(`Ещё ${thoughts.length - limit} — в «Журнале»`, `${thoughts.length - limit} more in the journal`)}</p>
      )}
    </div>
  );
}
