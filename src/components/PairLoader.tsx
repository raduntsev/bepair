/*
  The loading pair: the two halves of the pair mark as two round characters,
  indigo for you and amber for your partner, glints for eyes. Ten seconds of
  a small scene rather than a spinner, each with a temper of their own —
  indigo is curious and bouncy, amber calmer and a little shy:

  breathe and glance → indigo hops over and nudges amber, both squint happily
  → they look up together, amber sways → both shrink into «typing…» dots and
  a wave rolls through twice → they pop back, wide-eyed → indigo jumps twice
  for joy, amber watches and answers with one big jump → a blink in unison.

  Every layer is its own <g> so motions add up without fighting: position
  (hops), body (squash, stretch, sway), look (where the eyes point), and the
  eyes themselves (blink, surprise, or the happy ^ ^). All CSS keyframes under
  `.pair-loader` in globals.css; reduced motion freezes the calm last pose.
*/
function Character({ who, cx }: { who: 'you' | 'partner'; cx: number }) {
  const fill = who === 'you' ? 'var(--c-accent)' : 'var(--c-partner)';
  const ex = cx + 1.8;
  return (
    <g className={`pair-loader__pos pair-loader__pos--${who}`}>
      <g className={`pair-loader__body pair-loader__body--${who}`}>
        <circle cx={cx} cy="30" r="17" fill={fill} />
        <g className={`pair-loader__look pair-loader__look--${who}`}>
          <g className={`pair-loader__eyes pair-loader__eyes--${who}`}>
            <rect x={ex - 1.8} y="19" width="3.6" height="8.5" rx="1.8" fill="#fff" transform={`rotate(18 ${ex} 23.25)`} />
            <rect x={ex + 4.2} y="20" width="3.6" height="8.5" rx="1.8" fill="#fff" transform={`rotate(18 ${ex + 6} 24.25)`} />
          </g>
          <g className={`pair-loader__happy pair-loader__happy--${who}`} fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round">
            <path d={`M${ex - 3} 25 Q${ex - 0.6} 21.2 ${ex + 1.8} 25`} />
            <path d={`M${ex + 4.6} 25 Q${ex + 7} 21.2 ${ex + 9.4} 25`} />
          </g>
        </g>
      </g>
    </g>
  );
}

export function PairLoader({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 60" className={`pair-loader ${className}`} aria-hidden focusable="false">
      <circle className="pair-loader__mid" cx="60" cy="30" r="5" fill="var(--c-ink-faint)" />
      <Character who="you" cx={34} />
      <Character who="partner" cx={86} />
    </svg>
  );
}
