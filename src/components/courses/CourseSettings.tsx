'use client';

import { useId } from 'react';
import { BellRing, Eye, Footprints } from 'lucide-react';
import { WEEKDAYS_SHORT } from '@/lib/planerka';
import type { CoursesStore } from '@/hooks/useCourses';
import { RowGroup, SwitchRow } from '@/components/ui/Blocks';
import { Input } from '@/components/ui/Field';
import { tr } from '@/lib/i18n';

/* Monday first, as a Russian week reads. Values stay JS getDay() numbers. */
const WEEK = [1, 2, 3, 4, 5, 6, 0];

/*
  The one privacy switch. All or nothing, by the couple's decision: there is
  deliberately no per-answer control, so nobody has to choose, answer by
  answer, what to hide from the person they live with.
*/
export function ShareSwitch({ store, partnerName }: { store: CoursesStore; partnerName: string }) {
  const prefs = store.myPrefs;
  if (!prefs) return null;
  return (
    <RowGroup
      label={tr('Видимость ответов', 'Who sees your answers')}
      footer={
        prefs.share_answers
          ? tr(`${partnerName} видит все ваши ответы и записи журнала.`, `${partnerName} sees all your answers and journal entries.`)
          : tr(`Ответы и журнал видите только вы. ${partnerName} видит лишь, на каком вы уроке.`, `Only you see your answers and journal. ${partnerName} sees only which lesson you’re on.`)
      }
    >
      <SwitchRow
        Icon={Eye}
        title={tr(`Мои ответы видит ${partnerName}`, `${partnerName} sees my answers`)}
        checked={prefs.share_answers}
        onChange={(next) => store.updatePrefs({ share_answers: next })}
      />
    </RowGroup>
  );
}

/* When to be reminded about the course, and whether to hear about the partner's steps. */
export function CourseReminder({ store, partnerName }: { store: CoursesStore; partnerName?: string }) {
  const prefs = store.myPrefs;
  const timeId = useId();
  if (!prefs) return null;
  const days = new Set(prefs.remind_days);

  return (
    <div className="space-y-3">
      <RowGroup label={tr('Напоминание о курсе', 'Course reminder')}>
        <SwitchRow
          Icon={BellRing}
          title={tr('Напоминать о курсе', 'Remind me about the course')}
          sub={tr('Если сегодня вы ещё не занимались', 'If you haven’t worked on it today')}
          checked={prefs.remind}
          onChange={(next) => store.updatePrefs({ remind: next })}
        />
        {prefs.remind && (
          <li className="px-4 pt-2 pb-4">
            <div className="flex items-center gap-2 pl-[2.875rem]">
              <label htmlFor={timeId} className="text-subhead text-ink-soft">
                {tr('в', 'at')}
              </label>
              <div className="w-36">
                <Input
                  id={timeId}
                  type="time"
                  value={prefs.remind_at}
                  onChange={(event) => event.target.value && store.updatePrefs({ remind_at: event.target.value })}
                />
              </div>
            </div>
            <div role="group" aria-label={tr('Дни недели', 'Days of the week')} className="mt-3 flex gap-1 pl-[2.875rem]">
              {WEEK.map((d) => {
                const on = days.has(d);
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      const next = on ? prefs.remind_days.filter((x) => x !== d) : [...prefs.remind_days, d];
                      store.updatePrefs({ remind_days: next });
                    }}
                    className={`flex h-11 min-w-0 flex-1 items-center justify-center rounded-xl text-footnote font-semibold transition-colors ${
                      on ? 'bg-accent text-accent-ink' : 'bg-sunken text-ink-faint hover:text-ink'
                    }`}
                  >
                    {WEEKDAYS_SHORT[d]}
                  </button>
                );
              })}
            </div>
          </li>
        )}
      </RowGroup>
      {partnerName && (
        <RowGroup label={tr('Шаги партнёра', 'Partner’s steps')}>
          <SwitchRow
            Icon={Footprints}
            title={tr(`Когда ${partnerName} проходит урок`, `When ${partnerName} finishes a lesson`)}
            sub={tr('Уведомление на телефон', 'A notification on your phone')}
            checked={prefs.notify_partner}
            onChange={(next) => store.updatePrefs({ notify_partner: next })}
          />
        </RowGroup>
      )}
    </div>
  );
}
