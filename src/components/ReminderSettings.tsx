'use client';

import { useId } from 'react';
import { Moon, Sunrise } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Toggle } from '@/components/ui/Controls';
import { Input } from '@/components/ui/Field';
import type { Reminders } from '@/hooks/useReminders';

interface RowProps {
  Icon: LucideIcon;
  title: string;
  sub: string;
  on: boolean;
  at: string;
  onToggle: (next: boolean) => void;
  onTime: (next: string) => void;
}

function ReminderRow({ Icon, title, sub, on, at, onToggle, onTime }: RowProps) {
  const timeId = useId();
  return (
    <li className="px-5 py-3.5">
      <div className="flex items-center gap-3.5">
        <Icon className="size-5 shrink-0 text-ink-soft" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-ink">{title}</span>
          <span className="block text-sm text-ink-faint">{sub}</span>
        </span>
        <Toggle checked={on} onChange={onToggle} label={title} />
      </div>
      {on && (
        <div className="mt-2 flex items-center gap-2 pl-8.5">
          <label htmlFor={timeId} className="text-sm text-ink-soft">
            в
          </label>
          <div className="w-36">
            <Input id={timeId} type="time" aria-label={`${title}, время`} value={at} onChange={(event) => event.target.value && onTime(event.target.value)} />
          </div>
        </div>
      )}
    </li>
  );
}

/* Used in notification settings and as the last onboarding step. */
export function ReminderSettings({
  value,
  onChange,
}: {
  value: Reminders;
  onChange: (patch: Partial<Reminders>) => void;
}) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <ReminderRow
        Icon={Sunrise}
        title="Утром"
        sub="Если вчерашний день партнёра открыт, а вы его ещё не видели"
        on={value.remind_morning}
        at={value.remind_morning_at}
        onToggle={(next) => onChange({ remind_morning: next })}
        onTime={(next) => onChange({ remind_morning_at: next })}
      />
      <ReminderRow
        Icon={Moon}
        title="Вечером"
        sub="Если свой день ещё не отмечен"
        on={value.remind_evening}
        at={value.remind_evening_at}
        onToggle={(next) => onChange({ remind_evening: next })}
        onTime={(next) => onChange({ remind_evening_at: next })}
      />
    </ul>
  );
}
