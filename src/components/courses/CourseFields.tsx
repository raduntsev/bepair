'use client';

import { useId } from 'react';
import { Plus, X } from 'lucide-react';
import { hasContent, type Field, type FieldValue, type LessonAnswers } from '@/lib/courses';
import { Input, Textarea } from '@/components/ui/Field';
import { tr } from '@/lib/i18n';

/*
  The fields of a lesson. Each kind stores the simplest shape that holds it:
  text → string, list → string[], table → string[][], scale → { item index: score }.
  Editing never validates: every field may stay empty.
*/

const asText = (v: FieldValue | undefined) => (typeof v === 'string' ? v : '');
const asList = (v: FieldValue | undefined, n: number) => {
  const list = Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : [];
  return Array.from({ length: n }, (_, i) => list[i] ?? '');
};
const asTable = (v: FieldValue | undefined, cols: number, rows: number) => {
  const table = Array.isArray(v) && v.every((x) => Array.isArray(x)) ? (v as string[][]) : [];
  const count = Math.max(rows, table.length);
  return Array.from({ length: count }, (_, r) => Array.from({ length: cols }, (_, c) => table[r]?.[c] ?? ''));
};
const asScale = (v: FieldValue | undefined) => (v && !Array.isArray(v) && typeof v === 'object' ? (v as Record<string, number>) : {});

