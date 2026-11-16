'use client';

import { forwardRef } from 'react';

/* A filled field with no border at rest; focus draws the accent ring. */
const BASE =
  'w-full border border-transparent bg-sunken text-body text-ink outline-none transition-[border-color,background-color,box-shadow] placeholder:text-ink-faint focus:border-accent focus:bg-surface focus:shadow-[0_0_0_3px_var(--c-accent-soft)] disabled:text-ink-soft disabled:cursor-not-allowed';

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className = '', ...rest },
  ref,
) {
  return <input ref={ref} className={`${BASE} h-11 rounded-xl px-3.5 ${className}`} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className = '', ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        className={`${BASE} resize-y rounded-xl p-3.5 ${className}`}
        {...rest}
      />
    );
  },
);

export function Label({ htmlFor, children, hint }: { htmlFor?: string; children: React.ReactNode; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-2 block text-subhead font-medium text-ink">
      {children}
      {hint && <span className="ml-2 font-normal text-ink-faint">{hint}</span>}
    </label>
  );
}
