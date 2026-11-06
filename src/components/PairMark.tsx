/*
  The product's one graphic device: a single ring made of two halves. Indigo is
  you, amber is your partner, and the gaps sit at the top and the bottom.

  Both halves are the same circle (r=48, circumference 301.6) drawn with a dash
  pattern, which is what lets the mark move. A dash of 0.5 with a round cap is a
  dot; a dash of 124 is a half of the ring. So «apart» and «together» are the
  same two elements at different dash lengths, and the browser interpolates
  between them: each dot grows from its own centre, reaching with both ends at
  once, until the two meet. Nothing is added or removed to animate it.

  Geometry lives in globals.css, under `.pair-mark`, because a dash transition
  cannot be written as a utility class.

  Indigo and amber only — the mood spectrum stays reserved for mood, so the mark
  never wears green or red.
*/
export function PairMark({
  variant = 'together',
  spin = true,
  className = '',
}: {
  variant?: 'apart' | 'together' | 'quiet';
  /* The slow turn once the ring is closed. Off wherever the mark is chrome
     rather than the subject: a logo turning all day is noise, not motion. */
  spin?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 144 144"
      className={`pair-mark pair-mark--${variant} ${spin ? 'pair-mark--spin' : ''} ${className}`}
      aria-hidden
      focusable="false"
    >
      <g className="pair-mark__spin">
        <circle
          className="pair-mark__arc pair-mark__arc--partner"
          cx="72"
          cy="72"
          r="48"
          fill="none"
          stroke="var(--c-partner)"
          strokeLinecap="round"
        />
        {/* The partner's half before they have arrived. A separate path because a
            repeating dash pattern cannot be dotted on one half of a circle and
            solid on the other. */}
        <path
          className="pair-mark__promise"
          d="M85.45 25.93 A48 48 0 0 1 84.98 118.21"
          fill="none"
          stroke="var(--c-partner)"
          strokeWidth="7"
          strokeDasharray="7 13"
          strokeLinecap="round"
        />
        <circle
          className="pair-mark__arc pair-mark__arc--you"
          cx="72"
          cy="72"
          r="48"
          fill="none"
          stroke="var(--c-accent)"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <PairMark spin={false} className="size-6" />
      <span className="text-lg font-semibold tracking-tight">Впаре</span>
    </span>
  );
}