function Question({ id, field, children }: { id: string; field: Field; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-headline font-semibold">
        {field.q}
      </label>
      {field.hint && <p className="measure mt-1 text-subhead text-ink-faint">{field.hint}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}

export function FieldEditor({
  field,
  value,
  onChange,
  echo,
}: {
  field: Exclude<Field, { kind: 'diary' }>;
  value: FieldValue | undefined;
  onChange: (next: FieldValue) => void;
  /* Earlier answers the field asks you to compare with. */
  echo?: { label: string; value: FieldValue | undefined }[];
}) {
  const id = useId();

  const earlier = echo?.filter((e) => hasContent(e.value)) ?? [];
  const echoes =
    earlier.length > 0 ? (
      <div className="mb-3 space-y-2">
        {earlier.map((e) => (
          <div key={e.label} className="rounded-xl bg-sunken px-3.5 py-2.5">
            <p className="text-footnote font-medium text-ink-faint">{e.label}</p>
            <div className="mt-0.5 text-subhead text-ink-soft">
              <ValueView value={e.value} />
            </div>
          </div>
        ))}
      </div>
    ) : null;

  if (field.kind === 'text') {
    return (
      <Question id={id} field={field}>
        {echoes}
        <Textarea id={id} rows={field.rows ?? 3} value={asText(value)} onChange={(event) => onChange(event.target.value)} />
      </Question>
    );
  }

  if (field.kind === 'list') {
    const list = asList(value, field.count);
    return (
      <Question id={`${id}-0`} field={field}>
        <ol className="space-y-2">
          {list.map((item, i) => (
            <li key={i} className="flex items-center gap-2.5">
              {(field.ordered || field.count > 3) && (
                <span aria-hidden className="w-5 shrink-0 text-right text-subhead text-ink-faint tabular-nums">
                  {i + 1}
                </span>
              )}
              <div className="relative min-w-0 flex-1">
                {field.prefix && (
                  <span aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-body text-ink-faint">
                    {field.prefix.trim()}
                  </span>
                )}
                <Input
                  id={`${id}-${i}`}
                  aria-label={`${field.q}, ${i + 1}`}
                  value={item}
                  className={field.prefix ? 'pl-[3.25rem]' : ''}
                  onChange={(event) => {
                    const next = list.slice();
                    next[i] = event.target.value;
                    onChange(next);
                  }}
                />
              </div>
            </li>
          ))}
        </ol>
      </Question>
    );
  }

  if (field.kind === 'scale') {
    const scores = asScale(value);
    return (
      <fieldset>
        <legend className="block text-headline font-semibold">{field.q}</legend>
        {field.hint && <p className="measure mt-1 text-subhead text-ink-faint">{field.hint}</p>}
        <ul className="mt-3 space-y-4">
          {field.items.map((item, i) => {
            const score = scores[String(i)];
            const set = typeof score === 'number';
            return (
              <li key={item}>
                <div className="flex items-baseline justify-between gap-3">
                  <label htmlFor={`${id}-${i}`} className="text-subhead text-ink">
                    {item}
                  </label>
                  <span className={`shrink-0 text-headline font-semibold tabular-nums ${set ? 'text-accent' : 'text-ink-faint'}`}>{set ? score : '–'}</span>
                </div>
                <input
                  id={`${id}-${i}`}
                  type="range"
                  min={field.min}
                  max={field.max}
                  step={1}
                  value={set ? score : Math.round((field.min + field.max) / 2)}
                  aria-valuetext={set ? String(score) : tr('не оценено', 'not rated')}
                  onChange={(event) => onChange({ ...scores, [String(i)]: Number(event.target.value) })}
                  /* A tap on the untouched track still counts as a choice. */
                  onPointerUp={(event) => !set && onChange({ ...scores, [String(i)]: Number((event.target as HTMLInputElement).value) })}
                  className={`course-range h-11 w-full ${set ? '' : 'course-range--unset'}`}
                />
              </li>
            );
          })}
        </ul>
      </fieldset>
    );
  }

  /* table */
  const table = asTable(value, field.columns.length, field.rows);
  const max = field.max ?? 20;
  const write = (r: number, c: number, text: string) => {
    const next = table.map((row) => row.slice());
    next[r][c] = text;
    onChange(next);
  };
  return (
    <div>
      <p className="block text-headline font-semibold">{field.q}</p>
      {field.hint && <p className="measure mt-1 text-subhead text-ink-faint">{field.hint}</p>}
      <div className="mt-3 space-y-3">
        {field.example && (
          <div className="rounded-xl border border-dashed border-line-strong px-3.5 py-3">
            <p className="text-footnote font-medium text-ink-faint">{tr('Пример', 'Example')}</p>
            <dl className="mt-1 space-y-1.5">
              {field.columns.map((col, c) => (
                <div key={col}>
                  <dt className="text-footnote text-ink-faint">{col}</dt>
                  <dd className="text-subhead text-ink-soft">{field.example?.[c]}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
        {table.map((row, r) => (
          <div key={r} className="rounded-xl bg-sunken/60 p-3">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-footnote font-medium text-ink-faint tabular-nums">{r + 1}</span>
              {table.length > field.rows && (
                <button
                  type="button"
                  aria-label={tr(`Убрать строку ${r + 1}`, `Remove row ${r + 1}`)}
                  onClick={() => onChange(table.filter((_, i) => i !== r))}
                  className="tap -my-2 -mr-2 flex items-center justify-center rounded-full text-ink-faint hover:text-ink"
                >
                  <X className="size-4" aria-hidden />
                </button>
              )}
            </div>
            <div className="space-y-2">
              {field.columns.map((col, c) => (
                <div key={col}>
                  <label htmlFor={`${id}-${r}-${c}`} className="mb-1 block text-footnote text-ink-soft">
                    {col}
                  </label>
                  <Textarea id={`${id}-${r}-${c}`} rows={2} value={row[c]} onChange={(event) => write(r, c, event.target.value)} className="bg-surface" />
                </div>
              ))}
            </div>
          </div>
        ))}
        {table.length < max && (
          <button
            type="button"
            onClick={() => onChange([...table, field.columns.map(() => '')])}
            className="tap inline-flex items-center gap-1.5 rounded-xl px-2 text-subhead font-semibold text-accent hover:opacity-80"
          >
            <Plus className="size-4" aria-hidden /> {tr('Ещё строка', 'Add a row')}
          </button>
        )}
      </div>
    </div>
  );
}

/* Any stored value, read-only: the journal, the partner's answers, an echo. */
export function ValueView({ value, field }: { value: FieldValue | undefined; field?: Field }) {
  if (!hasContent(value)) return null;
  if (typeof value === 'string') return <p className="measure whitespace-pre-wrap">{value}</p>;
  if (Array.isArray(value) && value.every((x) => typeof x === 'string')) {
    const prefix = field?.kind === 'list' ? (field.prefix ?? '') : '';
    return (
      <ul className="space-y-0.5">
        {(value as string[])
          .filter((x) => x.trim())
          .map((x, i) => (
            <li key={i}>
              {prefix}
              {x}
            </li>
          ))}
      </ul>
    );
  }
  if (Array.isArray(value)) {
    const columns = field?.kind === 'table' ? field.columns : [];
    return (
      <div className="space-y-2">
        {(value as string[][])
          .filter((row) => row.some((c) => c.trim()))
          .map((row, r) => (
            <dl key={r} className="space-y-1 rounded-xl bg-sunken/60 px-3 py-2">
              {row.map((cell, c) =>
                cell.trim() ? (
                  <div key={c}>
                    {columns[c] && <dt className="text-footnote text-ink-faint">{columns[c]}</dt>}
                    <dd className="whitespace-pre-wrap">{cell}</dd>
                  </div>
                ) : null,
              )}
            </dl>
          ))}
      </div>
    );
  }
  const items = field?.kind === 'scale' ? field.items : [];
  const max = field?.kind === 'scale' ? field.max : 10;
  return (
    <ul className="space-y-1.5">
      {Object.entries(value as Record<string, number>)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([i, score]) => (
          <li key={i} className="flex items-center gap-3">
            <span className="min-w-0 flex-1">{items[Number(i)] ?? i}</span>
            <span aria-hidden className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-sunken">
              <span className="block h-full rounded-full bg-accent" style={{ width: `${(score / max) * 100}%` }} />
            </span>
            <span className="w-5 shrink-0 text-right font-semibold tabular-nums">{score}</span>
          </li>
        ))}
    </ul>
  );
}

/* A lesson's answers, read-only, question by question; empty questions are left out. */
export function AnswersView({ fields, answers }: { fields: Field[]; answers: LessonAnswers | null | undefined }) {
  const shown = fields.filter((f) => f.kind !== 'diary' && hasContent(answers?.[f.id]));
  if (shown.length === 0) return null;
  return (
    <div className="space-y-4">
      {shown.map((f) => (
        <div key={f.id}>
          <p className="text-subhead font-semibold text-ink">{f.q}</p>
          <div className="mt-1 text-body text-ink-soft">
            <ValueView value={answers?.[f.id]} field={f} />
          </div>
        </div>
      ))}
    </div>
  );
}
