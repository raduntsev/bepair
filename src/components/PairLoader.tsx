/*
  The loading character: the two halves of the pair mark as two round
  creatures, indigo for you and amber for your partner, each with a glint for
  eyes. They glance at each other and blink, shrink into the three dots of
  «typing…», roll a wave through them, and spring back round — one loop of
  waiting, 3.6 s, that never reads as a spinner.

  All motion is CSS keyframes under `.pair-loader` in globals.css: it loops
  without React, costs nothing per frame, and the global reduced-motion block
  freezes it on the first pose (both of them, eyes open).
*/
export function PairLoader({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 60" className={`pair-loader ${className}`} aria-hidden focusable="false">
      <circle className="pair-loader__mid" cx="60" cy="30" r="5" fill="var(--c-ink-faint)" />
      <g className="pair-loader__blob pair-loader__blob--you">
        <circle cx="34" cy="30" r="17" fill="var(--c-accent)" />
        <g className="pair-loader__eyes">
          <rect x="34" y="19" width="3.6" height="8.5" rx="1.8" fill="#fff" transform="rotate(18 35.8 23.25)" />
          <rect x="40" y="20" width="3.6" height="8.5" rx="1.8" fill="#fff" transform="rotate(18 41.8 24.25)" />
        </g>
      </g>
      <g className="pair-loader__blob pair-loader__blob--partner">
        <circle cx="86" cy="30" r="17" fill="var(--c-partner)" />
        <g className="pair-loader__eyes">
          <rect x="86" y="19" width="3.6" height="8.5" rx="1.8" fill="#fff" transform="rotate(18 87.8 23.25)" />
          <rect x="92" y="20" width="3.6" height="8.5" rx="1.8" fill="#fff" transform="rotate(18 93.8 24.25)" />
        </g>
      </g>
    </svg>
  );
}
