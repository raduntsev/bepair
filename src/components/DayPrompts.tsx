'use client';

import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { promptsFor } from '@/lib/dayPrompts';

/*
  A disclosure, not a questionnaire: closed by default, open by default only
  when the partner has already marked their day and it is your turn — that is
  the moment the concept puts these questions under «теперь ваша очередь».
  Reading them changes nothing and is recorded nowhere.
*/
export function DayPrompts({ date, defaultOpen = false }: { date: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const prompts = promptsFor(date);

  return (
    <div className="measure mt-4">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="tap -ml-2 inline-flex items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
      >
        Не знаете, с чего начать?
        <ChevronDown
          className={`size-4 transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {open && (
        <div id={panelId}>
          <ul className="mt-2 space-y-2 border-l-2 border-line pl-4">
            {prompts.map((q) => (
              <li key={q} className="text-sm text-ink-soft">
                {q}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-ink-faint">
            Просто чтобы было от чего оттолкнуться. Отвечать не нужно, и партнёр не узнает, какие вопросы вы читали.
          </p>
        </div>
      )}
    </div>
  );
}
