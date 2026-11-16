'use client';

import type { LucideIcon } from 'lucide-react';
import { SwitchTrack } from '@/components/ui/Blocks';

interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  id?: string;
}

/* A switch, announced as one. 44px tall hit area around a 31px track. */
export function Toggle({ checked, onChange, label, disabled, id }: ToggleProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="tap group relative inline-flex shrink-0 items-center justify-center disabled:opacity-50"
    >
      <SwitchTrack checked={checked} />
    </button>
  );
}

interface SegmentOption<T extends string | number> {
  value: T;
  label: string;
  Icon?: LucideIcon;
}

export function Segment<T extends string | number>({
  options,
  value,
  onChange,
  legend,
}: {
  options: SegmentOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  legend?: string;
}) {
  return (
    <div role="group" aria-label={legend} className="flex flex-wrap gap-2">
      {options.map(({ value: optionValue, label, Icon }) => {
        const active = optionValue === value;
        return (
          <button
            key={String(optionValue)}
            type="button"
            onClick={() => onChange(optionValue)}
            aria-pressed={active}
            className={`tap flex items-center gap-2 rounded-full px-4 text-subhead font-medium transition-colors ${
              active ? 'bg-ink text-surface' : 'bg-sunken text-ink-soft hover:text-ink'
            }`}
          >
            {Icon && <Icon className="size-4" aria-hidden />}
            {label}
          </button>
        );
      })}
    </div>
  );
}
