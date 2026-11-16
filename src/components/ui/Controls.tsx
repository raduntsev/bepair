'use client';

import { useId } from 'react';
import { motion } from 'framer-motion';
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

/*
  Segmented control, after iOS: a grey track, the choice a white plate that
  slides to where you tapped. The slide is the feedback — no caption needed.
*/
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
  const id = useId();
  return (
    <div role="radiogroup" aria-label={legend} className="flex w-full rounded-xl bg-sunken p-1">
      {options.map(({ value: optionValue, label, Icon }) => {
        const active = optionValue === value;
        return (
          <button
            key={String(optionValue)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(optionValue)}
            className={`relative flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-[0.625rem] px-2 text-subhead font-medium transition-colors duration-300 ${
              active ? 'text-ink' : 'text-ink-faint hover:text-ink'
            }`}
          >
            {active && (
              <motion.span
                layoutId={`segment-${id}`}
                transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
                className="absolute inset-0 rounded-[0.625rem] bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.1),0_1px_1px_rgba(0,0,0,0.04)]"
              />
            )}
            <span className="relative flex items-center gap-1.5">
              {Icon && <Icon className="size-4" aria-hidden />}
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
