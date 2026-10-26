'use client';

import { forwardRef } from 'react';

const BASE =
  'w-full border border-line bg-sunken text-base text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-accent focus:bg-surface disabled:text-ink-soft disabled:cursor-not-allowed';

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className = '', ...rest },
  ref,
) {
  return <input ref={ref} className={`${BASE} h-11 rounded-lg px-3.5 ${className}`} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className = '', ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        className={`${BASE} resize-y rounded-xl p-3.5 text-[15px] leading-relaxed ${className}`}
        {...rest}
      />
    );
  },
);

export function Label({ htmlFor, children, hint }: { htmlFor?: string; children: React.ReactNode; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-2 block text-sm font-medium text-ink">
      {children}
      {hint && <span className="ml-2 font-normal text-ink-faint">{hint}</span>}
    </label>
  );
}
