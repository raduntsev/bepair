/*
  The product's one graphic device, taken from the calendar: a ring is your
  day, a filled disc is your partner's. Apart, overlapping, or one of them
  still a dotted promise. Indigo and amber only — the mood spectrum stays
  reserved for mood, so the mark never wears green or red.
*/
export function PairMark({
  variant = 'together',
  className = '',
}: {
  variant?: 'apart' | 'together' | 'quiet';
  className?: string;
}) {
  const ring = variant === 'together' ? 40 : 30;
  const disc = variant === 'together' ? 56 : 66;
  return (
    <svg viewBox="0 0 96 56" className={className} aria-hidden focusable="false">
      {variant === 'quiet' ? (
        <circle cx={disc} cy="28" r="17" fill="none" stroke="var(--c-partner)" strokeWidth="2.5" strokeDasharray="4 5" strokeLinecap="round" />
      ) : (
        <circle cx={disc} cy="28" r="18" fill="var(--c-partner)" />
      )}
      <circle cx={ring} cy="28" r="16.5" fill="none" stroke="var(--c-accent)" strokeWidth="5" />
    </svg>
  );
}

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <PairMark className="h-6 w-10" />
      <span className="text-lg font-semibold tracking-tight">Впаре</span>
    </span>
  );
}
