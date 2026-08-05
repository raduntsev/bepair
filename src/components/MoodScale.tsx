'use client';

import { useCallback, useRef } from 'react';
import { moodColor, moodLabel } from '@/lib/mood';

interface MoodScaleProps {
  value: number | null;
  onChange: (value: number) => void;
  disabled?: boolean;
}

const STEP = 0.02;

export function MoodScale({ value, onChange, disabled = false }: MoodScaleProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  const setFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return;
      const { left, width } = track.getBoundingClientRect();
      /* The handle is inset half its width at each end; map pointer x to that range. */
      const inset = 36;
      const travel = width - inset * 2;
      if (travel <= 0) return;
      onChange(Math.min(1, Math.max(0, (clientX - left - inset) / travel)));
    },
    [onChange],
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setFromClientX(event.clientX);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    setFromClientX(event.clientX);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const current = value ?? 0.5;
    const move = (next: number) => {
      event.preventDefault();
      onChange(Math.min(1, Math.max(0, next)));
    };

    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') move(current - STEP);
    else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') move(current + STEP);
    else if (event.key === 'PageDown') move(current - STEP * 5);
    else if (event.key === 'PageUp') move(current + STEP * 5);
    else if (event.key === 'Home') move(0);
    else if (event.key === 'End') move(1);
    else if (value === null && (event.key === 'Enter' || event.key === ' ')) move(0.5);
  };

  const isSet = value !== null;
  const color = isSet ? moodColor(value) : undefined;

  return (
    <div className="select-none">
      <div
        ref={trackRef}
        role="slider"
        /* Stays focusable when disabled so a closed day can still be read aloud. */
        tabIndex={0}
        aria-label="Как прошёл день"
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={value ?? undefined}
        aria-valuetext={isSet ? moodLabel(value) : 'не выбрано'}
        aria-disabled={disabled || undefined}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onKeyDown={handleKeyDown}
        className={`mood-track relative h-16 w-full rounded-full ${
          disabled ? 'cursor-default opacity-70' : 'cursor-pointer touch-none'
        }`}
      >
        {/*
          The handle is always present — without it the one required control in
          the product looks like a flat stripe. Unset it carries no colour and no
          value (aria-valuenow is omitted); it is a grip, not a default.
          Positioned inside the track's own width so it never spills past the card.
        */}
        <span
          aria-hidden
          className={`pointer-events-none absolute top-1/2 size-[4.5rem] -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-surface transition-[left] duration-75 ease-out ${
            isSet ? 'shadow-lift' : 'shadow-card'
          }`}
          style={{
            left: `calc(2.25rem + ${(value ?? 0.5) * 100}% - ${(value ?? 0.5) * 4.5}rem)`,
            backgroundColor: isSet ? color : 'var(--c-surface)',
          }}
        >
          {!isSet && (
            <span className="absolute inset-0 flex items-center justify-center gap-[3px]">
              <span className="h-5 w-px rounded-full bg-ink-faint" />
              <span className="h-5 w-px rounded-full bg-ink-faint" />
              <span className="h-5 w-px rounded-full bg-ink-faint" />
            </span>
          )}
        </span>
      </div>

      <div className="mt-5 flex min-h-6 items-center justify-between text-sm">
        {isSet ? (
          <>
            <span className="flex items-center gap-2 font-medium text-ink">
              <span
                className="size-3.5 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
                aria-hidden
              />
              {moodLabel(value)}
            </span>
            <span className="text-ink-faint">
              {disabled ? 'день закрыт' : 'можно поправить до конца дня'}
            </span>
          </>
        ) : (
          <span className="text-ink-soft">
            Проведите по шкале — она примет цвет вашего дня
          </span>
        )}
      </div>
    </div>
  );
}
